export type ClassStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type SetupTaskStatus = "open" | "in_progress" | "done";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

// Phase C (portfolio correction) — see components/pipeline/types.ts's
// identical ProductOption for the reasoning.
export interface ProductOption {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

export interface Class {
  id: string;
  serviceId: string;
  productServiceId: string | null;
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

export type EnrollmentStatus = "enrolled" | "waitlisted" | "withdrawn";

export interface Enrollment {
  id: string;
  classId: string;
  customerId: string;
  status: EnrollmentStatus;
}

export interface CustomerOption {
  id: string;
  fullName: string;
}
