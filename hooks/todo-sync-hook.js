#!/usr/bin/env node

/**
 * Claude Code PostToolUse Hook for TodoWrite-Trello Auto Sync
 *
 * This hook is triggered after every TodoWrite tool use and automatically
 * syncs the current task state to the active Trello card.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SimpleAutoSyncService } from '../dist/services/simple-auto-sync.js';
import { logger } from '../dist/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main hook handler
 */
async function handleTodoWriteUpdate(hookContext) {
  try {
    logger.info('🎣 TodoWrite hook triggered - checking for auto-sync...');

    // Extract TodoWrite tasks from hook payload
    const tasks = parseTasksFromPayload(hookContext);
    if (!tasks || tasks.length === 0) {
      logger.info('No tasks found in TodoWrite payload - skipping sync');
      return {
        success: true,
        message: 'No tasks found in TodoWrite payload'
      };
    }

    logger.info(`📝 Found ${tasks.length} tasks in TodoWrite payload`);

    // Use the auto-sync service
    const autoSync = new SimpleAutoSyncService();
    const result = await autoSync.syncTasks(tasks);

    logger.info(`🔄 Auto-sync result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);

    return result;

  } catch (error) {
    logger.error('❌ Auto-sync hook failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse TodoWrite tasks from the hook payload
 */
function parseTasksFromPayload(hookContext) {
  try {
    // The hook payload should contain the TodoWrite tool parameters
    const toolParameters = hookContext.toolParameters;

    if (!toolParameters || !toolParameters.todos) {
      logger.warn('No todos found in TodoWrite payload structure:', JSON.stringify(hookContext, null, 2));
      return [];
    }

    // Convert TodoWrite format to our internal format
    const tasks = toolParameters.todos.map(todo => ({
      content: todo.content,
      status: todo.status, // completed, in_progress, pending
      activeForm: todo.activeForm
    }));

    logger.info(`📋 Parsed ${tasks.length} tasks from payload`);

    // Log task summary for debugging
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    logger.info(`Task breakdown: ${completed} completed, ${inProgress} in progress, ${pending} pending`);

    return tasks;

  } catch (error) {
    logger.error('Failed to parse tasks from TodoWrite payload:', error);
    logger.error('Hook context:', JSON.stringify(hookContext, null, 2));
    return [];
  }
}

// Hook entry point
if (process.argv.length > 2) {
  // Called as hook with context JSON as argument
  try {
    const hookContextJson = process.argv[2];
    logger.info('🚀 Hook started with context length:', hookContextJson.length);

    const hookContext = JSON.parse(hookContextJson);

    handleTodoWriteUpdate(hookContext)
      .then(result => {
        console.log(JSON.stringify(result));
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        logger.error('Hook execution failed:', error);
        console.error(JSON.stringify({
          success: false,
          error: error.message
        }));
        process.exit(1);
      });
  } catch (error) {
    logger.error('Hook startup failed:', error);
    console.error(JSON.stringify({
      success: false,
      error: `Hook startup failed: ${error.message}`
    }));
    process.exit(1);
  }
} else {
  // Called directly for testing
  console.log('TodoWrite Auto-sync Hook - Ready for PostToolUse events');
  console.log('Usage: node todo-sync-hook.js \'<hook-context-json>\'');
}