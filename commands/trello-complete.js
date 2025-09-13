#!/usr/bin/env node

/**
 * /trello-complete slash command
 * Moves current session card to Done list
 */

import { completeCard } from '../dist/slash-commands.js';

async function main() {
  // Optional completion note
  const completionNote = process.argv.slice(2).join(' ');

  try {
    const result = await completeCard(completionNote);
    console.log(result);
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

main();