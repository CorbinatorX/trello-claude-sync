#!/usr/bin/env node

/**
 * /trello-update slash command
 * Updates current card with TodoWrite progress
 */

import { updateCard } from '../dist/slash-commands.js';

async function main() {
  // Optional update note
  const updateNote = process.argv.slice(2).join(' ');

  try {
    const result = await updateCard(updateNote);
    console.log(result);
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

main();