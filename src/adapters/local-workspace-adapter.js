import {createUnavailableCloudAdapter} from './adapter-contract.js';

/**
 * Browser-local implementation of the workspace adapter.
 *
 * `normalizeWorkspace`, `validWorkspace`, `migrateLegacy`, and `makeWorkspace`
 * are injected from Flowboard's domain module so storage stays independent of
 * the current schema and can be tested without the UI.
 */
export function createLocalWorkspaceAdapter({
  storage = globalThis.localStorage,
  storageKey = 'flowboard-workspace',
  legacyKey = 'flowboard-data',
  backupKey = 'flowboard-workspace-backups',
  backupLimit = 5,
  validWorkspace,
  normalizeWorkspace,
  migrateLegacy,
  makeWorkspace,
  clone = value => JSON.parse(JSON.stringify(value))
}) {
  if (!storage || !validWorkspace || !normalizeWorkspace || !migrateLegacy || !makeWorkspace) {
    throw new Error('LocalWorkspaceAdapter requires storage and state normalization functions.');
  }

  const parse = (value) => JSON.parse(value);
  const readBackups = () => {
    try {
      const value = parse(storage.getItem(backupKey) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const backupWorkspace = (workspace, createdAt = new Date().toISOString()) => {
    try {
      const next = [{createdAt, workspace:clone(workspace)}, ...readBackups()].slice(0, backupLimit);
      storage.setItem(backupKey, JSON.stringify(next));
      return {ok:true, backups:next};
    } catch (error) {
      return {ok:false, error};
    }
  };

  return Object.freeze({
    ...createUnavailableCloudAdapter(),
    kind: 'local',
    getSession() { return null; },
    onAuthStateChange(callback) { callback?.(null); return () => {}; },
    loadWorkspace() {
      try {
        const saved = storage.getItem(storageKey);
        if (saved) {
          const parsed = parse(saved);
          if (!validWorkspace(parsed)) throw new Error('Unsupported workspace schema');
          const workspace = normalizeWorkspace(parsed);
          storage.setItem(storageKey, JSON.stringify(workspace));
          return {workspace, migrated:parsed.schemaVersion !== workspace.schemaVersion, source:'current'};
        }
        const legacy = storage.getItem(legacyKey);
        if (legacy) {
          const workspace = migrateLegacy(parse(legacy));
          if (workspace) {
            storage.setItem(storageKey, JSON.stringify(workspace));
            storage.removeItem(legacyKey);
            return {workspace, migrated:true, source:'legacy'};
          }
        }
      } catch (error) {
        return {workspace:makeWorkspace(), migrated:false, source:'recovery', error};
      }
      const workspace = makeWorkspace();
      try { storage.setItem(storageKey, JSON.stringify(workspace)); } catch (error) { return {workspace, migrated:false, source:'fresh', error}; }
      return {workspace, migrated:false, source:'fresh'};
    },
    saveWorkspace(workspace, {createBackup = true, announceAt = new Date().toISOString()} = {}) {
      if (createBackup) backupWorkspace(workspace, announceAt);
      try {
        storage.setItem(storageKey, JSON.stringify(workspace));
        return {ok:true};
      } catch (error) {
        return {ok:false, error};
      }
    },
    backupWorkspace,
    listRecoveryBackups: readBackups,
    exportLocalWorkspace(workspace) { return clone(workspace); }
  });
}
