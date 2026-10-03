import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseToml as parse } from '../../utils/toml.js';
import type { Codex } from './detect.js';
import { metadata } from '../../config/package.js';
import { configurationFromCodex } from '../../config/user.js';
import { mergeToml, TomlConflict, type DesiredValues } from './merge.js';
import { updateManagedMarkdown, removeManagedMarkdown, inspectManagedMarkdown } from '../../utils/markdown.js';
import { readOptional } from '../../utils/files.js';
import type { Change } from '../../utils/transaction.js';
import type { State, FileRecord } from '../../utils/state.js';

const templates = fileURLToPath(new URL('../../../templates/codex/', import.meta.url).href.replace('/dist/templates/', '/templates/'));
export interface Target { root: string; scope: 'global' | 'project'; portable: boolean }
export interface Plan { target: Target; state: State; changes: Change[]; reports: { path: string; changed: boolean }[] }
function flatten(value: Record<string, any>, prefix = ''): DesiredValues {
  const result: DesiredValues = {};
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)) Object.assign(result, flatten(item, name));
    else result[name] = item;
  }
  return result;
}
// Empty tables belonging to removed managed leaves may remain after safe merge.
// An unrelated empty table added by the user is still external content to preserve.
function onlyManagedEmptyTables(root: Record<string, any>, ownedKeys: string[], prefix = ''): boolean {
  return Object.entries(root).every(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
      && ownedKeys.some(owned => owned.startsWith(`${path}.`))
      && onlyManagedEmptyTables(value, ownedKeys, path);
  });
}
function managedDisplay(text: string, keys: string[]): string {
  const values = flatten(parse(text));
  return keys.filter(k => Object.hasOwn(values, k)).sort().map(k => `${k} = ${JSON.stringify(values[k], (_key, value) => typeof value === 'bigint' ? String(value) : value)}`).join('\n') + '\n';
}
export async function desiredFiles(target: Target, codex: Codex): Promise<{ path: string; kind: 'markdown' | 'toml'; content?: string; values?: DesiredValues }[]> {
  const base = target.scope === 'global' ? target.root : join(target.root, '.codex');
  const render = (text: string) => text.replaceAll('{{maxConcurrentSubagents}}', String(codex.maxConcurrentSubagents ?? 4)).replaceAll('{{maxWorkers}}', String((codex.maxConcurrentSubagents ?? 4) - 1));
  const markdown = render(await readFile(join(templates, target.scope, 'AGENTS.md'), 'utf8'));
  const files: Awaited<ReturnType<typeof desiredFiles>> = [{ path: join(target.root, 'AGENTS.md'), kind: 'markdown', content: markdown }];
  if (target.scope === 'global' || target.portable) {
    files.push({ path: join(base, 'config.toml'), kind: 'toml', values: {
      model: codex.root.model, model_reasoning_effort: codex.root.effort,
      'features.multi_agent_v2': false, 'agents.enabled': true,
      'agents.max_depth': 2, 'agents.max_concurrent_threads_per_session': (codex.maxConcurrentSubagents ?? 4),
    } });
    for (const [name, selection] of [['sol_orchestrator', codex.sol], ['luna_worker', codex.luna]] as const) {
      const text = render(await readFile(join(templates, 'global', 'agents', `${name}.toml`), 'utf8'))
        .replaceAll('{{model}}', selection.model).replaceAll('{{reasoning}}', selection.effort);
      files.push({ path: join(base, 'agents', `${name}.toml`), kind: 'toml', values: flatten(parse(text)) });
    }
  }
  return files;
}
export async function plan(target: Target, codex: Codex | null, previous: State | null, uninstall = false, preview = false, approvals: Record<string, DesiredValues> = {}): Promise<Plan> {
  if (previous && (previous.scope !== target.scope || previous.portable !== target.portable)) throw new Error('Existing target uses a different mode. Uninstall that target first to change modes.');
  const wanted = uninstall ? [] : await desiredFiles(target, codex!);
  const permitted = new Set([join(target.root, 'AGENTS.md'), ...['config.toml', 'agents/sol_orchestrator.toml', 'agents/luna_worker.toml'].map(x => join(target.scope === 'global' ? target.root : join(target.root, '.codex'), x))]);
  for (const file of previous?.files || []) {
    if (!permitted.has(file.path) || file.kind !== (file.path.endsWith('AGENTS.md') ? 'markdown' : 'toml')) throw new Error('State contains an unexpected file; no changes were made.');
  }
  for (const file of previous?.files || []) {
    const allowed = file.path.endsWith('config.toml')
      ? ['model', 'model_reasoning_effort', 'features.multi_agent_v2', 'agents.enabled', 'agents.max_depth', 'agents.max_concurrent_threads_per_session']
      : ['name', 'description', 'developer_instructions', 'model', 'model_reasoning_effort', 'agents.enabled', 'agents.max_depth', 'agents.max_concurrent_threads_per_session', 'features.multi_agent_v2'];
    if (Object.keys(file.owned || {}).some(key => !allowed.includes(key))) throw new Error('State claims an unexpected TOML key; no changes were made.');
  }
  const changes: Change[] = [], records: FileRecord[] = [], reports: Plan['reports'] = [];
  const inputs = uninstall ? previous?.files || [] : wanted;
  for (const input of inputs) {
    const old = previous?.files.find(f => f.path === input.path);
    const before = await readOptional(input.path);
    let after: string | null, displayBefore: string, displayAfter: string;
    const record: FileRecord = { path: input.path, kind: input.kind, created: old?.created ?? before === null };
    if (input.kind === 'markdown') {
      const text = before || '';
      displayBefore = inspectManagedMarkdown(text).content || '';
      const content = 'content' in input ? input.content! : '';
      after = uninstall ? removeManagedMarkdown(text) : updateManagedMarkdown(text, content);
      displayAfter = uninstall ? '' : inspectManagedMarkdown(after).content || '';
      if (uninstall && record.created && !after.trim()) after = null;
    } else {
      const values = 'values' in input ? input.values! : {};
      let merged;
      try { merged = mergeToml(before || '', values, old?.owned, uninstall, approvals[input.path]); }
      catch (error) {
        if (error instanceof TomlConflict) error.file = input.path;
        if (!preview) throw error;
        // Diff projects only desired managed keys. This result is never committed.
        merged = mergeToml('', values);
      }
      record.owned = merged.owned;
      after = merged.text;
      const keys = [...new Set([...Object.keys(values), ...Object.keys(old?.owned || {})])];
      displayBefore = managedDisplay(before || '', keys); displayAfter = managedDisplay(after, keys);
      if (uninstall && record.created && onlyManagedEmptyTables(parse(after), Object.keys(old?.owned || {}))) after = null;
    }
    if (before === null && uninstall) after = null;
    records.push(record);
    reports.push({ path: input.path, changed: before !== after });
    if (before !== after) changes.push({ path: input.path, before, after, displayBefore, displayAfter });
  }
  return { target, changes, reports, state: { schema: 1, version: metadata.version, provider: 'codex', scope: target.scope, root: target.root, portable: target.portable, files: records, ...(!uninstall && codex ? { configuration: configurationFromCodex(codex) } : {}), ...(previous?.backup ? { backup: previous.backup } : {}) } };
}
