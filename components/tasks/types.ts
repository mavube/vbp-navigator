export type TaskStatus = "open" | "in_progress" | "done";

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
  assigneeId: string | null;
  assigneeName: string;
  startDate: string | null;
  dueDate: string | null;
  dependencies: string[];
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
