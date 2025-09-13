// Test setup and global configurations

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
config({ path: join(__dirname, '../../.env.test') });

// Mock console methods in tests unless specifically testing logging
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(30000);

// Setup test environment variables if not present
if (!process.env.TRELLO_API_KEY) {
  process.env.TRELLO_API_KEY = 'test_api_key';
}

if (!process.env.TRELLO_TOKEN) {
  process.env.TRELLO_TOKEN = 'test_token';
}

if (!process.env.TRELLO_BOARD_ID) {
  process.env.TRELLO_BOARD_ID = 'test_board_id';
}

// Test mode flag
process.env.NODE_ENV = 'test';