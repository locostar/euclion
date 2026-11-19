import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { apiError, apiJson } from "@/lib/api-context";
import { hashJoinCode, isSameOrigin } from "@/lib/academy-join";
import { parseJson } from "@/lib/request-validation";
import { z } from "zod";

const joinInput = z.object({
  academyNumber: z.string().trim().regex(/^\d{6}-\d{6,}$/).max(30),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!isSameOrigin(request, env.BETTER_AUTH_URL)) {
    return apiError(403, "INVALID_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return apiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
  const parsed = await parseJson(request, joinInput);
  if ("response" in parsed) return parsed.response;

  const academy = await env.DB.prepare(
    "SELECT organization_id FROM academy_number WHERE printf('%s-%06d', issued_month, sequence) = ? LIMIT 1",
  ).bind(parsed.data.academyNumber).first<{ organization_id: string }>();
  const invalidMessage = "학원번호 또는 초대번호가 올바르지 않거나 만료되었습니다. 원장에게 새 번호를 요청해 주세요.";
  if (!academy) return apiError(400, "INVALID_JOIN_CODE", invalidMessage);

  const organizationId = academy.organization_id;
  const hash = await hashJoinCode(env.BETTER_AUTH_SECRET, organizationId, parsed.data.code);
  const now = Date.now();
  const id = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO academy_join_redemption (id, organization_id, user_id, created_at)
       SELECT ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM academy_join_code
         WHERE organization_id = ? AND code_hash = ? AND expires_at > ?
           AND consumed_at IS NULL AND attempts < 5
       ) AND NOT EXISTS (SELECT 1 FROM member WHERE user_id = ?)`,
    ).bind(id, organizationId, session.user.id, now, organizationId, hash, now, session.user.id),
    env.DB.prepare(
      `UPDATE academy_join_code SET attempts = attempts + 1
       WHERE organization_id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5
         AND NOT EXISTS (SELECT 1 FROM member WHERE user_id = ?)
         AND NOT EXISTS (SELECT 1 FROM academy_join_redemption WHERE id = ?)`,
    ).bind(organizationId, now, session.user.id, id),
    env.DB.prepare(
      `UPDATE session SET active_organization_id = ?
       WHERE id = ? AND user_id = ? AND expires_at > ?
         AND EXISTS (SELECT 1 FROM academy_join_redemption WHERE id = ?)`,
    ).bind(organizationId, session.session.id, session.user.id, now, id),
  ]);
  if (results[0].meta.changes === 0) {
    return apiError(400, "INVALID_JOIN_CODE", invalidMessage);
  }
  return apiJson({ joined: true });
}
