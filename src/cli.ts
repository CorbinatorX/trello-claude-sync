#!/usr/bin/env node

import { createCardFromPlan, pickupCard, completeCard, showStatus, updateCard } from './slash-commands.js';
import chalk from 'chalk';

/**
 * CLI entry point for trello-claude-sync package
 * Provides global CLI access to Trello integration commands
 */

const USAGE = `
${chalk.bold.blue('trello-claude-sync')} - Trello integration for Claude Code TodoWrite

${chalk.bold('USAGE:')}
  trello-claude-sync <command> [options]

${chalk.bold('COMMANDS:')}
  ${chalk.green('create')} [plan-text]     Create Trello card from TodoWrite plan
  ${chalk.green('pickup')} <card-id>       Pick up existing card for work
  ${chalk.green('status')}                 Show current session status
  ${chalk.green('update')} [note]          Update card with current progress
  ${chalk.green('complete')} [note]        Mark current card as complete
  ${chalk.green('help')}                   Show this help message

${chalk.bold('EXAMPLES:')}
  trello-claude-sync create "Implement user authentication"
  trello-claude-sync pickup 68c5ade263559cdf6d7cfbe1
  trello-claude-sync status
  trello-claude-sync complete "All tests passing"

${chalk.bold('SETUP:')}
  Ensure you have configured your Trello API credentials in .env:
  - TRELLO_API_KEY
  - TRELLO_TOKEN
  - TRELLO_BOARD_ID

For setup instructions, run the setup script or check the documentation.
`;

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  try {
    let result: string;

    switch (command) {
      case 'create':
        result = await createCardFromPlan(args.join(' '));
        break;

      case 'pickup':
        if (args.length === 0) {
          console.error(chalk.red('❌ Error: Card ID or name is required'));
          console.log('\nUsage: trello-claude-sync pickup <card-id-or-name>');
          process.exit(1);
        }
        result = await pickupCard(args[0]);
        break;

      case 'status':
        result = await showStatus();
        break;

      case 'update':
        result = await updateCard(args.join(' '));
        break;

      case 'complete':
        result = await completeCard(args.join(' '));
        break;

      default:
        console.error(chalk.red(`❌ Unknown command: ${command}`));
        console.log('\nRun "trello-claude-sync help" for available commands.');
        process.exit(1);
    }

    console.log(result);

  } catch (error) {
    console.error(chalk.red('❌ Command failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('❌ Unexpected error:'), error);
  process.exit(1);
});