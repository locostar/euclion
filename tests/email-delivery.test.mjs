import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { emailConfigured, EmailDeliveryError, sendEmail } from "../src/lib/email.ts";

const message = { to: "recipient@example.test", subject: "Invitation", text: "Test" };
const configured = { RESEND_API_KEY: "test-key", RESEND_FROM: "Staff <staff@example.test>" };

test("missing email configuration fails before sending", async () => {
  const fetch = mock.method(globalThis, "fetch");
  try {
    assert.equal(emailConfigured({}), false);
    await assert.rejects(sendEmail({}, message), (error) => error instanceof EmailDeliveryError && error.kind === "not_configured");
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    fetch.mock.restore();
  }
});

test("provider acceptance requires an id, rejection and network errors are distinct", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => Response.json({ id: "message-id" }));
  try {
    await sendEmail(configured, message);
    fetch.mock.mockImplementation(async () => new Response("", { status: 403 }));
    await assert.rejects(sendEmail(configured, message), (error) => error instanceof EmailDeliveryError && error.kind === "rejected" && error.status === 403);
    fetch.mock.mockImplementation(async () => new Response("", { status: 503 }));
    await assert.rejects(sendEmail(configured, message), (error) => error instanceof EmailDeliveryError && error.kind === "unknown" && error.status === 503);
    fetch.mock.mockImplementation(async () => Response.json({}));
    await assert.rejects(sendEmail(configured, message), (error) => error instanceof EmailDeliveryError && error.kind === "unknown");
    fetch.mock.mockImplementation(async () => { throw new Error("offline"); });
    await assert.rejects(sendEmail(configured, message), (error) => error instanceof EmailDeliveryError && error.kind === "unknown");
  } finally {
    fetch.mock.restore();
  }
});
