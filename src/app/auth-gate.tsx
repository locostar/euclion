"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Academy = { id: string; name: string; role: string } | null;
type AuthenticatedUser = { name: string; email: string };

function Logo() {
  return <div className="brand auth-brand"><span className="brand-mark"><span /></span><span>euclion<span className="brand-dot">.</span></span></div>;
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><Logo />{children}</section></main>;
}

function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) {
          setError(result.error.message ?? "가입을 완료하지 못했습니다.");
          return;
        }
        setConfirmationEmail(email);
        return;
      }

      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "로그인하지 못했습니다.");
        return;
      }
      await authClient.$store.notify("$sessionSignal");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "요청을 완료하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function resendConfirmation() {
    setPending(true);
    setError("");
    setConfirmationMessage("");
    try {
      const result = await authClient.sendVerificationEmail({
        email: confirmationEmail,
        callbackURL: "/",
      });
      if (result.error) {
        setError(result.error.message ?? "확인 이메일을 보내지 못했습니다.");
      } else {
        setConfirmationMessage("확인 이메일을 다시 보냈습니다.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "요청을 완료하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  if (confirmationEmail) {
    return <div className="auth-content">
      <span className="auth-icon"><Mail size={21} /></span>
      <h1>이메일을 확인해 주세요</h1>
      <p><strong>{confirmationEmail}</strong>로 확인 링크를 보냈습니다. 링크를 확인한 다음 로그인해 주세요.</p>
      {confirmationMessage && <p className="success-message">{confirmationMessage}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="button button-primary auth-submit" onClick={resendConfirmation} disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : null}확인 이메일 다시 보내기</button>
      <button className="auth-text-button" onClick={() => { setConfirmationEmail(""); setMode("sign-in"); }}>로그인으로 돌아가기</button>
    </div>;
  }

  return <div className="auth-content">
    <span className="auth-icon"><LockKeyhole size={21} /></span>
    <h1>{mode === "sign-in" ? "다시 만나 반가워요" : "Euclion 시작하기"}</h1>
    <p>{mode === "sign-in" ? "학원 업무를 안전하게 이어서 관리하세요." : "관리자 계정을 만들고 학원을 등록하세요."}</p>
    <form className="auth-form" onSubmit={submit}>
      {mode === "sign-up" && <label className="field">이름<input autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>}
      <label className="field">이메일<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="field">비밀번호<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><small>12자 이상 입력해 주세요.</small></label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : null}{mode === "sign-in" ? "로그인" : "계정 만들기"} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-switch">{mode === "sign-in" ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"}<button className="auth-text-button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); }}>{mode === "sign-in" ? "가입하기" : "로그인"}</button></p>
  </div>;
}

function VerifyEmail({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/" });
      if (result.error) setError(result.error.message ?? "확인 이메일을 보내지 못했습니다.");
      else setMessage("확인 이메일을 보냈습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "요청을 완료하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return <AuthCard><div className="auth-content">
    <span className="auth-icon"><Mail size={21} /></span>
    <h1>이메일을 확인해 주세요</h1>
    <p>{email} 주소의 소유자임을 확인한 후 계속할 수 있습니다.</p>
    <button className="button button-primary auth-submit" onClick={resend} disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : null}확인 이메일 다시 보내기 <ArrowRight size={16} /></button>
    {message && <p className="success-message">{message}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className="auth-text-button" onClick={() => authClient.signOut()}>로그아웃</button>
  </div></AuthCard>;
}

function AcademySetup({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        setError(result.error?.message ?? "학원을 등록하지 못했습니다.");
        return;
      }
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "요청을 완료하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return <AuthCard><div className="auth-content">
    <span className="auth-icon"><Sparkles size={21} /></span>
    <h1>학원을 등록해 주세요</h1>
    <p>학원 이름은 소속 데이터를 분리하는 데 사용됩니다. 등록 후에는 학원 관리자만 데이터를 관리할 수 있습니다.</p>
    <form className="auth-form" onSubmit={submit}>
      <label className="field">학원 이름<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 유클리온 학원" /></label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : null}학원 등록하기 <ArrowRight size={16} /></button>
    </form>
    <button className="auth-text-button" onClick={() => authClient.signOut()}>로그아웃</button>
  </div></AuthCard>;
}

export function AuthGate({
  children,
}: {
  children: (academy: NonNullable<Academy>, user: AuthenticatedUser) => React.ReactNode;
}) {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [academy, setAcademy] = useState<Academy>(null);
  const [academyLoadedFor, setAcademyLoadedFor] = useState("");
  const [academyError, setAcademyError] = useState("");
  const [academyRefresh, setAcademyRefresh] = useState(0);
  const academyRequestKey = session?.session.id
    ? `${session.session.id}:${academyRefresh}`
    : "";
  const academyLoaded = academyLoadedFor === academyRequestKey;

  useEffect(() => {
    if (!session?.user.emailVerified) return;

    let active = true;
    fetch("/api/academy")
      .then(async (response) => {
        const result = await response.json() as { academy?: Academy; error?: { message?: string } };
        if (!response.ok) throw new Error(result.error?.message ?? "학원 정보를 불러오지 못했습니다.");
        return result.academy ?? null;
      })
      .then((value) => {
        if (active) {
          setAcademy(value);
          setAcademyError("");
          setAcademyLoadedFor(`${session.session.id}:${academyRefresh}`);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setAcademyError(caught instanceof Error ? caught.message : "학원 정보를 불러오지 못했습니다.");
          setAcademyLoadedFor(`${session.session.id}:${academyRefresh}`);
        }
      });
    return () => { active = false; };
  }, [session?.user.emailVerified, session?.session.id, academyRefresh]);

  if (isPending) return <AuthCard><div className="auth-loading"><LoaderCircle className="spin" size={24} />계정 정보를 확인하고 있어요.</div></AuthCard>;
  if (!session) return <AuthCard><AuthForm /></AuthCard>;
  if (!session.user.emailVerified) return <VerifyEmail email={session.user.email} />;
  if (!academyLoaded) return <AuthCard><div className="auth-loading"><LoaderCircle className="spin" size={24} />학원 정보를 불러오고 있어요.</div></AuthCard>;
  if (academyError) return <AuthCard><div className="auth-content"><h1>학원 정보를 불러오지 못했어요</h1><p>{academyError}</p><button className="button button-primary auth-submit" onClick={() => { void refetch(); setAcademyRefresh((current) => current + 1); }}>다시 시도하기</button></div></AuthCard>;
  if (!academy) return <AcademySetup onCreated={() => { void refetch(); setAcademyRefresh((current) => current + 1); }} />;
  return children(academy, { name: session.user.name, email: session.user.email });
}
