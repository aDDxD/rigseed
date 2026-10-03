import { createInterface } from 'node:readline/promises';
import { configurationFromCodex, validateUserConfig, type UserConfig, type RoleConfig } from './user.js';
import { resolveCodex, highestReasoning, type Catalog, type Model } from '../providers/codex/detect.js';

export class CancelledError extends Error { constructor() { super('Cancelled. No changes were made.'); } }
export type Ask = (message: string) => Promise<string>;
function response(text: string): string {
  const value = text.trim();
  if (value.toLowerCase() === 'q') throw new CancelledError();
  return value;
}
async function choice(ask: Ask, label: string, values: string[], current: string): Promise<string> {
  const index = Math.max(0, values.indexOf(current));
  const menu = values.map((value, i) => `  ${i + 1}. ${value}${i === index ? ' (default)' : ''}`).join('\n');
  while (true) {
    const answer = response(await ask(`\n${label}\n${menu}\nChoose 1-${values.length}, Enter for default, or q to cancel: `));
    if (!answer) return values[index];
    const number = /^\d+$/.test(answer) ? Number(answer) : NaN;
    if (Number.isInteger(number) && number >= 1 && number <= values.length) return values[number - 1];
    if (values.includes(answer)) return answer;
    // Repeat the available choices instead of accepting unsupported identifiers.
  }
}
export async function selectConfiguration(catalog: Catalog, current?: UserConfig, injectedAsk?: Ask): Promise<UserConfig> {
  if (!injectedAsk && !process.stdin.isTTY) throw new Error('--interactive requires a terminal. Use --config with --yes for automation.');
  const prompt = injectedAsk ? null : createInterface({ input: process.stdin, output: process.stdout });
  const ask: Ask = injectedAsk || (message => prompt!.question(message).catch(() => { throw new CancelledError(); }));
  try {
    const models = catalog.models.filter(m => m.visibility === undefined || m.visibility === 'list');
    if (!models.length) throw new Error('The catalog has no selectable models.');
    let defaults = current;
    if (!defaults) {
      try { defaults = configurationFromCodex(resolveCodex(catalog)); }
      catch { /* A catalog without the recommended models is still usable interactively. */ }
    }
    async function role(label: string, old: RoleConfig | undefined, worker = false): Promise<RoleConfig> {
      const model = await choice(ask, `${label}: model (catalog support does not verify account access)`, models.map(m => m.slug), old?.model || models[0].slug);
      const entry = models.find(m => m.slug === model) as Model;
      const efforts = entry.supported_reasoning_levels.map(r => r.effort);
      let fallback = efforts.includes('medium') ? 'medium' : efforts[0];
      if (worker) { try { fallback = highestReasoning(efforts); } catch { /* Explicit selection is available for unfamiliar levels. */ } }
      const preferred = old?.reasoning === 'highest' ? highestReasoning(efforts) : old?.reasoning;
      const reasoning = await choice(ask, `${label}: reasoning`, efforts, preferred && efforts.includes(preferred) ? preferred : fallback);
      return { model, reasoning };
    }
    const root = await role('Root supervisor', defaults?.root);
    const sol = await role('Technical lead (sol_orchestrator)', defaults?.agents.sol_orchestrator);
    const luna = await role('Worker (luna_worker)', defaults?.agents.luna_worker, true);
    let concurrency: number;
    while (true) {
      const value = response(await ask(`\nSession-wide subagent limit, 2-8 [${defaults?.maxConcurrentSubagents || 4}] (includes the technical lead): `));
      concurrency = value ? Number(value) : defaults?.maxConcurrentSubagents || 4;
      if (Number.isInteger(concurrency) && concurrency >= 2 && concurrency <= 8) break;
    }
    return validateUserConfig({ schemaVersion: 1, provider: 'codex', root, agents: { sol_orchestrator: sol, luna_worker: luna }, maxConcurrentSubagents: concurrency });
  } finally { prompt?.close(); }
}
