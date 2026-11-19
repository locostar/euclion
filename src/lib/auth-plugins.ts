import { createAccessControl, organization } from "better-auth/plugins";
import { sendEmail } from "./email";

const statements = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
} as const;

const accessControl = createAccessControl(statements);
const fullAccess = accessControl.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
});

const roleLabels: Record<string, string> = {
  owner: "원장",
  admin: "관리자",
  member: "팀원",
};

const organizationOptions = {
  organizationLimit: 1,
  ac: accessControl,
  roles: {
    owner: fullAccess,
    admin: fullAccess,
    member: fullAccess,
  },
};

export const authPlugins = [organization(organizationOptions)];

export function createAuthPlugins(env: CloudflareEnv, baseURL: string) {
  return [
    organization({
      ...organizationOptions,
      sendInvitationEmail: async ({
        id,
        email,
        role,
        organization: invitedOrganization,
        inviter,
        invitation,
      }) => {
        const inviteURL = new URL("/invite", baseURL);
        inviteURL.searchParams.set("invitationId", id);
        inviteURL.searchParams.set("email", email);
        await sendEmail(env, {
          to: email,
          subject: `${invitedOrganization.name} 직원 초대`,
          text: `${inviter.user.name}님이 ${invitedOrganization.name}에 ${roleLabels[role] ?? role} 직급으로 초대했습니다.\n\n초대를 수락하려면 다음 링크를 여세요:\n${inviteURL}\n\n초대는 ${invitation.expiresAt.toLocaleDateString("ko-KR")}까지 유효합니다. 초대된 이메일 주소로 로그인하거나 새 계정을 만들어 주세요.`,
        });
      },
    }),
  ];
}
