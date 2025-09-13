import { createCardFromPlan, pickupCard, completeCard, updateCard, showStatus } from '../slash-commands.js';
import { TrelloMCPClient } from '../services/trello-client.js';
import { RaveHubTrelloIntegration } from '../index.js';
import * as sessionModule from '../utils/session.js';

// Mock dependencies
jest.mock('../services/trello-client.js');
jest.mock('../index.js');
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

describe('Slash Commands', () => {
  let mockTrelloClient: jest.Mocked<TrelloMCPClient>;
  let mockIntegration: jest.Mocked<RaveHubTrelloIntegration>;
  let mockSetActiveCard: jest.MockedFunction<typeof sessionModule.setActiveCard>;
  let mockGetActiveCard: jest.MockedFunction<typeof sessionModule.getActiveCard>;
  let mockClearSession: jest.MockedFunction<typeof sessionModule.clearSession>;

  const mockCard = {
    id: 'card_123',
    name: 'Test Card',
    desc: 'Test Description',
    url: 'https://trello.com/c/card123',
    idList: 'list_todo',
    dateLastActivity: '2024-01-01T00:00:00Z',
  };

  const mockLists = [
    { id: 'list_todo', name: 'To Do', pos: 1 },
    { id: 'list_progress', name: 'In Progress', pos: 2 },
    { id: 'list_done', name: 'Done', pos: 3 },
  ];

  beforeEach(() => {
    // Setup TrelloMCPClient mock
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
      getLists: jest.fn().mockResolvedValue(mockLists),
      ensureLabel: jest.fn().mockResolvedValue('label_123'),
      addLabelToCard: jest.fn().mockResolvedValue(undefined),
    } as any;

    (TrelloMCPClient as jest.MockedClass<typeof TrelloMCPClient>).mockImplementation(() => mockTrelloClient);

    // Setup RaveHubTrelloIntegration mock
    mockIntegration = {
      initialize: jest.fn().mockResolvedValue(undefined),
    } as any;

    (RaveHubTrelloIntegration as jest.MockedClass<typeof RaveHubTrelloIntegration>).mockImplementation(() => mockIntegration);

    // Setup session mocks
    mockSetActiveCard = sessionModule.setActiveCard as jest.MockedFunction<typeof sessionModule.setActiveCard>;
    mockGetActiveCard = sessionModule.getActiveCard as jest.MockedFunction<typeof sessionModule.getActiveCard>;
    mockClearSession = sessionModule.clearSession as jest.MockedFunction<typeof sessionModule.clearSession>;

    mockSetActiveCard.mockImplementation(() => {});
    mockClearSession.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCardFromPlan', () => {
    it('should create card from plan text', async () => {
      const planText = `# User Authentication Feature

## Tasks
- Create login endpoint
- Add password validation
- Write user tests`;

      const result = await createCardFromPlan(planText);

      expect(result).toContain('✅ **Trello Card Created**');
      expect(result).toContain(mockCard.name);
      expect(result).toContain(mockCard.id);

      expect(mockTrelloClient.createCard).toHaveBeenCalledWith(
        'User Authentication Feature',
        expect.stringContaining('User Authentication Feature'),
        undefined
      );

      expect(mockSetActiveCard).toHaveBeenCalledWith(
        mockCard.id,
        mockCard.name,
        expect.any(Array)
      );
    });

    it('should create card with default title when no plan provided', async () => {
      const result = await createCardFromPlan();

      expect(result).toContain('✅ **Trello Card Created**');
      expect(mockTrelloClient.createCard).toHaveBeenCalledWith(
        'Development Task',
        expect.any(String),
        undefined
      );
    });

    it('should handle creation errors', async () => {
      mockTrelloClient.createCard.mockRejectedValue(new Error('API Error'));

      const result = await createCardFromPlan('Test Plan');

      expect(result).toContain('❌ Failed to create Trello card: API Error');
    });

    it('should extract and track tasks from plan', async () => {
      const planText = `Development Plan
- [ ] Task 1: Create API
- [x] Task 2: Write tests
- Task 3: Deploy`;

      await createCardFromPlan(planText);

      expect(mockSetActiveCard).toHaveBeenCalledWith(
        mockCard.id,
        mockCard.name,
        expect.arrayContaining([
          expect.objectContaining({ content: 'Task 1: Create API', status: 'pending' }),
          expect.objectContaining({ content: 'Task 2: Write tests', status: 'completed' }),
          expect.objectContaining({ content: 'Task 3: Deploy', status: 'pending' }),
        ])
      );
    });
  });

  describe('pickupCard', () => {
    it('should pickup card by ID', async () => {
      const result = await pickupCard('card_123');

      expect(result).toContain('🎯 **Picked up Trello Card**');
      expect(result).toContain(mockCard.name);

      expect(mockTrelloClient.getCard).toHaveBeenCalledWith('card_123');
      expect(mockTrelloClient.moveCard).toHaveBeenCalledWith('card_123', 'list_progress');
      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        'card_123',
        expect.stringContaining('Card picked up for active work')
      );
      expect(mockSetActiveCard).toHaveBeenCalled();
    });

    it('should pickup card by name search', async () => {
      const result = await pickupCard('Test Card Name');

      expect(result).toContain('🎯 **Picked up Trello Card**');

      expect(mockTrelloClient.searchCards).toHaveBeenCalledWith('Test Card Name');
      expect(mockSetActiveCard).toHaveBeenCalled();
    });

    it('should handle multiple search results', async () => {
      const multipleCards = [
        { ...mockCard, id: 'card_1', name: 'Card 1', shortUrl: 'https://trello.com/c/card1' },
        { ...mockCard, id: 'card_2', name: 'Card 2', shortUrl: 'https://trello.com/c/card2' },
      ];
      mockTrelloClient.searchCards.mockResolvedValue(multipleCards);

      const result = await pickupCard('ambiguous name');

      expect(result).toContain('🔍 Multiple cards found');
      expect(result).toContain('card_1');
      expect(result).toContain('card_2');
    });

    it('should handle card not found', async () => {
      mockTrelloClient.searchCards.mockResolvedValue([]);

      const result = await pickupCard('nonexistent');

      expect(result).toContain('❌ No card found matching: "nonexistent"');
    });

    it('should handle pickup errors', async () => {
      mockTrelloClient.getCard.mockRejectedValue(new Error('Network error'));

      const result = await pickupCard('card_123');

      expect(result).toContain('❌ Failed to pickup card: Network error');
    });
  });

  describe('completeCard', () => {
    beforeEach(() => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });
    });

    it('should complete active card', async () => {
      const result = await completeCard('Task completed successfully');

      expect(result).toContain('🎉 **Task Completed!**');
      expect(result).toContain('Test Card');

      expect(mockTrelloClient.moveCard).toHaveBeenCalledWith('card_123', 'list_done');
      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        'card_123',
        expect.stringContaining('Task Completed')
      );
      expect(mockClearSession).toHaveBeenCalled();
    });

    it('should complete card without completion note', async () => {
      const result = await completeCard();

      expect(result).toContain('🎉 **Task Completed!**');
      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        'card_123',
        expect.stringContaining('Task Completed')
      );
    });

    it('should handle no active card', async () => {
      mockGetActiveCard.mockReturnValue({ cardId: undefined, cardName: undefined, tasks: undefined });

      const result = await completeCard();

      expect(result).toContain('❌ No active Trello card in session');
    });

    it('should handle missing done list', async () => {
      mockTrelloClient.getListId.mockReturnValue(null as any);

      const result = await completeCard();

      expect(result).toContain('❌ Could not find "Done" list on board');
    });

    it('should handle completion errors', async () => {
      mockTrelloClient.moveCard.mockRejectedValue(new Error('Move failed'));

      const result = await completeCard();

      expect(result).toContain('❌ Failed to complete card: Move failed');
    });
  });

  describe('updateCard', () => {
    beforeEach(() => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [
          { content: 'Task 1', status: 'completed', activeForm: 'Completing Task 1' },
          { content: 'Task 2', status: 'in_progress', activeForm: 'Working on Task 2' },
        ],
      });
    });

    it('should update active card with progress', async () => {
      const result = await updateCard('Progress update');

      expect(result).toContain('📋 **Card Updated Successfully**');
      expect(result).toContain(mockCard.name);

      expect(mockTrelloClient.updateCard).toHaveBeenCalledWith(
        'card_123',
        undefined,
        expect.stringContaining('✅ Task 1')
      );
      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        'card_123',
        expect.stringContaining('Progress Update')
      );
    });

    it('should update card without note', async () => {
      const result = await updateCard();

      expect(result).toContain('📋 **Card Updated Successfully**');
      expect(mockTrelloClient.addComment).toHaveBeenCalledWith(
        'card_123',
        expect.stringContaining('Progress Update')
      );
    });

    it('should handle no active card', async () => {
      mockGetActiveCard.mockReturnValue({ cardId: undefined, cardName: undefined, tasks: undefined });

      const result = await updateCard();

      expect(result).toContain('❌ No active Trello card in session');
    });

    it('should handle update errors', async () => {
      mockTrelloClient.updateCard.mockRejectedValue(new Error('Update failed'));

      const result = await updateCard();

      expect(result).toContain('❌ Failed to update card: Update failed');
    });
  });

  describe('showStatus', () => {
    it('should show status when active card exists', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });

      const result = await showStatus();

      expect(result).toContain('📋 **Trello Session Status**');
      expect(result).toContain('Test Card');
      expect(result).toContain('card_123');

      expect(mockTrelloClient.getCard).toHaveBeenCalledWith('card_123');
    });

    it('should show no active card message', async () => {
      mockGetActiveCard.mockReturnValue({ cardId: undefined, cardName: undefined, tasks: undefined });

      const result = await showStatus();

      expect(result).toContain('📋 **Trello Session Status**');
      expect(result).toContain('**Active Card:** None');
      expect(result).toContain('Use `/trello-create`');
    });

    it('should handle status errors', async () => {
      mockGetActiveCard.mockReturnValue({
        cardId: 'card_123',
        cardName: 'Test Card',
        tasks: [],
      });
      mockTrelloClient.getCard.mockRejectedValue(new Error('Get failed'));

      const result = await showStatus();

      expect(result).toContain('❌ Failed to get status: Get failed');
    });
  });
});