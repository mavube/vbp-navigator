import { Page } from "@/components/ui/Page";
import { TaskBoard } from "@/components/tasks/TaskBoard";

export default function TasksPage() {
  return (
    <Page title="Tasks" description="List, Kanban, Gantt, and Calendar views of the same work, plus first-class blockers with an owner, an impact, and a required action.">
      <TaskBoard />
    </Page>
  );
}
