import { parse, TomlError, type TomlTable } from 'smol-toml';

/** Parser diagnostics normally include source lines, which may contain credentials. */
export function parseToml(text: string): TomlTable {
  try { return parse(text, { integersAsBigInt: 'asNeeded', useLegacyDate: true, unsafeKeyBehaviour: 'throw' }); }
  catch (error) {
    const location = error instanceof TomlError ? ` at line ${error.line}, column ${error.column}` : '';
    throw new Error(`Invalid TOML document${location}. No changes were made.`, { cause: error });
  }
}
