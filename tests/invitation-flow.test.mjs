import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("invitations require email verification before granting membership", async () => {
  const bundle = await build({
    entryPoints: ["tests/invitation-test-worker.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    external: ["node:*"],
    conditions: ["workerd", "worker", "browser"],
    target: "es2022",
    write: false,
    tsconfig: "tsconfig.json",
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-11-17",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    bindings: {
      BETTER_AUTH_URL: "https://example.test",
      BETTER_AUTH_SECRET: "a-test-secret-at-least-32-bytes-long",
      RESEND_API_KEY: "test-key",
      RESEND_FROM: "test@example.test",
    },
  }));
  try {
    const db = await mf.getD1Database("DB");
    for (const migration of ["0000_worthless_menace.sql", "0001_complete_toxin.sql", "0002_ambitious_nicolaos.sql"]) {
      const sql = await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8");
      const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
      await db.batch(statements.map((statement) => db.prepare(statement)));
    }
    await db.prepare("CREATE TABLE test_mail (body TEXT NOT NULL)").run();

    async function call(path, body, cookie, ip = "192.0.2.1") {
      const response = await mf.dispatchFetch(`https://example.test/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          origin: "https://example.test",
          "content-type": "application/json",
          "cf-connecting-ip": ip,
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "manual",
      });
      return response;
    }
    async function signup(email, ip) {
      const response = await call("/sign-up/email", { name: email, email, password: "test-password-1234" }, null, ip);
      assert.equal(response.status, 200, await response.clone().text());
      const cookie = response.headers.get("set-cookie");
      assert.ok(cookie);
      return cookie.split(";")[0];
    }
    const owner = await signup("owner@example.test", "192.0.2.1");
    let response = await call("/organization/create", { name: "Test", slug: "test" }, owner);
    assert.equal(response.status, 200, await response.clone().text());
    const org = await response.json();

    response = await call("/organization/invite-member", { email: "staff@example.test", role: "member", organizationId: org.id }, owner);
    assert.equal(response.status, 200, await response.clone().text());
    const invite = await response.json();
    const mail = await db.prepare("SELECT body FROM test_mail ORDER BY rowid DESC LIMIT 1").first();
    assert.match(JSON.parse(mail.body).text, new RegExp(invite.id));

    const wrong = await signup("wrong@example.test", "192.0.2.2");
    response = await call("/organization/accept-invitation", { invitationId: invite.id }, wrong, "192.0.2.2");
    assert.notEqual(response.status, 200);

    const staff = await signup("staff@example.test", "192.0.2.3");
    response = await call("/organization/accept-invitation", { invitationId: invite.id }, staff, "192.0.2.3");
    assert.notEqual(response.status, 200);

    response = await call("/send-verification-email", { email: "staff@example.test", callbackURL: `/invite?invitationId=${invite.id}&email=staff%40example.test` }, staff, "192.0.2.3");
    assert.equal(response.status, 200, await response.clone().text());
    const verificationMail = JSON.parse((await db.prepare("SELECT body FROM test_mail ORDER BY rowid DESC LIMIT 1").first()).body);
    const verificationUrl = verificationMail.text.match(/https:\/\/\S+/)?.[0];
    assert.ok(verificationUrl);
    const verify = await mf.dispatchFetch(verificationUrl, { headers: { cookie: staff, "cf-connecting-ip": "192.0.2.3" }, redirect: "manual" });
    assert.equal(verify.status, 302, await verify.clone().text());

    response = await call("/organization/accept-invitation", { invitationId: invite.id }, staff, "192.0.2.3");
    assert.equal(response.status, 200, await response.clone().text());
    const membership = await db.prepare("SELECT COUNT(*) AS count FROM member WHERE organization_id = ?").bind(org.id).first();
    assert.equal(membership.count, 2);

    response = await call("/organization/accept-invitation", { invitationId: invite.id }, staff, "192.0.2.3");
    assert.notEqual(response.status, 200);

    await signup("existing@example.test", "192.0.2.4");
    response = await call("/sign-in/email", { email: "existing@example.test", password: "test-password-1234" }, null, "192.0.2.4");
    assert.equal(response.status, 200, await response.clone().text());
    const existing = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(existing);
    response = await call("/organization/invite-member", { email: "existing@example.test", role: "member", organizationId: org.id }, owner);
    assert.equal(response.status, 200, await response.clone().text());
    const existingInvite = await response.json();
    response = await call("/organization/accept-invitation", { invitationId: existingInvite.id }, existing, "192.0.2.4");
    assert.notEqual(response.status, 200);
    response = await call("/send-verification-email", { email: "existing@example.test", callbackURL: `/invite?invitationId=${existingInvite.id}&email=existing%40example.test` }, existing, "192.0.2.4");
    assert.equal(response.status, 200, await response.clone().text());
    const existingMail = JSON.parse((await db.prepare("SELECT body FROM test_mail ORDER BY rowid DESC LIMIT 1").first()).body);
    const existingUrl = existingMail.text.match(/https:\/\/\S+/)?.[0];
    assert.ok(existingUrl);
    const existingVerify = await mf.dispatchFetch(existingUrl, { headers: { cookie: existing, "cf-connecting-ip": "192.0.2.4" }, redirect: "manual" });
    assert.equal(existingVerify.status, 302, await existingVerify.clone().text());
    await db.prepare("UPDATE invitation SET expires_at = ? WHERE id = ?").bind(Date.now() - 1000, existingInvite.id).run();
    response = await call("/organization/accept-invitation", { invitationId: existingInvite.id }, existing, "192.0.2.4");
    assert.notEqual(response.status, 200);
    await db.prepare("UPDATE invitation SET expires_at = ? WHERE id = ?").bind(Date.now() + 60_000, existingInvite.id).run();
    response = await call("/organization/accept-invitation", { invitationId: existingInvite.id }, existing, "192.0.2.4");
    assert.equal(response.status, 200, await response.clone().text());
  } finally {
    await mf.dispose();
  }
});
