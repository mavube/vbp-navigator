// v3.0 roadmap Phase 11 (Cluster D) — shared priority vocabulary for
// every Task view (List/TaskItem, Kanban, Gantt, Calendar) so the same
// four colors and labels mean the same thing everywhere instead of
// each view inventing its own scale.

import type { TaskPriority } from "@/components/tasks/types";

export const PRIORITY_ORDER: TaskPriority[] = ["low", "normal", "high", "urgent"];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

// Colors reuse existing design tokens rather than inventing new ones —
// low/normal read as calm (muted/neutral), high leans on the existing
// accent color, urgent on the existing danger color, same scale the
// rest of the app already uses for "this needs attention."
export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "var(--v2-text-faint)",
  normal: "var(--v2-text-muted)",
  high: "var(--v2-accent)",
  urgent: "var(--v2-danger)",
};

export const PRIORITY_BADGE_TONE: Record<TaskPriority, "neutral" | "accent" | "danger"> = {
  low: "neutral",
  normal: "neutral",
  high: "accent",
  urgent: "danger",
};
