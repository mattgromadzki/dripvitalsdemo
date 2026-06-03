interface PlaceholderProps {
  title: string;
  description?: string;
  sourceFile?: string;
}

export function ModulePlaceholder({ title, description, sourceFile }: PlaceholderProps) {
  return (
    <div className="px-7 py-6">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight mb-1">{title}</div>
        <div className="text-[13px] text-ink-muted">{description || "Module migration in progress"}</div>
      </div>
      <div className="card p-12 text-center">
        <div className="text-[48px] opacity-40 mb-3">🚧</div>
        <div className="text-[16px] font-bold mb-1.5 tracking-tight">Migration in progress</div>
        <div className="text-[12.5px] text-ink-muted leading-relaxed max-w-md mx-auto">
          This module exists in the standalone HTML build but hasn&rsquo;t been ported to a React component yet.
          {sourceFile && <> Source: <span className="font-mono text-[11px]">{sourceFile}</span></>}
        </div>
        <div className="text-[11px] text-ink-muted-2 mt-4">
          Tell Claude &ldquo;convert the {title.toLowerCase()} module next&rdquo; in your next prompt.
        </div>
      </div>
    </div>
  );
}
