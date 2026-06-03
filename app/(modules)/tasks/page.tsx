"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DragEvent, Key } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NewTaskModal } from "@/components/modules/NewTaskModal";
import { toast } from "@/lib/hooks/useToast";
import { useTasks } from "@/lib/hooks/useTasks";
import { useStaff } from "@/lib/hooks/useStaff";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

interface ColumnDef {
  id: TaskStatus;
  label: string;
  icon: string;
  bg: string;
  fg: string;
  emptyHint: string;
}

const COLUMNS: ColumnDef[] = [
  { id: "todo",       label: "To Do",       icon: "📋", bg: "var(--color-brand-soft)",  fg: "var(--color-brand)",  emptyHint: "Drag tasks here or click + Add" },
  { id: "inprogress", label: "In Progress", icon: "⚙",  bg: "var(--color-amber-soft)",  fg: "var(--color-amber)",  emptyHint: "Tasks in active work" },
  { id: "review",     label: "In Review",   icon: "👁",  bg: "var(--color-violet-soft)", fg: "var(--color-violet)", emptyHint: "Tasks awaiting approval" },
  { id: "done",       label: "Done",        icon: "✓",  bg: "var(--color-green-soft)",  fg: "var(--color-green)",  emptyHint: "Completed tasks" },
];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: "var(--color-red)",
  high:   "var(--color-amber)",
  normal: "var(--color-blue)",
  low:    "var(--color-ink-muted)",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: "🔴 Urgent",
  high:   "🟡 High",
  normal: "Normal",
  low:    "Low",
};

// "Today" anchor for overdue calculations — May 29, 2026 to match prototype
const TODAY = "2026-05-29";

