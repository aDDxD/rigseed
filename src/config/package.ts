import { readFileSync } from 'node:fs';
// The supported entry point is compiled dist/src/cli.js; this path is package-relative.
export const metadata: { name: string; version: string } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
