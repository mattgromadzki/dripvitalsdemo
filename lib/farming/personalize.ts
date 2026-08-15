import type { FarmContact } from "@/lib/types/farming";

// Replaces {{variable}} tokens in a campaign body/subject with contact fields.
// Pure + isomorphic — used for the composer preview (client) and sending (server).
// Unknown tokens resolve to "" so a half-filled contact never leaks "{{company}}".
export function personalize(template: string, c: Partial<FarmContact>): string {
  const vars: Record<string, string> = {
    firstname: c.firstName || "",
    lastname: c.lastName || "",
    name: [c.firstName, c.lastName].filter(Boolean).join(" "),
    company: c.company || "",
    title: c.title || "",
    email: c.email || "",
    phone: c.phone || "",
  };
  return (template || "").replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key.toLowerCase()];
    return v !== undefined ? v : "";
  });
}

// Available merge tokens, surfaced as insert buttons in the composer.
export const MERGE_TOKENS = ["firstName", "lastName", "name", "company", "title", "email", "phone"] as const;
