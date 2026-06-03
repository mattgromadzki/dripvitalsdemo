"use client";

import { useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/hooks/useToast";
import { useKnowledgeBase } from "@/lib/hooks/useKnowledgeBase";
import type { KbArticle, KbCategory } from "@/lib/types";

type SortBy = "recent" | "popular" | "alpha";

const CATEGORIES: { id: KbCategory; icon: string; color: string; bgClass: string; description: string }[] = [
  { id: "Clinical SOPs",  icon: "🩺", color: "var(--color-brand)",  bgClass: "var(--color-brand-soft)",  description: "Provider protocols & guidelines" },
  { id: "Operations",     icon: "⚙",  color: "var(--color-amber)",  bgClass: "var(--color-amber-soft)",  description: "Day-to-day workflows" },
  { id: "Compliance",     icon: "📋", color: "var(--color-red)",    bgClass: "var(--color-red-soft)",    description: "HIPAA, legal, audit" },
  { id: "Billing",        icon: "💳", color: "var(--color-violet)", bgClass: "var(--color-violet-soft)", description: "Claims, PA, denials" },
  { id: "Patient FAQs",   icon: "❓", color: "var(--color-teal)",   bgClass: "var(--color-teal-soft)",   description: "Patient-facing education" },
  { id: "Integrations",   icon: "🔗", color: "var(--color-blue)",   bgClass: "var(--color-blue-soft)",   description: "API setup & troubleshooting" },
];

const CATEGORY_INTENT: Record<KbCategory, "brand" | "amber" | "red" | "purple" | "teal" | "blue"> = {
  "Clinical SOPs":  "brand",
  "Operations":     "amber",
  "Compliance":     "red",
  "Billing":        "purple",
  "Patient FAQs":   "teal",
  "Integrations":   "blue",
};

const SORT_LABEL: Record<SortBy, string> = {
  recent:  "Most recent",
  popular: "Most viewed",
  alpha:   "A → Z",
};

export default function KnowledgeBasePage() {
  const articles        = useKnowledgeBase((s) => s.articles);
  const togglePin       = useKnowledgeBase((s) => s.togglePin);
  const togglePublished = useKnowledgeBase((s) => s.togglePublished);
  const voteHelpful     = useKnowledgeBase((s) => s.voteHelpful);
  const incrementViews  = useKnowledgeBase((s) => s.incrementViews);
  const removeArticle   = useKnowledgeBase((s) => s.remove);

  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState<"all" | KbCategory>("all");
  const [sortBy, setSortBy]       = useState<SortBy>("recent");
  const [readArticle, setReadArticle] = useState<KbArticle | null>(null);
  const [removeTarget, setRemoveTarget] = useState<KbArticle | null>(null);

  // Counts per category
  const counts = useMemo(() => {
    const map: Record<KbCategory, number> = {
      "Clinical SOPs": 0,
      "Operations": 0,
      "Compliance": 0,
      "Billing": 0,
      "Patient FAQs": 0,
      "Integrations": 0,
    };
    for (const a of articles) map[a.category]++;
    return map;
  }, [articles]);

  // KPIs
  const metrics = useMemo(() => {
    const totalViews = articles.reduce((sum, a) => sum + a.views, 0);
    const totalHelpful = articles.reduce((sum, a) => sum + a.helpful, 0);
    const totalNotHelpful = articles.reduce((sum, a) => sum + a.notHelpful, 0);
    const helpfulRate = (totalHelpful + totalNotHelpful) > 0
      ? (totalHelpful / (totalHelpful + totalNotHelpful)) * 100
      : 0;
    const drafts = articles.filter((a) => !a.isPublished).length;

    return {
      total: articles.length,
      published: articles.length - drafts,
      totalViews,
      helpfulRate,
      pinned: articles.filter((a) => a.pinned).length,
    };
  }, [articles]);

  // Filtered + sorted articles
  const filtered = useMemo(() => {
    let list = articles;
    if (category !== "all") list = list.filter((a) => a.category === category);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    // Sort: pinned first, then by selected sort
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sortBy === "popular") return b.views - a.views;
      if (sortBy === "alpha")   return a.title.localeCompare(b.title);
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [articles, category, search, sortBy]);

  function openArticle(article: KbArticle) {
    incrementViews(article.id);
    setReadArticle(article);
  }

  function renderBody(text: string): ReactNode {
    // Simple markdown-ish renderer: split by double newlines into paragraphs,
    // bold within **...**
    const paragraphs = text.split(/\n\n+/);
    return paragraphs.map((p, idx) => (
      <p key={idx} className="text-[13px] text-ink-2 leading-relaxed mb-3 whitespace-pre-line">
        {renderInlineFormatting(p)}
      </p>
    ));
  }

  function renderInlineFormatting(text: string): ReactNode {
    // Split on **bold** segments
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Knowledge Base</div>
          <div className="text-[13px] text-ink-muted">
            {metrics.total} articles · Staff SOPs · Patient FAQs · Compliance guides
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Article catalog exported")}>📥 Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => toast("✏ Article editor opened (full editor not yet ported)")}>
            + New Article
          </button>
        </div>
      </div>

      {/* Hero search card */}
      <div className="rounded-lg p-6 mb-5" style={{ background: "var(--color-brand)" }}>
        <div className="text-white font-bold text-[20px] mb-2 tracking-tight">
          What can we help you find?
        </div>
        <div className="text-white/80 text-[12.5px] mb-3">
          Search across {metrics.total} articles · {metrics.totalViews.toLocaleString()} total views
        </div>
        <div className="flex items-center gap-2.5 bg-white/10 border border-white/15 rounded-md py-2.5 px-3.5">
          <span className="text-white text-[15px]">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, content, tags, or author…"
            className="flex-1 bg-transparent border-none outline-none text-white text-[14px] placeholder:text-white/60"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-white/60 hover:text-white text-[12px] font-bold px-2"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Total Articles"
          value={metrics.total}
          icon="📚"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${metrics.published} published`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Total Views"
          value={metrics.totalViews.toLocaleString()}
          icon="👁"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="All-time"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Helpful Rate"
          value={`${metrics.helpfulRate.toFixed(0)}%`}
          icon="👍"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend="Reader feedback"
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="Pinned"
          value={metrics.pinned}
          icon="📌"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend="High-priority articles"
          trendColor="var(--color-violet)"
        />
      </KpiGrid>

      {/* Category tiles */}
      <div className="grid grid-cols-6 gap-2.5 mb-5 max-[1100px]:grid-cols-3 max-[600px]:grid-cols-2">
        <button
          onClick={() => setCategory("all")}
          className={[
            "p-4 rounded-lg border text-center transition-all",
            category === "all" ? "border-brand bg-brand-soft" : "bg-surface border-border hover:border-border-2",
          ].join(" ")}
        >
          <div className="text-[24px] mb-1">📚</div>
          <div className="text-[12.5px] font-bold text-ink">All Articles</div>
          <div className="text-[11px] text-ink-muted mt-0.5">{metrics.total}</div>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={[
              "p-4 rounded-lg border text-center transition-all",
              category === c.id ? "shadow-md" : "bg-surface border-border hover:border-border-2",
            ].join(" ")}
            style={category === c.id ? { borderColor: c.color, background: c.bgClass } : undefined}
          >
            <div className="text-[24px] mb-1">{c.icon}</div>
            <div className="text-[12.5px] font-bold text-ink">{c.id}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{counts[c.id]} articles</div>
          </button>
        ))}
      </div>

      {/* Filter bar + sort */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {category !== "all" && (
          <Pill intent={CATEGORY_INTENT[category]} dot>
            {CATEGORIES.find((c) => c.id === category)?.icon} {category} ({counts[category]})
          </Pill>
        )}
        {(category !== "all" || search) && (
          <button
            onClick={() => { setCategory("all"); setSearch(""); }}
            className="py-1 px-2.5 rounded-pill text-[10.5px] font-semibold bg-surface-2 border border-border text-ink-muted hover:bg-red-soft hover:border-red hover:text-red transition-colors"
          >
            Clear filters ✕
          </button>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-ink-muted">Sort:</span>
        <select
          className="fsel"
          style={{ width: 150, padding: "5px 26px 5px 10px", fontSize: 12 }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          {(Object.keys(SORT_LABEL) as SortBy[]).map((s) => (
            <option key={s} value={s}>{SORT_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Article list */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>
            📚
          </div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2 flex-1">
            {category === "all" ? "All Articles" : category}
          </div>
          <div className="text-[11px] text-ink-muted">
            {filtered.length} {filtered.length === 1 ? "article" : "articles"}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-ink-muted">
            <div className="text-[36px] opacity-40 mb-2">📚</div>
            <div className="text-[13px] font-bold text-ink mb-0.5">No articles match</div>
            <div className="text-[11.5px]">Try a different search term or category</div>
          </div>
        ) : (
          filtered.map((a, i) => (
            <ArticleRow
              key={a.id}
              article={a}
              onOpen={() => openArticle(a)}
              onTogglePin={() => {
                togglePin(a.id);
                toast(a.pinned ? "📌 Unpinned" : "📌 Pinned to top");
              }}
              isLast={i === filtered.length - 1}
              delay={i * 12}
            />
          ))
        )}
      </div>

      {/* Article reader modal */}
      {readArticle && (
        <div
          className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4 animate-fadeUp"
          onClick={() => setReadArticle(null)}
          style={{ animationDuration: "150ms" }}
        >
          <div
            className="bg-surface rounded-lg shadow-2xl max-w-[760px] w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Article header */}
            <div className="py-4 px-6 border-b border-border flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Pill intent={CATEGORY_INTENT[readArticle.category]} dot>
                    {CATEGORIES.find((c) => c.id === readArticle.category)?.icon} {readArticle.category}
                  </Pill>
                  {readArticle.pinned && <Pill intent="purple">📌 Pinned</Pill>}
                  {!readArticle.isPublished && <Pill intent="muted">Draft</Pill>}
                  <Pill intent="muted">{readArticle.visibility === "patient" ? "👥 Public" : "🔒 Staff"}</Pill>
                </div>
                <div className="text-[20px] font-bold tracking-tight text-ink leading-tight mb-1">
                  {readArticle.title}
                </div>
                <div className="text-[11.5px] text-ink-muted">
                  By <strong className="text-ink-2">{readArticle.author}</strong> · Updated <span className="font-mono">{readArticle.updatedDate}</span> · <strong>{readArticle.views.toLocaleString()}</strong> views
                </div>
              </div>
              <button
                className="text-ink-muted hover:text-ink text-[20px] font-bold w-8 h-8 rounded-md hover:bg-surface-2 transition-colors flex items-center justify-center flex-shrink-0"
                onClick={() => setReadArticle(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Article body */}
            <div className="flex-1 overflow-y-auto py-5 px-6">
              {renderBody(readArticle.body)}

              {readArticle.tags.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">Tags</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {readArticle.tags.map((tag) => (
                      <span
                        key={tag}
                        className="py-1 px-2.5 rounded-pill text-[11px] font-semibold bg-surface-2 border border-border text-ink-2"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with thumbs */}
            <div className="py-3 px-6 border-t border-border bg-surface-2 flex items-center gap-3 flex-wrap">
              <span className="text-[11.5px] text-ink-muted">Was this helpful?</span>
              <button
                className="px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-green-soft hover:border-green text-[12px] font-semibold transition-colors flex items-center gap-1.5"
                onClick={() => {
                  voteHelpful(readArticle.id, true);
                  toast("👍 Thanks for the feedback");
                }}
              >
                👍 Yes <span className="text-ink-muted">({readArticle.helpful})</span>
              </button>
              <button
                className="px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-red-soft hover:border-red text-[12px] font-semibold transition-colors flex items-center gap-1.5"
                onClick={() => {
                  voteHelpful(readArticle.id, false);
                  toast("👎 Noted — we'll improve this article");
                }}
              >
                👎 No <span className="text-ink-muted">({readArticle.notHelpful})</span>
              </button>
              <div className="flex-1" />
              <button className="btn btn-ghost btn-sm" onClick={() => {
                togglePin(readArticle.id);
                toast(readArticle.pinned ? "📌 Unpinned" : "📌 Pinned to top");
              }}>
                {readArticle.pinned ? "📌 Unpin" : "📌 Pin"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                togglePublished(readArticle.id);
                toast(readArticle.isPublished ? "Moved to draft" : "Published");
              }}>
                {readArticle.isPublished ? "Move to Draft" : "Publish"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast("✏ Editor opened")}>
                ✏ Edit
              </button>
              <button
                className="btn btn-sm text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors"
                onClick={() => {
                  setRemoveTarget(readArticle);
                  setReadArticle(null);
                }}
              >
                🗑 Archive
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            removeArticle(removeTarget.id);
            toast(`🗑 ${removeTarget.title} archived`);
          }
        }}
        icon="🗑"
        title="Archive article?"
        message={removeTarget ? `"${removeTarget.title}" will be archived. Existing views and feedback are preserved. The article won't appear in search results.` : ""}
        confirmLabel="Archive article"
      />
      <Toast />
    </div>
  );
}

// ─── Article row ──────────────────────────────────────────────────────────
interface ArticleRowProps {
  key?: Key;
  article: KbArticle;
  onOpen: () => void;
  onTogglePin: () => void;
  isLast: boolean;
  delay: number;
}

function ArticleRow({ article: a, onOpen, onTogglePin, isLast, delay }: ArticleRowProps) {
  const initials = a.author.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const totalVotes = a.helpful + a.notHelpful;
  const helpfulPct = totalVotes > 0 ? Math.round((a.helpful / totalVotes) * 100) : 0;
  const preview = a.body.slice(0, 140).replace(/\*\*/g, "");

  return (
    <div
      onClick={onOpen}
      className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-surface-2 transition-colors animate-fadeUp ${isLast ? "" : "border-b border-border"}`}
      style={{
        animationDelay: `${delay}ms`,
        borderLeft: a.pinned ? "3px solid var(--color-violet)" : undefined,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
        style={{ background: a.authorColor || "var(--color-ink-muted)" }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {a.pinned && <span className="text-violet text-[12px]" title="Pinned">📌</span>}
          <div className="text-[13.5px] font-bold text-ink truncate">{a.title}</div>
          {!a.isPublished && <Pill intent="muted">Draft</Pill>}
          {a.visibility === "patient" && <Pill intent="teal">👥 Public</Pill>}
        </div>
        <div className="text-[11.5px] text-ink-muted leading-relaxed line-clamp-2 mb-2">
          {preview}…
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[10.5px] text-ink-muted">
          <Pill intent={CATEGORY_INTENT[a.category]}>{a.category}</Pill>
          <span>By <strong className="text-ink-2">{a.author}</strong></span>
          <span>·</span>
          <span className="font-mono">{a.updatedDate}</span>
          <span>·</span>
          <span>👁 <strong className="text-ink-2">{a.views.toLocaleString()}</strong> views</span>
          {totalVotes > 0 && (
            <>
              <span>·</span>
              <span>👍 <strong className="text-green">{helpfulPct}%</strong> ({totalVotes})</span>
            </>
          )}
          {a.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-brand-dk font-semibold">#{tag}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 items-end flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`text-[14px] w-8 h-8 rounded-md flex items-center justify-center transition-colors ${a.pinned ? "bg-violet-soft text-violet" : "text-ink-muted hover:bg-surface-3"}`}
          title={a.pinned ? "Unpin" : "Pin"}
        >
          📌
        </button>
      </div>
    </div>
  );
}
