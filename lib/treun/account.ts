import "server-only";

// The buying unit's account. HQ (an admin user) allocates its budget; paid orders draw it down.
// Kept on globalThis for the demo (resets when the server restarts).

export interface Allocation {
  amountUsdc: number;
  by: string;
  note: string;
  time: string;
}

export interface Account {
  unit: string;
  holder: string;
  allocations: Allocation[];
  spentUsdc: number;
}

const g = globalThis as unknown as { __treunAccount?: Account };
const account = (g.__treunAccount ??= {
  unit: "3rd Recon Company",
  holder: "Capt. A. Procurement Officer",
  allocations: [{ amountUsdc: 15000, by: "HQ Admin · Brigade J4 Finance", note: "Q4 operational equipment allocation", time: new Date().toISOString() }],
  spentUsdc: 0,
});

export function getAccount() {
  const budgetUsdc = account.allocations.reduce((a, x) => a + x.amountUsdc, 0);
  return { ...account, budgetUsdc, remainingUsdc: budgetUsdc - account.spentUsdc };
}

/** Budget still available to spend. */
export const remaining = (a: { remainingUsdc: number }) => a.remainingUsdc;

export function allocate(amountUsdc: number, by: string, note: string) {
  account.allocations.push({ amountUsdc, by, note, time: new Date().toISOString() });
  return getAccount();
}

export function recordSpend(amountUsdc: number) {
  account.spentUsdc += amountUsdc;
}
