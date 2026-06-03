// Shared types for USPS address validation (used by the API route + clients).
export interface UspsValidateInput {
  streetAddress: string;
  secondaryAddress?: string;
  city?: string;
  state: string;
  ZIPCode?: string;
}
export type UspsStatus = "verified" | "corrected" | "needs_secondary" | "unverified" | "error";
export interface UspsStandardized {
  streetAddress: string;
  secondaryAddress?: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
}
export interface UspsValidateResult {
  status: UspsStatus;
  dpv: "Y" | "D" | "S" | "N" | null; // USPS DPVConfirmation
  address: UspsStandardized | null;  // standardized address to store
  corrections: string[];             // human-readable "how to fix" notes
  warnings: string[];
  vacant: boolean;
  changed: boolean;                  // standardized differs from what was typed
  message: string;
  source: "usps" | "mock";
}

// Address autocomplete (type-ahead) suggestion.
export interface AddressSuggestion {
  street: string;       // primary address line
  secondary?: string;   // apt/suite/unit if present
  city: string;
  state: string;
  zip: string;
  text: string;         // display label
}
