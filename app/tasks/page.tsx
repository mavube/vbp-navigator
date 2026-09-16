import { TaskBoard } from "@/components/tasks/TaskBoard";

export default function TasksPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--v2-space-8) var(--v2-space-4)" }}>
      <h1 style={{ fontFamily: "var(--v2-font)", fontSize: "1.75rem", marginBottom: "4px" }}>Tasks</h1>
      <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-6)" }}>
        Every task belongs to a service — never a department or just a person.
      </p>
      <TaskBoard />
    </main>
  );
}
