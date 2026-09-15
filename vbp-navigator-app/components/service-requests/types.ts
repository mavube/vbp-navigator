export type RequestType = "request" | "incident";
export type RequestPriority = "low" | "medium" | "high" | "urgent";
export type RequestStatus = "open" | "in_progress" | "resolved" | "closed";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

export interface ServiceRequest {
  id: string;
  serviceId: string;
  requesterName: string;
  type: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  title: string;
  description: string;
}
