import type { InventoryItem } from "@/lib/types";

export const INVENTORY: InventoryItem[] = [
  { id: "INV-001", name: "Semaglutide 0.25mg", category: "GLP-1",     pharmacy: "Hallandale Compounding", stock: 340, reorderAt: 100, expires: "Aug 2026", status: "ok",       pricePerUnit: 28 },
  { id: "INV-002", name: "Semaglutide 0.5mg",  category: "GLP-1",     pharmacy: "Hallandale Compounding", stock: 280, reorderAt: 100, expires: "Aug 2026", status: "ok",       pricePerUnit: 38 },
  { id: "INV-003", name: "Semaglutide 1mg",    category: "GLP-1",     pharmacy: "Empower Pharmacy",       stock:  45, reorderAt: 100, expires: "Jul 2026", status: "low",      pricePerUnit: 54 },
  { id: "INV-004", name: "Semaglutide 2.4mg",  category: "GLP-1",     pharmacy: "Empower Pharmacy",       stock:  12, reorderAt:  80, expires: "Jul 2026", status: "critical", pricePerUnit: 78 },
  { id: "INV-005", name: "Tirzepatide 2.5mg",  category: "GLP-1",     pharmacy: "Hallandale Compounding", stock: 180, reorderAt:  80, expires: "Sep 2026", status: "ok",       pricePerUnit: 44 },
  { id: "INV-006", name: "Tirzepatide 5mg",    category: "GLP-1",     pharmacy: "Hallandale Compounding", stock:  95, reorderAt:  80, expires: "Sep 2026", status: "ok",       pricePerUnit: 62 },
  { id: "INV-007", name: "Tirzepatide 10mg",   category: "GLP-1",     pharmacy: "Empower Pharmacy",       stock:   8, reorderAt:  50, expires: "Jun 2026", status: "critical", pricePerUnit: 88 },
  { id: "INV-008", name: "Tirzepatide 15mg",   category: "GLP-1",     pharmacy: "Wells Pharmacy",         stock:  22, reorderAt:  40, expires: "Jun 2026", status: "low",      pricePerUnit: 110, onOrder: 40, lastReorderAt: "May 18, 2026" },
  { id: "INV-009", name: "NAD+ IV 500mg",      category: "IV Therapy",pharmacy: "Olympia Pharmacy",       stock:   0, reorderAt:  30, expires: "—",        status: "critical", pricePerUnit: 145 },
  { id: "INV-010", name: "NAD+ IV 250mg",      category: "IV Therapy",pharmacy: "Olympia Pharmacy",       stock:  14, reorderAt:  30, expires: "May 2026", status: "critical", pricePerUnit: 92 },
  { id: "INV-011", name: "Metformin 500mg",    category: "Oral",      pharmacy: "Wells Pharmacy",         stock: 800, reorderAt: 200, expires: "Dec 2026", status: "ok",       pricePerUnit: 2 },
  { id: "INV-012", name: "Metformin 1000mg",   category: "Oral",      pharmacy: "Wells Pharmacy",         stock: 650, reorderAt: 200, expires: "Dec 2026", status: "ok",       pricePerUnit: 3 },
];
