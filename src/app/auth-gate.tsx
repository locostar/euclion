"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Academy = { id: string; name: string; role: string; number: string } | null;
type AuthenticatedUser = { name: string; email: string };
type AcademyResult =
  | { kind: "success"; academy: Academy; sessionId: string }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };
async function loadAcademy(): Promise<AcademyResult> {
  try {
    const response = await fetch("/api/academy");
    if (response.status === 401) return { kind: "unauthenticated" };
    const result = await response.json() as { academy?: Academy; sessionId?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message ?? "학원 정보를 불러오지 못했습니다.");
    if (!result.sessionId || result.academy === undefined) {
      throw new Error("학원 정보를 올바르게 불러오지 못했습니다.");
    }
    return { kind: "success", academy: result.academy, sessionId: result.sessionId };
  } catch (caught) {
    return { kind: "error", message: caught instanceof Error ? caught.message : "학원 정보를 불러오지 못했습니다." };
  }
}

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
        await authClient.$store.notify("$sessionSignal");
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

  return <div className="auth-content">
    <span className="auth-icon"><LockKeyhole size={21} /></span>
    <h1>{mode === "sign-in" ? "다시 만나 반가워요" : "Euclion 시작하기"}</h1>
    <p>{mode === "sign-in" ? "학원 업무를 안전하게 이어서 관리하세요." : "계정을 만든 뒤 새 학원을 등록하거나 기존 학원에 참여하세요."}</p>
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

function AcademySetup({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [academyNumber, setAcademyNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(mode === "create" ? "/api/academy" : "/api/academy/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? { name } : { academyNumber, code }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        setError(result.error?.message ?? "학원을 설정하지 못했습니다.");
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
    <h1>{mode === "create" ? "새 학원 등록" : "기존 학원 참여"}</h1>
    <p>{mode === "create" ? "원장으로 새 학원을 등록하면 학원 고유번호가 자동 발급됩니다." : "원장에게 받은 학원 고유번호와 6자리 초대번호를 입력하세요."}</p>
    <form className="auth-form" onSubmit={submit}>
      {mode === "create" ? <label className="field">학원 이름<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 유클리온 학원" /></label> : <>
        <label className="field">학원 고유번호<input required maxLength={30} value={academyNumber} onChange={(event) => setAcademyNumber(event.target.value)} placeholder="예: 202611-000001" /></label>
        <label className="field">초대번호<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} placeholder="6자리 숫자" /></label>
      </>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : null}{mode === "create" ? "학원 등록하기" : "학원 참여하기"} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-switch"><button className="auth-text-button" onClick={() => { setMode(mode === "create" ? "join" : "create"); setError(""); }}>{mode === "create" ? "이미 등록된 학원에 참여하기" : "새 학원 등록하기"}</button></p>
    <button className="auth-text-button" onClick={() => authClient.signOut()}>로그아웃</button>
  </div></AuthCard>;
}

export function AuthGate({
  children,
}: {
  children: (academy: NonNullable<Academy>, user: AuthenticatedUser) => React.ReactNode;
}) {
  const { data: session, isPending, error: sessionError, refetch } = authClient.useSession();
  const [academy, setAcademy] = useState<Academy>(null);
  const [academyLoadedFor, setAcademyLoadedFor] = useState("");
  const [academyError, setAcademyError] = useState("");
  const [academyRefresh, setAcademyRefresh] = useState(0);
  const academyRequest = useRef<Promise<AcademyResult> | null>(null);
  const sessionId = session?.session.id;
  const academyRequestKey = sessionId
    ? `${sessionId}:${academyRefresh}`
    : "";
  const academyLoaded = academyLoadedFor === academyRequestKey;

  useEffect(() => {
    if (!isPending && !sessionId) {
      academyRequest.current = null;
      return;
    }

    let active = true;
    const request = academyRequest.current ?? loadAcademy();
    academyRequest.current = request;
    if (sessionId) {
      void (async () => {
        let result = await request;
        if (!active) return;
        if (result.kind === "unauthenticated" || (result.kind === "success" && result.sessionId !== sessionId)) {
          academyRequest.current = loadAcademy();
          result = await academyRequest.current;
        }
        if (!active) return;
        if (result.kind === "success" && result.sessionId === sessionId) {
          setAcademy(result.academy);
          setAcademyError("");
        } else {
          setAcademyError(result.kind === "error" ? result.message : "로그인 상태가 변경되었습니다. 다시 시도해 주세요.");
        }
        setAcademyLoadedFor(`${sessionId}:${academyRefresh}`);
      })();
    }
    return () => { active = false; };
  }, [sessionId, isPending, academyRefresh]);

  const refreshAcademy = () => {
    academyRequest.current = null;
    void refetch();
    setAcademyRefresh((current) => current + 1);
  };

  if (isPending) return <AuthCard><div className="auth-loading"><LoaderCircle className="spin" size={24} />계정 정보를 확인하고 있어요.</div></AuthCard>;
  if (sessionError) return <AuthCard><div className="auth-content"><h1>계정 정보를 확인하지 못했어요</h1><p>{sessionError.status === 429 ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." : "연결 상태를 확인한 후 다시 시도해 주세요."}</p><button className="button button-primary auth-submit" onClick={refreshAcademy}>다시 시도하기</button></div></AuthCard>;
  if (!session) return <AuthCard><AuthForm /></AuthCard>;
  if (!academyLoaded) return <AuthCard><div className="auth-loading"><LoaderCircle className="spin" size={24} />학원 정보를 불러오고 있어요.</div></AuthCard>;
  if (academyError) return <AuthCard><div className="auth-content"><h1>학원 정보를 불러오지 못했어요</h1><p>{academyError}</p><button className="button button-primary auth-submit" onClick={refreshAcademy}>다시 시도하기</button></div></AuthCard>;
  if (!academy) return <AcademySetup onCreated={refreshAcademy} />;
  return children(academy, { name: session.user.name, email: session.user.email });
}
