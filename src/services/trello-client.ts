import { TrelloConfig, TrelloCard, TrelloList, TrelloBoard, SyncResult } from '../types/index.js';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export class TrelloMCPClient {
  private config: TrelloConfig;
  private baseUrl = 'https://api.trello.com/1';
  private listIds: Record<string, string> = {};

  constructor() {
    this.config = getConfig();
  }

  /**
   * Initialize connection to Trello API
   */
  async connect(): Promise<void> {
    try {
      logger.info('Testing Trello API connection...');

      // Test connection by fetching user info
      const response = await this.makeRequest('/members/me');
      if (response.username) {
        logger.info(`Connected to Trello as: ${response.username}`);
      }

      // Auto-discover list IDs
      await this.autoDiscoverLists();
    } catch (error) {
      logger.error('Failed to connect to Trello API:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to Trello API
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}?key=${this.config.apiKey}&token=${this.config.token}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Trello API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get board information
   */
  async getBoard(boardId?: string): Promise<TrelloBoard> {
    const id = boardId || this.config.boardId;
    return this.makeRequest(`/boards/${id}`);
  }

  /**
   * Get lists from board
   */
  async getLists(boardId?: string): Promise<TrelloList[]> {
    const id = boardId || this.config.boardId;
    return this.makeRequest(`/boards/${id}/lists`);
  }

  /**
   * Create a new card
   */
  async createCard(name: string, description?: string, listId?: string): Promise<TrelloCard> {
    const targetListId = listId || this.listIds.todo || this.config.listIds?.todo;

    if (!targetListId) {
      throw new Error('No target list ID specified and no default todo list configured');
    }

    const cardData = {
      name,
      desc: description || '',
      idList: targetListId,
    };

    return this.makeRequest('/cards', 'POST', cardData);
  }

  /**
   * Update card
   */
  async updateCard(cardId: string, name?: string, description?: string): Promise<TrelloCard> {
    const updates: any = {};
    if (name) updates.name = name;
    if (description) updates.desc = description;

    return this.makeRequest(`/cards/${cardId}`, 'PUT', updates);
  }

  /**
   * Move card to different list
   */
  async moveCard(cardId: string, targetListId: string): Promise<TrelloCard> {
    return this.makeRequest(`/cards/${cardId}`, 'PUT', { idList: targetListId });
  }

  /**
   * Add comment to card
   */
  async addComment(cardId: string, comment: string): Promise<void> {
    await this.makeRequest(`/cards/${cardId}/actions/comments`, 'POST', { text: comment });
  }

  /**
   * Search for cards by name
   */
  async searchCards(query: string): Promise<TrelloCard[]> {
    const boardId = this.config.boardId;
    const result = await this.makeRequest(`/search?query=${encodeURIComponent(query)}&idBoards=${boardId}&modelTypes=cards&card_fields=all`);
    return result.cards || [];
  }

  /**
   * Get all cards from a list
   */
  async getCardsFromList(listId: string): Promise<TrelloCard[]> {
    return this.makeRequest(`/lists/${listId}/cards`);
  }

  /**
   * Auto-discover and cache list IDs from board
   */
  async autoDiscoverLists(): Promise<void> {
    try {
      const lists = await this.getLists();

      // Try to match common list names
      const nameMatches = {
        todo: ['to do', 'todo', 'backlog', 'planned'],
        inProgress: ['in progress', 'doing', 'active', 'current'],
        review: ['review', 'testing', 'qa', 'pending review'],
        done: ['done', 'completed', 'finished', 'closed']
      };

      for (const list of lists) {
        const listName = list.name.toLowerCase();

        for (const [key, patterns] of Object.entries(nameMatches)) {
          if (patterns.some(pattern => listName.includes(pattern))) {
            this.listIds[key] = list.id;
            break;
          }
        }
      }

      logger.info('Auto-discovered list IDs:', this.listIds);
    } catch (error) {
      logger.error('Failed to auto-discover list IDs:', error);
    }
  }

  /**
   * Get a specific card by ID
   */
  async getCard(cardId: string): Promise<TrelloCard> {
    return this.makeRequest(`/cards/${cardId}`);
  }

  /**
   * Get list ID by name/type
   */
  async getListId(listType: 'todo' | 'inProgress' | 'review' | 'done'): Promise<string | null> {
    return this.listIds[listType] || null;
  }


  /**
   * Get board labels
   */
  async getBoardLabels(): Promise<any[]> {
    const boardId = this.config.boardId;
    return this.makeRequest(`/boards/${boardId}/labels`);
  }

  /**
   * Add label to card
   */
  async addLabelToCard(cardId: string, labelId: string): Promise<void> {
    await this.makeRequest(`/cards/${cardId}/idLabels`, 'POST', {
      value: labelId,
    });
  }

  /**
   * Create or find label by name and color
   */
  async ensureLabel(name: string, color: string): Promise<string> {
    const labels = await this.getBoardLabels();

    // Check if label already exists
    const existingLabel = labels.find(label =>
      label.name.toLowerCase() === name.toLowerCase()
    );

    if (existingLabel) {
      return existingLabel.id;
    }

    // Create new label
    const newLabel = await this.makeRequest('/labels', 'POST', {
      name,
      color,
      idBoard: this.config.boardId,
    });

    return newLabel.id;
  }

  /**
   * Health check - verify connection and board access
   */
  async healthCheck(): Promise<boolean> {
    try {
      const board = await this.getBoard();
      logger.info(`Health check passed - Board: ${board.name}`);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Health check failed:', { message: error.message, stack: error.stack });
      } else {
        logger.error('Health check failed:', error);
      }
      return false;
    }
  }
}