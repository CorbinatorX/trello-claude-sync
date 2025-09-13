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

      // No checklist sync - keeping it simple with description only

      // Add progress comment with current status
      const completed = tasks.filter(t => t.status === 'completed').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;

      let progressMessage = `📊 **Progress Update:** ${completed}/${tasks.length} completed`;
      if (inProgress > 0) {
        progressMessage += ` (${inProgress} in progress)`;
      }

      await client.addComment(cardId, progressMessage);

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