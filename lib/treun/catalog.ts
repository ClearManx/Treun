// Treun demo catalogue. All suppliers and products are FICTIONAL.
// Listings are catalogue-level only (no technical weapon specifications).

export interface Supplier {
  id: string;
  name: string;
  country: string;
  flag: string;
  licence: { ref: string; status: "valid" | "expired"; expires: string };
}

export interface Item {
  id: string;
  name: string;
  category: string;
  supplierId: string;
  unitPriceUsdc: number;
  leadTimeDays: number;
}

export const SUPPLIERS: Supplier[] = [
  { id: "SUP-UK1", name: "Albion Field Systems", country: "United Kingdom", flag: "🇬🇧", licence: { ref: "UK-OGEL-2291", status: "valid", expires: "2027-06-30" } },
  { id: "SUP-PL1", name: "Wisła Tactical", country: "Poland", flag: "🇵🇱", licence: { ref: "PL-ZEZ-7714", status: "valid", expires: "2027-03-31" } },
  { id: "SUP-EE1", name: "Baltic Signal OÜ", country: "Estonia", flag: "🇪🇪", licence: { ref: "EE-SK-0458", status: "valid", expires: "2027-01-15" } },
  { id: "SUP-UA1", name: "Dnipro MedTech", country: "Ukraine", flag: "🇺🇦", licence: { ref: "UA-DSEK-3302", status: "valid", expires: "2026-12-31" } },
  { id: "SUP-XX1", name: "Northgate Surplus Ltd", country: "Unverified", flag: "⚠️", licence: { ref: "EXP-0091", status: "expired", expires: "2026-04-01" } },
];

export const ITEMS: Item[] = [
  { id: "RAD-01", name: "Encrypted handheld radio", category: "Comms", supplierId: "SUP-EE1", unitPriceUsdc: 420, leadTimeDays: 5 },
  { id: "RAD-02", name: "Vehicle radio set", category: "Comms", supplierId: "SUP-EE1", unitPriceUsdc: 1350, leadTimeDays: 9 },
  { id: "SAT-01", name: "Portable satellite terminal", category: "Comms", supplierId: "SUP-UK1", unitPriceUsdc: 2900, leadTimeDays: 7 },
  { id: "MED-01", name: "Individual first-aid kit (IFAK)", category: "Medical", supplierId: "SUP-UA1", unitPriceUsdc: 65, leadTimeDays: 2 },
  { id: "MED-02", name: "Tourniquet (pack of 4)", category: "Medical", supplierId: "SUP-UA1", unitPriceUsdc: 48, leadTimeDays: 2 },
  { id: "MED-03", name: "Casualty evacuation stretcher", category: "Medical", supplierId: "SUP-PL1", unitPriceUsdc: 210, leadTimeDays: 4 },
  { id: "ARM-01", name: "Body armour plate carrier", category: "Protection", supplierId: "SUP-PL1", unitPriceUsdc: 380, leadTimeDays: 6 },
  { id: "ARM-02", name: "Ballistic helmet", category: "Protection", supplierId: "SUP-UK1", unitPriceUsdc: 310, leadTimeDays: 6 },
  { id: "PWR-01", name: "Portable power bank (500 Wh)", category: "Power", supplierId: "SUP-UK1", unitPriceUsdc: 540, leadTimeDays: 3 },
  { id: "PWR-02", name: "Foldable solar panel (200 W)", category: "Power", supplierId: "SUP-PL1", unitPriceUsdc: 260, leadTimeDays: 4 },
  { id: "ISR-01", name: "Small reconnaissance drone (ISR)", category: "ISR", supplierId: "SUP-UA1", unitPriceUsdc: 1800, leadTimeDays: 5 },
  { id: "ISR-02", name: "Thermal monocular", category: "ISR", supplierId: "SUP-EE1", unitPriceUsdc: 1150, leadTimeDays: 8 },
  { id: "SUS-01", name: "Ration pack (case of 12)", category: "Sustainment", supplierId: "SUP-PL1", unitPriceUsdc: 95, leadTimeDays: 2 },
  { id: "SUS-02", name: "Water purification kit", category: "Sustainment", supplierId: "SUP-UA1", unitPriceUsdc: 70, leadTimeDays: 3 },
  { id: "PWR-03", name: "Portable generator (2 kW)", category: "Power", supplierId: "SUP-XX1", unitPriceUsdc: 1250, leadTimeDays: 3 },
];

/** Devnet settlement is scaled down so the demo wallet can pay real orders with test USDC. */
export const DEVNET_SCALE = 10_000;

export const supplierById = (id: string) => SUPPLIERS.find((s) => s.id === id);
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