export default function TasksPage() {
  const tasks      = useTasks((s) => s.tasks);
  const addTask    = useTasks((s) => s.add);
  const moveTask   = useTasks((s) => s.move);
  const toggleDone = useTasks((s) => s.toggleDone);
  const removeTask = useTasks((s) => s.remove);
  const staff      = useStaff((s) => s.staff);

  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("todo");
  const [removeTarget, setRemoveTarget] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  // KPIs
  const counts = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    const urgent = open.filter((t) => t.priority === "urgent");
    const overdue = open.filter((t) => t.due < TODAY);
    const completedToday = tasks.filter((t) => t.status === "done" && t.completedAt?.includes("May 29"));
    return {
      total:    tasks.length,
      open:     open.length,
      urgent:   urgent.length,
      overdue:  overdue.length,
      done:     tasks.filter((t) => t.status === "done").length,
      doneToday: completedToday.length,
    };
  }, [tasks]);

  // Active staff for the filter dropdown
  const activeAssignees = useMemo(() => {
    const set = new Set(tasks.map((t) => t.assignee));
    return Array.from(set).sort();
  }, [tasks]);

  // Filtered tasks
  const filtered = useMemo(() => {
    let list = tasks;
    if (assigneeFilter) list = list.filter((t) => t.assignee === assigneeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.patientName || "").toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tasks, assigneeFilter, search]);

  // Tasks per column (sorted by priority then due)
  const PRI_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  function tasksFor(col: TaskStatus): Task[] {
    return filtered
      .filter((t) => t.status === col)
      .sort((a, b) => {
        if (a.priority !== b.priority) return PRI_RANK[a.priority] - PRI_RANK[b.priority];
        return a.due.localeCompare(b.due);
      });
  }

  // Drag handlers
  function handleDragStart(e: DragEvent<HTMLDivElement>, taskId: number) {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, col: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== col) setDragOverCol(col);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, col: TaskStatus) {
    e.preventDefault();
    if (draggingId !== null) {
      const task = tasks.find((t) => t.id === draggingId);
      if (task && task.status !== col) {
        moveTask(draggingId, col);
        const colLabel = COLUMNS.find((c) => c.id === col)?.label || col;
        toast(`✓ "${task.title.slice(0, 40)}${task.title.length > 40 ? "…" : ""}" moved to ${colLabel}`);
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  }

  function handleAddInColumn(col: TaskStatus) {
    setNewTaskStatus(col);
    setNewTaskOpen(true);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Task Manager</div>
          <div className="text-[13px] text-ink-muted">
            Care coordination · Patient follow-ups · Staff assignments
          </div>
        </div>
        <div className="flex gap-2">
          <select
            className="fsel"
            style={{ width: 180, padding: "7px 28px 7px 12px", fontSize: 12 }}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">All Staff ({tasks.length})</option>
            {activeAssignees.map((a) => {
              const count = tasks.filter((t) => t.assignee === a).length;
              return <option key={a} value={a}>{a} ({count})</option>;
            })}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => { setNewTaskStatus("todo"); setNewTaskOpen(true); }}>
            + New Task
          </button>
        </div>
      </div>

      {/* KPIs */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Open Tasks"
          value={counts.open}
          icon="📋"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${counts.total} total`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Urgent"
          value={counts.urgent}
          icon="🔴"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={counts.urgent > 0 ? "Action needed" : "All clear"}
          trendColor={counts.urgent > 0 ? "var(--color-red)" : "var(--color-green)"}
        />
        <KpiCard
          label="Overdue"
          value={counts.overdue}
          icon="⏰"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={counts.overdue > 0 ? "Past due date" : "On track"}
          trendColor={counts.overdue > 0 ? "var(--color-amber)" : "var(--color-green)"}
        />
        <KpiCard
          label="Completed"
          value={counts.done}
          icon="✓"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend={`${counts.doneToday} today`}
          trendColor="var(--color-green)"
        />
      </KpiGrid>

      {/* Search bar */}
      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1.5 px-3.5 mb-4 max-w-[420px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
        <span className="text-ink-muted text-[13px]">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks, patients, categories…"
          className="flex-1 bg-transparent border-none outline-none text-[12.5px] text-ink placeholder:text-ink-muted"
        />
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {COLUMNS.map((col) => {
          const colTasks = tasksFor(col.id);
          const isDragOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              className={[
                "bg-surface border rounded-lg overflow-hidden flex flex-col transition-colors",
                isDragOver ? "border-brand shadow-md" : "border-border",
              ].join(" ")}
              style={isDragOver ? { background: "var(--color-brand-soft)" } : undefined}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div
                className="py-3 px-3.5 flex items-center gap-2"
                style={{ background: col.bg, borderBottom: "1px solid var(--color-border)" }}
              >
                <span className="text-[14px]" style={{ color: col.fg }}>{col.icon}</span>
                <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: col.fg }}>{col.label}</div>
                <div
                  className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-pill text-[10.5px] font-bold"
                  style={{ background: `${col.fg}25`, color: col.fg }}
                >
                  {colTasks.length}
                </div>
              </div>

              {/* Column body */}
              <div className="flex-1 p-2 space-y-2 min-h-[160px]">
                {colTasks.length === 0 ? (
                  <div className="py-6 text-center text-ink-muted">
                    <div className="text-[11px] opacity-60">{col.emptyHint}</div>
                  </div>
                ) : (
                  colTasks.map((t, i) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      expanded={expandedId === t.id}
                      onExpand={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      onToggleDone={() => {
                        toggleDone(t.id);
                        toast(t.status === "done" ? `↩ Reopened: ${t.title.slice(0, 40)}` : `✓ Completed: ${t.title.slice(0, 40)}`);
                      }}
                      onMove={(status) => {
                        moveTask(t.id, status);
                        const colLabel = COLUMNS.find((c) => c.id === status)?.label || status;
                        toast(`✓ Moved to ${colLabel}`);
                      }}
                      onRemove={() => setRemoveTarget(t)}
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggingId === t.id}
                      delay={i * 25}
                    />
                  ))
                )}

                {/* + Add task button */}
                <button
                  className="w-full py-2 px-2.5 mt-2 rounded-md border border-dashed border-border text-[11px] text-ink-muted hover:border-brand hover:text-brand-dk hover:bg-surface-2 transition-colors"
                  onClick={() => handleAddInColumn(col.id)}
                >
                  + Add task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onSave={(t) => {
          const created = addTask(t);
          toast(`✓ Task created: ${created.title.slice(0, 40)}${created.title.length > 40 ? "…" : ""}`);
        }}
        defaultStatus={newTaskStatus}
      />

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            removeTask(removeTarget.id);
            toast(`🗑 Task deleted`);
          }
        }}
        icon="🗑"
        title="Delete task?"
        message={removeTarget ? `"${removeTarget.title}" will be permanently deleted. This action cannot be undone.` : ""}
        confirmLabel="Delete task"
      />

      <Toast />
    </div>
  );
}

// ─── Task card ─────────────────────────────────────────────────────────────
interface TaskCardProps {
  key?: Key;
  task: Task;
  expanded: boolean;
  isDragging: boolean;
  delay: number;
  onExpand: () => void;
  onToggleDone: () => void;
  onMove: (status: TaskStatus) => void;
  onRemove: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

function TaskCard({ task: t, expanded, isDragging, delay, onExpand, onToggleDone, onMove, onRemove, onDragStart, onDragEnd }: TaskCardProps) {
  const isOverdue = t.due < TODAY && t.status !== "done";
  const assigneeInitials = t.assignee.split(" ").map((s) => s[0]).join("").slice(0, 2);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onExpand}
      className={[
        "bg-surface border rounded-md p-2.5 cursor-grab active:cursor-grabbing transition-all animate-fadeUp hover:shadow-sm",
        isDragging ? "opacity-50 scale-[0.98]" : "",
        expanded ? "border-brand shadow-md" : "border-border hover:border-border-2",
      ].join(" ")}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 mb-1.5">
        {/* Priority bar */}
        <div
          className="w-[3px] self-stretch rounded-full flex-shrink-0"
          style={{ background: PRIORITY_COLOR[t.priority] }}
        />
        <div className="flex-1 min-w-0">
          <div className={`text-[12.5px] font-semibold leading-snug ${t.status === "done" ? "line-through text-ink-muted" : "text-ink"}`}>
            {t.title}
          </div>
        </div>
        <input
          type="checkbox"
          checked={t.status === "done"}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleDone}
          className="w-3.5 h-3.5 mt-1 flex-shrink-0 cursor-pointer"
          style={{ accentColor: "var(--color-green)" }}
        />
      </div>

      {/* Description preview */}
      {t.description && !expanded && (
        <div className="text-[11px] text-ink-muted leading-snug ml-3 mb-2 line-clamp-2">
          {t.description.slice(0, 75)}{t.description.length > 75 ? "…" : ""}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-1.5 ml-3 flex-wrap">
        {t.patientName && (
          <Link
            href={t.patientId ? `/patients/${t.patientId}` : "#"}
            onClick={(e) => e.stopPropagation()}
            className="text-[10.5px] font-semibold text-brand-dk hover:underline truncate max-w-[100px]"
          >
            {t.patientName.split(" ")[0]}
          </Link>
        )}
        <Pill intent="muted">{t.category}</Pill>
        <div className="ml-auto flex items-center gap-1.5">
          {t.due && (
            <span
              className="font-mono text-[10px]"
              style={{ color: isOverdue ? "var(--color-red)" : "var(--color-ink-muted)" }}
              title={`Due ${t.due}`}
            >
              {isOverdue && "⏰ "}
              {t.due.slice(5)}
            </span>
          )}
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[8.5px] font-bold text-white flex-shrink-0"
            style={{ background: t.assigneeColor || "var(--color-ink-muted)" }}
            title={t.assignee}
          >
            {assigneeInitials}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2.5" onClick={(e) => e.stopPropagation()}>
          {t.description && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1">Description</div>
              <div className="text-[11.5px] text-ink-2 leading-relaxed whitespace-pre-wrap">{t.description}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mb-0.5">Priority</div>
              <div className="font-semibold" style={{ color: PRIORITY_COLOR[t.priority] }}>{PRIORITY_LABEL[t.priority]}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mb-0.5">Due</div>
              <div className={`font-mono font-semibold ${isOverdue ? "text-red" : "text-ink"}`}>{t.due}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mb-0.5">Assignee</div>
              <div className="font-semibold text-ink">{t.assignee}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mb-0.5">Category</div>
              <div className="font-semibold text-ink">{t.category}</div>
            </div>
            {t.completedAt && (
              <div className="col-span-2">
                <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mb-0.5">Completed</div>
                <div className="font-semibold text-green">✓ {t.completedAt}</div>
              </div>
            )}
          </div>

          {/* Move-to actions */}
          <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
            {COLUMNS.filter((c) => c.id !== t.status).map((c) => (
              <button
                key={c.id}
                onClick={() => onMove(c.id)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold border border-border bg-surface-2 hover:bg-brand-soft hover:border-brand transition-colors"
                title={`Move to ${c.label}`}
              >
                → {c.label}
              </button>
            ))}
            <button
              onClick={onRemove}
              className="ml-auto px-2 py-0.5 rounded text-[10px] font-semibold text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors"
              title="Delete task"
            >
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
