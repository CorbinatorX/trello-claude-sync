#!/usr/bin/env node

/**
 * /trello-status slash command
 * Shows current Trello session status
 */

import { showStatus } from '../dist/slash-commands.js';

async function main() {
  try {
    const result = await showStatus();
    console.log(result);
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

main();