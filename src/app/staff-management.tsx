"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";

type StaffMember = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: number;
};

type StaffData = { members: StaffMember[] };
type StaffRole = "owner" | "admin" | "member";
const roleLabels: Record<StaffRole, string> = {
  owner: "원장",
  admin: "관리자",
  member: "팀원",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let result: T & { error?: { message?: string } };
  try {
    result = JSON.parse(text) as T & { error?: { message?: string } };
  } catch {
    throw new Error("서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
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
  academyNumber,
}: {
  academyName: string;
  currentUserEmail: string;
  currentRole: string;
  academyNumber: string;
}) {
  const [staff, setStaff] = useState<StaffData>({ members: [] });
  const [joinCode, setJoinCode] = useState<{ code: string; expiresAt: number } | null>(null);
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

  async function generateJoinCode() {
    setPending(true);
    setError("");
    setMessage("");
    setJoinCode(null);
    try {
      const result = await requestJson<{ code: string; expiresAt: number }>("/api/academy/join-code", {
        method: "POST",
      });
      setJoinCode(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초대번호를 발급하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function remove(memberId: string, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await requestJson("/api/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      setMessage("직원을 학원에서 제거했습니다.");
      await reload(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "직원을 제거하지 못했습니다.");
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
        <div className="panel-heading"><div><h2>직원 초대</h2><p>직원이 계정을 만든 뒤 학원 고유번호와 초대번호를 입력하면 팀원으로 참여합니다.</p></div><KeyRound size={19} className="muted-icon" /></div>
        <div className="staff-invite-content">
          <div className="staff-academy-number"><span>학원 고유번호</span><strong>{academyNumber}</strong></div>
          {currentRole === "owner" ? <>
            <button className="button button-primary staff-code-button" type="button" disabled={pending} onClick={() => void generateJoinCode()}><KeyRound size={16} />새 초대번호 발급</button>
            {joinCode && <div className="staff-code-result" role="status"><span>초대번호 <strong>{joinCode.code}</strong></span><span>만료: {new Date(joinCode.expiresAt).toLocaleString("ko-KR")}</span></div>}
            <p className="staff-code-help">새 번호를 발급하면 이전 번호는 무효가 됩니다. 초대번호는 한 명만 사용할 수 있으며, 24시간 후 만료됩니다. 잘못 입력을 5회 하면 새 번호를 발급해야 합니다. 번호는 발급 직후에만 표시됩니다.</p>
          </> : <p className="staff-code-help">초대번호 발급은 원장에게 요청해 주세요.</p>}
        </div>
        <p className="staff-permission-note"><ShieldCheck size={15} />팀원은 학원 데이터 관리 권한을 가집니다. 신뢰할 수 있는 사람에게만 번호를 알려 주세요.</p>
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
                : <button className="button button-outline staff-remove" disabled={pending} onClick={() => void remove(member.id, `${member.name} 직원을 ${academyName}에서 제거할까요? 이 학원의 데이터에 더 이상 접근할 수 없습니다.`)}><Trash2 size={14} />강제 제거</button>}
              </td>
            </tr>)}
          </tbody></table></div>
        ) : <p className="staff-loading">학원 직원이 없습니다.</p>}
      </section>
    </>
  );
}
