import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { hashJoinCode, isSameOrigin, newJoinCode } from "@/lib/academy-join";

export async function POST(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;
  const { env, organizationId, role } = result.context;
  if (!isSameOrigin(request, env.BETTER_AUTH_URL)) {
    return apiError(403, "INVALID_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }
  if (role !== "owner") {
    return apiError(403, "OWNER_REQUIRED", "초대번호는 원장만 발급할 수 있습니다.");
  }

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  for (;;) {
    const code = newJoinCode();
    const hash = await hashJoinCode(env.BETTER_AUTH_SECRET, organizationId, code);
    const result = await env.DB.prepare(
      `INSERT INTO academy_join_code (organization_id, code_hash, expires_at, attempts, consumed_at)
       VALUES (?, ?, ?, 0, NULL)
       ON CONFLICT(organization_id) DO UPDATE SET
         code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, consumed_at = NULL
       WHERE academy_join_code.code_hash != excluded.code_hash`,
    ).bind(organizationId, hash, expiresAt).run();
    if (result.meta.changes === 1) return apiJson({ code, expiresAt });
  }
}
