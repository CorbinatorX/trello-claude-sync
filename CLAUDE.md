# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript/Node.js project that provides integration between Claude Code's TodoWrite functionality and Trello boards. It's a development workflow automation tool that allows syncing TodoWrite tasks with Trello cards for persistent project tracking.

## Development Commands

### Core Commands
- `npm run build` - Build TypeScript to JavaScript (outputs to `dist/`)
- `npm run dev` - Run in development mode with watch (`tsx watch src/index.ts`)
- `npm start` - Run the built application
- `npm test` - Run tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint on TypeScript files
- `npm run type-check` - Run TypeScript type checking without emitting files

### Slash Commands
- `npm run slash` - Build and run slash command interface
- Available slash commands:
  - `/trello-create` - Create Trello card from TodoWrite plan
  - `/trello-pickup <card-id>` - Load existing Trello card into session
  - `/trello-complete` - Mark current card as complete
  - `/trello-update` - Sync TodoWrite progress to Trello card
  - `/trello-status` - Show current session status

### Testing and CLI
- `npm start test` - Test connection to Trello board
- `npm start sync` - Sync sample tasks for testing
- `npm start info` - Show current configuration

## Architecture

### Core Services
- **TrelloMCPClient** (`src/services/trello-client.ts`) - Low-level client for Trello MCP operations
- **TodoTrelloSync** (`src/services/todo-sync.ts`) - Main sync logic between TodoWrite and Trello
- **RaveHubTrelloIntegration** (`src/index.ts`) - High-level API and CLI interface

### Slash Command System
- **Slash Commands** (`src/slash-commands.ts`) - Handlers for Claude Code integration commands
- **Session Management** (`src/utils/session.ts`) - Persistent session storage for active cards
- **Command Scripts** (`commands/`) - Executable scripts for each slash command

### Configuration
- **Config Management** (`src/utils/config.ts`) - Environment-based configuration
- **Logger** (`src/utils/logger.ts`) - Structured logging with different levels
- **Types** (`src/types/index.ts`) - TypeScript interfaces for Trello and TodoWrite data

## Key Dependencies

- **@modelcontextprotocol/sdk** - MCP client for Trello integration
- **tsx** - TypeScript execution for development
- **jest** with **ts-jest** - Testing framework with TypeScript support
- **ESLint** with **@typescript-eslint** - Code linting and style enforcement

## Development Workflow

The project uses strict TypeScript with ESLint rules:
- Explicit function return types (warning)
- No unused variables (error, except those prefixed with `_`)
- Prefer const over let
- No `var` usage
- Console logging is allowed

## Environment Setup

Required environment variables (see `.env.example`):
- `TRELLO_API_KEY` - Trello API key
- `TRELLO_TOKEN` - Trello access token
- `TRELLO_BOARD_ID` - Target board ID
- Optional list IDs for auto-discovery
- `NODE_ENV` and `LOG_LEVEL` for development

## Testing Strategy

- Tests located in `src/tests/`
- Uses Jest with ESM support
- Test setup file: `src/tests/setup.ts`
- Coverage reports generated to `coverage/`
- Test timeout: 30 seconds for async operations

## Special Features

### Git Hooks
- **Prepare Commit Message** (`.githooks/prepare-commit-msg`) - Automatically adds emojis to commit messages based on conventional commit prefixes

### Claude Code Integration
- Custom slash commands defined in `.claude/commands/`
- Smart commit command with conventional commit format
- Session persistence for multi-session development workflows