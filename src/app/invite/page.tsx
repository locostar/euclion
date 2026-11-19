"use client";

import { FormEvent, Suspense, useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

export default function InvitePage() {
  return <Suspense fallback={<main className="auth-page"><section className="auth-card"><div className="auth-loading"><LoaderCircle className="spin" size={24} />초대 정보를 불러오고 있어요.</div></section></main>}><InviteContent /></Suspense>;
}

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, isPending: sessionPending, error: sessionError, refetch } = authClient.useSession();
  const invitationId = searchParams.get("invitationId") ?? "";
  const invitedEmail = searchParams.get("email") ?? "";
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function acceptInvitation() {
    if (!invitationId) {
      setError("초대 링크가 올바르지 않습니다.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (result.error) {
        setError(result.error.message ?? "초대를 수락하지 못했습니다.");
        return;
      }
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초대를 수락하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const accountEmail = invitedEmail || email;
      const result = mode === "sign-up"
        ? await authClient.signUp.email({ name, email: accountEmail, password })
        : await authClient.signIn.email({ email: accountEmail, password });
      if (result.error) {
        setError(result.error.message ?? "계정 인증에 실패했습니다.");
        return;
      }
      await authClient.$store.notify("$sessionSignal");
      if (result.data?.user.emailVerified) {
        await acceptInvitation();
      } else {
        setMessage("초대를 수락하려면 이메일 소유 확인이 필요합니다. 아래 버튼으로 확인 메일을 받아 주세요.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "계정 인증에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function sendVerification() {
    if (!session) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: window.location.href,
      });
      if (result.error) {
        setError("확인 메일을 보내지 못했습니다. 잠시 후 다시 시도하거나 학원에 문의해 주세요.");
        return;
      }
      setMessage("이메일 확인 링크를 발송 요청했습니다. 수신함과 스팸함을 확인해 주세요.");
    } catch {
      setError("확인 메일 발송 결과를 확인하지 못했습니다. 수신함을 확인한 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function switchAccount() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message ?? "로그아웃하지 못했습니다.");
        return;
      }
      await authClient.$store.notify("$sessionSignal");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그아웃하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  const sessionEmail = session?.user.email.toLowerCase();
  const matchingAccount = Boolean(sessionEmail && invitedEmail && sessionEmail === invitedEmail.toLowerCase());
  const invalidLink = !invitationId || !invitedEmail;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand auth-brand"><span className="brand-mark"><span /></span><span>euclion<span className="brand-dot">.</span></span></div>
        <div className="auth-content">
          <span className="auth-icon"><LockKeyhole size={21} /></span>
          <h1>학원 직원 초대</h1>
          <p>
            {invitedEmail
              ? `${invitedEmail} 계정으로 초대를 수락해 학원에 합류하세요.`
              : "초대받은 이메일 계정으로 로그인하거나 새 계정을 만들어 주세요."}
          </p>
          {invalidLink && <p className="error-message" role="alert">초대 링크가 올바르지 않습니다.</p>}
          {sessionPending ? (
            <div className="auth-loading"><LoaderCircle className="spin" size={24} />계정 정보를 확인하고 있어요.</div>
          ) : sessionError ? (
            <div className="auth-form"><p className="error-message" role="alert">계정 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p><button className="button button-primary auth-submit" onClick={() => void refetch()}>다시 시도하기</button></div>
          ) : matchingAccount ? (
            <div className="auth-form">
              <p>{session?.user.name}님, 초대받은 계정으로 로그인되어 있습니다.</p>
              {message && <p role="status">{message}</p>}
              {error && <p className="error-message" role="alert">{error}</p>}
              {!session?.user.emailVerified ? <><p>초대를 수락하려면 이메일 주소를 확인해야 합니다.</p><button className="button button-primary auth-submit" onClick={() => void sendVerification()} disabled={pending || invalidLink}>이메일 확인 메일 보내기 <ArrowRight size={16} /></button></> :
              <button className="button button-primary auth-submit" onClick={() => void acceptInvitation()} disabled={pending || invalidLink}>
                {pending ? <LoaderCircle className="spin" size={16} /> : null}
                초대 수락하기 <ArrowRight size={16} />
              </button>}
            </div>
          ) : session ? (
            <div className="auth-form">
              <p>현재 로그인한 이메일은 초대를 받은 이메일과 다릅니다.</p>
              {error && <p className="error-message" role="alert">{error}</p>}
              <button className="button button-primary auth-submit" onClick={() => void switchAccount()} disabled={pending}>다른 계정으로 로그인</button>
            </div>
          ) : (
            <>
              <form className="auth-form" onSubmit={authenticate}>
                {mode === "sign-up" && <label className="field">이름<input autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>}
                <label className="field">초대 이메일<input type="email" autoComplete="email" required maxLength={254} readOnly={Boolean(invitedEmail)} value={invitedEmail || email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label className="field">비밀번호<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><small>12자 이상 입력해 주세요.</small></label>
                {error && <p className="error-message" role="alert">{error}</p>}
                <button className="button button-primary auth-submit" type="submit" disabled={pending || invalidLink}>
                  {pending ? <LoaderCircle className="spin" size={16} /> : null}
                  {mode === "sign-in" ? "로그인하고 초대 수락" : "계정 만들고 초대 수락"} <ArrowRight size={16} />
                </button>
              </form>
              <p className="auth-switch">
                {mode === "sign-in" ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"}
                <button className="auth-text-button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); }}>
                  {mode === "sign-in" ? "계정 만들기" : "로그인"}
                </button>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
