import { Redis } from "@upstash/redis";

/**
 * Shared store for patient ↔ provider chat messages, so the patient portal
 * (one device) and the EMR Patient Chat module (another device) see the same
 * conversation. Mirrors the SMS approach: Upstash Redis in production, with an
 * in-memory fallback for local `npm run dev`.
 */
export interface ChatMsgRecord {
  id: string; pid: string; from: string; text: string; time: string;
  attachment?: unknown; ts: number;
}

const KEY = "chat:all";
const MAX = 300;
let mem: ChatMsgRecord[] = [];

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function isPersistent(): boolean { return redis() !== null; }

export async function appendChat(msg: ChatMsgRecord): Promise<void> {
  const r = redis();
  if (r) { await r.rpush(KEY, JSON.stringify(msg)); await r.ltrim(KEY, -MAX, -1); }
  else { mem.push(msg); mem = mem.slice(-MAX); }
}

export async function listChat(pid?: string): Promise<ChatMsgRecord[]> {
  const r = redis();
  let all: ChatMsgRecord[];
  if (r) {
    const raw = await r.lrange<string | ChatMsgRecord>(KEY, 0, -1);
    all = raw.map((x) => (typeof x === "string" ? (JSON.parse(x) as ChatMsgRecord) : x));
  } else {
    all = mem.slice();
  }
  return pid ? all.filter((m) => m.pid === pid) : all;
}
