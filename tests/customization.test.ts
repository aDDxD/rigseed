import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, chmod } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
import { validateUserConfig, readUserConfig, type UserConfig } from '../src/config/user.js';
import { selectConfiguration, CancelledError } from '../src/config/wizard.js';
import { resolveCodex, type Catalog } from '../src/providers/codex/detect.js';
import { mergeToml } from '../src/providers/codex/merge.js';

const catalog: Catalog = { version: 'codex-cli 0.160.0', models: [
  { slug: 'custom-supervisor', supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'high' }] },
  { slug: 'custom-lead', supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }] },
  { slug: 'custom-worker', supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }] },
] };
function configuration(): UserConfig {
  return { schemaVersion: 1, provider: 'codex', root: { model: 'custom-supervisor', reasoning: 'high' },
    agents: { sol_orchestrator: { model: 'custom-lead', reasoning: 'medium' }, luna_worker: { model: 'custom-worker', reasoning: 'high' } },
    maxConcurrentSubagents: 3 };
}

test('custom configuration validates strict shape, bounded identifiers and concurrency', () => {
  assert.deepEqual(validateUserConfig(configuration()), configuration());
  for (const invalid of [null, [], true, 1n, {},
    { ...configuration(), extra: 'secret' },
    { ...configuration(), provider: 'other' },
    { ...configuration(), schemaVersion: 2 },
    { ...configuration(), root: { model: 'custom-supervisor', reasoning: 'high', token: 'secret' } },
    { ...configuration(), agents: { ...configuration().agents, extra: {} } },
    ...[1, 9, 2.5, NaN, Infinity, '4'].map(maxConcurrentSubagents => ({ ...configuration(), maxConcurrentSubagents })),
    ...['', 'a\nb', 'a'.repeat(1024), '__proto__'].map(model => ({ ...configuration(), root: { model, reasoning: 'high' } })),
    { ...configuration(), root: { model: 'custom-supervisor', reasoning: '' } },
  ]) assert.throws(() => validateUserConfig(invalid));
});

test('custom configuration resolves supported models without requiring preset families', () => {
  const resolved = resolveCodex(catalog, configuration());
  assert.deepEqual(resolved.root, { model: 'custom-supervisor', effort: 'high' });
  assert.deepEqual(resolved.sol, { model: 'custom-lead', effort: 'medium' });
  assert.deepEqual(resolved.luna, { model: 'custom-worker', effort: 'high' });
  assert.equal(resolved.maxConcurrentSubagents, 3);
  assert.throws(() => resolveCodex(catalog, { ...configuration(), root: { model: 'missing-model', reasoning: 'high' } }));
  assert.throws(() => resolveCodex(catalog, { ...configuration(), root: { model: 'custom-supervisor', reasoning: 'max' } }));
});

test('configuration parse errors never echo input secrets', async t => {
  const root = await mkdtemp(join(tmpdir(), 'rigseed-custom-json-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'config.json');
  for (const text of ['{ "token": "VERY_SECRET_VALUE", broken', JSON.stringify({ ...configuration(), token: 'VERY_SECRET_VALUE' })]) {
    await writeFile(path, text);
    await assert.rejects(readUserConfig(path), error => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes('VERY_SECRET_VALUE'));
      return true;
    });
  }
  await writeFile(path, JSON.stringify(configuration()));
  assert.deepEqual(await readUserConfig(path), configuration());
});

test('wizard retains current choices on enter and permits only catalog efforts', async () => {
  const answers = ['', '', '', '', '', '', ''];
  const retained = await selectConfiguration(catalog, configuration(), async () => {
    assert.ok(answers.length, 'wizard unexpectedly asked another question');
    return answers.shift()!;
  });
  assert.deepEqual(retained, configuration());
  const selectedAnswers = ['3', '1', '1', '2', '2', '1', '4'];
  const selected = await selectConfiguration(catalog, configuration(), async () => selectedAnswers.shift()!);
  assert.deepEqual(selected.root, { model: 'custom-worker', reasoning: 'low' });
  assert.deepEqual(selected.agents.sol_orchestrator, { model: 'custom-supervisor', reasoning: 'high' });
  assert.deepEqual(selected.agents.luna_worker, { model: 'custom-lead', reasoning: 'low' });
  assert.equal(selected.maxConcurrentSubagents, 4);
  resolveCodex(catalog, selected);
});

