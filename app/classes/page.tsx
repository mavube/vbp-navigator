import { ClassBoard } from "@/components/classes/ClassBoard";

export default function ClassesPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--v2-space-8) var(--v2-space-4)" }}>
      <h1 style={{ fontFamily: "var(--v2-font)", fontSize: "1.75rem", marginBottom: "4px" }}>Classes</h1>
      <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-6)" }}>
        Instances of Master Class Delivery. Scheduling a class generates its standard setup checklist as real,
        trackable tasks.
      </p>
      <ClassBoard />
    </main>
  );
}
