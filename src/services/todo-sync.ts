import { TrelloMCPClient } from './trello-client.js';
import { TodoTask, SyncResult, SyncOptions, TrelloCard } from '../types/index.js';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export class TodoTrelloSync {
  private trelloClient: TrelloMCPClient;
  private config: ReturnType<typeof getConfig>;
  private sessionTaskCards: Map<string, string> = new Map(); // task content -> card ID

  constructor() {
    this.trelloClient = new TrelloMCPClient();
    this.config = getConfig();
  }

  /**
   * Initialize sync service
   */
  async initialize(mcpServerPath?: string): Promise<void> {
    await this.trelloClient.connect();
    await this.trelloClient.autoDiscoverLists();

    // Verify board access
    if (!(await this.trelloClient.healthCheck())) {
      throw new Error('Failed to access Trello board. Check your configuration.');
    }

    logger.success('TodoTrelloSync initialized successfully');
  }

  /**
   * Clean up and disconnect
   */
  async cleanup(): Promise<void> {
    // No disconnect needed for REST API client
    this.sessionTaskCards.clear();
  }

  /**
   * Sync a single TodoWrite task to Trello
   */
  async syncTask(task: TodoTask, options: SyncOptions = {}): Promise<SyncResult> {
    try {
      logger.debug(`Syncing task: ${task.content}`, { task, options });

      const existingCardId = this.sessionTaskCards.get(task.content);

      if (existingCardId) {
        return await this.updateExistingCard(existingCardId, task, options);
      } else {
        return await this.createNewCard(task, options);
      }
    } catch (error) {
      logger.error(`Failed to sync task: ${task.content}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        action: 'skipped',
      };
    }
  }

  /**
   * Sync multiple TodoWrite tasks
   */
  async syncTasks(tasks: TodoTask[], options: SyncOptions = {}): Promise<SyncResult[]> {
    logger.info(`Syncing ${tasks.length} tasks to Trello`);

    const results: SyncResult[] = [];

    for (const task of tasks) {
      const result = await this.syncTask(task, options);
      results.push(result);

      // Add delay to avoid rate limiting
      if (results.length < tasks.length) {
        await this.delay(200);
      }
    }

    const successful = results.filter(r => r.success).length;
    logger.success(`Sync completed: ${successful}/${tasks.length} tasks synced successfully`);

    return results;
  }

  /**
   * Create a new Trello card from TodoWrite task
   */
  private async createNewCard(task: TodoTask, options: SyncOptions): Promise<SyncResult> {
    try {
      const listId = this.getTargetListId(task.status);

      if (!listId) {
        return {
          success: false,
          error: `No list configured for status: ${task.status}`,
          action: 'skipped',
        };
      }

      const description = this.buildCardDescription(task, options);

      const card = await this.trelloClient.createCard(
        task.content,
        description,
        listId
      );

      // Track this card for future updates
      this.sessionTaskCards.set(task.content, card.id);

      if (options.addLabels) {
        await this.addTaskStatusLabel(card.id, task.status);
      }

      logger.success(`Created Trello card: ${task.content}`, { cardId: card.id });

      return {
        success: true,
        cardId: card.id,
        action: 'created',
      };
    } catch (error) {
      logger.error(`Failed to create card for task: ${task.content}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        action: 'skipped',
      };
    }
  }

  /**
   * Update an existing Trello card
   */
  private async updateExistingCard(cardId: string, task: TodoTask, options: SyncOptions): Promise<SyncResult> {
    try {
      const targetListId = this.getTargetListId(task.status);

      if (!targetListId) {
        return {
          success: false,
          error: `No list configured for status: ${task.status}`,
          action: 'skipped',
        };
      }

      // Move card if status changed
      await this.trelloClient.moveCard(cardId, targetListId);

      // Update description if needed
      const description = this.buildCardDescription(task, options);
      await this.trelloClient.updateCard(cardId, undefined, description);

      // Add progress comment
      await this.trelloClient.addComment(
        cardId,
        `Status updated to: ${task.status} (${task.activeForm})`
      );

      logger.success(`Updated Trello card: ${task.content}`, { cardId });

      return {
        success: true,
        cardId,
        action: task.status === 'completed' ? 'moved' : 'updated',
      };
    } catch (error) {
      logger.error(`Failed to update card: ${cardId}`, error);
      return {
        success: false,
        cardId,
        error: error instanceof Error ? error.message : String(error),
        action: 'skipped',
      };
    }
  }

  /**
   * Get target list ID based on task status
   */
  private getTargetListId(status: TodoTask['status']): string | undefined {
    const { listIds } = this.config;

    switch (status) {
      case 'pending':
        return listIds?.todo;
      case 'in_progress':
        return listIds?.inProgress;
      case 'completed':
        return listIds?.done;
      default:
        return listIds?.todo;
    }
  }

  /**
   * Build card description with task details
   */
  private buildCardDescription(task: TodoTask, options: SyncOptions): string {
    let description = `**Task Status:** ${task.status}\\n`;
    description += `**Active Form:** ${task.activeForm}\\n\\n`;

    if (options.includeTimestamps) {
      description += `**Created:** ${new Date().toISOString()}\\n`;
    }

    description += `**Source:** TodoWrite Integration\\n`;
    description += `**Session:** Development Task\\n\\n`;

    description += `---\\n`;
    description += `*This card was automatically created from a TodoWrite task. Updates will be synced during development sessions.*`;

    return description;
  }

  /**
   * Add status label to card (if labels are supported)
   */
  private async addTaskStatusLabel(cardId: string, status: TodoTask['status']): Promise<void> {
    try {
      // This would require additional MCP tool for label management
      // For now, we'll skip label adding as it's not critical
      logger.debug(`Would add label for status: ${status} to card: ${cardId}`);
    } catch (error) {
      logger.warn('Failed to add status label', error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get sync summary for completed session
   */
  getSyncSummary(): { totalCards: number; cardIds: string[] } {
    return {
      totalCards: this.sessionTaskCards.size,
      cardIds: Array.from(this.sessionTaskCards.values()),
    };
  }

  /**
   * Manually add task-card mapping (for existing cards)
   */
  mapTaskToCard(taskContent: string, cardId: string): void {
    this.sessionTaskCards.set(taskContent, cardId);
    logger.debug(`Mapped task to existing card: ${taskContent} -> ${cardId}`);
  }

  /**
   * Search and link existing Trello cards to tasks
   */
  async linkExistingCards(tasks: TodoTask[]): Promise<void> {
    logger.info('Searching for existing Trello cards to link with tasks');

    for (const task of tasks) {
      try {
        // Search for cards with similar names
        const searchResults = await this.trelloClient.searchCards(task.content);

        // Find exact or close matches
        const matchingCard = searchResults.find(card =>
          card.name.toLowerCase() === task.content.toLowerCase() ||
          card.name.toLowerCase().includes(task.content.toLowerCase()) ||
          task.content.toLowerCase().includes(card.name.toLowerCase())
        );

        if (matchingCard) {
          this.mapTaskToCard(task.content, matchingCard.id);
          logger.success(`Linked task to existing card: ${task.content}`, {
            cardId: matchingCard.id,
            cardName: matchingCard.name,
          });
        }
      } catch (error) {
        logger.debug(`No existing card found for task: ${task.content}`);
      }
    }
  }
}