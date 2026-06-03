"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Key } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { useReviews } from "@/lib/hooks/useReviews";
import type { Review } from "@/lib/types";

type StarFilter = "all" | "5" | "4" | "3" | "2" | "1";
type SegmentFilter = "all" | "promoter" | "passive" | "detractor";
type ReplyFilter = "all" | "needs_reply" | "replied" | "flagged";

function npsSegment(nps: number): "promoter" | "passive" | "detractor" {
  if (nps >= 9) return "promoter";
  if (nps >= 7) return "passive";
  return "detractor";
}

export default function ReviewsPage() {
  const reviews     = useReviews((s) => s.reviews);
  const addReply    = useReviews((s) => s.addReply);
  const toggleFlag  = useReviews((s) => s.toggleFlag);

  const [starFilter, setStarFilter]       = useState<StarFilter>("all");
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>("all");
  const [replyFilter, setReplyFilter]     = useState<ReplyFilter>("all");
  const [search, setSearch]               = useState("");
  const [composingId, setComposingId]     = useState<string | null>(null);
  const [composerText, setComposerText]   = useState("");
  const [surveyOpen, setSurveyOpen]       = useState(false);

  // Metrics
  const metrics = useMemo(() => {
    const total = reviews.length;
    const totalStars = reviews.reduce((sum, r) => sum + r.stars, 0);
    const avgStars = total > 0 ? totalStars / total : 0;

    // NPS = % promoters - % detractors
    const promoters  = reviews.filter((r) => npsSegment(r.nps) === "promoter").length;
    const passives   = reviews.filter((r) => npsSegment(r.nps) === "passive").length;
    const detractors = reviews.filter((r) => npsSegment(r.nps) === "detractor").length;
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

    const needsReply = reviews.filter((r) => !r.reply).length;
    const lowScores = reviews.filter((r) => r.stars <= 2).length;

    // Star breakdown
    const starBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) starBreakdown[r.stars]++;

    return {
      total, avgStars, nps,
      promoters, passives, detractors,
      promoterPct:  total > 0 ? Math.round((promoters / total) * 100) : 0,
      passivePct:   total > 0 ? Math.round((passives / total) * 100) : 0,
      detractorPct: total > 0 ? Math.round((detractors / total) * 100) : 0,
      needsReply, lowScores,
      starBreakdown,
    };
  }, [reviews]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = reviews;
    if (starFilter !== "all") list = list.filter((r) => r.stars === parseInt(starFilter, 10));
    if (segmentFilter !== "all") list = list.filter((r) => npsSegment(r.nps) === segmentFilter);
    if (replyFilter === "needs_reply") list = list.filter((r) => !r.reply);
    else if (replyFilter === "replied") list = list.filter((r) => !!r.reply);
    else if (replyFilter === "flagged") list = list.filter((r) => r.flagged);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.text.toLowerCase().includes(q) ||
        (r.providerName || "").toLowerCase().includes(q) ||
        (r.reply || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.orderedAt - a.orderedAt);
  }, [reviews, starFilter, segmentFilter, replyFilter, search]);

  function handleReply(id: string) {
    const text = composerText.trim();
    if (!text) { toast("⚠ Reply cannot be empty"); return; }
    addReply(id, text, "Dr. Rivera");
    setComposingId(null);
    setComposerText("");
    toast(`💬 Reply published`);
  }

  function exportCsv() {
    const header = ["Review ID", "Patient", "Provider", "Visit Type", "Stars", "NPS", "Date", "Text", "Reply", "Replied By", "Flagged"];
    const rows = filtered.map((r) => [
      r.id,
      `"${r.patientName.replace(/"/g, '""')}"`,
      r.providerName || "",
      r.visitType,
      r.stars, r.nps,
      r.date,
      `"${r.text.replace(/"/g, '""')}"`,
      r.reply ? `"${r.reply.replace(/"/g, '""')}"` : "",
      r.replyAuthor || "",
      r.flagged ? "true" : "false",
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `dripvitals_reviews_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filtered.length} reviews to CSV`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Reviews &amp; NPS</div>
          <div className="text-[13px] text-ink-muted">
            {metrics.total} reviews · <span className="font-bold text-green">NPS: {metrics.nps}</span> · {metrics.avgStars.toFixed(1)}★ average
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setSurveyOpen(true)}>📧 Send Survey</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={5}>
        <KpiCard
          label="Avg Rating"
          value={`${metrics.avgStars.toFixed(1)}★`}
          icon="⭐"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={`${metrics.total} reviews`}
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="NPS Score"
          value={metrics.nps}
          icon="📊"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="Industry avg: 45–60"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Total Reviews"
          value={metrics.total}
          icon="💬"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend="Last 90 days"
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Awaiting Reply"
          value={metrics.needsReply}
          icon="⏳"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={metrics.needsReply > 0 ? "Reply within 24h" : "All replied"}
          trendColor={metrics.needsReply > 0 ? "var(--color-amber)" : "var(--color-green)"}
        />
        <KpiCard
          label="Low Scores"
          value={metrics.lowScores}
          icon="⚠"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={metrics.lowScores > 0 ? "Service recovery" : "All clear"}
          trendColor={metrics.lowScores > 0 ? "var(--color-red)" : "var(--color-green)"}
        />
      </KpiGrid>

      {/* 2-col: NPS breakdown + Star rating breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-4 max-[900px]:grid-cols-1">
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-green-soft)", color: "var(--color-green)" }}>
              📊
            </div>
            <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2">NPS Breakdown</div>
          </div>
          <div className="p-5 text-center">
            <div className="text-[54px] font-extrabold text-green leading-none tracking-tight">{metrics.nps}</div>
            <div className="text-[12px] text-ink-muted mt-1">
              Industry avg: 45–60 · <strong className="text-green">↑ +4 pts</strong>
            </div>

            <div className="flex h-3 rounded-full overflow-hidden mt-4 mb-3 border border-border bg-surface-3">
              <div
                className="transition-all"
                style={{ width: `${metrics.detractorPct}%`, background: "var(--color-red)" }}
                title={`${metrics.detractors} Detractors (0-6)`}
              />
              <div
                className="transition-all"
                style={{ width: `${metrics.passivePct}%`, background: "var(--color-amber)" }}
                title={`${metrics.passives} Passives (7-8)`}
              />
              <div
                className="transition-all"
                style={{ width: `${metrics.promoterPct}%`, background: "var(--color-green)" }}
                title={`${metrics.promoters} Promoters (9-10)`}
              />
            </div>

            <div className="flex justify-center gap-4 text-[11.5px] font-semibold">
              <button
                onClick={() => setSegmentFilter(segmentFilter === "detractor" ? "all" : "detractor")}
                className={`inline-flex items-center gap-1 hover:underline ${segmentFilter === "detractor" ? "text-red font-bold" : "text-red"}`}
              >
                <span className="w-2 h-2 rounded-full bg-red inline-block" /> Detractors {metrics.detractorPct}%
              </button>
              <button
                onClick={() => setSegmentFilter(segmentFilter === "passive" ? "all" : "passive")}
                className={`inline-flex items-center gap-1 hover:underline ${segmentFilter === "passive" ? "text-amber font-bold" : "text-amber"}`}
              >
                <span className="w-2 h-2 rounded-full bg-amber inline-block" /> Passives {metrics.passivePct}%
              </button>
              <button
                onClick={() => setSegmentFilter(segmentFilter === "promoter" ? "all" : "promoter")}
                className={`inline-flex items-center gap-1 hover:underline ${segmentFilter === "promoter" ? "text-green font-bold" : "text-green"}`}
              >
                <span className="w-2 h-2 rounded-full bg-green inline-block" /> Promoters {metrics.promoterPct}%
              </button>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-amber-soft)", color: "var(--color-amber)" }}>
              ⭐
            </div>
            <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2">Star Rating Breakdown</div>
          </div>
          <div className="p-5 space-y-2.5">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = metrics.starBreakdown[star] || 0;
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return (
                <button
                  key={star}
                  onClick={() => setStarFilter(starFilter === String(star) ? "all" : (String(star) as StarFilter))}
                  className={[
                    "flex items-center gap-3 w-full text-left p-1 rounded hover:bg-surface-2 transition-colors",
                    starFilter === String(star) ? "bg-brand-soft" : "",
                  ].join(" ")}
                >
                  <span className="font-bold text-[12.5px] w-8 text-right text-ink">{star}★</span>
                  <div className="flex-1 h-2 bg-surface-3 rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{ width: `${pct}%`, background: "var(--color-amber)" }}
                    />
                  </div>
                  <span className="font-mono text-[11.5px] text-ink-muted w-12 text-right">{count}</span>
                  <span className="font-mono text-[11.5px] text-ink-muted w-12 text-right">{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter chips + search */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setReplyFilter("all")}
          className={[
            "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
            replyFilter === "all" ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
          ].join(" ")}
        >
          All ({metrics.total})
        </button>
        <button
          onClick={() => setReplyFilter("needs_reply")}
          className={[
            "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
            replyFilter === "needs_reply" ? "bg-amber text-white border-amber" : "bg-surface border-border text-ink-2 hover:border-border-2",
          ].join(" ")}
        >
          ⏳ Needs Reply ({metrics.needsReply})
        </button>
        <button
          onClick={() => setReplyFilter("replied")}
          className={[
            "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
            replyFilter === "replied" ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
          ].join(" ")}
        >
          💬 Replied ({metrics.total - metrics.needsReply})
        </button>
        <button
          onClick={() => setReplyFilter("flagged")}
          className={[
            "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
            replyFilter === "flagged" ? "bg-red text-white border-red" : "bg-surface border-border text-ink-2 hover:border-border-2",
          ].join(" ")}
        >
          🚩 Flagged ({reviews.filter((r) => r.flagged).length})
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        {/* Active filter indicators with clear */}
        {(starFilter !== "all" || segmentFilter !== "all") && (
          <button
            onClick={() => { setStarFilter("all"); setSegmentFilter("all"); }}
            className="py-1.5 px-2.5 rounded-pill text-[10.5px] font-semibold bg-surface-2 border border-border text-ink-muted hover:bg-red-soft hover:border-red hover:text-red transition-colors"
          >
            Clear filters ✕
          </button>
        )}
        <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[260px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
          <span className="text-ink-muted text-[13px]">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews…"
            className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* Reviews list */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>
            💬
          </div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2">
            {filtered.length === metrics.total ? "All Reviews" : `Filtered Reviews · ${filtered.length} of ${metrics.total}`}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-ink-muted">
            <div className="text-[36px] opacity-40 mb-2">💬</div>
            <div className="text-[13px] font-bold text-ink mb-0.5">No reviews match</div>
            <div className="text-[11.5px]">Try a different filter or search term</div>
          </div>
        ) : (
          filtered.map((r, i) => (
            <ReviewCard
              key={r.id}
              review={r}
              isComposing={composingId === r.id}
              composerText={composerText}
              onStartReply={() => { setComposingId(r.id); setComposerText(""); }}
              onCancelReply={() => { setComposingId(null); setComposerText(""); }}
              onComposerChange={(t) => setComposerText(t)}
              onPublishReply={() => handleReply(r.id)}
              onToggleFlag={() => {
                toggleFlag(r.id, r.flagged ? undefined : "Manual flag");
                toast(r.flagged ? `🚩 Flag removed` : `🚩 Review flagged for review`);
              }}
              isLast={i === filtered.length - 1}
              delay={i * 30}
            />
          ))
        )}
      </div>

      {/* Send Survey modal */}
      <Modal
        open={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        title="Send NPS Survey"
        icon="📧"
        width={480}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setSurveyOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSurveyOpen(false);
                toast(`📧 NPS survey queued for delivery to selected segment · Resend SMS fallback enabled`);
              }}
            >
              📧 Send to Segment
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="fl">Audience Segment</label>
            <select className="fsel" defaultValue="post_visit">
              <option value="post_visit">Post-visit (last 7 days) · ~38 patients</option>
              <option value="quarterly">Quarterly check-in · ~142 patients</option>
              <option value="all">All active patients · ~284 patients</option>
              <option value="churned">Recently churned · ~12 patients</option>
            </select>
          </div>
          <div>
            <label className="fl">Survey Template</label>
            <select className="fsel" defaultValue="nps">
              <option value="nps">Standard NPS (0-10 + open feedback)</option>
              <option value="visit_specific">Visit-specific 5-star review</option>
              <option value="provider">Provider-specific feedback</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="fl">Send Time</label>
              <select className="fsel" defaultValue="immediate">
                <option value="immediate">Send immediately</option>
                <option value="next_morning">Tomorrow 9 AM (local)</option>
                <option value="scheduled">Schedule…</option>
              </select>
            </div>
            <div>
              <label className="fl">Channel</label>
              <select className="fsel" defaultValue="email_sms">
                <option value="email">Email only</option>
                <option value="email_sms">Email + SMS fallback</option>
                <option value="sms">SMS only</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
            <span className="text-[13px]">📊</span>
            <span>
              Responses appear here as new review entries. Patients can request to remain anonymous. Auto-replies fire for ratings ≤ 3.
            </span>
          </div>
        </div>
      </Modal>

      <Toast />
    </div>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────
