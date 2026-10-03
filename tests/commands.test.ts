import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, unlink, chmod } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
import { START_MARKER, END_MARKER } from '../src/utils/markdown.js';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
type Result = { status: number | null; output: string };

async function fixture(t: TestContext, highestLunaEffort = 'xhigh') {
  const root = await mkdtemp(join(tmpdir(), 'rigseed-commands-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'home'), codex = join(home, 'custom-codex'), state = join(root, 'state');
  const bin = join(root, 'bin'), project = join(root, 'project');
  await Promise.all([home, bin, project].map(path => mkdir(path, { recursive: true })));
  const catalog = { models: [
    { slug: 'gpt-6-astra', supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'high' }] },
    { slug: 'gpt-6.1-sol', supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'xhigh' }] },
    { slug: 'gpt-6-luna', supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'high' }, { effort: highestLunaEffort }] },
  ] };
  await writeFile(join(bin, 'codex'), `#!${process.execPath}\nconst args = process.argv.slice(2);\nif (args.join(' ') === '--version') console.log('codex-cli 0.160.0');\nelse if (args.join(' ') === 'debug models --bundled') console.log(${JSON.stringify(JSON.stringify(catalog))});\nelse { console.error('Unexpected mock arguments', args); process.exit(2); }\n`);
  await chmod(join(bin, 'codex'), 0o700);
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: codex, XDG_STATE_HOME: state, XDG_CONFIG_HOME: join(root, 'config'), PATH: `${bin}:${process.env.PATH || ''}` };
  execFileSync('git', ['init', '--quiet', project], { env });
  const run = (args: string[], cwd = root, overrides: NodeJS.ProcessEnv = {}): Result => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 20000 });
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  };
  const ok = (args: string[], cwd = root): Result => {
    const result = run(args, cwd);
    assert.equal(result.status, 0, result.output);
    return result;
  };
  const snapshot = async (): Promise<Record<string, string>> => {
    const contents: Record<string, string> = {};
    async function walk(path: string) {
      let entries;
      try { entries = await readdir(path, { withFileTypes: true }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
      for (const entry of entries) {
        if (entry.name === '.git') continue;
        const file = join(path, entry.name);
        if (entry.isDirectory()) await walk(file);
        else contents[file] = await readFile(file, 'utf8');
      }
    }
    await Promise.all([walk(home), walk(state), walk(project)]);
    return contents;
  };
  return { root, home, codex, state, bin, project, env, run, ok, snapshot };
}

test('CLI fresh setup, doctor and repeated setup are safe and idempotent', async t => {
  const f = await fixture(t);
  const before = await f.snapshot();
  assert.match(f.ok(['setup', '--dry-run']).output, /Dry run: no changes made/);
  assert.deepEqual(await f.snapshot(), before);
  f.ok(['setup', '--yes']);
  const config = parse(await readFile(join(f.codex, 'config.toml'), 'utf8'));
  assert.equal(config.model, 'gpt-6-astra');
  assert.equal(config.model_reasoning_effort, 'medium');
  const luna = parse(await readFile(join(f.codex, 'agents/luna_worker.toml'), 'utf8'));
  assert.equal(luna.model, 'gpt-6-luna');
  assert.equal(luna.model_reasoning_effort, 'xhigh');
  assert.match(f.ok(['doctor']).output, /No configuration problems found/);
  const installed = await f.snapshot();
  assert.match(f.ok(['setup', '--yes']).output, /No changes required/);
  assert.deepEqual(await f.snapshot(), installed, 'repeat setup must not rewrite state or create duplicate backups');
  assert.match(f.ok(['diff']).output, /No changes required/);
  assert.deepEqual(await f.snapshot(), installed);
});

test('CLI preserves arbitrary user TOML and Markdown and uninstall removes only ownership', async t => {
  const f = await fixture(t);
  await mkdir(f.codex, { recursive: true });
  const userConfig = 'sandbox_mode = "read-only"\n[future_setting]\ncustom = [1, 2]\n[mcp_servers.personal]\ncommand = "my-command"\n';
  const userRules = '# My rules\n\nNever do X.\n';
  await writeFile(join(f.codex, 'config.toml'), userConfig);
  await writeFile(join(f.codex, 'AGENTS.md'), userRules);
  f.ok(['setup', '--yes']);
  const config = parse(await readFile(join(f.codex, 'config.toml'), 'utf8'));
  assert.equal(config.sandbox_mode, 'read-only');
  assert.deepEqual(JSON.parse(JSON.stringify(config.future_setting)), { custom: [1, 2] });
  assert.deepEqual(JSON.parse(JSON.stringify(config.mcp_servers)), { personal: { command: 'my-command' } });
  assert.ok((await readFile(join(f.codex, 'AGENTS.md'), 'utf8')).startsWith(userRules));
  const backups = await readdir(join(f.state, 'rigseed/backups'));
  assert.equal(backups.length, 1);
  const records = await readdir(join(f.state, 'rigseed/targets'));
  const ownership = JSON.parse(await readFile(join(f.state, 'rigseed/targets', records[0]!), 'utf8'));
  assert.equal(ownership.backup, join(f.state, 'rigseed/backups', backups[0]!));
  const manifest = JSON.parse(await readFile(join(f.state, 'rigseed/backups', backups[0]!, 'manifest.json'), 'utf8')) as { path: string; file: string | null }[];
  const configBackup = manifest.find(entry => entry.path === join(f.codex, 'config.toml'))!;
  assert.equal(await readFile(join(f.state, 'rigseed/backups', backups[0]!, configBackup.file!), 'utf8'), userConfig);
  const before = await f.snapshot();
  f.ok(['uninstall', '--dry-run']);
  assert.deepEqual(await f.snapshot(), before);
  f.ok(['uninstall', '--yes']);
  const remaining = parse(await readFile(join(f.codex, 'config.toml'), 'utf8'));
  assert.equal(remaining.model, undefined);
  assert.equal(remaining.sandbox_mode, 'read-only');
  assert.ok((await readFile(join(f.codex, 'AGENTS.md'), 'utf8')).startsWith(userRules));
  assert.ok(!(await readFile(join(f.codex, 'AGENTS.md'), 'utf8')).includes(START_MARKER));
  assert.equal(await readFile(join(f.codex, 'agents/luna_worker.toml'), 'utf8').catch(() => null), null);
  assert.match(f.ok(['uninstall', '--yes']).output, /No managed targets found/);
});

test('CLI minimal project init preserves project instructions and does not copy agents', async t => {
  const f = await fixture(t);
  f.ok(['setup', '--yes']);
  const original = '# Project rules\nKeep domain-specific instructions.\n';
  await writeFile(join(f.project, 'AGENTS.md'), original);
  const before = await f.snapshot();
  f.ok(['init', '--dry-run'], f.project);
  assert.deepEqual(await f.snapshot(), before);
  f.ok(['init', '--yes'], f.project);
  assert.ok((await readFile(join(f.project, 'AGENTS.md'), 'utf8')).startsWith(original));
  assert.equal(await readdir(join(f.project, '.codex')).catch(() => null), null);
  assert.match(f.ok(['doctor'], f.project).output, /No configuration problems found/);
  const installed = await f.snapshot();
  assert.match(f.ok(['init', '--yes'], f.project).output, /No changes required/);
  assert.deepEqual(await f.snapshot(), installed);
  f.ok(['uninstall', '--project', '--yes'], f.project);
  assert.ok((await readFile(join(f.project, 'AGENTS.md'), 'utf8')).startsWith(original));
  assert.ok((await readFile(join(f.codex, 'AGENTS.md'), 'utf8')).includes(START_MARKER));
});

test('CLI portable init works without global setup and includes local agent definitions', async t => {
  const f = await fixture(t);
  f.ok(['init', '--portable', '--yes'], f.project);
  for (const relative of ['config.toml', 'agents/sol_orchestrator.toml', 'agents/luna_worker.toml']) {
    assert.ok(Object.keys(parse(await readFile(join(f.project, '.codex', relative), 'utf8'))).length);
  }
  assert.equal(await readdir(f.codex).catch(() => null), null, 'portable init must not write global Codex files');
  assert.match(f.ok(['doctor', '--project'], f.project).output, /No configuration problems found/);
  const before = await f.snapshot();
  assert.match(f.ok(['init', '--portable', '--yes'], f.project).output, /No changes required/);
  assert.deepEqual(await f.snapshot(), before);
  f.ok(['uninstall', '--project', '--yes'], f.project);
  assert.equal(await readFile(join(f.project, 'AGENTS.md'), 'utf8').catch(() => null), null);
});

test('CLI diff detects managed drift without writes; update repairs only managed Markdown', async t => {
  const f = await fixture(t);
  f.ok(['setup', '--yes']);
  const path = join(f.codex, 'AGENTS.md');
  const text = await readFile(path, 'utf8');
  const drift = `# Manual prefix\n\n${START_MARKER}\nEdited managed policy.\n${END_MARKER}\n\n# Manual suffix\nKeep this.\n`;
  await writeFile(path, drift);
  const before = await f.snapshot();
  const diff = f.ok(['diff']);
  assert.match(diff.output, /Edited managed policy/);
  assert.ok(!diff.output.includes('Manual prefix'));
  assert.deepEqual(await f.snapshot(), before);
  const doctor = f.run(['doctor']);
  assert.equal(doctor.status, 1);
  assert.match(doctor.output, /managed content matches template/);
  f.ok(['update', '--dry-run']);
  assert.deepEqual(await f.snapshot(), before);
  f.ok(['update', '--yes']);
  const after = await readFile(path, 'utf8');
  assert.ok(after.startsWith('# Manual prefix\n\n'));
  assert.ok(after.endsWith('\n\n# Manual suffix\nKeep this.\n'));
  assert.ok(after.includes(text.slice(text.indexOf(START_MARKER), text.indexOf(END_MARKER) + END_MARKER.length)));
  assert.match(f.ok(['doctor']).output, /No configuration problems found/);
  const updated = await f.snapshot();
  assert.match(f.ok(['update', '--yes']).output, /No changes required/);
  assert.deepEqual(await f.snapshot(), updated);
});

test('CLI corrupt markers and TOML conflicts fail before any transaction changes', async t => {
  const f = await fixture(t);
  await mkdir(f.codex, { recursive: true });
  await writeFile(join(f.codex, 'AGENTS.md'), `${START_MARKER}\nBroken policy.\n`);
  let before = await f.snapshot();
  const corrupt = f.run(['setup', '--yes']);
  assert.equal(corrupt.status, 1);
  assert.match(corrupt.output, /markers are inconsistent/);
  assert.deepEqual(await f.snapshot(), before);
  await writeFile(join(f.codex, 'AGENTS.md'), '# User policy\n');
  await writeFile(join(f.codex, 'config.toml'), 'model = "personal-model"\n');
  before = await f.snapshot();
  const conflict = f.run(['setup', '--yes']);
  assert.equal(conflict.status, 1);
  assert.match(conflict.output, /TOML conflict/);
  assert.deepEqual(await f.snapshot(), before);
});

test('CLI doctor distinguishes missing Codex, missing config, missing agent and corrupt markers', async t => {
  const f = await fixture(t);
  const noCodexBin = join(f.root, 'empty-bin');
  await mkdir(noCodexBin);
  const absent = f.run(['doctor'], f.root, { PATH: noCodexBin });
  assert.equal(absent.status, 1);
  assert.match(absent.output, /Codex CLI was not detected/);
  const fresh = f.run(['doctor']);
  assert.equal(fresh.status, 1);
  assert.match(fresh.output, /config\.toml: missing/);
  f.ok(['setup', '--yes']);
  await unlink(join(f.codex, 'agents/luna_worker.toml'));
  const missing = f.run(['doctor']);
  assert.equal(missing.status, 1);
  assert.match(missing.output, /luna_worker\.toml: missing/);
  f.ok(['update', '--yes']);
  await writeFile(join(f.codex, 'AGENTS.md'), `${START_MARKER}\nCorrupt.\n`);
  const corrupt = f.run(['doctor']);
  assert.equal(corrupt.status, 1);
  assert.match(corrupt.output, /markers are inconsistent/);
});

test('CLI uninstall refuses edited owned TOML and preserves all targets', async t => {
  const f = await fixture(t);
  f.ok(['setup', '--yes']);
  const path = join(f.codex, 'config.toml');
  await writeFile(path, (await readFile(path, 'utf8')).replace('gpt-6-astra', 'personal-edit'));
  const before = await f.snapshot();
  const result = f.run(['uninstall', '--yes']);
  assert.equal(result.status, 1);
  assert.match(result.output, /value was edited/);
  assert.deepEqual(await f.snapshot(), before);
});

test('CLI selects max for Luna only when installed catalog supports it', async t => {
  const f = await fixture(t, 'max');
  f.ok(['setup', '--yes']);
  const luna = parse(await readFile(join(f.codex, 'agents/luna_worker.toml'), 'utf8'));
  assert.equal(luna.model_reasoning_effort, 'max');
  assert.match(f.ok(['doctor']).output, /No configuration problems found/);
});

test('CLI requires Git and global setup for minimal init, and explicit noninteractive consent', async t => {
  const f = await fixture(t);
  const before = await f.snapshot();
  const missingGit = f.run(['init', '--portable', '--yes']);
  assert.equal(missingGit.status, 1);
  assert.match(missingGit.output, /No Git repository detected/);
  const missingGlobal = f.run(['init', '--yes'], f.project);
  assert.equal(missingGlobal.status, 1);
  assert.match(missingGlobal.output, /Global Rigseed setup is missing/);
  const noninteractive = f.run(['setup']);
  assert.equal(noninteractive.status, 1);
  assert.match(noninteractive.output, /Non-interactive input/);
  assert.deepEqual(await f.snapshot(), before);
});
