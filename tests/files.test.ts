import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'smol-toml';

function parsed(text: string): Record<string, unknown> {
  return JSON.parse(JSON.stringify(parse(text))) as Record<string, unknown>;
}
import { END_MARKER, START_MARKER, inspectManagedMarkdown, removeManagedMarkdown, updateManagedMarkdown } from '../src/utils/markdown.js';
import { mergeToml } from '../src/providers/codex/merge.js';

test('Markdown creation and updates preserve outside bytes and are idempotent', () => {
  const original = '# Personal rules\n\nNever do X.\n';
  const installed = updateManagedMarkdown(original, 'Policy one');
  assert.ok(installed.startsWith(original));
  assert.deepEqual(inspectManagedMarkdown(installed), { present: true, content: 'Policy one' });
  assert.equal(updateManagedMarkdown(installed, 'Policy one'), installed);
  const decorated = installed + '\n# More rules\n\nKeep me.  \n';
  const updated = updateManagedMarkdown(decorated, 'Policy two\nAnother rule');
  const [before, after] = [decorated.split(START_MARKER)[0], decorated.split(END_MARKER)[1]];
  assert.equal(updated.split(START_MARKER)[0], before);
  assert.equal(updated.split(END_MARKER)[1], after);
  assert.equal(removeManagedMarkdown(updated), before! + after!);
  assert.equal(removeManagedMarkdown(original), original);
});

test('Markdown preserves CRLF outside and uses CRLF for managed body', () => {
  const original = '# Rules\r\nKeep.\r\n';
  const installed = updateManagedMarkdown(original, 'one\ntwo');
  assert.ok(installed.startsWith(original));
  assert.ok(installed.includes('one\r\ntwo'));
  assert.equal(updateManagedMarkdown(installed, 'one\ntwo'), installed);
});

test('Markdown refuses missing, duplicate, reversed, damaged, or inline markers', () => {
  for (const text of [
    START_MARKER,
    END_MARKER,
    `${END_MARKER}\n${START_MARKER}\n`,
    `${START_MARKER}\n${START_MARKER}\n${END_MARKER}\n`,
    '<!-- rigseed:start codex-orchestration -->\n<!-- rigseed:end codex-orchestration --!>',
    'rigseed:start codex-orchestration\n',
    `prefix ${START_MARKER}\n${END_MARKER}\n`,
    `${START_MARKER} trailing\n${END_MARKER}\n`,
  ]) {
    assert.throws(() => updateManagedMarkdown(text, 'replacement'), /markers/i);
    assert.throws(() => removeManagedMarkdown(text), /markers/i);
    assert.throws(() => inspectManagedMarkdown(text), /markers/i);
  }
});

test('TOML merge preserves unrelated data and unknown future keys', () => {
  const original = '# User comment\n[existing]\nfoo = "bar"\nfuture = [1, 2]\n\n[mcp_servers.local]\ncommand = "node"\n';
  const result = mergeToml(original, { model: 'root', 'agents.max_threads': 4 });
  const config = parsed(result.text);
  assert.deepEqual(config.existing, { foo: 'bar', future: [1, 2] });
  assert.deepEqual(config.mcp_servers, { local: { command: 'node' } });
  assert.equal(config.model, 'root');
  assert.deepEqual(result.owned, { model: { value: 'root' }, 'agents.max_threads': { value: 4 } });
  const repeated = mergeToml(result.text, { model: 'root', 'agents.max_threads': 4 }, result.owned);
  assert.equal(repeated.text, result.text);
  assert.deepEqual(repeated.owned, result.owned);
});

test('TOML conflicts and scalar parents fail without returning a destructive merge', () => {
  assert.throws(() => mergeToml('model = "personal"\n', { model: 'root' }), /conflict/);
  assert.throws(() => mergeToml('agents = "personal"\n', { 'agents.max_threads': 4 }), /not a TOML table/);
  assert.throws(() => mergeToml('model = "edited"\n', { model: 'new' }, { model: { value: 'old' } }), /edited/);
  assert.throws(() => mergeToml('model = "edited"\n', {}, { model: { value: 'old' } }, true), /edited/);
  assert.throws(() => mergeToml('', { '__proto__.polluted': true }), /Unsupported/);
});

test('Matching unowned TOML is neither rewritten nor claimed', () => {
  const original = '# Keep comments\nmodel = "root"\n';
  const result = mergeToml(original, { model: 'root' });
  assert.equal(result.text, original);
  assert.deepEqual(result.owned, {});
  assert.equal(mergeToml(result.text, {}, result.owned, true).text, original);
});

test('Owned TOML updates and uninstall restore originals and preserve other values', () => {
  const existing = 'model = "old"\n[agents]\nmax_threads = 4\nuser_setting = true\n';
  const previous = { model: { value: 'old', original: 'personal' }, 'agents.max_threads': { value: 4 } };
  const updated = mergeToml(existing, { model: 'new', 'agents.max_threads': 5 }, previous);
  assert.equal(parsed(updated.text).model, 'new');
  const removed = mergeToml(updated.text, {}, updated.owned, true);
  assert.equal(parsed(removed.text).model, 'personal');
  assert.deepEqual(parsed(removed.text).agents, { user_setting: true });
  assert.deepEqual(removed.owned, {});
});

test('Removed preset keys are released without claiming parent table ownership', () => {
  const installed = mergeToml('', { 'agents.worker.model': 'worker', model: 'root' });
  const updated = mergeToml(installed.text, { model: 'root' }, installed.owned);
  assert.deepEqual(parsed(updated.text), { model: 'root', agents: { worker: {} } });
  assert.deepEqual(updated.owned, { model: { value: 'root' } });
  assert.deepEqual(parsed(mergeToml(updated.text, {}, updated.owned, true).text), { agents: { worker: {} } });
  const preexisting = mergeToml('[agents]\n', { 'agents.max_threads': 4 });
  assert.deepEqual(parsed(mergeToml(preexisting.text, {}, preexisting.owned, true).text), { agents: {} });
});

test('Invalid TOML is refused', () => {
  assert.throws(() => mergeToml('model = [broken', { model: 'root' }));
});