interface ReviewCardProps {
  key?: Key;
  review: Review;
  isComposing: boolean;
  composerText: string;
  onStartReply: () => void;
  onCancelReply: () => void;
  onComposerChange: (text: string) => void;
  onPublishReply: () => void;
  onToggleFlag: () => void;
  isLast: boolean;
  delay: number;
}

function ReviewCard({ review: r, isComposing, composerText, onStartReply, onCancelReply, onComposerChange, onPublishReply, onToggleFlag, isLast, delay }: ReviewCardProps) {
  const initials = r.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const npsColor = r.nps >= 9 ? "var(--color-green)" : r.nps >= 7 ? "var(--color-amber)" : "var(--color-red)";
  const segment = npsSegment(r.nps);

  return (
    <div
      className={`p-[18px] ${isLast ? "" : "border-b border-border"} animate-fadeUp transition-colors hover:bg-surface-2`}
      style={{
        animationDelay: `${delay}ms`,
        borderLeft: r.flagged ? "3px solid var(--color-red)" : r.stars <= 2 ? "3px solid var(--color-amber)" : undefined,
        background: r.flagged ? "rgba(192,57,43,.025)" : undefined,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-2.5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: r.patientColor || "var(--color-ink-muted)" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {r.patientId ? (
              <Link href={`/patients/${r.patientId}`} className="text-[13.5px] font-bold hover:text-brand-dk hover:underline">
                {r.patientName}
              </Link>
            ) : (
              <span className="text-[13.5px] font-bold">{r.patientName}</span>
            )}
            {r.flagged && <Pill intent="red" dot>🚩 Flagged</Pill>}
            {!r.reply && r.stars <= 3 && <Pill intent="amber">Awaiting Reply</Pill>}
          </div>
          <div className="text-[11.5px] text-ink-muted">
            {r.visitType} · {r.date}
            {r.providerName && <> · <span className="text-ink-2">{r.providerName}</span></>}
            {" · "}
            <span style={{ color: npsColor }} className="font-bold">NPS: {r.nps}/10</span>
            <span className="ml-1 text-[10px] uppercase tracking-wider font-bold" style={{ color: npsColor }}>
              ({segment})
            </span>
          </div>
        </div>
        <div className="text-[16px] font-mono tracking-tight" style={{ color: "var(--color-amber)" }}>
          {"★".repeat(r.stars)}
          <span className="text-ink-muted">{"☆".repeat(5 - r.stars)}</span>
        </div>
      </div>

      {/* Review text */}
      <div className="text-[13px] text-ink-2 leading-relaxed mb-2.5 pl-[52px]">
        “{r.text}”
      </div>

      {/* Reply thread */}
      {r.reply && (
        <div
          className="ml-[52px] mb-2.5 py-2.5 px-3 rounded-r-md text-[12.5px] text-ink-2 leading-relaxed"
          style={{ background: "var(--color-brand-soft)", borderLeft: "3px solid var(--color-brand)" }}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-brand-dk mb-1">
            {r.replyAuthor || "DripVitals"} replied · <span className="font-mono">{r.repliedAt}</span>
          </div>
          {r.reply}
        </div>
      )}

      {/* Flag reason */}
      {r.flagged && r.flagReason && (
        <div className="ml-[52px] mb-2.5 text-[11px] text-red flex items-center gap-1.5">
          <span>🚩</span> <strong>Flag reason:</strong> {r.flagReason}
        </div>
      )}

      {/* Inline composer */}
      {isComposing && (
        <div className="ml-[52px] mb-2.5">
          <textarea
            value={composerText}
            onChange={(e) => onComposerChange(e.target.value)}
            placeholder={`Reply to ${r.patientName.split(" ")[0]}…`}
            rows={3}
            className="w-full text-[12.5px] py-2 px-3 rounded-md border border-border bg-surface text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:shadow-[0_0_0_3px_rgba(31,138,112,.18)] resize-vertical"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary btn-sm" onClick={onPublishReply} disabled={!composerText.trim()}>
              💬 Publish Reply
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onCancelReply}>
              Cancel
            </button>
            <div className="flex-1" />
            <span className="text-[10.5px] text-ink-muted self-center">
              {composerText.length} chars · Visible to patient + on public review widget
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isComposing && (
        <div className="flex gap-2 ml-[52px] flex-wrap">
          {!r.reply && (
            <button className="btn btn-primary btn-sm" onClick={onStartReply}>
              💬 Reply
            </button>
          )}
          {r.reply && (
            <button className="btn btn-ghost btn-sm" onClick={onStartReply}>
              ✏ Edit Reply
            </button>
          )}
          <button
            className={[
              "btn btn-sm",
              r.flagged ? "text-red border border-red-soft bg-red-soft hover:bg-red hover:text-white" : "btn-ghost",
            ].join(" ")}
            onClick={onToggleFlag}
          >
            {r.flagged ? "✓ Unflag" : "🚩 Flag"}
          </button>
          {r.patientId && (
            <Link href={`/patients/${r.patientId}`} className="btn btn-ghost btn-sm">
              👤 View Patient
            </Link>
          )}
          <div className="flex-1" />
          <span className="text-[10.5px] text-ink-muted self-center font-mono">{r.id}</span>
        </div>
      )}
    </div>
  );
}
