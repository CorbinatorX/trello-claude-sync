import { TrelloMCPClient } from '../services/trello-client.js';
import { TrelloCard, TrelloList } from '../types/index.js';

// Mock fetch globally
global.fetch = jest.fn();

// Mock config
jest.mock('../utils/config.js', () => ({
  getConfig: () => ({
    apiKey: 'test_api_key',
    token: 'test_token',
    boardId: 'test_board_id',
    listIds: {
      todo: 'list_todo_123',
      inProgress: 'list_progress_456',
      done: 'list_done_789',
    },
  }),
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TrelloMCPClient', () => {
  let client: TrelloMCPClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockCard: TrelloCard = {
    id: 'card_123',
    name: 'Test Card',
    desc: 'Test Description',
    idList: 'list_todo_123',
    url: 'https://trello.com/c/card123',
    shortUrl: 'https://trello.com/c/card123',
    dateLastActivity: '2024-01-01T00:00:00Z',
  };

  const mockLists: TrelloList[] = [
    { id: 'list_todo_123', name: 'To Do', pos: 1 },
    { id: 'list_progress_456', name: 'In Progress', pos: 2 },
    { id: 'list_done_789', name: 'Done', pos: 3 },
  ];

  beforeEach(() => {
    client = new TrelloMCPClient();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ username: 'testuser' }))
        .mockResolvedValueOnce(createMockResponse(mockLists));

      await client.connect();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/members/me'),
        expect.any(Object)
      );
    });

    it('should handle connection errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.connect()).rejects.toThrow('Network error');
    });
  });

  describe('createCard', () => {
    beforeEach(async () => {
      // Setup successful connection
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ username: 'testuser' }))
        .mockResolvedValueOnce(createMockResponse(mockLists));
      await client.connect();
      mockFetch.mockClear();
    });

    it('should create card with title and description', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCard));

      const result = await client.createCard('Test Title', 'Test Description', 'list_todo_123');

      expect(result).toEqual(mockCard);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"Test Title"'),
        })
      );
    });

    it('should create card with default list if not specified', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCard));

      await client.createCard('Test Title', 'Test Description');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards'),
        expect.objectContaining({
          body: expect.stringContaining('"idList":"list_todo_123"'),
        })
      );
    });
  });

  describe('updateCard', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ username: 'testuser' }))
        .mockResolvedValueOnce(createMockResponse(mockLists));
      await client.connect();
      mockFetch.mockClear();
    });

    it('should update card name and description', async () => {
      const updatedCard = { ...mockCard, name: 'Updated Name', desc: 'Updated Description' };
      mockFetch.mockResolvedValueOnce(createMockResponse(updatedCard));

      const result = await client.updateCard('card_123', 'Updated Name', 'Updated Description');

      expect(result).toEqual(updatedCard);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards/card_123'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"name":"Updated Name"'),
        })
      );
    });

    it('should update only description when name is undefined', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCard));

      await client.updateCard('card_123', undefined, 'New Description');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards/card_123'),
        expect.objectContaining({
          body: expect.stringContaining('"desc":"New Description"'),
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(requestBody).not.toHaveProperty('name');
    });
  });

  describe('moveCard', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ username: 'testuser' }))
        .mockResolvedValueOnce(createMockResponse(mockLists));
      await client.connect();
      mockFetch.mockClear();
    });

    it('should move card to specified list', async () => {
      const movedCard = { ...mockCard, idList: 'list_progress_456' };
      mockFetch.mockResolvedValueOnce(createMockResponse(movedCard));

      const result = await client.moveCard('card_123', 'list_progress_456');

      expect(result).toEqual(movedCard);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards/card_123'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"idList":"list_progress_456"'),
        })
      );
    });
  });

  describe('addComment', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ username: 'testuser' }))
        .mockResolvedValueOnce(createMockResponse(mockLists));
      await client.connect();
      mockFetch.mockClear();
    });

    it('should add comment to card', async () => {
      const mockComment = { id: 'comment_123', data: { text: 'Test comment' } };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockComment));

      await client.addComment('card_123', 'Test comment');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards/card_123/actions/comments'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"text":"Test comment"'),
        })
      );
    });
  });

  describe('searchCards', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ username: 'testuser' }))
        .mockResolvedValueOnce(createMockResponse(mockLists));
      await client.connect();
      mockFetch.mockClear();
    });

    it('should search for cards by query', async () => {
      const searchResults = { cards: [mockCard] };
      mockFetch.mockResolvedValueOnce(createMockResponse(searchResults));

      const result = await client.searchCards('test query');

      expect(result).toEqual([mockCard]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search'),
        expect.objectContaining({
          method: 'GET',
        })
      );

      // Check that the query is properly URL encoded
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('query=test%20query');
    });

    it('should return empty array when no cards found', async () => {
      const searchResults = { cards: [] };
      mockFetch.mockResolvedValueOnce(createMockResponse(searchResults));

      const result = await client.searchCards('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getListId', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ username: 'testuser' }))
        .mockResolvedValueOnce(createMockResponse(mockLists));
      await client.connect();
    });

    it('should return correct list ID for known list types', async () => {
      expect(await client.getListId('todo')).toBe('list_todo_123');
      expect(await client.getListId('inProgress')).toBe('list_progress_456');
      expect(await client.getListId('done')).toBe('list_done_789');
    });

    it('should return null for unknown list types', async () => {
      expect(await client.getListId('unknown' as any)).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ username: 'testuser' }));

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when API is not accessible', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('autoDiscoverLists', () => {
    it('should discover lists from board', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockLists));

      await client.autoDiscoverLists();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/boards/test_board_id/lists`),
        expect.any(Object)
      );
    });

    it('should handle discovery errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Discovery failed'));

      // Should not throw - errors are caught and logged
      await expect(client.autoDiscoverLists()).resolves.toBeUndefined();
    });
  });
});

function createMockResponse(data: any): Response {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    bytes: jest.fn(),
  } as Response;
}