test('wizard cancellation returns a distinct error before installation', async () => {
  await assert.rejects(selectConfiguration(catalog, configuration(), async () => 'q'), CancelledError);
});

test('explicit conflict consent records originals, checks exact current values, and restores on uninstall', () => {
  const original = 'model = "personal"\nsandbox_mode = "read-only"\n';
  const installed = mergeToml(original, { model: 'custom-supervisor' }, {}, false, { model: 'personal' });
  assert.deepEqual(installed.owned.model, { value: 'custom-supervisor', original: 'personal' });
  assert.equal(parse(installed.text).sandbox_mode, 'read-only');
  assert.equal(parse(mergeToml(installed.text, {}, installed.owned, true).text).model, 'personal');
  assert.throws(() => mergeToml(original, { model: 'custom-supervisor' }, {}, false, { model: 'stale-value' }));
  assert.throws(() => mergeToml('model = "edited"\n', { model: 'next' }, installed.owned, false, { model: 'edited' }), /edited/);
  assert.throws(() => mergeToml('model = 9223372036854775807\n', { model: 'next' }, {}, false, { model: 9223372036854775807n }));
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'rigseed-custom-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'home'), codex = join(home, '.codex'), state = join(root, 'state'), bin = join(root, 'bin'), project = join(root, 'project');
  await Promise.all([home, bin, project].map(path => mkdir(path, { recursive: true })));
  await writeFile(join(bin, 'codex'), `#!${process.execPath}\nconst args = process.argv.slice(2).join(' ');\nif (args === '--version') console.log('codex-cli 0.160.0');\nelse if (args === 'debug models --bundled') console.log(${JSON.stringify(JSON.stringify({ models: catalog.models }))});\nelse process.exit(2);\n`);
  await chmod(join(bin, 'codex'), 0o700);
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: codex, XDG_STATE_HOME: state, XDG_CONFIG_HOME: join(root, 'config'), PATH: `${bin}:${process.env.PATH || ''}` };
  execFileSync('git', ['init', '--quiet', project], { env });
  const configPath = join(root, 'rigseed.json');
  await writeFile(configPath, JSON.stringify(configuration()));
  const run = (args: string[], cwd = root) => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), ...args], { env, cwd, encoding: 'utf8', timeout: 20000 });
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  };
  const ok = (args: string[], cwd = root) => { const result = run(args, cwd); assert.equal(result.status, 0, result.output); return result; };
  return { root, codex, state, project, configPath, run, ok };
}

test('CLI stores custom selections and reuses them for update, diff, doctor and minimal init', async t => {
  const f = await fixture(t);
  f.ok(['setup', '--config', f.configPath, '--yes']);
  assert.equal(parse(await readFile(join(f.codex, 'config.toml'), 'utf8')).model, 'custom-supervisor');
  assert.equal(parse(await readFile(join(f.codex, 'agents/sol_orchestrator.toml'), 'utf8')).model, 'custom-lead');
  const states = await readdir(join(f.state, 'rigseed/targets'));
  const state = JSON.parse(await readFile(join(f.state, 'rigseed/targets', states[0]!), 'utf8'));
  assert.deepEqual(state.configuration, configuration());
  assert.match(f.ok(['diff', '--global']).output, /No changes required/);
  assert.match(f.ok(['update', '--global', '--yes']).output, /No changes required/);
  assert.match(f.ok(['doctor', '--global']).output, /No configuration problems found/);
  f.ok(['init', '--yes'], f.project);
  assert.equal(await readdir(join(f.project, '.codex')).catch(() => null), null);
  const refused = f.run(['update', '--project', '--config', f.configPath, '--yes'], f.project);
  assert.equal(refused.status, 1);
  assert.match(refused.output, /Regular projects inherit global choices/);
  assert.match(f.ok(['doctor', '--project'], f.project).output, /No configuration problems found/);
  const next = configuration();
  next.root.reasoning = 'medium';
  next.maxConcurrentSubagents = 4;
  await writeFile(f.configPath, JSON.stringify(next));
  f.ok(['update', '--global', '--config', f.configPath, '--yes']);
  assert.equal(parse(await readFile(join(f.codex, 'config.toml'), 'utf8')).model_reasoning_effort, 'medium');
  assert.match(f.ok(['diff', '--global']).output, /No changes required/);
});

