import { TodoTrelloSync } from '../services/todo-sync.js';
import { TrelloMCPClient } from '../services/trello-client.js';
import { TodoTask, TrelloCard, TrelloList } from '../types/index.js';

// Mock the TrelloMCPClient
jest.mock('../services/trello-client.js');

describe('TodoTrelloSync', () => {
  let syncService: TodoTrelloSync;
  let mockTrelloClient: jest.Mocked<TrelloMCPClient>;

  const mockCard: TrelloCard = {
    id: 'card_123',
    name: 'Test Task',
    desc: 'Test Description',
    idList: 'list_todo_123',
    url: 'https://trello.com/c/card123',
    shortUrl: 'https://trello.com/c/card123',
    dateLastActivity: '2024-01-01T00:00:00Z',
  };

  const mockLists: TrelloList[] = [
    { id: 'list_todo_123', name: 'To Do', pos: 1 },
    { id: 'list_progress_456', name: 'In Progress', pos: 2 },
    { id: 'list_done_012', name: 'Done', pos: 3 },
  ];

  beforeEach(() => {
    // Create mock instance
    mockTrelloClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      autoDiscoverLists: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue(true),
      getBoard: jest.fn().mockResolvedValue({
        id: 'board_123',
        name: 'Test Board',
        url: 'https://trello.com/b/board123',
        lists: mockLists,
      }),
      getLists: jest.fn().mockResolvedValue(mockLists),
      createCard: jest.fn().mockResolvedValue(mockCard),
      updateCard: jest.fn().mockResolvedValue(mockCard),
      moveCard: jest.fn().mockResolvedValue(mockCard),
      addComment: jest.fn().mockResolvedValue(undefined),
      searchCards: jest.fn().mockResolvedValue([mockCard]),
      getCardsFromList: jest.fn().mockResolvedValue([mockCard]),
    } as any;

    // Mock the constructor to return our mock
    (TrelloMCPClient as jest.MockedClass<typeof TrelloMCPClient>).mockImplementation(() => mockTrelloClient);

    syncService = new TodoTrelloSync();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await syncService.initialize();

      expect(mockTrelloClient.connect).toHaveBeenCalled();
      expect(mockTrelloClient.autoDiscoverLists).toHaveBeenCalled();
      expect(mockTrelloClient.healthCheck).toHaveBeenCalled();
    });

    it('should throw error if health check fails', async () => {
      mockTrelloClient.healthCheck.mockResolvedValueOnce(false);

      await expect(syncService.initialize()).rejects.toThrow('Failed to access Trello board');
    });
  });

  describe('syncTask', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should create new card for pending task', async () => {
      const task: TodoTask = {
        content: 'New test task',
        status: 'pending',
        activeForm: 'Creating new test task',
      };

      const result = await syncService.syncTask(task);

      expect(result.success).toBe(true);
      expect(result.action).toBe('created');
      expect(result.cardId).toBe(mockCard.id);
      expect(mockTrelloClient.createCard).toHaveBeenCalledWith(
        task.content,
        expect.stringContaining(task.status),
        'list_todo_123'
      );
    });

    it('should update existing card when task exists', async () => {
      const task: TodoTask = {
        content: 'Existing task',
        status: 'in_progress',
        activeForm: 'Working on existing task',
      };

      // First sync creates the card
      await syncService.syncTask(task);

      // Update the task status
      const updatedTask: TodoTask = {
        ...task,
        status: 'completed',
        activeForm: 'Completing existing task',
      };

      // Second sync should update the existing card
      const result = await syncService.syncTask(updatedTask);

      expect(result.success).toBe(true);
      expect(result.action).toBe('moved');
      expect(mockTrelloClient.moveCard).toHaveBeenCalledWith(mockCard.id, 'list_done_012');
    });

    it('should handle sync errors gracefully', async () => {
      const task: TodoTask = {
        content: 'Failing task',
        status: 'pending',
        activeForm: 'Creating failing task',
      };

      mockTrelloClient.createCard.mockRejectedValueOnce(new Error('API Error'));

      const result = await syncService.syncTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.action).toBe('skipped');
    });
  });

  describe('syncTasks', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should sync multiple tasks', async () => {
      const tasks: TodoTask[] = [
        {
          content: 'Task 1',
          status: 'pending',
          activeForm: 'Creating Task 1',
        },
        {
          content: 'Task 2',
          status: 'in_progress',
          activeForm: 'Working on Task 2',
        },
      ];

      mockTrelloClient.createCard
        .mockResolvedValueOnce({ ...mockCard, id: 'card_1', name: 'Task 1' })
        .mockResolvedValueOnce({ ...mockCard, id: 'card_2', name: 'Task 2' });

      const results = await syncService.syncTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockTrelloClient.createCard).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success/failure scenarios', async () => {
      const tasks: TodoTask[] = [
        {
          content: 'Success Task',
          status: 'pending',
          activeForm: 'Creating success task',
        },
        {
          content: 'Failure Task',
          status: 'pending',
          activeForm: 'Creating failure task',
        },
      ];

      mockTrelloClient.createCard
        .mockResolvedValueOnce(mockCard)
        .mockRejectedValueOnce(new Error('Failed'));

      const results = await syncService.syncTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('linkExistingCards', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should link tasks to existing cards with matching names', async () => {
      const tasks: TodoTask[] = [
        {
          content: 'Test Task',
          status: 'pending',
          activeForm: 'Creating Test Task',
        },
      ];

      mockTrelloClient.searchCards.mockResolvedValueOnce([mockCard]);

      await syncService.linkExistingCards(tasks);

      // Verify that subsequent sync uses the linked card
      const result = await syncService.syncTask(tasks[0]);

      expect(mockTrelloClient.moveCard).toHaveBeenCalledWith(mockCard.id, expect.any(String));
      expect(mockTrelloClient.createCard).not.toHaveBeenCalled();
    });
  });

  describe('getSyncSummary', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should return correct sync summary', async () => {
      const tasks: TodoTask[] = [
        {
          content: 'Task 1',
          status: 'pending',
          activeForm: 'Creating Task 1',
        },
        {
          content: 'Task 2',
          status: 'pending',
          activeForm: 'Creating Task 2',
        },
      ];

      await syncService.syncTasks(tasks);

      const summary = syncService.getSyncSummary();

      expect(summary.totalCards).toBe(2);
      expect(summary.cardIds).toEqual([mockCard.id, mockCard.id]);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await syncService.initialize();
      await syncService.cleanup();

      expect(mockTrelloClient.disconnect).toHaveBeenCalled();

      // Verify session data is cleared
      const summary = syncService.getSyncSummary();
      expect(summary.totalCards).toBe(0);
    });
  });
});