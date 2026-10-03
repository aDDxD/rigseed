import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink, rm, chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { paths } from '../src/providers/codex/paths.js';
import { commit, type Change } from '../src/utils/transaction.js';
import { readOptional } from '../src/utils/files.js';
import { parseToml } from '../src/utils/toml.js';
import { plan } from '../src/providers/codex/install.js';
import { loadState, statePath } from '../src/utils/state.js';

async function temporary(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'rigseed-safety-'));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
function change(path: string, before: string | null, after: string | null): Change { return { path, before, after, displayBefore: '', displayAfter: '' }; }

test('Normalized CODEX_HOME keeps a stable target identity; relative XDG paths fail', () => {
  assert.equal(paths({ HOME: '/tmp/home', CODEX_HOME: '/tmp/codex/' }).codex, paths({ HOME: '/tmp/home', CODEX_HOME: '/tmp/codex' }).codex);
  assert.throws(() => paths({ CODEX_HOME: 'relative' }), /absolute/);
  assert.throws(() => paths({ XDG_STATE_HOME: 'relative' }), /absolute/);
});

test('Symlink files and ancestors are refused without touching their destination', async () => temporary(async dir => {
  const destination = join(dir, 'destination');
  await writeFile(destination, 'personal');
  const link = join(dir, 'link');
  await symlink(destination, link);
  await assert.rejects(readOptional(link), /symbolic link/);
  await assert.rejects(commit(join(dir, 'state'), [change(link, 'personal', 'managed')], []), /symbolic link/);
  assert.equal(await readFile(destination, 'utf8'), 'personal');
  const actual = join(dir, 'actual'); await mkdir(actual);
  const alias = join(dir, 'alias'); await symlink(actual, alias);
  await assert.rejects(readOptional(join(alias, 'config.toml')), /symbolic link/);
}));

test('Preflight detects an external edit before any target is written', async () => temporary(async dir => {
  const first = join(dir, 'first'), second = join(dir, 'second');
  await writeFile(first, 'old'); await writeFile(second, 'external edit');
  await assert.rejects(commit(join(dir, 'state'), [change(first, 'old', 'new'), change(second, 'old', 'new')], []), /changed during planning/);
  assert.equal(await readFile(first, 'utf8'), 'old');
  assert.equal(await readFile(second, 'utf8'), 'external edit');
  assert.deepEqual(await readdir(join(dir, 'state')), []);
}));

test('Exclusive lock blocks writes and preserves the other process lock', async () => temporary(async dir => {
  const base = join(dir, 'state'); await mkdir(base);
  await writeFile(join(base, 'write.lock'), 'another process');
  await assert.rejects(commit(base, [change(join(dir, 'new'), null, 'value')], []), /Another rigseed/);
  assert.equal(await readOptional(join(dir, 'new')), null);
  assert.equal(await readFile(join(base, 'write.lock'), 'utf8'), 'another process');
}));

test('Backups contain exact original content and a private restore manifest', async () => temporary(async dir => {
  const file = join(dir, 'config.toml'); await writeFile(file, '# original\n'); await chmod(file, 0o640);
  const backup = await commit(join(dir, 'state'), [change(file, '# original\n', 'model = "new"\n')], []);
  assert.ok(backup);
  const manifest = JSON.parse(await readFile(join(backup, 'manifest.json'), 'utf8'));
  assert.equal(manifest[0].path, file);
  assert.equal(await readFile(join(backup, manifest[0].file), 'utf8'), '# original\n');
  assert.equal((await stat(file)).mode & 0o777, 0o640);
  assert.equal((await stat(join(backup, manifest[0].file))).mode & 0o777, 0o600);
  assert.equal(await readOptional(join(dir, 'state', 'write.lock')), null);
}));

test('Corrupted ownership records are rejected instead of guessing', async () => temporary(async dir => {
  const root = join(dir, 'codex'), base = join(dir, 'state');
  const path = statePath(base, root); await mkdir(join(base, 'targets'), { recursive: true });
  await writeFile(path, JSON.stringify({ schema: 1, provider: 'codex', scope: 'global', root, portable: false, files: [{ path: join(root, 'config.toml'), kind: 'toml', created: 'yes' }] }));
  await assert.rejects(loadState(base, root), /Invalid managed file record/);
  await writeFile(path, JSON.stringify({ schema: 1, provider: 'codex', scope: 'global', root, portable: false, files: [{ path: join(root, 'config.toml'), kind: 'toml', created: false, owned: { model: { value: 'managed', original: { invalid: 'table' } } } }] }));
  await assert.rejects(loadState(base, root), /Invalid TOML ownership value/);
}));

test('Partial filesystem failure rolls back created files and empty parents', async () => temporary(async dir => {
  const base = join(dir, 'state'), first = join(dir, 'new-parent', 'file');
  // A second target under a newly created regular file fails after the first rename.
  await assert.rejects(commit(base, [change(first, null, 'new'), change(join(first, 'impossible-child'), null, 'new')], []));
  assert.equal(await readOptional(first), null);
  assert.equal(await readOptional(join(base, 'write.lock')), null);
  assert.deepEqual(await readdir(dir), ['state']);
}));


test('Uninstall preserves external empty TOML tables while deleting untouched created agents', async () => temporary(async dir => {
  const target = { root: join(dir, 'codex'), scope: 'global' as const, portable: false };
  const codex = { version: 'codex-cli 0.160.0', root: { model: 'gpt-6-astra', effort: 'medium' }, sol: { model: 'gpt-6.1-sol', effort: 'medium' }, luna: { model: 'gpt-6-luna', effort: 'max' } };
  const initial = await plan(target, codex, null);
  await commit(join(dir, 'state'), initial.changes, []);
  const config = join(target.root, 'config.toml');
  await writeFile(config, (await readFile(config, 'utf8')) + '\n[manual_empty]\n');
  const removal = await plan(target, null, initial.state, true);
  assert.match(removal.changes.find(c => c.path === config)!.after!, /manual_empty/);
  assert.equal(removal.changes.find(c => c.path.endsWith('luna_worker.toml'))!.after, null);
}));


test('TOML syntax diagnostics do not log surrounding secret values', () => {
  assert.throws(() => parseToml('token = "DO_NOT_LOG_THIS"\ninvalid = [\n'), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Invalid TOML document at line/);
    assert.ok(!error.message.includes('DO_NOT_LOG_THIS'));
    return true;
  });
});
