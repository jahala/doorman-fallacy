/** The fields of a submitted form: each name with every value it was sent with, in order. */
export type Fields = Readonly<Record<string, readonly string[]>>;

/** Groups name and value pairs by name. */
export function fieldsFrom(pairs: Iterable<readonly [string, string]>): Fields {
  const grouped = new Map<string, string[]>();
  for (const [name, value] of pairs) {
    const values = grouped.get(name);
    if (values === undefined) grouped.set(name, [value]);
    else values.push(value);
  }
  return Object.fromEntries(grouped);
}

/** Every value sent under a name, or none. Only a field that was sent counts, never an inherited property. */
export function valuesOf(fields: Fields, name: string): readonly string[] {
  return Object.hasOwn(fields, name) ? (fields[name] ?? []) : [];
}

/** The first value sent under a name, or an empty string when there is none. */
export function firstValue(fields: Fields, name: string): string {
  return valuesOf(fields, name)[0] ?? '';
}

/** A result that carries its failures instead of throwing. */
export type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly problems: readonly Problem[] };

/**
 * The hidden field that people leave empty and bots fill in. A form that reaches the Worker with
 * it filled is dropped without a trace.
 */
export function isHoneypotFilled(fields: Fields): boolean {
  return valuesOf(fields, 'website').some((value) => value !== '');
}
