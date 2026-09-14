"use client";

import { useEffect, useRef, useState } from "react";
import { FINDINGS } from "@/lib/findings-data";

type Status = "open" | "confirmed" | "resolved";
interface FindingRow {
  id: string;
  status: Status;
  note: string;
  updatedAt: string;
}

const POLL_MS = 4000;

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    "updated " +
    d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  );
}

export function Findings() {
  const [rows, setRows] = useState<Record<string, FindingRow>>({});
  const [live, setLive] = useState<"connecting" | "live" | "error">("connecting");
  const draftNotes = useRef<Record<string, string>>({});
  const dirty = useRef<Record<string, boolean>>({});
  const focusedId = useRef<string | null>(null);

  async function fetchAll() {
    try {
      const res = await fetch("/api/findings", { cache: "no-store" });
      if (!res.ok) throw new Error("bad response");
      const data: FindingRow[] = await res.json();
      setRows((prev) => {
        const next = { ...prev };
        for (const r of data) {
          // Don't clobber a note the user is actively typing / hasn't saved.
          if (dirty.current[r.id]) continue;
          next[r.id] = r;
        }
        return next;
      });
      setLive("live");
    } catch {
      setLive("error");
    }
  }

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(id: string, body: { status?: Status; note?: string }) {
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated: FindingRow = await res.json();
        setRows((prev) => ({ ...prev, [id]: updated }));
      }
    } catch {
      /* offline / transient — next poll will reconcile */
    }
  }

  function setStatus(id: string, status: Status) {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { id, note: "", updatedAt: "" }), status },
    }));
    patch(id, { status });
  }

  function saveNote(id: string) {
    const note = draftNotes.current[id] ?? rows[id]?.note ?? "";
    dirty.current[id] = false;
    patch(id, { note });
  }

  return (
    <div className="section">
      <h2 className="section-title">Findings</h2>
      <p className="section-lede">
        What the service view surfaces that the department labels hide. Confirmed with the team,
        not yet — use the status control below to record what&apos;s real.
      </p>
      <p className="findings-status">
        <span className={`dot ${live === "live" ? "live" : ""}`} />
        <span>
          {live === "connecting" && "Connecting…"}
          {live === "live" && "Live — status and notes sync for everyone with this page open"}
          {live === "error" && "Offline — changes will sync once the connection returns"}
        </span>
      </p>

      {FINDINGS.map((f) => {
        const row = rows[f.id];
        const status: Status = row?.status || "open";
        const noteValue = draftNotes.current[f.id] ?? row?.note ?? "";
        return (
          <div className="finding" key={f.id}>
            <div className="finding-top">
              <h3>{f.title}</h3>
              <span className={`chip ${f.severity}`}>
                {f.severity === "watch" ? "Watch" : f.severity === "critical" ? "Critical" : "Elevated"}
              </span>
            </div>
            <p>{f.body}</p>
            <div className="status-row">
              <div className="seg" role="group" aria-label="Status">
                {(["open", "confirmed", "resolved"] as Status[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-status={s}
                    aria-pressed={status === s}
                    onClick={() => setStatus(f.id, s)}
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <span className="updated-note">{timeLabel(row?.updatedAt || null)}</span>
            </div>
            <div className="note-row">
              <textarea
                placeholder="Add a note — e.g. who's covering, decision made…"
                defaultValue={noteValue}
                onFocus={() => {
                  focusedId.current = f.id;
                }}
                onChange={(e) => {
                  draftNotes.current[f.id] = e.target.value;
                  dirty.current[f.id] = true;
                }}
              />
              <button type="button" className="save" onClick={() => saveNote(f.id)}>
                Save note
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
