import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preset } from '../../config/preset.js';
import { validateUserConfig, type UserConfig } from '../../config/user.js';
const exec = promisify(execFile);
export interface Model { slug: string; display_name?: string; visibility?: string; supported_reasoning_levels: { effort: string }[] }
export interface Catalog { version: string; models: Model[] }
export interface Selection { model: string; effort: string }
export interface Codex { version: string; root: Selection; sol: Selection; luna: Selection; maxConcurrentSubagents?: number }

export async function discoverCodex(): Promise<Catalog> {
  let version: string;
  try { version = (await exec('codex', ['--version'], { timeout: 10000 })).stdout.trim(); }
  catch { throw new Error('Codex CLI was not detected. Install Codex and ensure codex is on PATH.'); }
  // Do not silently reuse agent syntax across unverified Codex configuration generations.
  if (!/^codex-cli 0\.160\.\d+$/.test(version)) throw new Error(`Unsupported Codex version: ${version}. This release validates Codex 0.160.x only; see docs/codex.md.`);
  const isolated = await mkdtemp(join(tmpdir(), 'rigseed-catalog-'));
  try {
    const { stdout } = await exec('codex', ['debug', 'models', '--bundled'], {
      env: { ...process.env, CODEX_HOME: isolated }, timeout: 10000, maxBuffer: 16 * 1024 * 1024,
    });
    const models = JSON.parse(stdout).models as Model[];
    const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;
    if (!Array.isArray(models) || !models.length || models.some(m => !m || typeof m.slug !== 'string' || !identifier.test(m.slug) || !Array.isArray(m.supported_reasoning_levels) || !m.supported_reasoning_levels.length || m.supported_reasoning_levels.some(r => !r || typeof r.effort !== 'string' || !identifier.test(r.effort))) || new Set(models.map(m => m.slug)).size !== models.length) throw new Error('Malformed model catalog');
    return { version, models };
  } catch { throw new Error('Could not read a valid bundled Codex model catalog; no configuration was changed.'); }
  finally { await rm(isolated, { recursive: true, force: true }); }
}
export function highestReasoning(levels: string[]): string {
  const order = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
  if (levels.some(level => !order.includes(level))) throw new Error('The catalog contains an unfamiliar reasoning level. Select an explicit effort instead of highest.');
  return [...order].reverse().find(level => levels.includes(level))!;
}
export function resolveCodex(catalog: Catalog, input?: UserConfig): Codex {
  const config = input ? validateUserConfig(input) : null;
  function select(model: string, reasoning: string): Selection {
    const entry = catalog.models.find(m => m.slug === model);
    if (!entry) throw new Error(`Requested model ${model} is not in the installed Codex catalog. Use setup --interactive or --config to choose a supported model.`);
    const levels = entry.supported_reasoning_levels.map(r => r.effort);
    const effort = reasoning === 'highest' ? highestReasoning(levels) : reasoning;
    if (!levels.includes(effort)) throw new Error(`Unsupported reasoning ${effort} for ${model}. Supported: ${levels.join(', ')}.`);
    return { model, effort };
  }
  const id = (spec: { generation: string; family: string }) => `gpt-${spec.generation}-${spec.family}`;
  return {
    version: catalog.version,
    root: select(config?.root.model ?? id(preset.root), config?.root.reasoning ?? preset.root.reasoning),
    sol: select(config?.agents.sol_orchestrator.model ?? id(preset.agents.sol_orchestrator), config?.agents.sol_orchestrator.reasoning ?? preset.agents.sol_orchestrator.reasoning),
    luna: select(config?.agents.luna_worker.model ?? id(preset.agents.luna_worker), config?.agents.luna_worker.reasoning ?? preset.agents.luna_worker.reasoning),
    maxConcurrentSubagents: config?.maxConcurrentSubagents ?? preset.maxConcurrentSubagents,
  };
}
export async function detectCodex(): Promise<Codex> { return resolveCodex(await discoverCodex()); }
