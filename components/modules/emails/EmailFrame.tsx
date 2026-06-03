"use client";

import { useState } from "react";

/* Renders email HTML inside a sandboxed, script-disabled iframe so pasted
   templates (with their own <style>, tables, inline CSS) display faithfully
   and can't leak styles into the app. Auto-sizes to content height. */
export function EmailFrame({ html, minHeight = 120 }: { html: string; minHeight?: number }) {
  const [h, setH] = useState(minHeight);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d2733;font-size:14px;line-height:1.55;padding:6px 2px;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#2f6df6}table{max-width:100%}blockquote{border-left:3px solid #e4e7ec;padding-left:.9em;margin:0 0 .6em;color:#475467}h2{font-size:1.18rem;margin:.5em 0 .3em}h3{font-size:1.05rem;margin:.5em 0 .3em}ul,ol{padding-left:1.4em}</style>
</head><body>${html || ""}</body></html>`;
  return (
    <iframe title="email-preview" sandbox="" srcDoc={doc} className="w-full border-0 bg-white rounded-md"
      style={{ height: h }}
      onLoad={(e) => { try { const d = (e.currentTarget as HTMLIFrameElement).contentDocument; if (d?.body) setH(Math.max(minHeight, Math.min(3000, d.body.scrollHeight + 20))); } catch { /* cross-origin guard */ } }} />
  );
}
