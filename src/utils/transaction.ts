import { mkdir, open, unlink, rmdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite, readOptional, assertSafePath } from './files.js';
export interface Change { path: string; before: string | null; after: string | null; displayBefore: string; displayAfter: string }

/** Preflight all files, acquire a local lock, back up, then commit with rollback. */
export async function commit(base: string, changes: Change[], stateChanges: Change[], backupLocation?: string): Promise<string | undefined> {
  if (!changes.length && !stateChanges.length) return;
  const all = [...changes, ...stateChanges];
  await assertSafePath(join(base, 'write.lock'));
  await mkdir(base, { recursive: true, mode: 0o700 });
  const lock = join(base, 'write.lock');
  let handle;
  try { handle = await open(lock, 'wx', 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Another rigseed write may be running. Inspect ${lock}; remove it only if that process has exited.`, { cause: error }); throw error; }
  const applied: Change[] = [];
  let backup: string | undefined;
  const createdDirectories: string[] = [];
  try {
    await handle.writeFile(String(process.pid));
    for (const change of all) {
      if (await readOptional(change.path) !== change.before) throw new Error(`File changed during planning: ${change.path}. Retry; no changes were made.`);
    }
    if (all.some(c => c.before !== null)) {
      backup = backupLocation || newBackupPath(base);
      await mkdir(backup, { recursive: true, mode: 0o700 });
      const manifest = [];
      for (const [i, change] of all.entries()) {
        const file = `${i}-${change.path.split(/[\\/]/).at(-1)}`;
        manifest.push({ path: change.path, file: change.before === null ? null : file });
        if (change.before !== null) await atomicWrite(join(backup, file), change.before);
      }
      await atomicWrite(join(backup, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    for (const change of all) {
      // A second precondition immediately before mutation catches ordinary concurrent editors.
      if (await readOptional(change.path) !== change.before) throw new Error(`Concurrent modification: ${change.path}`);
      if (change.after === null) { if (change.before !== null) await unlink(change.path); }
      else {
        // Record only missing parents so rollback does not delete preexisting directories.
        let parent = join(change.path, '..');
        while (true) {
          try { await lstat(parent); break; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
          createdDirectories.push(parent); parent = join(parent, '..');
        }
        await atomicWrite(change.path, change.after);
      }
      applied.push(change);
    }
    return backup;
  } catch (error) {
    for (const change of applied.reverse()) {
      if (await readOptional(change.path) !== change.after) throw new Error(`Rollback stopped to preserve concurrent edits at ${change.path}. Restore manually from ${backup}.`, { cause: error });
      if (change.before === null) await unlink(change.path);
      else await atomicWrite(change.path, change.before);
    }
    for (const dir of createdDirectories) await rmdir(dir).catch(() => undefined);
    throw error;
  } finally { await handle.close(); await unlink(lock); }
}

export function newBackupPath(base: string): string {
  return join(base, 'backups', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
}
