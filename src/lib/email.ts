type EmailConfig = { RESEND_API_KEY?: string; RESEND_FROM?: string };

export class EmailDeliveryError extends Error {
  readonly kind: "not_configured" | "rejected" | "unknown";
  readonly status?: number;

  constructor(kind: "not_configured" | "rejected" | "unknown", status?: number) {
    super(`Email delivery ${kind}${status ? ` (${status})` : ""}`);
    this.name = "EmailDeliveryError";
    this.kind = kind;
    this.status = status;
  }
}

export function emailConfigured(env: EmailConfig) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM?.trim());
}

export async function sendEmail(
  env: EmailConfig,
  message: { to: string; subject: string; text: string },
) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    throw new EmailDeliveryError("not_configured");
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
  } catch {
    throw new EmailDeliveryError("unknown");
  }

  if (!response.ok) {
    throw new EmailDeliveryError(response.status >= 500 ? "unknown" : "rejected", response.status);
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new EmailDeliveryError("unknown");
  }
  if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !result.id) {
    throw new EmailDeliveryError("unknown");
  }
}
