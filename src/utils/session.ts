import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { TodoTask } from '../types/index.js';

export interface SessionState {
  currentCardId?: string;
  currentCardName?: string;
  linkedTasks?: TodoTask[];
  createdAt?: string;
  lastActivity?: string;
}

const SESSION_FILE = join(process.cwd(), '.trello-session.json');

/**
 * Load session state from disk
 */
export function loadSession(): SessionState {
  try {
    if (!existsSync(SESSION_FILE)) {
      return {};
    }

    const data = readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to load session state:', error);
    return {};
  }
}

/**
 * Save session state to disk
 */
export function saveSession(state: SessionState): void {
  try {
    const sessionData = {
      ...state,
      lastActivity: new Date().toISOString(),
    };

    writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    console.warn('Failed to save session state:', error);
  }
}

/**
 * Clear session state
 */
export function clearSession(): void {
  try {
    if (existsSync(SESSION_FILE)) {
      writeFileSync(SESSION_FILE, JSON.stringify({}, null, 2));
    }
  } catch (error) {
    console.warn('Failed to clear session state:', error);
  }
}

/**
 * Update session with card info
 */
export function setActiveCard(cardId: string, cardName: string, tasks?: TodoTask[]): void {
  const session = loadSession();
  session.currentCardId = cardId;
  session.currentCardName = cardName;
  session.linkedTasks = tasks;
  session.createdAt = session.createdAt || new Date().toISOString();
  saveSession(session);
}

/**
 * Get current active card
 */
export function getActiveCard(): { cardId?: string; cardName?: string; tasks?: TodoTask[] } {
  const session = loadSession();
  return {
    cardId: session.currentCardId,
    cardName: session.currentCardName,
    tasks: session.linkedTasks,
  };
}

/**
 * Update tasks in current session
 */
export function updateSessionTasks(tasks: TodoTask[]): void {
  const session = loadSession();
  if (session.currentCardId) {
    session.linkedTasks = tasks;
    saveSession(session);
  }
}