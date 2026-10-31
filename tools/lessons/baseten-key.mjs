import { execFileSync } from 'node:child_process';
import { HACKATHON_PROVIDER } from '../../lessons/provider.js';

export function getBasetenApiKey() {
  const fromEnvironment = process.env.BASETEN_API_KEY?.trim();
  if (fromEnvironment) return { key: fromEnvironment, source: 'environment' };
  if (process.platform !== 'darwin') return { key: '', source: 'unavailable' };
  try {
    const key = execFileSync('/usr/bin/security', [
      'find-generic-password', '-s', HACKATHON_PROVIDER.keychainService,
      '-a', HACKATHON_PROVIDER.keychainAccount, '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { key, source: key ? 'keychain' : 'empty' };
  } catch {
    return { key: '', source: 'unavailable' };
  }
}
