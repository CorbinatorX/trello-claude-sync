#!/usr/bin/env node

/**
 * /trello-create slash command
 * Creates a Trello card from current TodoWrite plan
 */

import { createCardFromPlan } from '../dist/slash-commands.js';

async function main() {
  // Get the plan text from arguments (everything after the command)
  const planText = process.argv.slice(2).join(' ');

  try {
    const result = await createCardFromPlan(planText);
    console.log(result);
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

main();