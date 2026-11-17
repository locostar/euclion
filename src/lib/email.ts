type EmailConfig = Pick<CloudflareEnv, "RESEND_API_KEY" | "RESEND_FROM">;

export async function sendEmail(
  env: EmailConfig,
  message: { to: string; subject: string; text: string },
) {
  const apiKey = env.RESEND_API_KEY.trim();
  const from = env.RESEND_FROM.trim();
  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
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

  if (!response.ok) {
    throw new Error(`Email delivery failed with status ${response.status}.`);
  }
}
