import { config as dotenvConfig } from 'dotenv';
import { TrelloConfig } from '../types/index.js';

// Load environment variables
dotenvConfig();

export class ConfigManager {
  private static instance: ConfigManager;
  private config: TrelloConfig;

  private constructor() {
    this.validateEnvironment();
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private validateEnvironment(): void {
    const required = ['TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_BOARD_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease copy .env.example to .env and fill in your Trello credentials.`);
    }
  }

  private loadConfig(): TrelloConfig {
    return {
      apiKey: process.env.TRELLO_API_KEY!,
      token: process.env.TRELLO_TOKEN!,
      boardId: process.env.TRELLO_BOARD_ID!,
      listIds: {
        todo: process.env.TRELLO_LIST_TODO,
        inProgress: process.env.TRELLO_LIST_IN_PROGRESS,
        review: process.env.TRELLO_LIST_REVIEW,
        done: process.env.TRELLO_LIST_DONE,
      }
    };
  }

  getConfig(): TrelloConfig {
    return { ...this.config };
  }

  updateListIds(listIds: Partial<TrelloConfig['listIds']>): void {
    this.config.listIds = { ...this.config.listIds, ...listIds };
  }
}

export const getConfig = (): TrelloConfig => {
  return ConfigManager.getInstance().getConfig();
};