test('CLI portable configuration includes selected local roles and preserves global absence', async t => {
  const f = await fixture(t);
  f.ok(['init', '--portable', '--config', f.configPath, '--yes'], f.project);
  assert.equal(parse(await readFile(join(f.project, '.codex/agents/luna_worker.toml'), 'utf8')).model, 'custom-worker');
  assert.equal(await readdir(f.codex).catch(() => null), null);
  assert.match(f.ok(['doctor', '--project'], f.project).output, /No configuration problems found/);
  assert.match(f.ok(['update', '--project', '--yes'], f.project).output, /No changes required/);
  f.ok(['uninstall', '--project', '--yes'], f.project);
  assert.equal(await readFile(join(f.project, '.codex/agents/luna_worker.toml'), 'utf8').catch(() => null), null);
});

test('CLI custom config never converts --yes into destructive consent and refuses invalid modes', async t => {
  const f = await fixture(t);
  await mkdir(f.codex, { recursive: true });
  const original = 'model = "personal"\n';
  await writeFile(join(f.codex, 'config.toml'), original);
  const conflict = f.run(['setup', '--config', f.configPath, '--yes']);
  assert.equal(conflict.status, 1);
  assert.match(conflict.output, /TOML conflict/);
  assert.equal(await readFile(join(f.codex, 'config.toml'), 'utf8'), original);
  assert.equal(await readdir(join(f.state, 'rigseed/targets')).catch(() => null), null);
  for (const args of [
    ['setup', '--interactive', '--yes'],
    ['setup', '--interactive', '--config', f.configPath],
    ['setup', '--interactive'],
  ]) assert.notEqual(f.run(args, f.project).status, 0);
  const minimal = f.run(['init', '--config', f.configPath, '--yes'], f.project);
  assert.equal(minimal.status, 1);
  assert.match(minimal.output, /requires init --portable/);
});

test('CLI custom dry-run is read-only and unsupported efforts fail without creating targets', async t => {
  const f = await fixture(t);
  assert.match(f.ok(['setup', '--config', f.configPath, '--dry-run']).output, /Dry run: no changes made/);
  assert.equal(await readdir(f.codex).catch(() => null), null);
  assert.equal(await readdir(join(f.state, 'rigseed')).catch(() => null), null);
  const invalid = configuration();
  invalid.agents.luna_worker.reasoning = 'max';
  await writeFile(f.configPath, JSON.stringify(invalid));
  const result = f.run(['setup', '--config', f.configPath, '--yes']);
  assert.equal(result.status, 1);
  assert.match(result.output, /Unsupported reasoning/);
  assert.equal(await readdir(f.codex).catch(() => null), null);
  assert.equal(await readdir(join(f.state, 'rigseed')).catch(() => null), null);
});

test('wizard works without preset models and retries unsupported selections and limits', async () => {
  const answers = ['999', '3', 'max', '1', '1', '2', '2', '1', '9', '2'];
  const selected = await selectConfiguration(catalog, undefined, async () => {
    assert.ok(answers.length, 'wizard unexpectedly asked another question');
    return answers.shift()!;
  });
  assert.deepEqual(selected.root, { model: 'custom-worker', reasoning: 'low' });
  assert.deepEqual(selected.agents.sol_orchestrator, { model: 'custom-supervisor', reasoning: 'high' });
  assert.deepEqual(selected.agents.luna_worker, { model: 'custom-lead', reasoning: 'low' });
  assert.equal(selected.maxConcurrentSubagents, 2);
  assert.equal(answers.length, 0);
  resolveCodex(catalog, selected);
});
