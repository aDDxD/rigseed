import { validateUserConfig, type UserConfig } from '../config/user.js';
import { join } from 'node:path';
import { readOptional, hash } from './files.js';
import type { Ownership } from '../providers/codex/merge.js';
export interface FileRecord { path: string; kind: 'markdown' | 'toml'; created: boolean; owned?: Ownership }
export interface State { schema: 1; version: string; provider: 'codex'; scope: 'global' | 'project'; root: string; portable: boolean; files: FileRecord[]; backup?: string; configuration?: UserConfig }
export function statePath(base: string, root: string) { return join(base, 'targets', `${hash(root).slice(0, 24)}.json`); }
function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value);
}
export async function loadState(base: string, root: string): Promise<State | null> {
  const text = await readOptional(statePath(base, root));
  if (text === null) return null;
  let state: State;
  try { state = JSON.parse(text); } catch { throw new Error('Invalid rigseed state JSON. Restore the state backup before continuing.'); }
  if (state.schema !== 1 || state.provider !== 'codex' || state.root !== root || !Array.isArray(state.files) || !['global', 'project'].includes(state.scope) || typeof state.portable !== 'boolean') throw new Error('Invalid rigseed state; no changes were made.');
  if (state.configuration !== undefined) state.configuration = validateUserConfig(state.configuration);
  const seen = new Set<string>();
  for (const file of state.files) {
    if (!file || typeof file.path !== 'string' || seen.has(file.path) || !['markdown', 'toml'].includes(file.kind) || typeof file.created !== 'boolean') throw new Error('Invalid managed file record in rigseed state.');
    seen.add(file.path);
    if (file.owned !== undefined) {
      if (!file.owned || typeof file.owned !== 'object' || Array.isArray(file.owned)) throw new Error('Invalid TOML ownership state.');
      for (const entry of Object.values(file.owned)) {
        if (!entry || typeof entry !== 'object' || !Object.hasOwn(entry, 'value') || !isScalar(entry.value) || (Object.hasOwn(entry, 'original') && !isScalar(entry.original))) throw new Error('Invalid TOML ownership value in state.');
      }
    }
  }
  return state;
}
