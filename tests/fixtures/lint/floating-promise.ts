// Fixture: the call in run() starts a promise and drops it. no-floating-promises must flag it.

async function save(): Promise<void> {
  await Promise.resolve();
}

export function run(): void {
  save();
}
