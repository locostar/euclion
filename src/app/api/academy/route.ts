import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { apiError, apiJson } from "@/lib/api-context";
import { parseJson } from "@/lib/request-validation";
import { z } from "zod";

const academyInput = z.object({
  name: z.string().trim().min(2).max(100),
});

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return apiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
  }

  let result = await env.DB.prepare(
    `SELECT o.id, o.name, m.role
     FROM member m
     INNER JOIN organization o ON o.id = m.organization_id
     INNER JOIN session s ON s.active_organization_id = o.id
     WHERE m.user_id = ? AND s.id = ? AND s.expires_at > ?
     LIMIT 1`,
  )
    .bind(session.user.id, session.session.id, Date.now())
    .first<{ id: string; name: string; role: string }>();

  if (!result) {
    const membership = await env.DB.prepare(
      `SELECT o.id, o.name, m.role
       FROM member m
       INNER JOIN organization o ON o.id = m.organization_id
       WHERE m.user_id = ?
       LIMIT 1`,
    )
      .bind(session.user.id)
      .first<{ id: string; name: string; role: string }>();

    if (membership) {
      await auth.api.setActiveOrganization({
        headers: request.headers,
        body: { organizationId: membership.id },
      });
      result = membership;
    }
  }

  return apiJson({ academy: result });
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return apiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
  }

  const activeOrganization = await env.DB.prepare(
    `SELECT active_organization_id
     FROM session
     WHERE id = ? AND user_id = ? AND expires_at > ?
     LIMIT 1`,
  )
    .bind(session.session.id, session.user.id, Date.now())
    .first<{ active_organization_id: string | null }>();
  if (activeOrganization?.active_organization_id) {
    return apiError(409, "ACADEMY_ALREADY_SET", "이미 학원이 등록되어 있습니다.");
  }

  const parsed = await parseJson(request, academyInput);
  if ("response" in parsed) return parsed.response;

  const existingMembership = await env.DB.prepare(
    "SELECT 1 AS member FROM member WHERE user_id = ? LIMIT 1",
  )
    .bind(session.user.id)
    .first<{ member: number }>();
  if (existingMembership) {
    return apiError(409, "ACADEMY_ALREADY_SET", "이미 학원이 등록되어 있습니다.");
  }

  const slug = `euclion-${crypto.randomUUID()}`;
  const created = await auth.api.createOrganization({
    headers: request.headers,
    body: {
      name: parsed.data.name,
      slug,
      keepCurrentActiveOrganization: true,
    },
  });

  if (!created) {
    return apiError(500, "ACADEMY_CREATION_FAILED", "학원을 등록하지 못했습니다.");
  }

  await auth.api.setActiveOrganization({
    headers: request.headers,
    body: { organizationId: created.id },
  });

  return apiJson({ id: created.id, name: created.name }, { status: 201 });
}
