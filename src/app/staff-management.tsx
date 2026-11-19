"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { MailPlus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

type StaffMember = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: number;
};

type StaffInvitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expires_at: number;
  created_at: number;
  expired: number;
};

type StaffData = { members: StaffMember[]; invitations: StaffInvitation[] };
type StaffRole = "owner" | "admin" | "member";
const roleLabels: Record<StaffRole, string> = {
  owner: "원장",
  admin: "관리자",
  member: "팀원",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(result.error?.message ?? "요청을 완료하지 못했습니다.");
  }
  return result;
}

function roleLabel(role: string | null) {
  return role && role in roleLabels ? roleLabels[role as StaffRole] : role ?? "팀원";
}

function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("ko-KR");
}

export function StaffManagement({
  academyName,
  currentUserEmail,
  currentRole,
}: {
  academyName: string;
  currentUserEmail: string;
  currentRole: string;
}) {
  const [staff, setStaff] = useState<StaffData>({ members: [], invitations: [] });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("member");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await requestJson<StaffData>("/api/staff");
      setStaff(result);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "직원 목록을 불러오지 못했습니다.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      await requestJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          resend: false,
        }),
      });
      setMessage(`${email.trim()} 주소로 초대 이메일을 보냈습니다.`);
      setEmail("");
      await reload(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "직원 초대에 실패했습니다.";
      await reload(false);
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function resend(invitation: StaffInvitation) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await requestJson("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invitation.email,
          role: invitation.role ?? "member",
          resend: true,
        }),
      });
      setMessage(`${invitation.email} 주소로 초대 이메일을 다시 보냈습니다.`);
      await reload(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초대 이메일을 다시 보내지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function remove(payload: { invitationId?: string; memberId?: string }, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await requestJson("/api/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(payload.invitationId ? "직원 초대를 취소했습니다." : "직원을 학원에서 제거했습니다.");
      await reload(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "직원 또는 초대를 처리하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow">ACADEMY SETTINGS</div><h1>직원 관리</h1><p>{academyName}에 참여 중인 직원과 초대 상태를 관리합니다.</p></div>
      </div>
      {message && <div className="success-message" role="status">{message}</div>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <section className="panel staff-invite-panel">
        <div className="panel-heading"><div><h2>직원 초대</h2><p>초대받은 사람은 이메일 링크에서 본인 계정으로 로그인하거나 새 계정을 만들 수 있습니다.</p></div><MailPlus size={19} className="muted-icon" /></div>
        <form className="staff-invite-form" onSubmit={(event) => void invite(event)}>
          <label className="field">이메일<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@example.com" /></label>
          <label className="field">직급<select value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>{Object.entries(roleLabels).filter(([value]) => value !== "owner" || currentRole === "owner").map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <button className="button button-primary" type="submit" disabled={pending}><MailPlus size={16} />초대 이메일 보내기</button>
        </form>
        <p className="staff-permission-note"><ShieldCheck size={15} />현재 원장·관리자·팀원은 동일한 권한으로 운영됩니다.</p>
      </section>
      <section className="panel staff-list-panel">
        <div className="panel-heading"><div><h2>학원 직원</h2><p>{staff.members.length.toLocaleString("ko-KR")}명이 학원에 참여 중입니다.</p></div></div>
        {loading ? <p className="staff-loading">직원 목록을 불러오고 있습니다.</p> : staff.members.length ? (
          <div className="table-wrap"><table><thead><tr><th>직원</th><th>이메일</th><th>직급</th><th>참여일</th><th>관리</th></tr></thead><tbody>
            {staff.members.map((member) => <tr key={member.id}>
              <td><strong>{member.name}</strong>{member.email.toLowerCase() === currentUserEmail.toLowerCase() && <small className="staff-self-label"> · 나</small>}</td>
              <td>{member.email}</td><td><span className="status-pill active">{roleLabel(member.role)}</span></td><td>{dateLabel(member.created_at)}</td>
              <td>{member.email.toLowerCase() === currentUserEmail.toLowerCase()
                ? <span className="staff-action-note">본인</span>
                : <button className="button button-outline staff-remove" disabled={pending} onClick={() => void remove({ memberId: member.id }, `${member.name} 직원을 ${academyName}에서 제거할까요? 이 학원의 데이터에 더 이상 접근할 수 없습니다.`)}><Trash2 size={14} />강제 제거</button>}
              </td>
            </tr>)}
          </tbody></table></div>
        ) : <p className="staff-loading">학원 직원이 없습니다.</p>}
      </section>
      <section className="panel staff-list-panel">
        <div className="panel-heading"><div><h2>초대 대기</h2><p>수락 전이거나 만료된 초대를 확인하고 관리합니다.</p></div><button className="button button-outline staff-refresh" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />새로고침</button></div>
        {loading ? <p className="staff-loading">초대 목록을 불러오고 있습니다.</p> : staff.invitations.length ? (
          <div className="table-wrap"><table><thead><tr><th>이메일</th><th>초대 직급</th><th>상태</th><th>만료일</th><th>관리</th></tr></thead><tbody>
            {staff.invitations.map((invitation) => {
              const expired = Boolean(invitation.expired);
              return <tr key={invitation.id}>
                <td>{invitation.email}</td><td>{roleLabel(invitation.role)}</td>
                <td><span className={`status-pill ${expired ? "" : "active"}`}>{expired ? "만료됨" : "수락 대기"}</span></td>
                <td>{dateLabel(invitation.expires_at)}</td>
                <td className="staff-invitation-actions">
                  <button className="button button-outline staff-refresh" disabled={pending} onClick={() => void resend(invitation)}><RefreshCw size={14} />재전송</button>
                  <button className="button button-outline staff-remove" disabled={pending} onClick={() => void remove({ invitationId: invitation.id }, `${invitation.email} 초대를 취소할까요?`)}><Trash2 size={14} />취소</button>
                </td>
              </tr>;
            })}
          </tbody></table></div>
        ) : <div className="empty staff-empty"><h3>대기 중인 초대가 없습니다</h3><p>초대를 보내면 이곳에서 수락 여부와 만료일을 확인할 수 있습니다.</p></div>}
      </section>
    </>
  );
}
