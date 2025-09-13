# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2024-09-13

### 🎯 Major Features Added

#### Automatic TodoWrite-Trello Sync Hooks
- **PostToolUse Integration**: Automatically triggers after every TodoWrite update
- **Real-time Sync**: No manual commands needed - updates happen instantly
- **Smart Checklist Matching**: Automatically updates existing Trello checklist items
- **Progress Tracking**: Real-time progress calculation (e.g., 3/15 tasks completed)
- **Milestone Comments**: Auto-comments added for significant progress milestones

#### Enhanced Sync Service
- **Simple Auto Sync**: New `SimpleAutoSyncService` class for reliable automatic updates
- **Fuzzy Task Matching**: Intelligent matching between TodoWrite tasks and Trello checklist items
- **Session State Management**: Proper state persistence across Claude Code sessions
- **Error Handling**: Robust error handling and logging for hook operations

#### Claude Code Integration
- **Hooks Configuration**: `.claude/claude_hooks.json` for PostToolUse hook setup
- **Hook Handler**: `hooks/todo-sync-hook.js` for processing TodoWrite updates
- **Installation Scripts**: `npm run install:hooks` for easy setup

### 🔧 Improvements
- **TypeScript**: Full TypeScript support with proper types for all new services
- **Build Process**: Enhanced build process for hook distribution
- **Documentation**: Complete documentation update with v2.0 features
- **Package Structure**: Updated package.json with hook files for npm distribution

### 🐛 Bug Fixes
- **Progress Calculation**: Fixed progress counting to respect original Trello checklist structure
- **Task Matching**: Improved task matching algorithm for better sync reliability
- **Session Persistence**: Fixed session state issues that caused sync inconsistencies

### 💥 Breaking Changes
- **Version Bump**: Major version bump to 2.0.0 due to significant new functionality
- **Package Structure**: Added new directories (`hooks/`, `.claude/`) to package distribution

---

## [1.0.0] - 2024-09-13

### 🚀 Initial Release

#### Core Features
- **Bidirectional Sync**: Link TodoWrite tasks with Trello cards
- **Smart Mapping**: Auto-discovery of board lists (To Do, In Progress, Done, etc.)
- **Automatic Labeling**: Content-based label assignment (bug, feature, API, etc.)
- **Checklist Management**: TodoWrite tasks become Trello checklist items
- **Progress Comments**: Add progress notes to cards during development
- **Card Linking**: Search and link existing Trello cards to new tasks
- **Session Persistence**: State survives across command executions
- **Automatic Movement**: Cards flow through lists based on workflow state
- **Global CLI**: Install once, use anywhere with `trello-claude-sync` command

#### CLI Commands
- `/trello-create` - Create Trello cards from TodoWrite plans
- `/trello-pickup` - Load existing cards into active session
- `/trello-update` - Sync progress to Trello with comments
- `/trello-complete` - Move cards to Done and clear session
- `/trello-status` - Show current workflow state

#### Technical Foundation
- **TypeScript**: Full TypeScript implementation with strict types
- **REST API**: Direct Trello REST API integration
- **Session Management**: File-based persistent session storage
- **Error Handling**: Comprehensive error handling and logging
- **Testing**: Jest test framework with comprehensive test coverage