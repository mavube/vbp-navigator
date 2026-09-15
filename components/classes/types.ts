export type ClassStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type SetupTaskStatus = "open" | "in_progress" | "done";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

export interface Class {
  id: string;
  serviceId: string;
  title: string;
  scheduledDate: string | null;
  instructorName: string;
  status: ClassStatus;
  notes: string;
}

export interface SetupTask {
  id: string;
  classId: string | null;
  title: string;
  status: SetupTaskStatus;
}
