import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { createAuth } from "@/lib/auth";
import { parseJson } from "@/lib/request-validation";
import { z } from "zod";

const inviteInput = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["owner", "admin", "member"]),
  resend: z.boolean().optional(),
});

const deleteInput = z
  .object({
    invitationId: z.string().min(1).max(128).optional(),
    memberId: z.string().min(1).max(128).optional(),
  })
  .refine((value) => Boolean(value.invitationId) !== Boolean(value.memberId), {
    message: "취소할 초대 또는 제거할 직원 하나를 지정해 주세요.",
  });

export async function GET(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;
  const { env, organizationId } = result.context;

  const [members, invitations] = await Promise.all([
    env.DB.prepare(
      `SELECT m.id, m.user_id, u.name, u.email, m.role, m.created_at
       FROM member m
       INNER JOIN user u ON u.id = m.user_id
       WHERE m.organization_id = ?
       ORDER BY m.created_at ASC`,
    )
      .bind(organizationId)
      .all<{
        id: string;
        user_id: string;
        name: string;
        email: string;
        role: string;
        created_at: number;
      }>(),
    env.DB.prepare(
      `SELECT id, email, role, status, expires_at, created_at,
              CASE WHEN expires_at <= ? THEN 1 ELSE 0 END AS expired
       FROM invitation
       WHERE organization_id = ? AND status = 'pending'
       ORDER BY created_at DESC`,
    )
      .bind(Date.now(), organizationId)
      .all<{
        id: string;
        email: string;
        role: string | null;
        status: string;
        expires_at: number;
        created_at: number;
        expired: number;
      }>(),
  ]);

  return apiJson({
    members: members.results,
    invitations: invitations.results,
  });
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;
  const { env, organizationId } = result.context;
  const parsed = await parseJson(request, inviteInput);
  if ("response" in parsed) return parsed.response;

  if (!env.RESEND_API_KEY.trim() || !env.RESEND_FROM.trim()) {
    return apiError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "초대 이메일을 보내려면 RESEND_API_KEY와 RESEND_FROM 설정이 필요합니다.",
    );
  }

  try {
    const invitation = await createAuth(env).api.createInvitation({
      headers: request.headers,
      body: {
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        organizationId,
        resend: parsed.data.resend,
      },
    });
    return apiJson({ invitation }, { status: 201 });
  } catch (caught) {
    return apiError(
      400,
      "STAFF_INVITATION_FAILED",
      caught instanceof Error ? caught.message : "직원 초대를 보내지 못했습니다.",
    );
  }
}

export async function DELETE(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;
  const { env, organizationId, userId } = result.context;
  const parsed = await parseJson(request, deleteInput);
  if ("response" in parsed) return parsed.response;
  const auth = createAuth(env);

  try {
    if (parsed.data.invitationId) {
      await auth.api.cancelInvitation({
        headers: request.headers,
        body: {
          invitationId: parsed.data.invitationId,
        },
      });
      return apiJson({ canceled: true });
    }

    const memberId = parsed.data.memberId;
    if (!memberId) {
      return apiError(400, "STAFF_MEMBER_REQUIRED", "제거할 직원을 지정해 주세요.");
    }

    const target = await env.DB.prepare(
      "SELECT user_id FROM member WHERE id = ? AND organization_id = ? LIMIT 1",
    )
      .bind(memberId, organizationId)
      .first<{ user_id: string }>();

    if (!target) {
      return apiError(404, "STAFF_MEMBER_NOT_FOUND", "직원을 찾을 수 없습니다.");
    }
    if (target.user_id === userId) {
      return apiError(400, "CANNOT_REMOVE_SELF", "현재 로그인한 계정은 직접 제거할 수 없습니다.");
    }

    await auth.api.removeMember({
      headers: request.headers,
      body: {
        memberIdOrEmail: memberId,
        organizationId,
      },
    });
    return apiJson({ removed: true });
  } catch (caught) {
    return apiError(
      400,
      "STAFF_REMOVAL_FAILED",
      caught instanceof Error ? caught.message : "직원 또는 초대를 처리하지 못했습니다.",
    );
  }
}
