#!/usr/bin/env node

import { RaveHubTrelloIntegration } from './index.js';
import { TrelloMCPClient } from './services/trello-client.js';
import { TodoTask } from './types/index.js';
import { logger } from './utils/logger.js';
import { loadSession, saveSession, clearSession, setActiveCard, getActiveCard } from './utils/session.js';

/**
 * Slash Command Handlers for Claude Code Integration
 * Provides seamless TodoWrite ↔ Trello workflow commands
 */

/**
 * /trello-create - Create Trello card from current TodoWrite plan
 */
export async function createCardFromPlan(planText?: string): Promise<string> {
  try {
    logger.info('Creating Trello card from TodoWrite plan...');

    const integration = new RaveHubTrelloIntegration();
    await integration.initialize();

    const client = new TrelloMCPClient();
    await client.connect();

    // If no plan text provided, use a template
    const cardTitle = extractTitleFromPlan(planText) || 'Development Task';
    const cardDescription = formatPlanAsDescription(planText);

    // Create the card in TODO list
    const card = await client.createCard(cardTitle, cardDescription);

    // Parse tasks from plan for checklist
    const tasks = extractTasksFromPlan(planText || '');

    // Create checklist if we have tasks
    if (tasks.length > 0) {
      const taskNames = tasks.map(task => task.content);
      await client.createChecklist(card.id, 'Development Tasks', taskNames);
    }

    // Add relevant labels
    await addRelevantLabels(client, card.id, cardTitle, planText || '');

    // Store in persistent session for future reference
    setActiveCard(card.id, card.name, tasks);

    logger.success('Trello card created successfully!');

    return `✅ **Trello Card Created**

**Card:** [${card.name}](${card.url})
**ID:** ${card.id}
**List:** TODO 📚

✨ **Enhanced features:**
- ☑️ Checklist created with ${tasks.length} development tasks
- 🏷️ Relevant labels automatically applied
- 🔗 Linked to your current session

**Next steps:**
- \`/trello-pickup ${card.id}\` to work on this card (moves to DOING)
- \`/trello-update\` to sync TodoWrite progress to checklist
- \`/trello-complete\` when all work is finished`;

  } catch (error) {
    logger.error('Failed to create Trello card:', error);
    return `❌ Failed to create Trello card: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * /trello-pickup - Load existing Trello card into TodoWrite session
 */
export async function pickupCard(cardIdentifier: string): Promise<string> {
  try {
    logger.info(`Picking up Trello card: ${cardIdentifier}`);

    const client = new TrelloMCPClient();
    await client.connect();

    // Search for card by name or use ID directly
    let card;
    if (cardIdentifier.length === 24) {
      // Looks like a Trello ID
      try {
        card = await client.getCard(cardIdentifier);
      } catch {
        // Fallback to search
        const searchResults = await client.searchCards(cardIdentifier);
        card = searchResults[0];
      }
    } else {
      // Search by name
      const searchResults = await client.searchCards(cardIdentifier);
      if (searchResults.length === 0) {
        return `❌ No card found matching: "${cardIdentifier}"`;
      }
      if (searchResults.length > 1) {
        const cardList = searchResults.slice(0, 5)
          .map(c => `- [${c.name}](${c.url}) (${c.id})`)
          .join('\n');
        return `🔍 Multiple cards found. Please be more specific or use card ID:

${cardList}

Use: \`/trello-pickup <card-id>\` with the specific ID`;
      }
      card = searchResults[0];
    }

    if (!card) {
      return `❌ Card not found: "${cardIdentifier}"`;
    }

    // Move card to In Progress list when picked up
    const inProgressListId = await client.getListId('inProgress');
    if (inProgressListId && card.idList !== inProgressListId) {
      await client.moveCard(card.id, inProgressListId);
      await client.addComment(card.id, '🚀 **Card picked up for active work**\n\n*Moved to In Progress via Claude Code*');
    }

    // Extract tasks from card description (if formatted properly)
    const tasks = parseTasksFromDescription(card.desc || '');

    // Store in persistent session
    setActiveCard(card.id, card.name, tasks);

    logger.success('Card picked up and moved to In Progress!');

    const taskList = tasks.length > 0
      ? `\n\n**Extracted Tasks:**\n${tasks.map(t => `- ${t.content} (${t.status})`).join('\n')}`
      : '\n\n*No structured tasks found in card description*';

    const currentListName = inProgressListId && card.idList !== inProgressListId ? 'DOING ⚙️' : await getCurrentListName(client, card);
    const moveMessage = inProgressListId && card.idList !== inProgressListId ? '\n🚀 **Automatically moved to DOING column**' : '';

    return `🎯 **Picked up Trello Card**

**Card:** [${card.name}](${card.url})
**Current List:** ${currentListName}${moveMessage}
**Description:** ${card.desc || '*No description*'}${taskList}

🔗 This card is now your active work item. Use:
- Update your TodoWrite tasks and they'll sync to this card
- \`/trello-complete\` when all work is finished`;

  } catch (error) {
    logger.error('Failed to pickup card:', error);
    return `❌ Failed to pickup card: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * /trello-complete - Move current card to Done list
 */
export async function completeCard(completionNote?: string): Promise<string> {
  try {
    const { cardId, cardName } = getActiveCard();
    if (!cardId) {
      return `❌ No active Trello card in session. Use \`/trello-pickup <card>\` first.`;
    }

    logger.info('Completing current Trello card...');

    const client = new TrelloMCPClient();
    await client.connect();

    // Move card to Done list
    const doneListId = await client.getListId('done');
    if (!doneListId) {
      return `❌ Could not find "Done" list on board. Please check board structure.`;
    }

    await client.moveCard(cardId, doneListId);

    // Add completion comment
    const completionComment = `✅ **Task Completed**${completionNote ? `\n\n${completionNote}` : ''}

*Completed via Claude Code integration*`;

    await client.addComment(cardId, completionComment);

    // Clear persistent session
    clearSession();

    logger.success('Card completed successfully!');

    return `🎉 **Task Completed!**

**Card:** ${cardName}
**Status:** Moved to DONE! 🙌🏽
**Comment:** Added completion note

✨ Great work! The card is now marked as complete and the session has been cleared.`;

  } catch (error) {
    logger.error('Failed to complete card:', error);
    return `❌ Failed to complete card: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * /trello-update - Update current card with TodoWrite progress
 */
export async function updateCard(updateNote?: string): Promise<string> {
  try {
    const { cardId, cardName, tasks } = getActiveCard();
    if (!cardId) {
      return `❌ No active Trello card in session. Use \`/trello-pickup <card>\` first.`;
    }

    logger.info('Updating current Trello card with progress...');

    const client = new TrelloMCPClient();
    await client.connect();

    const card = await client.getCard(cardId);

    // Update card description with current TodoWrite tasks
    const updatedDescription = generateUpdatedDescription(card.desc || '', tasks || []);
    await client.updateCard(cardId, undefined, updatedDescription);

    // Update checklists with current task status
    await syncTasksToChecklists(client, cardId, tasks || []);

    // Add progress comment
    const progressSummary = generateProgressSummary(tasks || []);
    const progressComment = `📋 **Progress Update**${updateNote ? `\n\n${updateNote}` : ''}

${progressSummary}

*Updated via Claude Code TodoWrite sync*`;

    await client.addComment(cardId, progressComment);

    logger.success('Card updated with current progress!');

    return `📋 **Card Updated Successfully**

**Card:** [${cardName}](${card.url})
**Progress:** ${progressSummary}

🔄 **What was synced:**
- ☑️ Checklist items updated with TodoWrite task status
- 📝 Card description refreshed with current progress
- 💬 Progress comment added with completion summary
- ⏰ Card timestamp updated for activity tracking

Use \`/trello-status\` to view updated card details or \`/trello-complete\` when finished.`;

  } catch (error) {
    logger.error('Failed to update card:', error);
    return `❌ Failed to update card: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * /trello-status - Show current session status and active card
 */
export async function showStatus(): Promise<string> {
  try {
    const { cardId, cardName } = getActiveCard();
    if (!cardId) {
      return `📋 **Trello Session Status**

**Active Card:** None
**Status:** No card currently linked to session

Use \`/trello-create\` to create a card from your current plan, or \`/trello-pickup <card>\` to work on an existing card.`;
    }

    const client = new TrelloMCPClient();
    await client.connect();

    const card = await client.getCard(cardId);
    const currentList = await getCurrentListName(client, card);

    return `📋 **Trello Session Status**

**Active Card:** [${card.name}](${card.url})
**Current List:** ${currentList}
**Card ID:** ${card.id}
**Last Modified:** ${new Date(card.dateLastActivity).toLocaleString()}

**Available Commands:**
- \`/trello-complete\` - Move card to Done
- \`/trello-pickup <other-card>\` - Switch to different card

**Description:**
${card.desc || '*No description*'}`;

  } catch (error) {
    logger.error('Failed to get status:', error);
    return `❌ Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Helper functions

function extractTasksFromPlan(planText: string): TodoTask[] {
  const tasks: TodoTask[] = [];
  const lines = planText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for task-like patterns in the plan text
    if (trimmed.match(/^[-*•]\s+(.+)/) ||
        trimmed.match(/^\[[ x]\]\s+(.+)/) ||
        trimmed.match(/^[0-9]+\.\s+(.+)/)) {

      let taskText = trimmed.replace(/^[-*•\[\] x0-9\.]+\s*/, '');

      // Remove status emojis if present
      taskText = taskText.replace(/^[✅⚙️📋]\s*/, '');

      // Determine status from emojis or checkboxes
      const isCompleted = trimmed.includes('[x]') || trimmed.includes('✅');
      const isInProgress = trimmed.includes('⚙️') || trimmed.toLowerCase().includes('in progress');

      const status = isCompleted ? 'completed' : isInProgress ? 'in_progress' : 'pending';

      tasks.push({
        content: taskText,
        status: status,
        activeForm: `Working on ${taskText}`,
      });
    }
  }

  return tasks;
}

async function addRelevantLabels(client: TrelloMCPClient, cardId: string, title: string, content: string): Promise<void> {
  try {
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    // Define label mapping based on keywords
    const labelMappings = [
      { keywords: ['bug', 'fix', 'error', 'issue'], name: 'Bug', color: 'red' },
      { keywords: ['feature', 'enhancement', 'new'], name: 'Feature', color: 'green' },
      { keywords: ['refactor', 'cleanup', 'optimization'], name: 'Refactoring', color: 'yellow' },
      { keywords: ['test', 'testing', 'spec'], name: 'Testing', color: 'purple' },
      { keywords: ['doc', 'documentation', 'readme'], name: 'Documentation', color: 'blue' },
      { keywords: ['api', 'endpoint', 'service'], name: 'API', color: 'orange' },
      { keywords: ['ui', 'frontend', 'component'], name: 'Frontend', color: 'pink' },
      { keywords: ['backend', 'database', 'server'], name: 'Backend', color: 'lime' },
    ];

    const labelsToAdd = [];

    for (const mapping of labelMappings) {
      const hasKeyword = mapping.keywords.some(keyword =>
        titleLower.includes(keyword) || contentLower.includes(keyword)
      );

      if (hasKeyword) {
        try {
          const labelId = await client.ensureLabel(mapping.name, mapping.color);
          labelsToAdd.push(labelId);
        } catch (error) {
          logger.warn(`Failed to create/find label ${mapping.name}:`, error);
        }
      }
    }

    // Add labels to card
    for (const labelId of labelsToAdd) {
      try {
        await client.addLabelToCard(cardId, labelId);
      } catch (error) {
        logger.warn(`Failed to add label to card:`, error);
      }
    }

    if (labelsToAdd.length > 0) {
      logger.info(`Added ${labelsToAdd.length} relevant labels to card`);
    }
  } catch (error) {
    logger.warn('Failed to add labels:', error);
  }
}

async function syncTasksToChecklists(client: TrelloMCPClient, cardId: string, tasks: TodoTask[]): Promise<void> {
  try {
    const checklists = await client.getCardChecklists(cardId);

    if (checklists.length === 0) {
      // No checklists exist, create one if we have tasks
      if (tasks.length > 0) {
        const taskNames = tasks.map(task => task.content);
        await client.createChecklist(cardId, 'Development Tasks', taskNames);
      }
      return;
    }

    // Update existing checklists
    for (const checklist of checklists) {
      const checkItems = checklist.checkItems || [];

      for (const task of tasks) {
        // Find matching checklist item
        const matchingItem = checkItems.find((item: any) =>
          item.name.includes(task.content) || task.content.includes(item.name)
        );

        if (matchingItem) {
          const shouldBeCompleted = task.status === 'completed';
          const isCurrentlyCompleted = matchingItem.state === 'complete';

          if (shouldBeCompleted !== isCurrentlyCompleted) {
            await client.updateChecklistItem(checklist.id, matchingItem.id, shouldBeCompleted);
          }
        }
      }
    }

    logger.info('Synced task status to checklists');
  } catch (error) {
    logger.warn('Failed to sync checklists:', error);
  }
}

function extractTitleFromPlan(planText?: string): string {
  if (!planText) return 'Development Task';

  // Look for first line that looks like a title
  const lines = planText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 100 && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      return trimmed.replace(/^#+\s*/, ''); // Remove markdown headers
    }
  }

  return 'Development Task';
}

function formatPlanAsDescription(planText?: string): string {
  if (!planText) {
    return `## Development Task

*Created from Claude Code TodoWrite plan*

### Tasks
- Task planning in progress...

---
*Use /trello-pickup to resume work on this card*`;
  }

  return `## Development Plan

${planText}

---
*Created from Claude Code TodoWrite plan*
*Use /trello-pickup ${Date.now()} to resume work on this card*`;
}

function parseTasksFromDescription(description: string): TodoTask[] {
  const tasks: TodoTask[] = [];
  const lines = description.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for task-like patterns: - Task, * Task, [ ] Task, etc.
    if (trimmed.match(/^[-*•]\s+(.+)/) || trimmed.match(/^\[[ x]\]\s+(.+)/)) {
      const taskText = trimmed.replace(/^[-*•\[\] x]+\s*/, '');
      const isCompleted = trimmed.includes('[x]') || trimmed.includes('✅');

      tasks.push({
        content: taskText,
        status: isCompleted ? 'completed' : 'pending',
        activeForm: `Working on ${taskText}`,
      });
    }
  }

  return tasks;
}

function generateUpdatedDescription(originalDescription: string, currentTasks: TodoTask[]): string {
  // Find the task section in the original description
  const lines = originalDescription.split('\n');
  const updatedLines: string[] = [];
  let inTaskSection = false;
  let taskSectionFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a task line
    if (trimmed.match(/^[-*•]\s+(.+)/) || trimmed.match(/^\[[ x]\]\s+(.+)/)) {
      if (!inTaskSection) {
        inTaskSection = true;
        taskSectionFound = true;
      }
      // Skip original task lines - we'll replace them
      continue;
    } else if (inTaskSection && (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('---'))) {
      // End of task section
      inTaskSection = false;

      // Insert updated tasks here
      for (const task of currentTasks) {
        const statusIcon = task.status === 'completed' ? '✅' :
                         task.status === 'in_progress' ? '⚙️' : '📋';
        updatedLines.push(`- ${statusIcon} ${task.content}`);
      }

      updatedLines.push(line);
    } else {
      updatedLines.push(line);
    }
  }

  // If no task section was found, add tasks at the end
  if (!taskSectionFound && currentTasks.length > 0) {
    updatedLines.push('');
    updatedLines.push('## Current Tasks');
    for (const task of currentTasks) {
      const statusIcon = task.status === 'completed' ? '✅' :
                       task.status === 'in_progress' ? '⚙️' : '📋';
      updatedLines.push(`- ${statusIcon} ${task.content}`);
    }
  }

  return updatedLines.join('\n');
}

function generateProgressSummary(tasks: TodoTask[]): string {
  if (tasks.length === 0) {
    return '📋 No tasks currently tracked';
  }

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  const summary = `**Progress:** ${completed}/${tasks.length} completed`;
  const breakdown = [];

  if (completed > 0) breakdown.push(`✅ ${completed} done`);
  if (inProgress > 0) breakdown.push(`⚙️ ${inProgress} in progress`);
  if (pending > 0) breakdown.push(`📋 ${pending} pending`);

  return breakdown.length > 0 ? `${summary} (${breakdown.join(', ')})` : summary;
}

async function getCurrentListName(client: TrelloMCPClient, card: any): Promise<string> {
  try {
    const lists = await client.getLists();
    const currentList = lists.find(list => list.id === card.idList);
    return currentList?.name || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// CLI interface for testing
if (process.argv[1]?.endsWith('slash-commands.js') || process.argv[1]?.endsWith('slash-commands.ts')) {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'create':
      createCardFromPlan(arg).then(console.log);
      break;
    case 'pickup':
      if (!arg) {
        console.log('Usage: npm run slash pickup <card-id-or-name>');
        process.exit(1);
      }
      pickupCard(arg).then(console.log);
      break;
    case 'complete':
      completeCard(arg).then(console.log);
      break;
    case 'status':
      showStatus().then(console.log);
      break;
    case 'update':
      updateCard(arg).then(console.log);
      break;
    default:
      console.log(`Available commands: create, pickup, complete, status, update`);
  }
}