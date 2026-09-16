"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

interface Comment {
  id: string;
  authorName: string;
  body: string;
  mentions: string[];
  createdAt: string;
}

// A contextual comment thread, embedded directly on whatever it's
// about (a Task card, a Budget Request, ...) rather than living in a
// separate chat surface — per the vision doc's "collaboration lives
// where the work is" framing. entityType is a free-text label that
// must match what the host module uses consistently (e.g. "task",
// "budget_request") — see lib/db-comments.ts.
export function CommentThread({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/comments?entityType=${entityType}&entityId=${entityId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Comment[]) => {
        setComments(data);
        setLoaded(true);
      });
  }, [open, loaded, entityType, entityId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          authorName: name,
          body,
          mentions: mentions
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Couldn't post comment");
      }
      const comment: Comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setBody("");
      setMentions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: "var(--v2-space-3)", borderTop: "1px solid var(--v2-border)", paddingTop: "var(--v2-space-3)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="v2-btn v2-btn-secondary"
        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
      >
        {open ? "Hide comments" : `Comments${comments.length > 0 ? ` (${comments.length})` : ""}`}
      </button>

      {open && (
        <div style={{ marginTop: "var(--v2-space-2)" }}>
          {!loaded ? (
            <p style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", margin: 0 }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "var(--v2-space-2)" }}>
              {comments.length === 0 && (
                <p style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", margin: 0 }}>No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} style={{ fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600 }}>{c.authorName}</span>{" "}
                  <span style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <div>{c.body}</div>
                  {c.mentions.length > 0 && (
                    <div style={{ color: "var(--v2-accent)", fontSize: "0.75rem" }}>
                      {c.mentions.map((m) => `@${m}`).join(" ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 160, fontSize: "0.8rem" }} />
              <Input placeholder="Mentions (comma-separated)" value={mentions} onChange={(e) => setMentions(e.target.value)} style={{ flex: "1 1 160px", fontSize: "0.8rem" }} />
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              className="v2-input"
              rows={2}
              style={{ fontSize: "0.85rem", resize: "vertical" }}
            />
            <div>
              <button
                type="submit"
                disabled={busy || !body.trim()}
                className={`v2-btn v2-btn-secondary ${busy ? "v2-btn-busy" : ""}`}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {busy && <Spinner size={11} />}
                {busy ? "Posting…" : "Post"}
              </button>
            </div>
            {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: 0 }}>{error}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
