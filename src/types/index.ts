// Types for Trello MCP Integration

export interface TrelloConfig {
  apiKey: string;
  token: string;
  boardId: string;
  listIds?: {
    todo?: string;
    inProgress?: string;
    review?: string;
    done?: string;
  };
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  url: string;
  shortUrl: string;
  dateLastActivity: string;
  due?: string;
  labels?: TrelloLabel[];
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc?: string;
  url: string;
  lists?: TrelloList[];
}

export interface TodoTask {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

export interface SyncResult {
  success: boolean;
  cardId?: string;
  error?: string;
  action: 'created' | 'updated' | 'moved' | 'skipped';
}

export interface MCPResponse<T = any> {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface SyncOptions {
  createMissingLists?: boolean;
  syncOnlyActiveSession?: boolean;
  addLabels?: boolean;
  includeTimestamps?: boolean;
}