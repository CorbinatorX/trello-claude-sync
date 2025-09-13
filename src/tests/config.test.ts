import { ConfigManager, getConfig } from '../utils/config.js';

describe('ConfigManager', () => {
  beforeEach(() => {
    // Reset singleton instance for clean tests
    (ConfigManager as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getConfig', () => {
    it('should return configuration with required fields', () => {
      const config = getConfig();

      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('token');
      expect(config).toHaveProperty('boardId');
      expect(config).toHaveProperty('listIds');

      expect(typeof config.apiKey).toBe('string');
      expect(typeof config.token).toBe('string');
      expect(typeof config.boardId).toBe('string');
    });

    it('should include list IDs from environment', () => {
      const config = getConfig();

      expect(config.listIds).toEqual({
        todo: 'list_todo_123',
        inProgress: 'list_progress_456',
        review: 'list_review_789',
        done: 'list_done_012',
      });
    });

    it('should return copy of config (not reference)', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('updateListIds', () => {
    it('should update list IDs in configuration', () => {
      const configManager = ConfigManager.getInstance();
      const initialConfig = configManager.getConfig();

      configManager.updateListIds({
        todo: 'new_todo_list',
        inProgress: 'new_progress_list',
      });

      const updatedConfig = configManager.getConfig();

      expect(updatedConfig.listIds?.todo).toBe('new_todo_list');
      expect(updatedConfig.listIds?.inProgress).toBe('new_progress_list');
      expect(updatedConfig.listIds?.review).toBe(initialConfig.listIds?.review);
      expect(updatedConfig.listIds?.done).toBe(initialConfig.listIds?.done);
    });
  });
});