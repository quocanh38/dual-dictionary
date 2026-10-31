import { execFileSync } from 'node:child_process';
import { META_MODEL_API_PROVIDER } from '../../lessons/provider.js';

export function getMetaApiKey() {
  const fromEnvironment = process.env[META_MODEL_API_PROVIDER.keyEnvironment]?.trim();
  if (fromEnvironment) return { key: fromEnvironment, source: 'environment' };
  if (process.platform !== 'darwin') return { key: '', source: 'unavailable' };

  const queries = [
    ['find-generic-password', '-s', META_MODEL_API_PROVIDER.keychainService, '-a', META_MODEL_API_PROVIDER.keychainAccount, '-w'],
    ['find-generic-password', '-s', META_MODEL_API_PROVIDER.keychainService, '-w'],
  ];
  for (const args of queries) {
    try {
      const key = execFileSync('/usr/bin/security', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (key) return { key, source: 'keychain' };
    } catch {
      // Try the service-only query for older items without the Studio account.
    }
  }
  return { key: '', source: 'unavailable' };
}
