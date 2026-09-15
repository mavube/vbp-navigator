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
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueDate: string | null;
}
