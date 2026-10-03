import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { discoverCodex, resolveCodex } from '../providers/codex/detect.js';
import { paths } from '../providers/codex/paths.js';
import { desiredFiles, plan, type Target } from '../providers/codex/install.js';
import { loadState } from '../utils/state.js';
import { readOptional } from '../utils/files.js';
import { parseToml as parse } from '../utils/toml.js';
import { inspectManagedMarkdown } from '../utils/markdown.js';
import { gitRoot, type Options } from './run.js';

export async function doctor(options: Options): Promise<void> {
  console.log('Rigseed Doctor');
  console.log(`✓ Node ${process.versions.node}`);
  let failed = false;
  const check = (ok: boolean, message: string) => { console.log(`${ok ? '✓' : '✗'} ${message}`); if (!ok) failed = true; };
  let catalog;
  try { catalog = await discoverCodex(); check(true, catalog.version); }
  catch (error) { check(false, (error as Error).message); }
  const env = paths(), git = await gitRoot();
  const targets: Target[] = [];
  if (!options.project) targets.push({ root: env.codex, scope: 'global', portable: false });
  if (!options.global && git) {
    try {
      const state = await loadState(env.state, git);
      if (state) targets.push({ root: git, scope: 'project', portable: state.portable });
      else if (options.project) check(false, 'Current project has not been initialized.');
      else console.log('! Git project detected; rigseed init has not been applied.');
    } catch (error) { check(false, (error as Error).message); }
  } else if (options.project) check(false, 'No Git repository detected.');
  if (catalog) for (const target of targets) {
    console.log(`\n${target.scope}: ${target.root}`);
    try {
      const state = await loadState(env.state, target.root);
      check(!!state, 'Ownership state present');
      let settings = state?.configuration;
      if (target.scope === 'project' && !target.portable) {
        const globalState = await loadState(env.state, env.codex);
        check(!!globalState, 'Required global setup registered');
        settings = globalState?.configuration;
        if (globalState) {
          const globalPlan = await plan({ root: env.codex, scope: 'global', portable: false }, resolveCodex(catalog, settings), globalState, false, true);
          check(!globalPlan.changes.length, 'Required global setup matches desired configuration');
        }
      }
      const codex = resolveCodex(catalog, settings);
      for (const file of await desiredFiles(target, codex)) {
        try {
          const text = await readOptional(file.path);
          if (text === null) { check(false, `${file.path}: missing`); continue; }
          if (file.kind === 'markdown') {
            const block = inspectManagedMarkdown(text);
            check(block.present, `${file.path}: managed markers present and valid`);
            if (block.present) check(block.content?.replaceAll('\r\n', '\n') === file.content?.trim(), `${file.path}: managed content matches template`);
          } else {
            const doc = parse(text) as Record<string, any>;
            const mismatches = Object.entries(file.values!).filter(([key, value]) => {
              const actual = key.split('.').reduce((obj, part) => obj?.[part], doc as any);
              return !isDeepStrictEqual(actual, value);
            });
            if (mismatches.length) for (const [key] of mismatches) check(false, `${file.path}: drift at ${key}`);
            else check(true, `${file.path}: managed settings match (${doc.model}, reasoning: ${doc.model_reasoning_effort})`);
          }
        } catch (error) { check(false, `${file.path}: ${(error as Error).message}`); }
      }
      const override = await readOptional(join(target.root, 'AGENTS.override.md'));
      if (override !== null) check(false, 'AGENTS.override.md takes precedence over managed AGENTS.md; review instruction loading.');
      if (target.scope === 'project' && !target.portable && await readOptional(join(target.root, '.codex', 'config.toml')) !== null) console.log('! Project .codex/config.toml exists: it may override global settings; review it manually.');
    } catch (error) { check(false, (error as Error).message); }
  }
  console.log('\n! Root → technical lead → worker: configured policy; live delegation and account model access are not runtime verified.');
  console.log('! Unmanaged settings are preserved; the full Codex runtime loader is not exercised.');
  console.log('! Concurrency is a session-wide budget; per-workstream limits are instruction policy.');
  console.log(failed ? '\nProblems found. Run rigseed diff to inspect managed drift.' : '\nNo configuration problems found.');
  if (failed) process.exitCode = 1;
}
