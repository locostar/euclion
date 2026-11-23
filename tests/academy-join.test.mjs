import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("academy numbers and one-time codes safely enroll staff", async () => {
  const bundle = await build({
    entryPoints: ["tests/academy-test-worker.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    external: ["node:*"],
    conditions: ["workerd", "worker", "browser"],
    target: "es2022",
    write: false,
    tsconfig: "tsconfig.json",
    plugins: [{
      name: "test-context",
      setup(build) {
        build.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({
          path: new URL("./academy-test-context.ts", import.meta.url).pathname,
        }));
      },
    }],
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
    },
  }));
  try {
    const db = await mf.getD1Database("DB");
    for (const migration of ["0000_worthless_menace.sql", "0001_complete_toxin.sql", "0002_ambitious_nicolaos.sql", "0003_youthful_taskmaster.sql"]) {
      const sql = await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8");
      await db.batch(sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    }
    await db.prepare("INSERT INTO organization (id, name, slug, created_at) VALUES (?, ?, ?, ?)").bind("existing", "Existing", "existing", Date.parse("2026-01-31T16:00:00Z")).run();
    const migration = await readFile(new URL("../migrations/0013_academy_join_codes.sql", import.meta.url), "utf8");
    await db.batch(migration.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    const salesMigration = await readFile(new URL("../migrations/0014_sales_dashboard.sql", import.meta.url), "utf8");
    await db.batch(salesMigration.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    const existing = await db.prepare("SELECT issued_month, sequence FROM academy_number WHERE organization_id = ?").bind("existing").first();
    assert.deepEqual(existing, { issued_month: "202602", sequence: 1 });

    async function call(path, body, cookie, ip = "192.0.2.1", method) {
      return mf.dispatchFetch(`https://example.test${path}`, {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers: {
          origin: "https://example.test",
          "content-type": "application/json",
          "cf-connecting-ip": ip,
          ...(cookie ? { cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    async function signup(email, ip) {
      const response = await call("/api/auth/sign-up/email", { name: email, email, password: "test-password-1234" }, null, ip);
      assert.equal(response.status, 200, await response.clone().text());
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie);
      return cookie;
    }
    async function issue(owner) {
      const response = await call("/api/academy/join-code", {}, owner);
      assert.equal(response.status, 200, await response.clone().text());
      const result = await response.json();
      assert.match(result.code, /^\d{6}$/);
      return result.code;
    }

    for (let i = 0; i < 30; i++) {
      const sessionResponse = await call("/api/auth/get-session", undefined, null, "192.0.2.100");
      assert.equal(sessionResponse.status, 200, `session request ${i + 1}`);
    }
    let limited = await call("/api/auth/get-session", undefined, null, "192.0.2.100");
    assert.equal(limited.status, 429);
    await db.prepare("UPDATE rateLimit SET lastRequest = ? WHERE key = ?")
      .bind(Date.now() - 61_000, "192.0.2.100|/get-session").run();
    limited = await call("/api/auth/get-session", undefined, null, "192.0.2.100");
    assert.equal(limited.status, 200);
    for (let i = 0; i < 3; i++) {
      const signIn = await call("/api/auth/sign-in/email", { email: "missing@example.test", password: "wrong-password-1234" }, null, "192.0.2.101");
      assert.notEqual(signIn.status, 429);
    }
    const signInLimited = await call("/api/auth/sign-in/email", { email: "missing@example.test", password: "wrong-password-1234" }, null, "192.0.2.101");
    assert.equal(signInLimited.status, 429);

    const owner = await signup("owner@example.test", "192.0.2.1");
    let response = await call("/api/academy", { name: "Test" }, owner);
    assert.equal(response.status, 201, await response.clone().text());
    const organization = await response.json();
    response = await call("/api/academy", undefined, owner);
    assert.equal(response.status, 200, await response.clone().text());
    const number = (await response.json()).academy.number;
    assert.match(number, /^\d{6}-\d{6,}$/);
    const member = await signup("member@example.test", "192.0.2.2");
    const other = await signup("other@example.test", "192.0.2.3");

    const old = await issue(owner);
    const code = await issue(owner);
    const saved = await db.prepare("SELECT code_hash FROM academy_join_code WHERE organization_id = ?").bind(organization.id).first();
    assert.notEqual(saved.code_hash, code);
    assert.notEqual(old, code);
    response = await call("/api/academy/join", { academyNumber: number, code: old }, member, "192.0.2.2");
    assert.equal(response.status, 400);
    const [first, second] = await Promise.all([
      call("/api/academy/join", { academyNumber: number, code }, member, "192.0.2.2"),
      call("/api/academy/join", { academyNumber: number, code }, other, "192.0.2.3"),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 400]);
    const winner = first.status === 200 ? member : other;
    const loser = first.status === 200 ? other : member;
    response = await call("/api/academy", undefined, winner);
    assert.equal((await response.json()).academy.number, number);
    response = await call("/api/academy/join-code", {}, winner);
    assert.equal(response.status, 403);

    const lockedCode = await issue(owner);
    const wrongCode = lockedCode === "000000" ? "000001" : "000000";
    for (let i = 0; i < 5; i++) {
      response = await call("/api/academy/join", { academyNumber: number, code: wrongCode }, loser, "192.0.2.4");
      assert.equal(response.status, 400);
    }
    response = await call("/api/academy/join", { academyNumber: number, code: lockedCode }, loser, "192.0.2.4");
    assert.equal(response.status, 400);

    const expiredCode = await issue(owner);
    await db.prepare("UPDATE academy_join_code SET expires_at = ? WHERE organization_id = ?").bind(Date.now() - 1, organization.id).run();
    response = await call("/api/academy/join", { academyNumber: number, code: expiredCode }, loser, "192.0.2.4");
    assert.equal(response.status, 400);
    const finalCode = await issue(owner);
    response = await call("/api/academy/join", { academyNumber: number, code: finalCode }, winner, "192.0.2.2");
    assert.equal(response.status, 400);
    const finalWrong = finalCode === "000000" ? "000001" : "000000";
    for (let i = 0; i < 4; i++) {
      response = await call("/api/academy/join", { academyNumber: number, code: finalWrong }, loser, "192.0.2.4");
      assert.equal(response.status, 400);
    }
    response = await call("/api/academy/join", { academyNumber: number, code: finalCode }, loser, "192.0.2.4");
    assert.equal(response.status, 200, await response.clone().text());
    const count = await db.prepare("SELECT COUNT(*) AS count FROM member WHERE organization_id = ?").bind(organization.id).first();
    assert.equal(count.count, 3);

    await db.prepare("INSERT INTO students (id, organization_id, name, enrolled_on) VALUES (?, ?, ?, ?)").bind("student", organization.id, "Test", "2026-01-01").run();
    await db.prepare("INSERT INTO tuition_charges (id, organization_id, student_id, billing_period, amount, due_date) VALUES (?, ?, ?, ?, ?, ?)").bind("charge", organization.id, "student", "2026-01", 100000, "2026-01-10").run();
    response = await call("/api/billing", { chargeId: "charge", status: "paid", paymentMethod: "cash" }, owner, "192.0.2.1", "PATCH");
    assert.equal(response.status, 200, await response.clone().text());
    const initial = await db.prepare("SELECT paid_at, payment_method FROM tuition_charges WHERE id = 'charge'").first();
    assert.equal(initial.payment_method, "cash");
    response = await call("/api/billing", { chargeId: "charge", status: "paid", paymentMethod: "card" }, owner, "192.0.2.1", "PATCH");
    assert.equal(response.status, 200);
    assert.equal((await db.prepare("SELECT paid_at FROM tuition_charges WHERE id = 'charge'").first()).paid_at, initial.paid_at);
    await db.prepare("UPDATE tuition_charges SET paid_at = ? WHERE id = 'charge'").bind(Date.parse("2026-02-28T15:00:00Z")).run();
    response = await call("/api/sales?period=2026-03", undefined, owner);
    assert.equal(response.status, 200);
    const sales = await response.json();
    assert.equal(sales.records.length, 1);
    assert.equal(sales.records[0].payment_method, "card");
    const outsider = await signup("outsider@example.test", "192.0.2.5");
    response = await call("/api/academy", { name: "Other Academy" }, outsider, "192.0.2.5");
    assert.equal(response.status, 201);
    response = await call("/api/sales?period=2026-03", undefined, outsider, "192.0.2.5");
    assert.equal((await response.json()).records.length, 0);
    response = await call("/api/billing", { chargeId: "charge", status: "unpaid" }, outsider, "192.0.2.5", "PATCH");
    assert.equal(response.status, 404);
    response = await call("/api/sales?period=2026-02", undefined, owner);
    assert.equal((await response.json()).records.length, 0);
    response = await call("/api/billing", { chargeId: "charge", status: "unpaid" }, owner, "192.0.2.1", "PATCH");
    assert.equal(response.status, 200);
    const unpaid = await db.prepare("SELECT paid_at, payment_method FROM tuition_charges WHERE id = 'charge'").first();
    assert.equal(unpaid.paid_at, null);
    assert.equal(unpaid.payment_method, null);
    response = await call("/api/sales?period=2026-03", undefined, owner);
    assert.equal((await response.json()).records.length, 0);
    await db.prepare("UPDATE tuition_charges SET status = 'paid', paid_at = ?, payment_method = NULL WHERE id = 'charge'").bind(Date.parse("2026-02-28T15:00:00Z")).run();
    response = await call("/api/sales?period=2026-03", undefined, owner);
    assert.equal((await response.json()).records[0].payment_method, null);
    response = await call("/api/dashboard-layout", undefined, owner);
    const layout = (await response.json()).layout;
    layout.reverse();
    layout[0].width = 45.72;
    layout[0].height = 315;
    response = await call("/api/dashboard-layout", layout, owner, "192.0.2.1", "PUT");
    assert.equal(response.status, 200);
    response = await call("/api/dashboard-layout", undefined, owner);
    assert.deepEqual((await response.json()).layout, layout);
    response = await call("/api/dashboard-layout", undefined, winner, "192.0.2.2");
    assert.notDeepEqual((await response.json()).layout, layout);
    response = await call("/api/dashboard-layout", [layout[0]], owner, "192.0.2.1", "PUT");
    assert.equal(response.status, 400);
    const legacyLayout = layout.map((card) => ({ id: card.id, size: "large" }));
    await db.prepare("UPDATE dashboard_layout SET layout = ?").bind(JSON.stringify(legacyLayout)).run();
    response = await call("/api/dashboard-layout", undefined, owner);
    assert.deepEqual((await response.json()).layout, layout.map((card) => ({ id: card.id, width: 66.67, height: null })));
    response = await call("/api/dashboard-layout", legacyLayout, owner, "192.0.2.1", "PUT");
    assert.equal(response.status, 200);
    response = await call("/api/dashboard-layout", undefined, owner);
    assert.deepEqual((await response.json()).layout, layout.map((card) => ({ id: card.id, width: 66.67, height: null })));
    response = await call("/api/dashboard-layout", layout.map((card, index) => index ? card : { ...card, width: 101 }), owner, "192.0.2.1", "PUT");
    assert.equal(response.status, 400);
    response = await call("/api/dashboard-layout", layout.map((card, index) => index ? card : { ...card, height: 159 }), owner, "192.0.2.1", "PUT");
    assert.equal(response.status, 400);
  } finally {
    await mf.dispose();
  }
});
