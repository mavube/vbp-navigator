"use client";

import type { ServiceRow } from "@/lib/db-services";

interface ServiceGraphProps {
  services: ServiceRow[];
}

// v3.0 roadmap Phase 2 — replaces the old static InternalChain.tsx
// (hand-drawn SVG with hardcoded coordinates for VBP's exact 9 services)
// with a graph computed live from each service's own `feeds` column —
// the data has always been there since Phase 1's schema; nothing ever
// rendered it as a graph until now. Works for any org's own catalog,
// not just VBP's specific one, since nothing here is hardcoded to a
// service name or count.
//
// Layout: a simple longest-path layering over the `feeds` edges (A
// feeds B → B sits at least one layer to the right of A). Good enough
// for the kind of small, mostly-linear service chains this product
// deals with — deliberately not a general graph-layout library, which
// would be a lot of new dependency weight for what's a handful of
// nodes per org.
const BOX_W = 168;
const BOX_H = 104;
const GAP_X = 56;
const GAP_Y = 20;
const PAD = 24;

export function ServiceGraph({ services }: ServiceGraphProps) {
  if (services.length === 0) {
    return <p style={{ color: "var(--v2-text-muted)" }}>No services to graph yet.</p>;
  }

  const byId = new Map(services.map((s) => [s.id, s]));
  const layer = new Map<string, number>();
  for (const s of services) layer.set(s.id, 0);

  // Relax up to N times (N = service count) so layering settles even if
  // `feeds` isn't already in topological order in the data.
  for (let pass = 0; pass < services.length; pass++) {
    let changed = false;
    for (const s of services) {
      for (const targetId of s.feeds) {
        if (!byId.has(targetId)) continue; // a feeds-reference to a service outside this org/list
        const candidate = (layer.get(s.id) ?? 0) + 1;
        if (candidate > (layer.get(targetId) ?? 0)) {
          layer.set(targetId, candidate);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const layerCount = Math.max(...Array.from(layer.values())) + 1;
  const columns: ServiceRow[][] = Array.from({ length: layerCount }, () => []);
  for (const s of services) columns[layer.get(s.id) ?? 0].push(s);

  const maxRows = Math.max(...columns.map((c) => c.length));
  const width = PAD * 2 + layerCount * BOX_W + (layerCount - 1) * GAP_X;
  const height = PAD * 2 + maxRows * BOX_H + (maxRows - 1) * GAP_Y;

  const centerOf = (id: string): { x: number; y: number } | null => {
    const l = layer.get(id);
    if (l === undefined) return null;
    const col = columns[l];
    const row = col.findIndex((s) => s.id === id);
    if (row === -1) return null;
    const colHeight = col.length * BOX_H + (col.length - 1) * GAP_Y;
    const yOffset = (height - PAD * 2 - colHeight) / 2; // vertically center a shorter column
    return {
      x: PAD + l * (BOX_W + GAP_X),
      y: PAD + yOffset + row * (BOX_H + GAP_Y),
    };
  };

  const edges: Array<{ from: string; to: string }> = [];
  for (const s of services) {
    for (const targetId of s.feeds) {
      if (byId.has(targetId)) edges.push({ from: s.id, to: targetId });
    }
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius-md)", background: "var(--v2-surface)", padding: "var(--v2-space-4)" }}>
      <svg width={width} height={height} role="img" aria-label="Service dependency graph">
        <defs>
          <marker id="v2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--v2-text-faint)" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const from = centerOf(e.from);
          const to = centerOf(e.to);
          if (!from || !to) return null;
          const x1 = from.x + BOX_W;
          const y1 = from.y + BOX_H / 2;
          const x2 = to.x;
          const y2 = to.y + BOX_H / 2;
          const midX = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 8} ${y2}`}
              fill="none"
              stroke="var(--v2-text-faint)"
              strokeWidth={1.5}
              markerEnd="url(#v2-arrow)"
            />
          );
        })}

        {services.map((s) => {
          const pos = centerOf(s.id);
          if (!pos) return null;
          const isGap = s.type === "cvs" && !s.providerId;
          const stroke = isGap ? "var(--v2-warning)" : s.type === "cvs" ? "var(--v2-accent)" : "var(--v2-border-strong)";
          const dash = isGap ? "4 3" : s.type === "enabling" ? "3 3" : undefined;
          const fill = s.type === "cvs" ? "var(--v2-accent-soft)" : "var(--v2-surface-sunken)";
          return (
            <g key={s.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={BOX_W}
                height={BOX_H}
                rx={10}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
                strokeDasharray={dash}
              />
              <text x={pos.x + 12} y={pos.y + 20} fontSize={9} fontWeight={700} letterSpacing="0.04em" fill="var(--v2-text-muted)">
                {s.type === "cvs" ? (isGap ? "CVS · GAP" : "CVS") : "ENABLING"}
              </text>
              <foreignObject x={pos.x + 10} y={pos.y + 26} width={BOX_W - 20} height={BOX_H - 50}>
                <div style={{ fontFamily: "var(--v2-font)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--v2-text)", lineHeight: 1.25 }}>
                  {s.name}
                </div>
              </foreignObject>
              <text x={pos.x + 12} y={pos.y + BOX_H - 12} fontSize={9} fontFamily="var(--v2-font)" fill="var(--v2-text-faint)">
                {(s.department || "—").toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
