// Life File sandbox reference data (products, shipping services, statuses).
export const LIFEFILE_SANDBOX_PRODUCTS = [
  { id: 305157968, name: "Benzocaine, Lidocaine, Tetracaine Susp Dental", strength: "10%, 10%, 4%", form: "Paste", schedule: "L", units: "grams" },
  { id: 305492218, name: "Baclofen, Dexamethasone, Flurbiprofen Emulsion", strength: "2.5%,0.5%,5%", form: "Cream", schedule: "L", units: "grams" },
  { id: 305492220, name: "Acarbose", strength: "50mg", form: "Tablet", schedule: "L", units: "each" },
  { id: 305492221, name: "Acetaminophen", strength: "500mg", form: "Tablet", schedule: "O", units: "each" },
  { id: 305492222, name: "Acyclovir", strength: "5%", form: "Ointment", schedule: "L", units: "grams" },
] as const;
export const LIFEFILE_SHIP_SERVICES: [number, string][] = [
  [9, "Pharmacy pickup"], [999, "Delivery"], [6223, "Fedex 2 Day"], [6224, "Fedex Express Saver"],
  [6225, "Fedex Ground"], [6226, "Fedex First Overnight"], [6227, "Fedex Ground Home Delivery"],
  [6228, "Fedex Priority Overnight"], [6230, "Fedex Standard Overnight"], [6231, "Fedex 2 Day AM"],
];
export const LIFEFILE_STATUSES: [string, string][] = [["ba9e1", "Sandbox Status A"], ["be520", "Sandbox Status B"]];
