#!/usr/bin/env node

/**
 * /trello-pickup slash command
 * Loads existing Trello card into TodoWrite session
 */

import { pickupCard } from '../dist/slash-commands.js';

async function main() {
  const cardIdentifier = process.argv[2];

  if (!cardIdentifier) {
    console.log('❌ Usage: /trello-pickup <card-id-or-name>');
    console.log('\nExamples:');
    console.log('  /trello-pickup "user authentication"');
    console.log('  /trello-pickup 507f1f77bcf86cd799439011');
    process.exit(1);
  }

  try {
    const result = await pickupCard(cardIdentifier);
    console.log(result);
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

main();