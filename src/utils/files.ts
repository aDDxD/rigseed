import { lstat, readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, parse, resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function assertSafePath(path: string): Promise<void> {
  let cursor = resolve(path);
  const root = parse(cursor).root;
  while (cursor !== root) {
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${cursor}`);
      if (cursor === resolve(path) && !info.isFile()) throw new Error(`Expected a regular file: ${cursor}`);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    cursor = dirname(cursor);
  }
}
export async function readOptional(path: string): Promise<string | null> {
  await assertSafePath(path);
  try { return await readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function atomicWrite(path: string, content: string): Promise<void> {
  await assertSafePath(path);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = join(dirname(path), `.rigseed-${randomUUID()}.tmp`);
  try {
    let mode = 0o600;
    try { mode = (await lstat(path)).mode & 0o777; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await writeFile(temp, content, { flag: 'wx', mode });
    await rename(temp, path);
  } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
