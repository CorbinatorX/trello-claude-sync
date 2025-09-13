import { RaveHubTrelloIntegration, TodoTask } from '../index.js';
import { TrelloMCPClient } from '../services/trello-client.js';

// Mock dependencies for example tests
jest.mock('../services/trello-client.js');

describe('Integration Examples', () => {
  let integration: RaveHubTrelloIntegration;
  let mockTrelloClient: jest.Mocked<TrelloMCPClient>;

  beforeEach(() => {
    mockTrelloClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      autoDiscoverLists: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue(true),
      getBoard: jest.fn().mockResolvedValue({
        id: 'board_123',
        name: 'RaveHub Project',
        url: 'https://trello.com/b/board123',
      }),
      getLists: jest.fn().mockResolvedValue([
        { id: 'list_todo', name: 'To Do', pos: 1 },
        { id: 'list_progress', name: 'In Progress', pos: 2 },
        { id: 'list_done', name: 'Done', pos: 3 },
      ]),
      createCard: jest.fn().mockResolvedValue({
        id: 'card_123',
        name: 'Test Card',
        idList: 'list_todo',
        url: 'https://trello.com/c/card123',
        shortUrl: 'https://trello.com/c/card123',
        dateLastActivity: '2024-01-01T00:00:00Z',
      }),
    } as any;

    (TrelloMCPClient as jest.MockedClass<typeof TrelloMCPClient>).mockImplementation(() => mockTrelloClient);

    integration = new RaveHubTrelloIntegration();
  });

  describe('Example Usage Patterns', () => {
    it('should demonstrate basic task sync workflow', async () => {
      // This test demonstrates the typical workflow
      await integration.initialize();

      const developmentTasks: TodoTask[] = [
        {
          content: 'Implement user authentication API',
          status: 'in_progress',
          activeForm: 'Implementing user authentication API'
        },
        {
          content: 'Write unit tests for auth service',
          status: 'pending',
          activeForm: 'Writing unit tests for auth service'
        },
        {
          content: 'Update API documentation',
          status: 'pending',
          activeForm: 'Updating API documentation'
        }
      ];

      await integration.syncTasks(developmentTasks);

      // Verify all tasks were processed
      expect(mockTrelloClient.createCard).toHaveBeenCalledTimes(3);

      await integration.cleanup();
    });

    it('should demonstrate error handling in real scenarios', async () => {
      await integration.initialize();

      // Simulate API failure for one task
      mockTrelloClient.createCard
        .mockResolvedValueOnce({
          id: 'card_1',
          name: 'Success Task',
          idList: 'list_todo',
          url: 'https://trello.com/c/card1',
          shortUrl: 'https://trello.com/c/card1',
          dateLastActivity: '2024-01-01T00:00:00Z',
        })
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          id: 'card_3',
          name: 'Recovery Task',
          idList: 'list_todo',
          url: 'https://trello.com/c/card3',
          shortUrl: 'https://trello.com/c/card3',
          dateLastActivity: '2024-01-01T00:00:00Z',
        });

      const tasks: TodoTask[] = [
        {
          content: 'Task that succeeds',
          status: 'pending',
          activeForm: 'Creating task that succeeds'
        },
        {
          content: 'Task that fails',
          status: 'pending',
          activeForm: 'Creating task that fails'
        },
        {
          content: 'Task that recovers',
          status: 'pending',
          activeForm: 'Creating task that recovers'
        }
      ];

      // This should not throw, but handle errors gracefully
      await expect(integration.syncTasks(tasks)).resolves.not.toThrow();

      await integration.cleanup();
    });
  });

  describe('Connection Testing Examples', () => {
    it('should demonstrate connection testing workflow', async () => {
      const result = await integration.testConnection();

      expect(result).toBe(true);
      expect(mockTrelloClient.connect).toHaveBeenCalled();
      expect(mockTrelloClient.healthCheck).toHaveBeenCalled();
      expect(mockTrelloClient.getBoard).toHaveBeenCalled();
      expect(mockTrelloClient.getLists).toHaveBeenCalled();
      expect(mockTrelloClient.disconnect).toHaveBeenCalled();
    });

    it('should handle connection failures gracefully', async () => {
      mockTrelloClient.healthCheck.mockResolvedValueOnce(false);

      const result = await integration.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Real-world Task Examples', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    afterEach(async () => {
      await integration.cleanup();
    });

    it('should sync RaveHub backend development tasks', async () => {
      const backendTasks: TodoTask[] = [
        {
          content: 'Setup Entity Framework migrations for User entity',
          status: 'completed',
          activeForm: 'Setting up Entity Framework migrations for User entity'
        },
        {
          content: 'Implement JWT authentication middleware',
          status: 'in_progress',
          activeForm: 'Implementing JWT authentication middleware'
        },
        {
          content: 'Create API endpoints for user registration',
          status: 'pending',
          activeForm: 'Creating API endpoints for user registration'
        },
        {
          content: 'Add validation for user input models',
          status: 'pending',
          activeForm: 'Adding validation for user input models'
        }
      ];

      await integration.syncTasks(backendTasks);

      expect(mockTrelloClient.createCard).toHaveBeenCalledTimes(4);

      // Verify card creation with proper descriptions
      const createCardCalls = mockTrelloClient.createCard.mock.calls;
      expect(createCardCalls[0][0]).toBe('Setup Entity Framework migrations for User entity');
      expect(createCardCalls[0][1]).toContain('completed');
    });

    it('should sync RaveHub frontend development tasks', async () => {
      const frontendTasks: TodoTask[] = [
        {
          content: 'Setup React Native navigation structure',
          status: 'completed',
          activeForm: 'Setting up React Native navigation structure'
        },
        {
          content: 'Implement user authentication screens',
          status: 'in_progress',
          activeForm: 'Implementing user authentication screens'
        },
        {
          content: 'Create event listing component with Redux state',
          status: 'pending',
          activeForm: 'Creating event listing component with Redux state'
        }
      ];

      await integration.syncTasks(frontendTasks);

      expect(mockTrelloClient.createCard).toHaveBeenCalledTimes(3);

      const summary = integration.syncService.getSyncSummary();
      expect(summary.totalCards).toBe(3);
    });

    it('should handle infrastructure and DevOps tasks', async () => {
      const infraTasks: TodoTask[] = [
        {
          content: 'Configure Azure App Service for .NET API',
          status: 'completed',
          activeForm: 'Configuring Azure App Service for .NET API'
        },
        {
          content: 'Setup CI/CD pipeline with GitHub Actions',
          status: 'in_progress',
          activeForm: 'Setting up CI/CD pipeline with GitHub Actions'
        },
        {
          content: 'Configure Azure SQL Database connection strings',
          status: 'pending',
          activeForm: 'Configuring Azure SQL Database connection strings'
        }
      ];

      await integration.syncTasks(infraTasks);

      expect(mockTrelloClient.createCard).toHaveBeenCalledTimes(3);
    });
  });
});