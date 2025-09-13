# Trello Claude Sync

Development workflow automation tool for syncing TodoWrite tasks with Trello boards. This tool enables autonomous development workflow management by bridging the gap between Claude Code's TodoWrite functionality and persistent project tracking in Trello.

## Overview

This integration provides a **low-complexity manual sync** approach that:

- Keeps TodoWrite for session-based task management (fast, ephemeral)
- Uses Trello for persistent project tracking across development sessions
- Enables team visibility into development progress
- Maintains simplicity while adding project management value

## Features

- 🔄 **Bidirectional Sync**: Link TodoWrite tasks with Trello cards
- 🎯 **Smart Mapping**: Auto-discovery of board lists (To Do, In Progress, Done, etc.)
- 🏷️ **Status Tracking**: Automatic card movement based on task status changes
- 💬 **Progress Comments**: Add progress notes to cards during development
- 🔍 **Card Linking**: Search and link existing Trello cards to new tasks
- ⚡ **Session Management**: Track task-to-card mappings within development sessions

## Prerequisites

1. **Node.js 18+**
2. **Trello Account** with a board for your project
3. **Trello API Credentials** (API Key + Token)
4. **kocakli/Trello-Desktop-MCP** server installed and configured

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Trello API Credentials

1. Visit [https://trello.com/app-key](https://trello.com/app-key)
2. Copy your **API Key**
3. Generate a **Token** with read/write permissions:
   ```
   https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Claude%20Code%20Integration&key=YOUR_API_KEY
   ```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
TRELLO_API_KEY=your_trello_api_key_here
TRELLO_TOKEN=your_trello_token_here
TRELLO_BOARD_ID=your_board_id_here
NODE_ENV=development
LOG_LEVEL=debug
```

**Finding your Board ID:**
- Open your Trello board: `https://trello.com/b/BOARD_ID/your-board-name`
- The `BOARD_ID` is in the URL

### 4. Install Trello MCP Server

```bash
# Clone the MCP server
git clone https://github.com/kocakli/Trello-Desktop-MCP.git
cd Trello-Desktop-MCP

# Install and build
npm install
npm run build

# Note the path to dist/index.js for Claude Desktop config
echo "MCP Server path: $(pwd)/dist/index.js"
```

### 5. Configure Claude Desktop

Edit your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\\Claude\\claude_desktop_config.json`

Add the Trello MCP server:

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/Trello-Desktop-MCP/dist/index.js"],
      "env": {
        "TRELLO_API_KEY": "your_api_key_here",
        "TRELLO_TOKEN": "your_token_here"
      }
    }
  }
}
```

**Important:** Use absolute paths and restart Claude Desktop after configuration.

## Usage

### Testing the Integration

```bash
# Test connection to Trello board
npm start test

# Show current configuration
npm start info

# Test sync with sample tasks
npm start sync
```

### Programmatic Usage

```typescript
import { RaveHubTrelloIntegration, TodoTask } from 'trello-claude-sync';

const integration = new RaveHubTrelloIntegration();

// Initialize
await integration.initialize();

// Sync tasks from TodoWrite
const tasks: TodoTask[] = [
  {
    content: 'Implement user authentication API',
    status: 'in_progress',
    activeForm: 'Implementing user authentication API'
  },
  {
    content: 'Write unit tests for auth service',
    status: 'pending',
    activeForm: 'Writing unit tests for auth service'
  }
];

await integration.syncTasks(tasks);

// Clean up
await integration.cleanup();
```

### Development Workflow

#### 1. Planning Phase
```typescript
// TodoWrite creates session tasks
const sessionTasks = [
  { content: 'Setup database migration', status: 'pending', activeForm: '...' },
  { content: 'Implement user service', status: 'pending', activeForm: '...' },
  { content: 'Add API endpoints', status: 'pending', activeForm: '...' }
];

// Sync to Trello for persistence
await integration.syncTasks(sessionTasks);
```

#### 2. Implementation Phase
```typescript
// Update task status in TodoWrite
const updatedTask = {
  content: 'Setup database migration',
  status: 'in_progress',
  activeForm: 'Setting up database migration'
};

// Sync updates to Trello (moves card, adds comments)
await integration.syncTasks([updatedTask]);
```

#### 3. Completion Phase
```typescript
// Mark task complete in TodoWrite
const completedTask = {
  content: 'Setup database migration',
  status: 'completed',
  activeForm: 'Setting up database migration'
};

// Sync to Trello (moves card to Done list)
await integration.syncTasks([completedTask]);
```

## Board Structure

The integration expects these lists in your Trello board:

- **Backlog** - Future features and ideas
- **To Do** - Ready to implement (maps to `pending` status)
- **In Progress** - Currently working on (maps to `in_progress` status)
- **Review** - Awaiting review/testing
- **Done** - Completed tasks (maps to `completed` status)

The integration will auto-discover list IDs based on common naming patterns.

## API Reference

### TodoTrelloSync

Main synchronization service.

```typescript
class TodoTrelloSync {
  // Initialize connection to Trello MCP server
  async initialize(mcpServerPath?: string): Promise<void>

  // Sync single task
  async syncTask(task: TodoTask, options?: SyncOptions): Promise<SyncResult>

  // Sync multiple tasks
  async syncTasks(tasks: TodoTask[], options?: SyncOptions): Promise<SyncResult[]>

  // Link existing Trello cards to tasks
  async linkExistingCards(tasks: TodoTask[]): Promise<void>

  // Get session summary
  getSyncSummary(): { totalCards: number; cardIds: string[] }

  // Clean up resources
  async cleanup(): Promise<void>
}
```

### TrelloMCPClient

Low-level client for Trello MCP operations.

```typescript
class TrelloMCPClient {
  // Connection management
  async connect(mcpServerPath?: string): Promise<void>
  async disconnect(): Promise<void>

  // Board operations
  async getBoard(boardId?: string): Promise<TrelloBoard>
  async getLists(boardId?: string): Promise<TrelloList[]>

  // Card operations
  async createCard(name: string, description?: string, listId?: string): Promise<TrelloCard>
  async updateCard(cardId: string, name?: string, description?: string): Promise<TrelloCard>
  async moveCard(cardId: string, targetListId: string): Promise<TrelloCard>
  async addComment(cardId: string, comment: string): Promise<void>

  // Search and utility
  async searchCards(query: string): Promise<TrelloCard[]>
  async healthCheck(): Promise<boolean>
}
```

## Configuration Options

### SyncOptions

```typescript
interface SyncOptions {
  createMissingLists?: boolean;    // Auto-create lists if missing
  syncOnlyActiveSession?: boolean; // Only sync current session tasks
  addLabels?: boolean;             // Add status labels to cards
  includeTimestamps?: boolean;     // Include timestamps in descriptions
}
```

### Environment Variables

```env
# Required
TRELLO_API_KEY=            # Your Trello API key
TRELLO_TOKEN=              # Your Trello access token
TRELLO_BOARD_ID=           # Target board ID

# Optional - Auto-discovered if not set
TRELLO_LIST_TODO=          # "To Do" list ID
TRELLO_LIST_IN_PROGRESS=   # "In Progress" list ID
TRELLO_LIST_REVIEW=        # "Review" list ID
TRELLO_LIST_DONE=          # "Done" list ID

# Development
NODE_ENV=development       # Environment mode
LOG_LEVEL=debug           # Logging level (debug, info, warn, error)
```

## Troubleshooting

### Common Issues

1. **"Not connected to MCP server"**
   - Ensure kocakli/Trello-Desktop-MCP is installed and built
   - Check Claude Desktop configuration
   - Verify absolute paths in config

2. **"Failed to access Trello board"**
   - Verify API key and token are correct
   - Check board ID in URL
   - Ensure token has read/write permissions

3. **"No list configured for status"**
   - Run `npm start test` to auto-discover lists
   - Manually set list IDs in `.env`
   - Verify list names match expected patterns

4. **Rate limiting errors**
   - The sync includes delays between operations
   - Reduce batch sizes for large task lists
   - Check Trello API rate limits

### Debug Mode

Enable debug logging for detailed information:

```env
LOG_LEVEL=debug
```

This will show:
- MCP server connection details
- API request/response data
- Task-to-card mapping information
- Sync operation details

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run type-check
```

### Project Structure

```
src/
├── index.ts              # Main entry point and CLI
├── types/
│   └── index.ts          # TypeScript type definitions
├── utils/
│   ├── config.ts         # Configuration management
│   └── logger.ts         # Logging utilities
├── services/
│   ├── trello-client.ts  # Trello MCP client wrapper
│   └── todo-sync.ts      # TodoWrite ↔ Trello sync logic
└── tests/
    └── *.test.ts         # Test files
```

## Contributing

1. Follow existing code patterns and TypeScript strict mode
2. Add tests for new functionality
3. Update documentation for API changes
4. Use conventional commit messages

## License

MIT - See LICENSE file for details.

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review logs with `LOG_LEVEL=debug`
3. Test connection with `npm start test`
4. Verify kocakli/Trello-Desktop-MCP server installation

---

**Note:** This is a development tool designed for integrating Claude Code's TodoWrite functionality with Trello. It keeps complexity low while providing essential project management integration between development sessions and persistent project tracking.