import { SimpleAutoSyncService } from '../services/simple-auto-sync.js';
import { createCardFromPlan, pickupCard, updateCard, completeCard } from '../slash-commands.js';
import { TodoTask } from '../types/index.js';
import * as sessionModule from '../utils/session.js';

// Mock all external dependencies
jest.mock('../services/trello-client.js');
jest.mock('../index.js');
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Real session implementation for integration testing
jest.unmock('../utils/session.js');

describe('Integration Tests - Simplified Sync Flow', () => {
  let syncService: SimpleAutoSyncService;
  let mockTrelloClient: any;

  const mockCard = {
    id: 'integration_card_123',
    name: 'Integration Test Card',
    desc: `## Development Plan

Tasks will be tracked here.

---
*Created from Claude Code TodoWrite plan*`,
    url: 'https://trello.com/c/integration123',
    idList: 'list_todo',
    dateLastActivity: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    // Setup comprehensive mock client
    mockTrelloClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      createCard: jest.fn().mockResolvedValue(mockCard),
      getCard: jest.fn().mockResolvedValue(mockCard),
      updateCard: jest.fn().mockResolvedValue(mockCard),
      moveCard: jest.fn().mockResolvedValue(mockCard),
      addComment: jest.fn().mockResolvedValue(undefined),
      searchCards: jest.fn().mockResolvedValue([mockCard]),
      getListId: jest.fn().mockImplementation((type: string) => {
        const mapping = { todo: 'list_todo', inProgress: 'list_progress', done: 'list_done' };
        return mapping[type as keyof typeof mapping] || null;
      }),
      getLists: jest.fn().mockResolvedValue([
        { id: 'list_todo', name: 'To Do', pos: 1 },
        { id: 'list_progress', name: 'In Progress', pos: 2 },
        { id: 'list_done', name: 'Done', pos: 3 },
      ]),
      ensureLabel: jest.fn().mockResolvedValue('label_123'),
      addLabelToCard: jest.fn().mockResolvedValue(undefined),
    };

    // Mock the TrelloMCPClient constructor
    const TrelloMCPClient = require('../services/trello-client.js').TrelloMCPClient;
    TrelloMCPClient.mockImplementation(() => mockTrelloClient);

    // Mock RaveHubTrelloIntegration
    const RaveHubTrelloIntegration = require('../index.js').RaveHubTrelloIntegration;
    RaveHubTrelloIntegration.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
    }));

    syncService = new SimpleAutoSyncService();

    // Clear session before each test
    sessionModule.clearSession();
  });

  afterEach(() => {
    jest.clearAllMocks();
    sessionModule.clearSession();
  });

  describe('Complete Development Workflow', () => {
    it('should handle complete workflow: create -> pickup -> auto-sync -> update -> complete', async () => {
      // 1. Create card from plan
      const planText = `# User Authentication System

## Development Tasks
- Set up authentication middleware
- Create login/logout endpoints
- Add password hashing
- Write authentication tests`;

      const createResult = await createCardFromPlan(planText);
      expect(createResult).toContain('✅ **Trello Card Created**');
      expect(mockTrelloClient.createCard).toHaveBeenCalledWith(
        'User Authentication System',
        expect.stringContaining('User Authentication System'),
        undefined
      );

      // Verify session was set
      const session1 = sessionModule.getActiveCard();
      expect(session1.cardId).toBe(mockCard.id);
      expect(session1.tasks).toHaveLength(4);

      // 2. Pickup the card (simulating working on it)
      const pickupResult = await pickupCard(mockCard.id);
      expect(pickupResult).toContain('🎯 **Picked up Trello Card**');
      expect(mockTrelloClient.moveCard).toHaveBeenCalledWith(mockCard.id, 'list_progress');

      // 3. Simulate TodoWrite progress - auto-sync via SimpleAutoSyncService
      const updatedTasks: TodoTask[] = [
        { content: 'Set up authentication middleware', status: 'completed', activeForm: 'Completing middleware setup' },
        { content: 'Create login/logout endpoints', status: 'in_progress', activeForm: 'Building endpoints' },
        { content: 'Add password hashing', status: 'pending', activeForm: 'Planning password hashing' },
        { content: 'Write authentication tests', status: 'pending', activeForm: 'Planning tests' },
      ];

      const syncResult = await syncService.syncTasks(updatedTasks);
      expect(syncResult.success).toBe(true);
      expect(syncResult.completed).toBe(1);
      expect(syncResult.total).toBe(4);

      // Verify description update with status icons
      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        mockCard.id,
        undefined,
        expect.stringMatching(/✅ Set up authentication middleware[\s\S]*⚙️ Create login\/logout endpoints/)
      );

      // Verify progress comment
      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        mockCard.id,
        '📊 **Progress Update:** 1/4 completed (1 in progress)'
      );

      // 4. Manual update with note
      const updateResult = await updateCard('Middleware completed, working on endpoints');
      expect(updateResult).toContain('📋 **Card Updated Successfully**');

      // 5. Complete more tasks and auto-sync again
      const finalTasks: TodoTask[] = [
        { content: 'Set up authentication middleware', status: 'completed', activeForm: 'Completed middleware' },
        { content: 'Create login/logout endpoints', status: 'completed', activeForm: 'Completed endpoints' },
        { content: 'Add password hashing', status: 'completed', activeForm: 'Completed hashing' },
        { content: 'Write authentication tests', status: 'in_progress', activeForm: 'Writing tests' },
      ];

      const finalSyncResult = await syncService.syncTasks(finalTasks);
      expect(finalSyncResult.success).toBe(true);
      expect(finalSyncResult.completed).toBe(3);
      expect(finalSyncResult.total).toBe(4);

      // 6. Complete the card
      const completeResult = await completeCard('All authentication features implemented and tested');
      expect(completeResult).toContain('🎉 **Task Completed!**');
      expect(mockTrelloClient.moveCard).toHaveBeenCalledWith(mockCard.id, 'list_done');

      // Verify session was cleared
      const finalSession = sessionModule.getActiveCard();
      expect(finalSession.cardId).toBeNull();
    });

    it('should handle task status changes correctly through multiple syncs', async () => {
      // Set up initial session
      sessionModule.setActiveCard(mockCard.id, mockCard.name, []);

      // First sync - initial tasks
      const initialTasks: TodoTask[] = [
        { content: 'Task A', status: 'pending', activeForm: 'Planning Task A' },
        { content: 'Task B', status: 'pending', activeForm: 'Planning Task B' },
      ];

      await syncService.syncTasks(initialTasks);

      // Verify initial description update
      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        mockCard.id,
        undefined,
        expect.stringMatching(/📋 Task A[\s\S]*📋 Task B/)
      );

      // Second sync - progress on Task A
      const progressTasks: TodoTask[] = [
        { content: 'Task A', status: 'in_progress', activeForm: 'Working on Task A' },
        { content: 'Task B', status: 'pending', activeForm: 'Planning Task B' },
      ];

      await syncService.syncTasks(progressTasks);

      // Verify status icon changed
      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        mockCard.id,
        undefined,
        expect.stringMatching(/⚙️ Task A[\s\S]*📋 Task B/)
      );

      // Third sync - complete both tasks
      const completedTasks: TodoTask[] = [
        { content: 'Task A', status: 'completed', activeForm: 'Completed Task A' },
        { content: 'Task B', status: 'completed', activeForm: 'Completed Task B' },
      ];

      await syncService.syncTasks(completedTasks);

      // Verify both tasks marked complete
      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        mockCard.id,
        undefined,
        expect.stringMatching(/✅ Task A[\s\S]*✅ Task B/)
      );

      // Verify final progress comment
      expect(mockTrelloClient.addComment).toHaveBeenLastCalledWith(
        mockCard.id,
        '📊 **Progress Update:** 2/2 completed'
      );
    });

    it('should handle description update when no existing task section exists', async () => {
      // Set up card with description that has no task section
      const cardWithoutTasks = {
        ...mockCard,
        desc: `## Project Overview

This is a development project.

## Notes
Some additional notes.`,
      };

      mockTrelloClient.getCard.mockResolvedValue(cardWithoutTasks);
      sessionModule.setActiveCard(mockCard.id, mockCard.name, []);

      const newTasks: TodoTask[] = [
        { content: 'New Task', status: 'pending', activeForm: 'Starting new task' },
      ];

      await syncService.syncTasks(newTasks);

      // Verify that task section was added
      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        mockCard.id,
        undefined,
        expect.stringContaining('## Current Tasks')
      );
    });

    it('should handle errors gracefully during workflow', async () => {
      // Set up session
      sessionModule.setActiveCard(mockCard.id, mockCard.name, []);

      // Simulate network error during sync
      mockTrelloClient.updateCard.mockRejectedValueOnce(new Error('Network timeout'));

      const tasks: TodoTask[] = [
        { content: 'Test Task', status: 'pending', activeForm: 'Testing task' },
      ];

      const result = await syncService.syncTasks(tasks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(result.message).toBe('Auto-sync failed: Network timeout');
    });
  });

  describe('Session Persistence', () => {
    it('should maintain session state across multiple operations', async () => {
      // Create and pickup card
      await createCardFromPlan('Test Project\n- Task 1\n- Task 2');

      const session1 = sessionModule.getActiveCard();
      expect(session1.cardId).toBe(mockCard.id);
      expect(session1.tasks).toHaveLength(2);

      // Update tasks via sync
      const updatedTasks: TodoTask[] = [
        { content: 'Task 1', status: 'completed', activeForm: 'Completing Task 1' },
        { content: 'Task 2', status: 'in_progress', activeForm: 'Working on Task 2' },
      ];

      await syncService.syncTasks(updatedTasks);

      // Verify session was updated
      const session2 = sessionModule.getActiveCard();
      expect(session2.cardId).toBe(mockCard.id);
      expect(session2.tasks).toEqual(updatedTasks);

      // Complete card - should clear session
      await completeCard();

      const session3 = sessionModule.getActiveCard();
      expect(session3.cardId).toBeNull();
    });
  });
});