import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";

type AcademyContext = {
  env: CloudflareEnv;
  organizationId: string;
  userId: string;
  role: string;
};

type ContextResult =
  | { context: AcademyContext }
  | { response: Response };

export function apiError(status: number, code: string, message: string) {
  return apiJson({ error: { code, message } }, { status });
}

export function apiJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json(body, { ...init, headers });
}

export async function getAcademyContext(
  request: Request,
  requireManager = false,
): Promise<ContextResult> {
  const { env } = await getCloudflareContext({ async: true });
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return {
      response: apiError(401, "UNAUTHENTICATED", "로그인이 필요합니다."),
    };
  }

  const activeOrganization = await env.DB.prepare(
    `SELECT active_organization_id
     FROM session
     WHERE id = ? AND user_id = ? AND expires_at > ?
     LIMIT 1`,
  )
    .bind(session.session.id, session.user.id, Date.now())
    .first<{ active_organization_id: string | null }>();
  const organizationId = activeOrganization?.active_organization_id;
  if (!organizationId) {
    return {
      response: apiError(409, "ACADEMY_REQUIRED", "학원을 먼저 등록해 주세요."),
    };
  }

  const membership = await env.DB.prepare(
    "SELECT role FROM member WHERE organization_id = ? AND user_id = ? LIMIT 1",
  )
    .bind(organizationId, session.user.id)
    .first<{ role: string }>();

  if (!membership) {
    return {
      response: apiError(403, "ACADEMY_ACCESS_DENIED", "학원 접근 권한이 없습니다."),
    };
  }

  if (requireManager && !["owner", "admin"].includes(membership.role)) {
    return {
      response: apiError(403, "MANAGER_REQUIRED", "관리자 권한이 필요합니다."),
    };
  }

  return {
    context: {
      env,
      organizationId,
      userId: session.user.id,
      role: membership.role,
    },
  };
}
