import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { MemoryEntryRecord, ServiceOption } from "@/components/memory/types";

export function MemoryEntryItem({ entry, services }: { entry: MemoryEntryRecord; services: ServiceOption[] }) {
  const serviceName = entry.serviceId ? services.find((s) => s.id === entry.serviceId)?.name ?? "Unknown service" : null;

  return (
    <Card style={{ padding: "var(--v2-space-4)", display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
          <Badge tone={entry.type === "decision" ? "accent" : "neutral"}>{entry.type === "decision" ? "Decision" : "Lesson"}</Badge>
          <strong>{entry.title}</strong>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
          {new Date(entry.createdAt).toLocaleDateString()} · {entry.authorName || "Someone"}
        </span>
      </div>
      {entry.body && <p style={{ margin: 0, color: "var(--v2-text)" }}>{entry.body}</p>}
      <span style={{ fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>{serviceName ?? "Org-wide"}</span>
    </Card>
  );
}
