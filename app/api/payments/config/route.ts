import { publicConfig } from "@/lib/payments/provider";
export async function GET() { return Response.json(publicConfig()); }
