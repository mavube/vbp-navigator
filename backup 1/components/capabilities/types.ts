export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
  outcome: string;
}

export interface ServiceRollup {
  serviceId: string;
  tasksOpen: number;
  tasksDone: number;
  requestsOpen: number;
  requestsResolved: number;
  leadsActive: number;
  leadsAdmitted: number;
  classesActive: number;
  classesCompleted: number;
  budgetPendingAmount: number;
  budgetApprovedAmount: number;
  expensesTotal: number;
  compensationFinalizedCount: number;
  compensationNetPayTotal: number;
}

export interface PersonWorkload {
  name: string;
  activeTasks: number;
}
