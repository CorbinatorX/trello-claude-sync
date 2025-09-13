# Trello Configuration Directory

This directory contains your Trello integration configuration.

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Trello credentials:
   - Get your API key from: https://trello.com/app-key
   - Generate a token with read/write permissions
   - Find your board ID from the board URL

## Files

- `.env.example` - Template with all required variables
- `.env` - Your actual configuration (gitignored for security)
- `session.json` - Runtime session data (auto-generated)

## Security

The `.env` file should be added to your project's `.gitignore` to prevent committing credentials.