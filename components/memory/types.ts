// Shared shapes for the Memory module — mirrors lib/db-org-memory.ts's
// MemoryEntry, kept as its own small client-side type (rather than
// importing the server module directly) same as every other feature's
// components/<feature>/types.ts.

export type MemoryType = "decision" | "lesson";

export interface MemoryEntryRecord {
  id: string;
  type: MemoryType;
  title: string;
  body: string;
  serviceId: string | null;
  authorId: string | null;
  authorName: string;
  createdAt: string;
}

export interface ServiceOption {
  id: string;
  name: string;
}
