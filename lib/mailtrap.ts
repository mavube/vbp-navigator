// Mailtrap Sending API client — Phase 14 production readiness, Area 1.
// Diallo chose Mailtrap's production Sending product (not its Testing
// sandbox — a different product from the same vendor) with domain
// verification (SPF/DKIM/DMARC) already completed. API over SMTP, per
// the earlier recommendation: no persistent connection to manage per
// serverless invocation, which is what this app runs as on Vercel.
//
// One env var, server-only: MAILTRAP_API_TOKEN (see .env.example). The
// "from" address/name are NOT hardcoded here — they come from
// lib/db-org-settings.ts's mailtrapFromEmail/mailtrapFromName, so
// changing the sending identity is a Company Settings edit, not a
// deploy.
//
// Every call here is logged by its caller to lib/db-email-log.ts,
// success or failure — see that file's comment for why.

const MAILTRAP_SEND_URL = "https://send.api.mailtrap.io/api/send";

export function isMailtrapConfigured(): boolean {
  return Boolean(process.env.MAILTRAP_API_TOKEN);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromEmail: string;
  fromName: string;
  attachments?: Array<{ filename: string; contentBase64: string; contentType: string }>;
}

export interface SendEmailResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
  raw: unknown;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const token = process.env.MAILTRAP_API_TOKEN;
  if (!token) {
    throw new Error("Mailtrap is not configured — MAILTRAP_API_TOKEN must be set");
  }
  if (!input.fromEmail) {
    throw new Error("No sending address configured — set it in Company Settings before sending email");
  }

  const body = {
    from: { email: input.fromEmail, name: input.fromName || undefined },
    to: [{ email: input.to }],
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    ...(input.attachments && input.attachments.length > 0
      ? {
          attachments: input.attachments.map((a) => ({
            filename: a.filename,
            content: a.contentBase64,
            type: a.contentType,
            disposition: "attachment",
          })),
        }
      : {}),
  };

  let res: Response;
  try {
    res = await fetch(MAILTRAP_SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, messageId: null, error: err instanceof Error ? err.message : "Network error calling Mailtrap", raw: null };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const errorMessage = json?.errors ? JSON.stringify(json.errors) : `Mailtrap responded ${res.status}`;
    return { ok: false, messageId: null, error: errorMessage, raw: json };
  }

  const messageId = Array.isArray(json.message_ids) && json.message_ids.length > 0 ? json.message_ids[0] : null;
  return { ok: true, messageId, error: null, raw: json };
}
