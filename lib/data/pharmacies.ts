import type { Pharmacy } from "@/lib/types";

// Real pharmacy network used by DripVitals. e-Prescribe + Integrations + the
// /pharmacies module all read from this list. Keep this to pharmacies you
// actually transmit to — demo/sample pharmacies have been removed.
//
// GreenstoneRX is the live fulfillment pharmacy, reached through the 5Axis
// Pharmacy Orders API (connector: "greenstone"). The transmit endpoint and
// credentials are configured via server env vars (GREENSTONE_BASE_URL,
// GREENSTONE_API_TOKEN, GREENSTONE_PHARMACY_NCPDPID); the fields below are the
// display/admin record.
export const PHARMACIES: Pharmacy[] = [
  {
    id: "PH-001",
    name: "GreenstoneRX",
    icon: "💊",
    location: "5Axis Network",
    states: "All 50 states",
    turnaround: "48h",
    contactName: "GreenstoneRX (5Axis)",
    contactEmail: "orders@greenstonerx.com",
    contactPhone: "",
    apiEndpoint: "https://pharmacy.5axis.health",
    apiKey: "5ap_••••••••",
    status: "connected",
    lastSync: "—",
    type: "compounding",
    monthlyOrders: 0,
    successRate: 100,
    avgFulfillmentDays: 2.0,
    contractedSince: "Jun 2026",
    dba: "GreenstoneRX",
    npi: "",
    ncpdp: "DRIP",
    connector: "greenstone",
    dea: "",
    fax: "",
    website: "https://5axis.health",
    addr: "",
    city: "", state: "", zip: "",
    statesList: ["FL", "TX", "CA", "NY", "GA", "CO", "AZ", "WA", "IL", "PA", "OH", "NC", "MI", "NJ", "VA", "MA"],
    compound: true, ship: true, surescripts: false, epcs: false,
    active: true, primary: true,
    notes: "Live fulfillment pharmacy. Connected via 5Axis Pharmacy Orders API v2 (clinic DRIP). Supports order submission, status polling, and webhook status events.",
    orders30d: 0,
  },
];
