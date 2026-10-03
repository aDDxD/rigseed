import { readOptional } from '../utils/files.js';
import type { Codex } from '../providers/codex/detect.js';

export interface RoleConfig { model: string; reasoning: string }
export interface UserConfig {
  schemaVersion: 1;
  provider: 'codex';
  root: RoleConfig;
  agents: { sol_orchestrator: RoleConfig; luna_worker: RoleConfig };
  maxConcurrentSubagents: number;
}
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}: expected an object.`);
  const doc = value as Record<string, unknown>;
  if (Object.keys(doc).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(doc, key))) throw new Error(`Invalid ${label}: expected only ${keys.join(', ')}.`);
  return doc;
}
function role(value: unknown, label: string): RoleConfig {
  const doc = object(value, ['model', 'reasoning'], label);
  for (const key of ['model', 'reasoning']) {
    if (typeof doc[key] !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(doc[key])) throw new Error(`Invalid ${label}.${key}: expected a model identifier or reasoning name.`);
  }
  return { model: doc.model as string, reasoning: doc.reasoning as string };
}
export function validateUserConfig(input: unknown): UserConfig {
  const doc = object(input, ['schemaVersion', 'provider', 'root', 'agents', 'maxConcurrentSubagents'], 'rigseed configuration');
  if (doc.schemaVersion !== 1 || doc.provider !== 'codex') throw new Error('Configuration requires schemaVersion: 1 and provider: codex.');
  const agents = object(doc.agents, ['sol_orchestrator', 'luna_worker'], 'agents');
  if (!Number.isInteger(doc.maxConcurrentSubagents) || (doc.maxConcurrentSubagents as number) < 2 || (doc.maxConcurrentSubagents as number) > 8) throw new Error('maxConcurrentSubagents must be an integer from 2 to 8 (session-wide).');
  return { schemaVersion: 1, provider: 'codex', root: role(doc.root, 'root'), agents: { sol_orchestrator: role(agents.sol_orchestrator, 'sol_orchestrator'), luna_worker: role(agents.luna_worker, 'luna_worker') }, maxConcurrentSubagents: doc.maxConcurrentSubagents as number };
}
export async function readUserConfig(path: string): Promise<UserConfig> {
  const text = await readOptional(path);
  if (text === null) throw new Error(`Configuration file not found: ${path}`);
  if (Buffer.byteLength(text) > 64 * 1024) throw new Error('Configuration file is too large; maximum size is 64 KiB.');
  let input: unknown;
  try { input = JSON.parse(text); }
  catch { throw new Error('Invalid rigseed JSON. Source contents are omitted to protect private data.'); }
  return validateUserConfig(input);
}
export function configurationFromCodex(codex: Codex): UserConfig {
  const role = (selection: { model: string; effort: string }): RoleConfig => ({ model: selection.model, reasoning: selection.effort });
  return { schemaVersion: 1, provider: 'codex', root: role(codex.root), agents: { sol_orchestrator: role(codex.sol), luna_worker: role(codex.luna) }, maxConcurrentSubagents: codex.maxConcurrentSubagents ?? 4 };
}
