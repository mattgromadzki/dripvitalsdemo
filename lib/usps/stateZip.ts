// Representative major city + a real, valid ZIP code for every US state + DC.
// Used by the DEMO (mock) address autocomplete and validator so any generated
// ZIP is always valid for the selected state instead of a random number.
// When a real provider (Smarty / USPS) is connected, these are not used.
export const STATE_CITY_ZIP: Record<string, { city: string; zip: string }> = {
  AL: { city: "Birmingham", zip: "35203" }, AK: { city: "Anchorage", zip: "99501" },
  AZ: { city: "Phoenix", zip: "85004" }, AR: { city: "Little Rock", zip: "72201" },
  CA: { city: "Los Angeles", zip: "90012" }, CO: { city: "Denver", zip: "80202" },
  CT: { city: "Hartford", zip: "06103" }, DE: { city: "Wilmington", zip: "19801" },
  DC: { city: "Washington", zip: "20001" }, FL: { city: "Miami", zip: "33101" },
  GA: { city: "Atlanta", zip: "30303" }, HI: { city: "Honolulu", zip: "96813" },
  ID: { city: "Boise", zip: "83702" }, IL: { city: "Chicago", zip: "60601" },
  IN: { city: "Indianapolis", zip: "46204" }, IA: { city: "Des Moines", zip: "50309" },
  KS: { city: "Wichita", zip: "67202" }, KY: { city: "Louisville", zip: "40202" },
  LA: { city: "New Orleans", zip: "70112" }, ME: { city: "Portland", zip: "04101" },
  MD: { city: "Baltimore", zip: "21201" }, MA: { city: "Boston", zip: "02108" },
  MI: { city: "Detroit", zip: "48226" }, MN: { city: "Minneapolis", zip: "55401" },
  MS: { city: "Jackson", zip: "39201" }, MO: { city: "Kansas City", zip: "64106" },
  MT: { city: "Billings", zip: "59101" }, NE: { city: "Omaha", zip: "68102" },
  NV: { city: "Las Vegas", zip: "89101" }, NH: { city: "Manchester", zip: "03101" },
  NJ: { city: "Newark", zip: "07102" }, NM: { city: "Albuquerque", zip: "87102" },
  NY: { city: "New York", zip: "10007" }, NC: { city: "Charlotte", zip: "28202" },
  ND: { city: "Fargo", zip: "58102" }, OH: { city: "Columbus", zip: "43215" },
  OK: { city: "Oklahoma City", zip: "73102" }, OR: { city: "Portland", zip: "97204" },
  PA: { city: "Philadelphia", zip: "19103" }, RI: { city: "Providence", zip: "02903" },
  SC: { city: "Columbia", zip: "29201" }, SD: { city: "Sioux Falls", zip: "57104" },
  TN: { city: "Nashville", zip: "37203" }, TX: { city: "Austin", zip: "78701" },
  UT: { city: "Salt Lake City", zip: "84101" }, VT: { city: "Burlington", zip: "05401" },
  VA: { city: "Richmond", zip: "23219" }, WA: { city: "Seattle", zip: "98101" },
  WV: { city: "Charleston", zip: "25301" }, WI: { city: "Milwaukee", zip: "53202" },
  WY: { city: "Cheyenne", zip: "82001" },
};

export const FALLBACK_STATES = ["FL", "TX", "CA", "NY", "WA", "IL"];
