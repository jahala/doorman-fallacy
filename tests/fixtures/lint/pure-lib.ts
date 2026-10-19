// Control: this is allowed in src/lib. A date built from an argument is pure.

export function parse(text: string): Date {
  return new Date(text);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
