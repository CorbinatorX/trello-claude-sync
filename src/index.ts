#!/usr/bin/env node

import { TodoTrelloSync } from './services/todo-sync.js';
import { TrelloMCPClient } from './services/trello-client.js';
import { TodoTask } from './types/index.js';
import { logger } from './utils/logger.js';
import { getConfig } from './utils/config.js';

/**
 * RaveHub Trello Integration CLI
 * Autonomous development workflow tool for syncing TodoWrite tasks with Trello
 */

export class RaveHubTrelloIntegration {
  private syncService: TodoTrelloSync;
  private mcpServerPath?: string;

  constructor(mcpServerPath?: string) {
    this.syncService = new TodoTrelloSync();
    this.mcpServerPath = mcpServerPath;
  }

  /**
   * Initialize the integration service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing RaveHub Trello Integration...');

      // Validate configuration
      const config = getConfig();
      logger.info('Configuration loaded', {
        boardId: config.boardId,
        hasListIds: Object.keys(config.listIds || {}).length > 0,
      });

      await this.syncService.initialize(this.mcpServerPath);

      logger.success('RaveHub Trello Integration ready!');
    } catch (error) {
      logger.error('Failed to initialize integration', error);
      throw error;
    }
  }

  /**
   * Sync TodoWrite tasks to Trello
   */
  async syncTasks(tasks: TodoTask[]): Promise<void> {
    try {
      logger.info(`Starting sync of ${tasks.length} tasks`);

      // First try to link existing cards
      await this.syncService.linkExistingCards(tasks);

      // Sync all tasks
      const results = await this.syncService.syncTasks(tasks, {
        createMissingLists: false,
        syncOnlyActiveSession: true,
        addLabels: false,
        includeTimestamps: true,
      });

      // Report results
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      logger.success(`Sync completed: ${successful.length} successful, ${failed.length} failed`);

      if (failed.length > 0) {
        logger.warn('Failed tasks:', failed.map(f => f.error));
      }

      const summary = this.syncService.getSyncSummary();
      logger.info('Session summary', summary);

    } catch (error) {
      logger.error('Sync operation failed', error);
      throw error;
    }
  }

  /**
   * Test connection to Trello board
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = new TrelloMCPClient();
      await client.connect();

      const isHealthy = await client.healthCheck();

      if (isHealthy) {
        const board = await client.getBoard();
        const lists = await client.getLists();

        logger.success('Connection test passed', {
          boardName: board.name,
          boardUrl: board.url,
          listsCount: lists.length,
          lists: lists.map(l => ({ id: l.id, name: l.name })),
        });
      } else {
        logger.error('Health check failed');
      }

      // No disconnect needed for REST API client
      return isHealthy;

    } catch (error) {
      logger.error('Connection test failed', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.syncService.cleanup();
    logger.info('Integration service cleaned up');
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const integration = new RaveHubTrelloIntegration();

  try {
    switch (command) {
      case 'test':
        logger.info('Testing Trello connection...');
        await integration.initialize();
        const isHealthy = await integration.testConnection();
        process.exit(isHealthy ? 0 : 1);
        break;

      case 'sync':
        // Example tasks for testing
        const sampleTasks: TodoTask[] = [
          {
            content: 'Test Trello integration with sample task',
            status: 'pending',
            activeForm: 'Testing Trello integration with sample task',
          },
          {
            content: 'Verify card creation and movement',
            status: 'in_progress',
            activeForm: 'Verifying card creation and movement',
          },
        ];

        await integration.initialize();
        await integration.syncTasks(sampleTasks);
        break;

      case 'info':
        const config = getConfig();
        console.log('\\nRaveHub Trello Integration Configuration:');
        console.log(`Board ID: ${config.boardId}`);
        console.log(`List IDs:`, config.listIds);
        break;

      default:
        console.log(`
RaveHub Trello Integration CLI

Usage:
  npm start test     - Test connection to Trello board
  npm start sync     - Sync sample tasks (for testing)
  npm start info     - Show configuration info

Environment Setup:
  1. Copy .env.example to .env
  2. Fill in your Trello API credentials
  3. Install kocakli/Trello-Desktop-MCP server
  4. Update Claude Desktop config

For detailed setup instructions, see README.md
        `);
        break;
    }
  } catch (error) {
    logger.error('CLI command failed', error);
    process.exit(1);
  } finally {
    await integration.cleanup();
  }
}

// Export for programmatic use
export { TodoTrelloSync, TrelloMCPClient };
export * from './types/index.js';

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error', error);
    process.exit(1);
  });
}