import { getEmailCreds, getSmsCreds } from "./store";

export interface HealthItem { id: string; name: string; category: string; endpoint: string; status: "connected" | "mock"; mode: string; detail: string; }

export function healthStatuses(): HealthItem[] {
  const email = getEmailCreds();
  const sms = getSmsCreds();
  const sq = !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
  const cp = !!(process.env.COREPAY_CLIENT_ID && process.env.COREPAY_API_KEY && process.env.COREPAY_SITE_ID);
  const emed = !!(process.env.EMED_PASSWORD || process.env.EMED_USERNAME);
  const lf = !!(process.env.LIFEFILE_API_USER && process.env.LIFEFILE_API_PASS);
  const mk = (id: string, name: string, category: string, endpoint: string, ok: boolean, detail = ""): HealthItem =>
    ({ id, name, category, endpoint, status: ok ? "connected" : "mock", mode: ok ? "Live credentials set" : "Mock fallback", detail });
  return [
    mk("email", email.provider === "resend" ? "Resend" : "SendGrid", "Email", email.provider === "resend" ? "api.resend.com" : "api.sendgrid.com", !!email.apiKey, email.from || ""),
    mk("sms", "Twilio", "SMS", "api.twilio.com", !!(sms.accountSid && sms.authToken && sms.from), sms.from || ""),
    mk("square", "Square", "Payments", process.env.SQUARE_ENV === "production" ? "connect.squareup.com" : "connect.squareupsandbox.com", sq),
    mk("corepay", "Corepay / NetValve", "Payments", process.env.COREPAY_BASE_URL || "api.netvalve.com", cp, "Live call pending NetValve spec"),
    mk("emed", "RXCompound Store (eMed)", "Pharmacy", "emed.azurewebsites.net", emed),
    mk("lifefile", "Hallandale (Life File)", "Pharmacy", "host100-7.lifefile.net", lf),
  ];
}
