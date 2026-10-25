// The AUD curves are built by the engine but switched off on the site for
// now: no positions, no quotes, no rows. Flip this to bring them back.
export const SHOW_AUD = false;

export const isAud = (id: string) => /^(AUD|AONIA|BBSW|AUDUSD|EOD_AUD)/.test(id) || /AUD/.test(id);

// Drop AUD entries from an object keyed by curve id, or from a list of rows
// that carry a curve id under `key`.
export function dropAudKeys<T>(o: Record<string, T>): Record<string, T> {
  if (SHOW_AUD) return o;
  return Object.fromEntries(Object.entries(o).filter(([k]) => !isAud(k)));
}
export function dropAudRows<T>(rows: T[], key = 'curve'): T[] {
  if (SHOW_AUD) return rows;
  return rows.filter(r => !isAud(String((r as unknown as Record<string, unknown>)[key] ?? '')));
}
