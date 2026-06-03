"use client";

import { useEffect, useRef, useState } from "react";
import { EmailFrame } from "./EmailFrame";

type Mode = "rich" | "html" | "preview";

/* WYSIWYG + HTML source + preview. The "HTML" tab lets you paste a full HTML
   email template; "Preview" renders it sandboxed; "Rich" is the formatting
   editor. All three drive the same `value`. */
export function RichTextEditor({ value, onChange, minHeight = 240 }: {
  value: string; onChange: (html: string) => void; minHeight?: number;
}) {
  const [mode, setMode] = useState<Mode>("rich");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "rich" && ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value, mode]);

  const emit = () => onChange(ref.current?.innerHTML || "");
  function exec(cmd: string, arg?: string) { document.execCommand(cmd, false, arg); ref.current?.focus(); emit(); }
  function block(tag: string) { document.execCommand("formatBlock", false, tag); ref.current?.focus(); emit(); }
  function link() { const url = window.prompt("Link URL"); if (url) exec("createLink", /^https?:\/\//i.test(url) ? url : `https://${url}`); }

  const Btn = ({ on, label, title }: { on: () => void; label: string; title: string }) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); on(); }}
      className="h-7 w-7 rounded-md text-[13px] font-semibold text-ink-2 hover:bg-surface-3 flex items-center justify-center">{label}</button>
  );
  const Sep = () => <span className="w-px h-5 bg-border mx-0.5 self-center" />;
  const Tab = ({ m, label }: { m: Mode; label: string }) => (
    <button type="button" onClick={() => setMode(m)}
      className={`h-7 px-2.5 rounded-md text-[11.5px] font-bold ${mode === m ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-3"}`}>{label}</button>
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface flex flex-col h-full">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border bg-surface-2">
        {mode === "rich" ? (
          <>
            <Btn on={() => exec("bold")} label="B" title="Bold" />
            <Btn on={() => exec("italic")} label="𝘐" title="Italic" />
            <Btn on={() => exec("underline")} label="U̲" title="Underline" />
            <Btn on={() => exec("strikeThrough")} label="S̶" title="Strikethrough" />
            <Sep />
            <Btn on={() => block("H2")} label="H1" title="Heading" />
            <Btn on={() => block("H3")} label="H2" title="Subheading" />
            <Btn on={() => block("P")} label="¶" title="Paragraph" />
            <Sep />
            <Btn on={() => exec("insertUnorderedList")} label="•" title="Bulleted list" />
            <Btn on={() => exec("insertOrderedList")} label="1." title="Numbered list" />
            <Btn on={() => block("BLOCKQUOTE")} label="❝" title="Quote" />
            <Sep />
            <Btn on={() => exec("justifyLeft")} label="⇤" title="Align left" />
            <Btn on={() => exec("justifyCenter")} label="↔" title="Center" />
            <Btn on={() => exec("justifyRight")} label="⇥" title="Align right" />
            <Sep />
            <Btn on={link} label="🔗" title="Insert link" />
            <Btn on={() => exec("removeFormat")} label="⌫" title="Clear formatting" />
          </>
        ) : (
          <span className="text-[11px] text-ink-muted px-1">{mode === "html" ? "Paste or edit raw HTML — full email templates supported." : "Sandboxed preview"}</span>
        )}
        <div className="flex-1" />
        <Tab m="rich" label="Rich" />
        <Tab m="html" label="HTML" />
        <Tab m="preview" label="Preview" />
      </div>

      {mode === "rich" && (
        <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit}
          className="rte-surface px-3 py-2.5 text-[13px] leading-relaxed outline-none overflow-y-auto flex-1" style={{ minHeight }} />
      )}
      {mode === "html" && (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false}
          placeholder="<table>…paste your HTML email template here…</table>"
          className="px-3 py-2.5 font-mono text-[12px] leading-relaxed outline-none overflow-y-auto flex-1 resize-none bg-surface" style={{ minHeight }} />
      )}
      {mode === "preview" && (
        <div className="overflow-y-auto flex-1 p-2 bg-surface-2/50" style={{ minHeight }}>
          <EmailFrame html={value} minHeight={minHeight - 20} />
        </div>
      )}
    </div>
  );
}
