import { SimpleAutoSyncService } from '../services/simple-auto-sync.js';
import { TrelloMCPClient } from '../services/trello-client.js';
import { TodoTask, TrelloCard } from '../types/index.js';
import * as sessionModule from '../utils/session.js';

// Mock dependencies
jest.mock('../services/trello-client.js');
jest.mock('../utils/session.js');
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SimpleAutoSyncService', () => {
  let syncService: SimpleAutoSyncService;
  let mockTrelloClient: jest.Mocked<TrelloMCPClient>;
  let mockGetActiveCard: jest.MockedFunction<typeof sessionModule.getActiveCard>;
  let mockUpdateSessionTasks: jest.MockedFunction<typeof sessionModule.updateSessionTasks>;

  const mockCard: TrelloCard = {
    id: 'card_123',
    name: 'Test Card',
    desc: `## Development Plan

- 📋 Task 1: Create user authentication
- ⚙️ Task 2: Build API endpoints
- ✅ Task 3: Write tests

---
*Created from Claude Code TodoWrite plan*`,
    idList: 'list_in_progress',
    url: 'https://trello.com/c/card123',
    shortUrl: 'https://trello.com/c/card123',
    dateLastActivity: '2024-01-01T00:00:00Z',
  };

  const mockTasks: TodoTask[] = [
    {
      content: 'Create user authentication',
      status: 'completed',
      activeForm: 'Creating user authentication',
    },
    {
      content: 'Build API endpoints',
      status: 'in_progress',
      activeForm: 'Building API endpoints',
    },
    {
      content: 'Write tests',
      status: 'pending',
      activeForm: 'Writing tests',
    },
  ];

  beforeEach(() => {
    // Setup mocks
    mockTrelloClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      getCard: jest.fn().mockResolvedValue(mockCard),
      updateCard: jest.fn().mockResolvedValue(mockCard),
      addComment: jest.fn().mockResolvedValue(undefined),
    } as any;

    (TrelloMCPClient as jest.MockedClass<typeof TrelloMCPClient>).mockImplementation(() => mockTrelloClient);

    mockGetActiveCard = sessionModule.getActiveCard as jest.MockedFunction<typeof sessionModule.getActiveCard>;
    mockUpdateSessionTasks = sessionModule.updateSessionTasks as jest.MockedFunction<typeof sessionModule.updateSessionTasks>;

    syncService = new SimpleAutoSyncService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncTasks', () => {
    it('should skip sync when no active card', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: undefined,
        cardName: undefined,
        tasks: undefined,
      });

      const result = await syncService.syncTasks(mockTasks);

      expect(result.success).toBe(true);
      expect(result.message).toBe('No active card');
      expect(mockTrelloClient.connect).not.toHaveBeenCalled();
    });

    it('should successfully sync tasks to active card', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });

      const result = await syncService.syncTasks(mockTasks);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Synced 3 tasks to Trello');
      expect(result.completed).toBe(1);
      expect(result.total).toBe(3);

      // Verify client calls
      expect(mockTrelloClient.connect).toHaveBeenCalled();
      expect(mockTrelloClient.getCard).toHaveBeenCalledWith('card_123');
      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        'card_123',
        undefined,
        expect.stringContaining('✅ Create user authentication')
      );
      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        'card_123',
        '📊 **Progress Update:** 1/3 completed (1 in progress)'
      );

      // Verify session update
      expect(mockUpdateSessionTasks).toHaveBeenCalledWith(mockTasks);
    });

    it('should handle sync errors gracefully', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });

      mockTrelloClient.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await syncService.syncTasks(mockTasks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.message).toBe('Auto-sync failed: Connection failed');
    });

    it('should generate correct progress message without in-progress tasks', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });

      const allCompletedTasks: TodoTask[] = [
        { content: 'Task 1', status: 'completed', activeForm: 'Completing Task 1' },
        { content: 'Task 2', status: 'completed', activeForm: 'Completing Task 2' },
      ];

      await syncService.syncTasks(allCompletedTasks);

      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        'card_123',
        '📊 **Progress Update:** 2/2 completed'
      );
    });
  });

  describe('generateUpdatedDescription', () => {
    it('should update existing task section with new status icons', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });

      const originalDescription = `## Development Plan

- 📋 Old task
- ⚙️ Another task

---
*Created from Claude Code TodoWrite plan*`;

      mockTrelloClient.getCard.mockResolvedValue({
        ...mockCard,
        desc: originalDescription,
      });

      const newTasks: TodoTask[] = [
        { content: 'Updated task', status: 'completed', activeForm: 'Completing task' },
        { content: 'New task', status: 'pending', activeForm: 'Starting new task' },
      ];

      await syncService.syncTasks(newTasks);

      const expectedDescription = expect.stringContaining('✅ Updated task');
      const expectedDescription2 = expect.stringContaining('📋 New task');

      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        'card_123',
        undefined,
        expect.stringMatching(/✅ Updated task[\s\S]*📋 New task/)
      );
    });

    it('should add task section if none exists', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });

      const descriptionWithoutTasks = `## Development Plan

Just a description without tasks.

---
*Some footer*`;

      mockTrelloClient.getCard.mockResolvedValue({
        ...mockCard,
        desc: descriptionWithoutTasks,
      });

      const newTasks: TodoTask[] = [
        { content: 'First task', status: 'pending', activeForm: 'Starting first task' },
      ];

      await syncService.syncTasks(newTasks);

      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        'card_123',
        undefined,
        expect.stringContaining('## Current Tasks')
      );
    });
  });

  describe('getStatusIcon', () => {
    it('should return correct icons for different statuses', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });

      const testTasks: TodoTask[] = [
        { content: 'Pending task', status: 'pending', activeForm: 'Starting pending task' },
        { content: 'Progress task', status: 'in_progress', activeForm: 'Working on progress task' },
        { content: 'Done task', status: 'completed', activeForm: 'Completing done task' },
      ];

      await syncService.syncTasks(testTasks);

      const updateCall = mockTrelloClient.updateCard.mock.calls[0];
      const updatedDescription = updateCall[2];

      expect(updatedDescription).toContain('📋 Pending task');
      expect(updatedDescription).toContain('⚙️ Progress task');
      expect(updatedDescription).toContain('✅ Done task');
    });
  });
});