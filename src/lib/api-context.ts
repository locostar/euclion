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

  const membership = await env.DB.prepare(
    `SELECT s.active_organization_id, m.role
     FROM session s
     LEFT JOIN member m
       ON m.organization_id = s.active_organization_id
      AND m.user_id = s.user_id
     WHERE s.id = ? AND s.user_id = ? AND s.expires_at > ?
     LIMIT 1`,
  )
    .bind(session.session.id, session.user.id, Date.now())
    .first<{ active_organization_id: string | null; role: string | null }>();
  const organizationId = membership?.active_organization_id;
  if (!organizationId) {
    return {
      response: apiError(409, "ACADEMY_REQUIRED", "학원을 먼저 등록해 주세요."),
    };
  }

  if (!membership?.role) {
    return {
      response: apiError(403, "ACADEMY_ACCESS_DENIED", "학원 접근 권한이 없습니다."),
    };
  }

  if (
    requireManager &&
    !["owner", "admin", "member"].includes(membership.role)
  ) {
    return {
      response: apiError(403, "ROLE_NOT_SUPPORTED", "학원 구성원 권한을 확인할 수 없습니다."),
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
