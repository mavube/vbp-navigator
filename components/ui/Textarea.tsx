import { TextareaHTMLAttributes } from "react";

// Phase 16 (Products & Services Catalog) — the first field in this app
// that genuinely wants multi-line entry (standard offering / what's
// included / expected outcome are meant to hold real descriptive text,
// not a one-liner). Reuses the same v2-input class as Input.tsx so it
// inherits identical border/padding/focus styling rather than
// introducing a second visual language for form fields.
export function Textarea({ className = "", rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`v2-input ${className}`} rows={rows} style={{ resize: "vertical", fontFamily: "inherit" }} {...rest} />;
}
