import { getActiveCard, updateSessionTasks } from '../utils/session.js';
import { TrelloMCPClient } from './trello-client.js';
import { TodoTask } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Simple auto-sync service for TodoWrite-Trello integration
 */
export class SimpleAutoSyncService {
  /**
   * Sync tasks from TodoWrite to active Trello card
   */
  async syncTasks(tasks: TodoTask[]): Promise<{ success: boolean; message: string; completed?: number; total?: number; error?: string }> {
    try {
      const { cardId, cardName } = getActiveCard();
      if (!cardId) {
        logger.info('No active Trello card - skipping auto-sync');
        return { success: true, message: 'No active card' };
      }

      logger.info(`🔄 Auto-syncing ${tasks.length} tasks to Trello card: ${cardName}`);

      // Update local session first
      updateSessionTasks(tasks);

      // Connect to Trello and sync
      const client = new TrelloMCPClient();
      await client.connect();

      // Update card description with task status
      const card = await client.getCard(cardId);
      const updatedDescription = this.generateUpdatedDescription(card.desc || '', tasks);
      await client.updateCard(cardId, undefined, updatedDescription);

      // Update checklists to match TodoWrite task status
      await this.syncChecklistsWithTodoWrite(client, cardId, tasks);

      // Add progress comment for milestones
      const completed = tasks.filter(t => t.status === 'completed').length;
      if (completed > 0 && (completed % 2 === 0 || completed === tasks.length)) {
        await client.addComment(cardId, `🎯 **Auto-sync Progress:** ${completed}/${tasks.length} tasks completed ✨`);
      }

      logger.success(`✅ Auto-sync completed successfully`);

      return {
        success: true,
        message: `Synced ${tasks.length} tasks to Trello`,
        completed: completed,
        total: tasks.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Auto-sync failed:', error);
      return {
        success: false,
        error: errorMessage,
        message: `Auto-sync failed: ${errorMessage}`
      };
    }
  }

  /**
   * Generate updated card description with current task status
   */
  private generateUpdatedDescription(originalDescription: string, tasks: TodoTask[]): string {
    const lines = originalDescription.split('\n');
    const updatedLines: string[] = [];
    let inTaskSection = false;
    let taskSectionFound = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if this is a task line (including status emojis)
      if (trimmed.match(/^[-*•]\s+[✅⚙️📋]?\s*(.+)/) || trimmed.match(/^\[[ x]\]\s+(.+)/)) {
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
        for (const task of tasks) {
          const statusIcon = this.getStatusIcon(task.status);
          const cleanContent = task.content.replace(/^[✅⚙️📋]\s*/, ''); // Remove any existing icons
          updatedLines.push(`- ${statusIcon} ${cleanContent}`);
        }

        updatedLines.push(line);
      } else {
        updatedLines.push(line);
      }
    }

    // If no task section was found, add tasks at the end
    if (!taskSectionFound && tasks.length > 0) {
      updatedLines.push('');
      updatedLines.push('## Current Tasks');
      for (const task of tasks) {
        const statusIcon = this.getStatusIcon(task.status);
        const cleanContent = task.content.replace(/^[✅⚙️📋]\s*/, '');
        updatedLines.push(`- ${statusIcon} ${cleanContent}`);
      }
    }

    return updatedLines.join('\n');
  }

  /**
   * Sync Trello checklists with TodoWrite task status
   */
  private async syncChecklistsWithTodoWrite(client: TrelloMCPClient, cardId: string, todoWriteTasks: TodoTask[]): Promise<void> {
    try {
      const checklists = await client.getCardChecklists(cardId);

      if (checklists.length === 0) {
        logger.warn('No checklists found on card - skipping checklist sync');
        return;
      }

      let updatedCount = 0;

      for (const checklist of checklists) {
        const checkItems = checklist.checkItems || [];

        // For each TodoWrite task, find matching checklist item and update it
        for (const todoTask of todoWriteTasks) {
          const matchingItem = this.findMatchingChecklistItem(checkItems, todoTask.content);

          if (matchingItem) {
            const shouldBeCompleted = todoTask.status === 'completed';
            const isCurrentlyCompleted = matchingItem.state === 'complete';

            if (shouldBeCompleted !== isCurrentlyCompleted) {
              await client.updateChecklistItem(cardId, matchingItem.id, shouldBeCompleted);
              logger.info(`Updated checklist: "${matchingItem.name}" -> ${shouldBeCompleted ? 'completed' : 'pending'}`);
              updatedCount++;
            }
          } else {
            logger.warn(`Could not find matching checklist item for: "${todoTask.content}"`);
          }
        }
      }

      if (updatedCount > 0) {
        logger.success(`Updated ${updatedCount} checklist items to match TodoWrite status`);
      } else {
        logger.info('All checklist items already match TodoWrite status');
      }

    } catch (error) {
      logger.error('Failed to sync checklists with TodoWrite:', error);
    }
  }

  /**
   * Find matching checklist item for TodoWrite task
   */
  private findMatchingChecklistItem(checkItems: any[], todoTaskContent: string): any | null {
    const cleanTodoContent = this.cleanTaskContent(todoTaskContent);

    // Try exact match first
    let match = checkItems.find(item => {
      const cleanItemName = this.cleanTaskContent(item.name);
      return cleanItemName === cleanTodoContent;
    });

    if (match) return match;

    // Try fuzzy match
    match = checkItems.find(item => {
      const cleanItemName = this.cleanTaskContent(item.name);
      return cleanItemName.includes(cleanTodoContent) || cleanTodoContent.includes(cleanItemName);
    });

    if (match) return match;

    // Try keyword match
    const todoKeywords = cleanTodoContent.split(' ').filter(w => w.length > 3);
    match = checkItems.find(item => {
      const cleanItemName = this.cleanTaskContent(item.name);
      return todoKeywords.some(keyword => cleanItemName.includes(keyword));
    });

    return match || null;
  }

  /**
   * Clean task content for comparison
   */
  private cleanTaskContent(content: string): string {
    return content
      .replace(/^[✅⚙️📋]\s*/, '') // Remove status icons
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Get status icon for task
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '⚙️';
      default: return '📋';
    }
  }
}