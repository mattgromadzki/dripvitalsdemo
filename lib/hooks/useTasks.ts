"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Task, TaskStatus } from "@/lib/types";
import { TASKS as SEED } from "@/lib/data/tasks";

interface TasksState {
  tasks: Task[];
  add: (task: Omit<Task, "id" | "createdAt">) => Task;
  move: (id: number, status: TaskStatus) => void;
  toggleDone: (id: number) => void;
  update: (id: number, patch: Partial<Task>) => void;
  remove: (id: number) => void;
}

let nextId = SEED.length + 1;

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowOrdered(): number {
  const d = new Date();
  return parseInt(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`, 10);
}

function nowDisplay(): string {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export const useTasks = create<TasksState>((set) => ({
  tasks: SEED,
  add: (input) => {
    const created: Task = {
      id: nextId++,
      createdAt: nowOrdered(),
      ...input,
    };
    set((s) => ({ tasks: [created, ...s.tasks] }));
    return created;
  },
  move: (id, status) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        const patch: Partial<Task> = { status };
        if (status === "done" && !t.completedAt) patch.completedAt = nowDisplay();
        if (status !== "done" && t.completedAt)   patch.completedAt = undefined;
        return { ...t, ...patch };
      }),
    }));
  },
  toggleDone: (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        if (t.status === "done") {
          return { ...t, status: "todo" as const, completedAt: undefined };
        }
        return { ...t, status: "done" as const, completedAt: nowDisplay() };
      }),
    }));
  },
  update: (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },
  remove: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },
}));

// Helper: today's YYYY-MM-DD for the prototype "today" anchor
export const TODAY_YMD = todayYmd;
