export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

export interface Task {
  id: string;
  serviceId: string;
  classId: string | null;
  serviceRequestId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string;
  startDate: string | null;
  dueDate: string | null;
  dependencies: string[];
}

// v3.0 roadmap Phase 11 (Cluster D) — the Calendar view's class-session
// integration. A minimal read-only projection of ClassRow (lib/db-
// classes.ts), just what a calendar chip needs to render and link back
// to Classes — not the full class record.
export interface ClassEvent {
  id: string;
  serviceId: string;
  title: string;
  scheduledDate: string | null;
  instructorName: string;
}

export type BlockerImpact = "low" | "medium" | "high" | "critical";
export type BlockerStatus = "open" | "resolved";

export interface Blocker {
  id: string;
  serviceId: string;
  taskId: string | null;
  title: string;
  description: string;
  ownerName: string;
  impact: BlockerImpact;
  requiredAction: string;
  status: BlockerStatus;
  createdAt: string;
  resolvedAt: string | null;
}
