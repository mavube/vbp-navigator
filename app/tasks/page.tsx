import { Page } from "@/components/ui/Page";
import { TaskBoard } from "@/components/tasks/TaskBoard";

export default function TasksPage() {
  return (
    <Page title="Tasks" description="Every task belongs to a service — never a department or just a person.">
      <TaskBoard />
    </Page>
  );
}
