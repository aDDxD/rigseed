export const START_MARKER = '<!-- rigseed:start codex-orchestration -->';
export const END_MARKER = '<!-- rigseed:end codex-orchestration -->';

type Block = { start: number; bodyStart: number; bodyEnd: number; end: number };

function locate(text: string): Block | undefined {
  // Also reject malformed variants: a damaged marker must never silently create
  // a second block, or cause us to guess which content is ours.
  const candidates = [...text.matchAll(/<!--[^\r\n]*rigseed:(?:start|end)[^\r\n]*(?:-->|$)/gm)];
  const signals = [...text.matchAll(/rigseed:(?:start|end)/g)];
  if (signals.length === 0) return undefined;
  if (signals.length !== candidates.length) {
    throw new Error('The managed block markers are inconsistent. No changes were made.');
  }
  if (candidates.length !== 2 || candidates[0]?.[0] !== START_MARKER || candidates[1]?.[0] !== END_MARKER) {
    throw new Error('The managed block markers are inconsistent. No changes were made.');
  }
  const first = candidates[0]!;
  const last = candidates[1]!;
  const start = first.index!;
  const bodyStart = start + START_MARKER.length;
  const bodyEnd = last.index!;
  const end = bodyEnd + END_MARKER.length;
  // Markers must occupy their own lines.
  for (const [offset, length] of [[start, START_MARKER.length], [bodyEnd, END_MARKER.length]]) {
    if ((offset! > 0 && text[offset! - 1] !== '\n') || !['\n', '\r', undefined].includes(text[offset! + length!])) {
      throw new Error('Managed block markers must occupy their own lines. No changes were made.');
    }
  }
  return { start, bodyStart, bodyEnd, end };
}

export function inspectManagedMarkdown(text: string): { present: boolean; content?: string } {
  const block = locate(text);
  return block ? { present: true, content: text.slice(block.bodyStart, block.bodyEnd).replace(/^\r?\n/, '').replace(/\r?\n$/, '') } : { present: false };
}

export function updateManagedMarkdown(text: string, content: string): string {
  if (/rigseed:(?:start|end)/.test(content)) throw new Error('Managed content cannot contain managed markers.');
  const block = locate(text);
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const normalized = content.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '').replace(/\n/g, newline);
  const body = `${newline}${normalized}${newline}`;
  if (block) return text.slice(0, block.bodyStart) + body + text.slice(block.bodyEnd);
  // Existing text, including its whitespace, is preserved byte for byte.
  const separator = text.length === 0 ? '' : text.endsWith(newline + newline) ? '' : text.endsWith(newline) ? newline : newline + newline;
  return `${text}${separator}${START_MARKER}${body}${END_MARKER}${newline}`;
}

export function removeManagedMarkdown(text: string): string {
  const block = locate(text);
  if (!block) return text;
  // Only the markers and their enclosed content belong to us. Keep every
  // outside byte, including surrounding blank lines and the final newline.
  return text.slice(0, block.start) + text.slice(block.end);
}
