import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { createTwoFilesPatch } from 'diff';
import { discoverCodex, resolveCodex, type Catalog, type Codex } from '../providers/codex/detect.js';
import { paths } from '../providers/codex/paths.js';
import { plan, type Target, type Plan } from '../providers/codex/install.js';
import { TomlConflict, type DesiredValues } from '../providers/codex/merge.js';
import { loadState, statePath, type State } from '../utils/state.js';
import { readOptional } from '../utils/files.js';
import { commit, newBackupPath, type Change } from '../utils/transaction.js';
import { readUserConfig, type UserConfig } from '../config/user.js';
import { CancelledError, selectConfiguration } from '../config/wizard.js';
import { doctor } from './doctor.js';
const exec = promisify(execFile);
export interface Options { yes?: boolean; dryRun?: boolean; portable?: boolean; global?: boolean; project?: boolean; preset?: string; interactive?: boolean; config?: string }
export async function gitRoot(): Promise<string | null> {
  try { return (await exec('git', ['rev-parse', '--show-toplevel'], { timeout: 10000 })).stdout.trim(); }
  catch { return null; }
}
function printPlan(p: Plan, details: boolean) {
  console.log(`\nCodex ${p.target.scope}: ${p.target.root}`);
  for (const report of p.reports) {
    const change = p.changes.find(c => c.path === report.path);
    const status = !change ? 'no changes' : change.after === null ? 'remove' : change.before === null ? 'create' : 'modify';
    console.log(`  ${report.path}: ${status}`);
    if (change && details) console.log(createTwoFilesPatch(report.path, report.path, change.displayBefore, change.displayAfter, 'installed (managed)', 'desired (managed)'));
  }
}
async function question(message: string): Promise<string> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try { return await prompt.question(message); }
  finally { prompt.close(); }
}
async function confirm(options: Options): Promise<boolean> {
  if (options.yes) return true;
  if (!process.stdin.isTTY) throw new Error('Non-interactive input: rerun with --yes or --dry-run. Conflicts are never overridden by --yes.');
  return /^y(es)?$/i.test((await question('Apply these changes? [y/N] ')).trim());
}
interface Work { target: Target; previous: State | null; codex: Codex | null }
async function safePlan(work: Work, options: Options, uninstall: boolean): Promise<Plan> {
  const approvals: Record<string, DesiredValues> = {};
  while (true) {
    try { return await plan(work.target, work.codex, work.previous, uninstall, false, approvals); }
    catch (error) {
      if (!(error instanceof TomlConflict) || uninstall || options.yes || options.dryRun || !process.stdin.isTTY || !error.canAdopt) throw error;
      // Show the entire managed projection before asking to adopt an existing value.
      const preview = await plan(work.target, work.codex, work.previous, false, true);
      printPlan(preview, true);
      // Locate the conflict's file without logging its potentially private source contents.
      const candidate = preview.changes.find(change => change.path === error.file);
      if (!candidate) throw error;
      const answer = (await question(`Adopt the desired value for ${error.key} in ${candidate.path}? The original is backed up and restored by uninstall. [y/N] `)).trim();
      if (!/^y(es)?$/i.test(answer)) throw new CancelledError();
      (approvals[candidate.path] ||= {})[error.key] = error.current;
    }
  }
}
export async function run(command: string, options: Options): Promise<void> {
  if (options.global && options.project) throw new Error('Choose either --global or --project.');
  if (options.preset && options.preset !== 'default') throw new Error('Only the default preset is implemented.');
  if (options.interactive && options.yes) throw new Error('--interactive cannot be combined with --yes.');
  if (options.interactive && options.config) throw new Error('Choose --interactive or --config, not both.');
  if (options.interactive && !process.stdin.isTTY) throw new Error('--interactive requires a terminal. Use --config with --yes for automation.');
  if (command === 'doctor') { await doctor(options); return; }
  const env = paths(), git = await gitRoot();
  let globalState = options.project ? null : await loadState(env.state, env.codex);
  const localState = git && !options.global && command !== 'setup' ? await loadState(env.state, git) : null;
  if (options.project && localState && !localState.portable && command !== 'uninstall') globalState = await loadState(env.state, env.codex);
  if (command === 'init' && !git) throw new Error('No Git repository detected. Run git init first.');
  const portable = options.portable ?? localState?.portable ?? false;
  if (command === 'init' && !portable && (options.config || options.interactive)) throw new Error('Model customization in a project requires init --portable. Normal init uses the global setup.');
  const input = options.config ? await readUserConfig(options.config) : undefined;
  const catalog: Catalog | null = command === 'uninstall' ? null : await discoverCodex();
  if (catalog) console.log(`✓ ${catalog.version} detected (bundled catalog; account access not verified)`);
  let chosen: UserConfig | undefined = input;
  const initial = command === 'setup' ? globalState : localState;
  const canChoose = command === 'setup' || command === 'init' && portable;
  const shouldChoose = options.interactive || canChoose && !initial && !input && !options.yes && !options.dryRun && !!process.stdin.isTTY;
  if (shouldChoose) {
    console.log('Rigseed setup: choose models and reasoning. No configuration is written until you approve the final plan.');
    chosen = await selectConfiguration(catalog!, initial?.configuration);
  }
  let targets: Target[];
  if (command === 'setup') targets = [{ root: env.codex, scope: 'global', portable: false }];
  else if (command === 'init') {
    if (!portable) {
      if (!globalState) throw new Error('Global Rigseed setup is missing. Run rigseed setup first, or use init --portable.');
      const globalCodex = resolveCodex(catalog!, globalState.configuration);
      const globalPlan = await plan({ root: env.codex, scope: 'global', portable: false }, globalCodex, globalState);
      if (globalPlan.changes.length) throw new Error('Global configuration has drift. Run rigseed diff and update, or use init --portable.');
    }
    targets = [{ root: git!, scope: 'project', portable }];
  } else {
    targets = [];
    if (!options.project && (globalState || command === 'diff')) targets.push({ root: env.codex, scope: 'global', portable: false });
    if (!options.global && localState && git) targets.push({ root: git, scope: 'project', portable: localState.portable });
    if (options.project && !localState) throw new Error('This Git project is not registered. Run rigseed init first.');
    if (!targets.length) { console.log('No managed targets found.'); return; }
  }
  if (input && !targets.some(t => t.scope === 'global') && targets.some(t => t.scope === 'project' && !t.portable)) throw new Error('Regular projects inherit global choices. Use update --global --config to change them, or a portable project for independent choices.');
  const works: Work[] = targets.map(target => {
    const previous = target.scope === 'global' ? globalState : localState;
    const settings = chosen || (target.scope === 'project' && !target.portable ? globalState?.configuration : previous?.configuration);
    return { target, previous, codex: catalog ? resolveCodex(catalog, settings) : null };
  });
  // Inspect every target before asking conflict-adoption questions or making any writes.
  if (command !== 'uninstall') for (const work of works) await plan(work.target, work.codex, work.previous, false, true);
  const plans: Plan[] = [], stateChanges: Change[] = [];
  for (const work of works) {
    const p = command === 'diff' ? await plan(work.target, work.codex, work.previous, false, true) : await safePlan(work, options, command === 'uninstall');
    plans.push(p);
    const path = statePath(env.state, work.target.root), before = await readOptional(path);
    const after = command === 'uninstall' ? null : JSON.stringify(p.state, null, 2) + '\n';
    if (before !== after) stateChanges.push({ path, before, after, displayBefore: '', displayAfter: '' });
  }
  for (const p of plans) printPlan(p, !!options.dryRun || command === 'diff' || shouldChoose);
  const changes = plans.flatMap(p => p.changes);
  if (command === 'diff') { if (!changes.length) console.log('\nNo changes required.'); return; }
  if (!changes.length && !stateChanges.length) { console.log('\nNo changes required.'); return; }
  if (stateChanges.length) console.log(`  Ownership state: ${command === 'uninstall' ? 'remove' : 'record'} (${env.state}/targets)`);
  if (options.dryRun) { console.log('\nDry run: no changes made.'); return; }
  if (!await confirm(options)) { console.log('Cancelled.'); return; }
  const backupLocation = [...changes, ...stateChanges].some(c => c.before !== null) ? newBackupPath(env.state) : undefined;
  if (backupLocation && command !== 'uninstall') for (const p of plans) {
    p.state.backup = backupLocation;
    const path = statePath(env.state, p.target.root), after = JSON.stringify(p.state, null, 2) + '\n';
    const existing = stateChanges.find(c => c.path === path);
    if (existing) existing.after = after;
    else stateChanges.push({ path, before: await readOptional(path), after, displayBefore: '', displayAfter: '' });
  }
  const backup = await commit(env.state, changes, stateChanges, backupLocation);
  if (backup) console.log(`Backup: ${backup}`);
  console.log('Done.');
}
