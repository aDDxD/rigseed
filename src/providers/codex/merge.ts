import { stringify } from 'smol-toml';
import { parseToml as parse } from '../../utils/toml.js';
import { isDeepStrictEqual } from 'node:util';

export type OwnedValue = { value: unknown; original?: unknown };
export type Ownership = Record<string, OwnedValue>;
export type DesiredValues = Record<string, unknown>;
export class TomlConflict extends Error {
  readonly canAdopt: boolean;
  file?: string;
  constructor(readonly key: string, readonly current: unknown) {
    super(`TOML conflict at ${key}: existing user value differs. No changes were made.`);
    this.canAdopt = ['string', 'boolean', 'number'].includes(typeof current) && (typeof current !== 'number' || Number.isFinite(current));
  }
}


function parts(key: string): string[] {
  const result = key.split('.');
  if (result.some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) {
    throw new Error(`Unsupported managed TOML key: ${key}`);
  }
  return result;
}

function table(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function equal(left: unknown, right: unknown): boolean {
  // smol-toml creates null-prototype tables; ownership loaded from JSON has
  // ordinary objects. Their prototype is not part of a TOML value.
  if (table(left) && table(right)) {
    return Object.keys(left).length === Object.keys(right).length &&
      Object.keys(left).every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  }
  return isDeepStrictEqual(left, right);
}

function read(root: Record<string, unknown>, key: string): { exists: boolean; value?: unknown } {
  const path = parts(key);
  let cursor = root;
  for (const part of path.slice(0, -1)) {
    if (!Object.hasOwn(cursor, part)) return { exists: false };
    if (!table(cursor[part])) throw new Error(`Cannot manage ${key}: parent ${part} is not a TOML table.`);
    cursor = cursor[part];
  }
  const leaf = path.at(-1)!;
  return Object.hasOwn(cursor, leaf) ? { exists: true, value: cursor[leaf] } : { exists: false };
}

function write(root: Record<string, unknown>, key: string, value: unknown): void {
  const path = parts(key);
  let cursor = root;
  for (const part of path.slice(0, -1)) {
    if (!Object.hasOwn(cursor, part)) cursor[part] = {};
    if (!table(cursor[part])) throw new Error(`Cannot manage ${key}: parent ${part} is not a TOML table.`);
    cursor = cursor[part];
  }
  cursor[path.at(-1)!] = value;
}

function remove(root: Record<string, unknown>, key: string): void {
  const path = parts(key);
  let cursor = root;
  for (const part of path.slice(0, -1)) {
    if (!Object.hasOwn(cursor, part)) return;
    if (!table(cursor[part])) throw new Error(`Cannot remove ${key}: parent ${part} is not a TOML table.`);
    cursor = cursor[part];
  }
  delete cursor[path.at(-1)!];
  // Parent tables may have existed before installation. Leaf ownership cannot
  // prove they are ours, so preserve even empty tables on removal.
}

/** Structural merge, refusing unowned conflicts and edited owned values.
 * Unchanged input is returned verbatim. Changed TOML is serialized by smol-toml;
 * values survive, but comments and formatting do not.
 */
export function mergeToml(text: string, desired: DesiredValues, previous: Ownership = {}, uninstall = false, approvedConflicts: DesiredValues = {}): { text: string; owned: Ownership } {
  const root = parse(text) as Record<string, unknown>;
  const owned: Ownership = {};
  let changed = false;
  const releases = Object.keys(previous).filter(key => uninstall || !Object.hasOwn(desired, key));
  for (const key of releases) {
    const current = read(root, key);
    const prior = previous[key]!;
    if (current.exists && !equal(current.value, prior.value)) {
      throw new Error(`Cannot remove managed TOML key ${key}: its value was edited. No changes were made.`);
    }
    if (!current.exists) continue;
    if (Object.hasOwn(prior, 'original')) write(root, key, prior.original);
    else remove(root, key);
    changed = true;
  }
  if (!uninstall) for (const [key, value] of Object.entries(desired)) {
    const current = read(root, key);
    const prior = previous[key];
    if (prior && current.exists && !equal(current.value, prior.value)) {
      throw new Error(`Managed TOML key ${key} was edited. No changes were made.`);
    }
    if (!prior && current.exists) {
      if (!equal(current.value, value)) {
        const conflict = new TomlConflict(key, current.value);
        if (!conflict.canAdopt || !Object.hasOwn(approvedConflicts, key) || !equal(approvedConflicts[key], current.value)) throw conflict;
        owned[key] = { value, original: current.value };
        write(root, key, value);
        changed = true;
        continue;
      }
      // Matching user configuration is not ours to uninstall later.
      continue;
    }
    owned[key] = prior && Object.hasOwn(prior, 'original') ? { value, original: prior.original } : { value };
    if (!current.exists || !equal(current.value, value)) {
      write(root, key, value);
      changed = true;
    }
  }
  return { text: changed ? stringify(root as Parameters<typeof stringify>[0]) : text, owned };
}
