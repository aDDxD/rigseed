import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

export function paths(env: NodeJS.ProcessEnv = process.env) {
  const home = env.HOME || env.USERPROFILE || homedir();
  for (const key of ['CODEX_HOME', 'XDG_STATE_HOME']) {
    if (env[key] && !isAbsolute(env[key]!)) throw new Error(`${key} must be an absolute path.`);
  }
  return {
    home: resolve(home),
    codex: resolve(env.CODEX_HOME || join(home, '.codex')),
    state: join(env.XDG_STATE_HOME || join(home, '.local', 'state'), 'rigseed'),
  };
}
