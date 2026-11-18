"use client";

import {
  ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleAlert, ClipboardCheck,
  Menu, MessageSquareText, Plus, Search, Sparkles,
  UsersRound, WalletCards, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { AuthGate } from "./auth-gate";
import { authClient } from "@/lib/auth-client";

type Page = "dashboard" | "students" | "student-new" | "consultations" | "classes" | "class-new" | "schedule" | "attendance" | "attendance-list" | "billing" | "billing-settings" | "payments" | "academy" | "staff" | "permissions";
type Student = {
  id: string; name: string; birth: string; phone: string; guardian: string;
  school: string; address: string; enrolled: string; classes: string[];
  memo: string; status: "재원" | "퇴원";
};
type ClassRoom = { id: string; name: string; subject: string; teacher: string; grade: string; capacity: string; room: string; start: string; end: string; memo: string };
type AttendanceStatus = "출석" | "결석" | "지각" | "조퇴" | "보강";
type AttendanceEntry = { status: AttendanceStatus; memo: string };
type Attendance = Record<string, AttendanceEntry>;

const menus: { label: string; items: [string, Page][] }[] = [
  { label: "학생 관리", items: [["학생 목록", "students"], ["신규 학생 등록", "student-new"], ["상담 기록", "consultations"]] },
  { label: "수업 관리", items: [["반 목록", "classes"], ["반 등록", "class-new"], ["수업 일정", "schedule"]] },
  { label: "출결 관리", items: [["출결 입력", "attendance"], ["출결 조회", "attendance-list"]] },
  { label: "수강료 관리", items: [["청구 내역", "billing"], ["정기 청구 설정", "billing-settings"], ["납부 내역", "payments"]] },
  { label: "학원 관리", items: [["학원 정보", "academy"], ["직원 관리", "staff"], ["직원별 권한", "permissions"]] },
];
const labels: Record<Page, string> = {
  dashboard: "대시보드", students: "학생 목록", "student-new": "신규 학생 등록", consultations: "상담 기록",
  classes: "반 목록", "class-new": "반 등록", schedule: "수업 일정", attendance: "출결 입력",
  "attendance-list": "출결 조회", billing: "청구 내역", "billing-settings": "정기 청구 설정",
  payments: "납부·환불 내역", academy: "학원 정보", staff: "직원 관리", permissions: "직원별 권한",
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateLabel = (value: string) => value.replaceAll("-", ".");
const emptyStudent = (): Omit<Student, "id" | "status"> => ({ name: "", birth: "", phone: "", guardian: "", school: "", address: "", enrolled: "", classes: [], memo: "" });
const emptyClass = (): Omit<ClassRoom, "id"> => ({ name: "", subject: "", teacher: "", grade: "", capacity: "", room: "", start: "", end: "", memo: "" });
const subscribeDate = (callback: () => void) => {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
};

function Logo() {
  return <div className="brand"><span className="brand-mark"><span /></span><span>euclion<span className="brand-dot">.</span></span></div>;
}
function Button({ children, onClick, variant = "primary", type = "button", disabled = false }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "outline" | "ghost"; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`button button-${variant}`}>{children}</button>;
}
function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty"><span className="empty-icon"><Sparkles size={20} /></span><h3>{title}</h3><p>{text}</p></div>;
}
function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="field"><span>{label}{required && <i> *</i>}</span>{children}</label>;
}

export default function Home() {
  return <AuthGate>{(academy, user) => <Dashboard academy={academy} user={user} />}</AuthGate>;
}

type StudentApi = {
  id: string;
  name: string;
  birth_date: string | null;
  phone: string | null;
  guardian_phone: string | null;
  school: string | null;
  address: string | null;
  enrolled_on: string;
  status: "active" | "withdrawn";
  memo: string | null;
  classIds: string[];
};

type ClassApi = {
  id: string;
  name: string;
  subject: string | null;
  teacher: string | null;
  grade: string | null;
  capacity: number | null;
  room: string | null;
  starts_on: string | null;
  ends_on: string | null;
  memo: string | null;
  student_count: number;
};

type AttendanceApi = {
  studentId: string;
  status: "present" | "absent" | "late" | "left_early" | "makeup" | null;
  memo: string | null;
};
type BillingCharge = {
  id: string;
  student_id: string;
  student_name: string;
  billing_period: string;
  amount: number;
  due_date: string;
  status: "unpaid" | "paid";
  paid_at: number | null;
  memo: string | null;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(result.error?.message ?? "요청을 완료하지 못했습니다.");
  }
  return result;
}

function toStudent(row: StudentApi): Student {
  return {
    id: row.id,
    name: row.name,
    birth: row.birth_date ?? "",
    phone: row.phone ?? "",
    guardian: row.guardian_phone ?? "",
    school: row.school ?? "",
    address: row.address ?? "",
    enrolled: row.enrolled_on,
    classes: row.classIds,
    memo: row.memo ?? "",
    status: row.status === "active" ? "재원" : "퇴원",
  };
}

function toClassroom(row: ClassApi): ClassRoom {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject ?? "",
    teacher: row.teacher ?? "",
    grade: row.grade ?? "",
    capacity: row.capacity?.toString() ?? "",
    room: row.room ?? "",
    start: row.starts_on ?? "",
    end: row.ends_on ?? "",
    memo: row.memo ?? "",
  };
}

const attendanceStatuses: Record<AttendanceStatus, AttendanceApi["status"]> = {
  출석: "present",
  결석: "absent",
  지각: "late",
  조퇴: "left_early",
  보강: "makeup",
};

const attendanceLabels: Record<NonNullable<AttendanceApi["status"]>, AttendanceStatus> = {
  present: "출석",
  absent: "결석",
  late: "지각",
  left_early: "조퇴",
  makeup: "보강",
};

function Dashboard({ academy, user }: {
  academy: { id: string; name: string; role: string };
  user: { name: string; email: string };
}) {
  const currentDate = useSyncExternalStore(subscribeDate, today, () => "");
  const [page, setPage] = useState<Page>("dashboard");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [attendance, setAttendance] = useState<Attendance>({});
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [classForm, setClassForm] = useState(emptyClass);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체 상태");
  const [classFilter, setClassFilter] = useState("전체 반");
  const [attendanceDate, setAttendanceDate] = useState("");
  const [attendanceClass, setAttendanceClass] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState("");
  const [billingCharges, setBillingCharges] = useState<BillingCharge[]>([]);
  const [billingFormOpen, setBillingFormOpen] = useState(false);
  const [billingForm, setBillingForm] = useState({
    studentId: "",
    amount: "",
    dueDate: "",
    memo: "",
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const selectedDate = attendanceDate || currentDate;
  const canManageBilling = ["owner", "admin"].includes(academy.role);
  const billingQueryPeriod = page === "dashboard"
    ? currentDate.slice(0, 7)
    : billingPeriod || currentDate.slice(0, 7);

  const reloadData = useCallback(async () => {
    try {
      const [studentRows, classRows] = await Promise.all([
        requestJson<StudentApi[]>("/api/students"),
        requestJson<ClassApi[]>("/api/classes"),
      ]);
      setStudents(studentRows.map(toStudent));
      setClasses(classRows.map(toClassroom));
      setAttendanceClass((current) => current || classRows[0]?.id || "");
      setDataError("");
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : "학원 정보를 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reloadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reloadData]);

  useEffect(() => {
    if (!selectedDate || !attendanceClass) {
      return;
    }

    let active = true;
    requestJson<AttendanceApi[]>(
      `/api/attendance?date=${encodeURIComponent(selectedDate)}&classId=${encodeURIComponent(attendanceClass)}`,
    ).then((entries) => {
      if (!active) return;
      const next: Attendance = {};
      for (const entry of entries) {
        if (entry.status) {
          next[`${selectedDate}|${attendanceClass}|${entry.studentId}`] = {
            status: attendanceLabels[entry.status],
            memo: entry.memo ?? "",
          };
        }
      }
      setAttendance(next);
      setDataError("");
    }).catch((caught: unknown) => {
      if (active) setDataError(caught instanceof Error ? caught.message : "출결 정보를 불러오지 못했습니다.");
    });

    return () => { active = false; };
  }, [selectedDate, attendanceClass]);

  useEffect(() => {
    if (!billingQueryPeriod) return;

    let active = true;
    requestJson<BillingCharge[]>(
      `/api/billing?period=${encodeURIComponent(billingQueryPeriod)}`,
    ).then((charges) => {
      if (active) {
        setBillingCharges(charges);
        setDataError("");
      }
    }).catch((caught: unknown) => {
      if (active) {
        setDataError(caught instanceof Error ? caught.message : "수강료 내역을 불러오지 못했습니다.");
      }
    });

    return () => { active = false; };
  }, [billingQueryPeriod]);

  const go = (next: Page) => { setPage(next); setSelectedStudent(null); setMobileOpen(false); setNoticeOpen(false); setError(""); setMessage(""); };
  const startNewStudent = () => { setStudentForm({ ...emptyStudent(), enrolled: today() }); setEditing(null); go("student-new"); };
  const classNames = (ids: string[]) => ids.map((id) => classes.find((item) => item.id === id)?.name).filter(Boolean).join(", ");
  const activeStudents = students.filter((s) => s.status === "재원");
  const shownStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      const text = [s.name, s.phone, s.guardian, s.school, s.enrolled, ...s.classes.map((id) => classes.find((c) => c.id === id)?.name ?? "")].join(" ").toLowerCase();
      return (!term || text.includes(term)) && (statusFilter === "전체 상태" || s.status === statusFilter) && (classFilter === "전체 반" || s.classes.includes(classFilter));
    });
  }, [students, classes, search, statusFilter, classFilter]);
  const todayEntries = Object.entries(attendance).filter(([key]) => key.startsWith(`${selectedDate}|`));
  const selected = students.find((s) => s.id === selectedStudent);

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentForm.classes.length) { setError("수강 반을 하나 이상 선택해 주세요."); return; }
    if (students.some((s) => s.id !== editing && s.name.trim() === studentForm.name.trim() && s.birth === studentForm.birth)) {
      if (!window.confirm("이름과 생년월일이 같은 학생이 있습니다. 그래도 저장하시겠습니까?")) return;
    }
    setError("");
    try {
      const body = {
        name: studentForm.name,
        birthDate: studentForm.birth,
        phone: studentForm.phone,
        guardianPhone: studentForm.guardian,
        school: studentForm.school,
        address: studentForm.address,
        enrolledOn: studentForm.enrolled,
        status: students.find((student) => student.id === editing)?.status === "퇴원" ? "withdrawn" : "active",
        memo: studentForm.memo,
        classIds: studentForm.classes,
      };
      const saved = await requestJson<{ id: string }>(
        editing ? `/api/students/${encodeURIComponent(editing)}` : "/api/students",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      await reloadData();
      setEditing(null); setSelectedStudent(saved.id); setPage("students"); setMessage("학생 정보를 저장했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "학생 정보를 저장하지 못했습니다.");
    }
  }
  function editStudent(student: Student) {
    const { id, status: _status, ...form } = student;
    void _status;
    setStudentForm(form); setEditing(id); setPage("student-new"); setSelectedStudent(null); setMessage("");
  }
  async function saveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classForm.name.trim()) { setError("반 이름을 입력해 주세요."); return; }
    setError("");
    try {
      await requestJson<{ id: string }>("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: classForm.name,
          subject: classForm.subject,
          teacher: classForm.teacher,
          grade: classForm.grade,
          capacity: classForm.capacity ? Number(classForm.capacity) : null,
          room: classForm.room,
          startsOn: classForm.start || null,
          endsOn: classForm.end || null,
          memo: classForm.memo,
        }),
      });
      await reloadData();
      setClassForm(emptyClass()); go("classes"); setMessage("반을 등록했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "반을 등록하지 못했습니다.");
    }
  }
  const attendanceKey = (studentId: string) => `${selectedDate}|${attendanceClass}|${studentId}`;
  const updateAttendance = (studentId: string, patch: Partial<AttendanceEntry>) => {
    setAttendance((current) => {
      const key = attendanceKey(studentId);
      const existing = current[key];
      if (!existing && !patch.status) return current;
      return { ...current, [key]: { status: patch.status ?? existing?.status ?? "출석", memo: patch.memo ?? existing?.memo ?? "" } };
    });
  };
  async function saveAttendance() {
    if (!attendanceClass || !selectedDate) {
      setError("날짜와 반을 먼저 선택해 주세요.");
      return;
    }
    setSavingAttendance(true);
    setError("");
    try {
      const entries = students
        .filter((student) => student.status === "재원" && student.classes.includes(attendanceClass))
        .flatMap((student) => {
          const entry = attendance[attendanceKey(student.id)];
          return entry
            ? [{ studentId: student.id, status: attendanceStatuses[entry.status], memo: entry.memo }]
            : [];
        });
      await requestJson<{ saved: number }>("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: attendanceClass, date: selectedDate, entries }),
      });
      setMessage(`${entries.length}명의 출결을 저장했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "출결을 저장하지 못했습니다.");
    } finally {
      setSavingAttendance(false);
    }
  }
  function startBilling() {
    setBillingForm({
      studentId: activeStudents[0]?.id ?? "",
      amount: "",
      dueDate: billingQueryPeriod ? `${billingQueryPeriod}-10` : "",
      memo: "",
    });
    setBillingFormOpen(true);
    setError("");
    setMessage("");
  }
  async function saveBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBilling(true);
    setError("");
    setMessage("");
    try {
      await requestJson<{ created: boolean }>("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: billingForm.studentId,
          billingPeriod: billingQueryPeriod,
          amount: Number(billingForm.amount),
          dueDate: billingForm.dueDate,
          memo: billingForm.memo,
        }),
      });
      setBillingFormOpen(false);
      setMessage("청구 내역을 등록했습니다.");
      const charges = await requestJson<BillingCharge[]>(
        `/api/billing?period=${encodeURIComponent(billingQueryPeriod)}`,
      );
      setBillingCharges(charges);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "청구 내역을 등록하지 못했습니다.");
    } finally {
      setSavingBilling(false);
    }
  }
  async function updateBillingStatus(charge: BillingCharge) {
    setError("");
    setMessage("");
    try {
      await requestJson<{ updated: boolean }>("/api/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargeId: charge.id,
          status: charge.status === "paid" ? "unpaid" : "paid",
        }),
      });
      const charges = await requestJson<BillingCharge[]>(
        `/api/billing?period=${encodeURIComponent(billingQueryPeriod)}`,
      );
      setBillingCharges(charges);
      setMessage(charge.status === "paid" ? "미납 상태로 변경했습니다." : "납부 완료로 기록했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "납부 상태를 변경하지 못했습니다.");
    }
  }
  return <div className="app">
    <div className="demo-bar"><CircleAlert size={15} /> <span><strong>보안 연결됨</strong> · 로그인한 학원 구성원에게만 데이터가 표시됩니다.</span></div>
    <header className="header"><div className="header-inner">
      <button className="logo-button" onClick={() => go("dashboard")} aria-label="Euclion 대시보드"><Logo /></button>
      <nav className={`nav ${mobileOpen ? "nav-open" : ""}`} aria-label="주 메뉴">
        <button className={`nav-home ${page === "dashboard" ? "nav-active" : ""}`} onClick={() => go("dashboard")}>홈</button>
        {menus.map((menu) => <div className="nav-group" key={menu.label}>
          <button className={`nav-trigger ${menu.items.some(([, target]) => target === page) ? "nav-active" : ""}`}>{menu.label}<ChevronDown size={13} /></button>
          <div className="dropdown">{menu.items.map(([label, target]) => <button key={target} onClick={() => target === "student-new" ? startNewStudent() : go(target)}>{label}<ChevronRight size={14} /></button>)}</div>
        </div>)}
        <button className="mobile-signout" onClick={() => void authClient.signOut()}>로그아웃 · {user.email}</button>
      </nav>
      <div className="header-actions">
        <div className="notice-wrap"><button className="icon-button notification-button" aria-label="알림" aria-expanded={noticeOpen} onClick={() => setNoticeOpen(!noticeOpen)}><Bell size={19} /><span /></button>
          {noticeOpen && <div className="notice-popover"><div className="popover-head"><strong>알림</strong><span>준비 중</span></div><p>알림 기능은 아직 연결되지 않았습니다.</p><small>출결, 미납, 초대 등 알림 기능을 준비 중입니다.</small></div>}
        </div>
        <div className="header-divider" /><div className="account"><div className="avatar">{user.name.slice(0, 1)}</div><div><strong>{user.name}</strong><span>{academy.name}</span></div><button className="auth-text-button" onClick={() => void authClient.signOut()}>로그아웃</button></div>
        <button className="mobile-toggle icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={mobileOpen}>{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div></header>

    <main className="main">
      {dataError && <p className="error-message" role="alert">{dataError}</p>}
      {page === "dashboard" && <>
        <div className="dashboard-welcome"><div><div className="eyebrow"><span className="eyebrow-dot" /> EUCLION WORKSPACE</div><h1>안녕하세요, {user.name}님 <span>✳</span></h1><p>{academy.name}의 하루를 편리하게 관리해 보세요.</p></div><div className="date-chip"><CalendarDays size={16} /> 오늘 <span>{currentDate ? dateLabel(currentDate) : "—"}</span></div></div>
        <div className="section-title"><div><h2>한눈에 보는 우리 학원</h2><p>학원의 주요 현황을 확인해 보세요.</p></div><span className="sample-label">실시간 데이터</span></div>
        <div className="stats">
          <button className="stat-card" onClick={() => go("students")}><div className="stat-top"><span className="stat-icon mint"><UsersRound size={20} /></span><ArrowRight size={17} /></div><div className="stat-label">재원 학생</div><div className="stat-number">{activeStudents.length}<small>명</small></div><div className="stat-foot"><span className="green-dot" /> 현재 재원 중인 학생</div></button>
          <button className="stat-card" onClick={() => go("attendance")}><div className="stat-top"><span className="stat-icon blue"><ClipboardCheck size={20} /></span><ArrowRight size={17} /></div><div className="stat-label">오늘의 출결</div><div className="stat-number">{Object.entries(attendance).filter(([key]) => key.startsWith(`${currentDate}|`)).length}<small>건 입력</small></div><div className="stat-foot"><span className="blue-dot" /> 저장된 출결 기록</div></button>
          <button className="stat-card" onClick={() => go("billing")}><div className="stat-top"><span className="stat-icon peach"><WalletCards size={20} /></span><ArrowRight size={17} /></div><div className="stat-label">이번 달 미납 수강료</div><div className="stat-number pending-number">{billingCharges.filter((charge) => charge.status === "unpaid").reduce((total, charge) => total + charge.amount, 0).toLocaleString("ko-KR")}<small>원</small></div><div className="stat-foot">{billingCharges.filter((charge) => charge.status === "unpaid").length}건 미납</div></button>
        </div>
        <div className="dashboard-grid"><section className="panel quick-panel"><div className="panel-heading"><div><h2>빠른 실행</h2><p>자주 사용하는 업무를 바로 시작하세요.</p></div><span className="panel-icon"><Sparkles size={17} /></span></div>
          <div className="quick-grid">
            {[{ icon: <Plus size={19} />, title: "학생 등록", desc: "새로운 학생 추가", action: startNewStudent, tone: "mint" }, { icon: <ClipboardCheck size={19} />, title: "출결 입력", desc: "오늘의 출결 기록", action: () => go("attendance"), tone: "blue" }, { icon: <BookOpen size={19} />, title: "반 관리", desc: "운영 중인 반 확인", action: () => go("classes"), tone: "purple" }, { icon: <MessageSquareText size={19} />, title: "상담 기록", desc: "학생 상담 내역", action: () => go("consultations"), tone: "peach" }].map((item) => <button className="quick-item" onClick={item.action} key={item.title}><span className={`quick-icon ${item.tone}`}>{item.icon}</span><span><strong>{item.title}</strong><small>{item.desc}</small></span><ChevronRight size={16} /></button>)}
          </div></section>
          <section className="panel"><div className="panel-heading"><div><h2>알림과 할 일</h2><p>놓치지 않도록 한곳에서 확인해요.</p></div><Bell size={18} className="muted-icon" /></div><div className="dashboard-empty"><span><Check size={22} /></span><strong>아직 표시할 알림이 없어요</strong><p>실제 알림 기능은 준비 중입니다.</p></div></section>
        </div>
        <section className="panel recent-panel"><div className="panel-heading"><div><h2>학생 현황</h2><p>등록된 학생 목록을 확인해 보세요.</p></div><button className="text-link" onClick={() => go("students")}>전체 보기 <ArrowRight size={15} /></button></div><StudentTable students={students.slice(0, 4)} classNames={classNames} select={(id) => { setPage("students"); setSelectedStudent(id); }} /></section>
      </>}

      {page === "students" && selected && <><button className="back-link" onClick={() => setSelectedStudent(null)}><ArrowLeft size={16} /> 학생 목록으로</button><PageHeading eyebrow="STUDENT MANAGEMENT" title={selected.name} description={`${selected.status} · 등록일 ${dateLabel(selected.enrolled)}`} action={<Button variant="outline" onClick={() => editStudent(selected)}>정보 수정</Button>} />{message && <div className="success-message">{message}</div>}<div className="panel detail-panel"><h2>학생 기본 정보</h2><div className="detail-grid">{[["이름", selected.name], ["생년월일", selected.birth], ["학생 연락처", selected.phone], ["보호자 연락처", selected.guardian], ["학교·학년", selected.school], ["주소", selected.address], ["등록일", selected.enrolled], ["수강 반", classNames(selected.classes) || "없음"], ["메모", selected.memo]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div><div className="detail-note"><CircleAlert size={17} /> 퇴원·재등록 및 연결된 상담·수강료 이력은 아직 구현되지 않았습니다.</div></>}
      {page === "students" && !selected && <><PageHeading eyebrow="STUDENT MANAGEMENT" title="학생 관리" description="학생 정보를 한곳에서 관리해 보세요." action={<Button onClick={startNewStudent}><Plus size={17} /> 신규 학생 등록</Button>} />{message && <div className="success-message">{message}</div>}<section className="panel list-panel"><div className="list-heading"><div><h2>전체 학생 <span>{shownStudents.length}</span></h2><p>학생을 선택하면 상세 정보를 볼 수 있습니다.</p></div></div><div className="filters"><label className="search-field"><Search size={17} /><input placeholder="이름, 연락처, 학교, 등록일 검색" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="학생 검색" /></label><select aria-label="재원 상태" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>전체 상태</option><option>재원</option><option>퇴원</option></select><select aria-label="수강 반" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}><option>전체 반</option>{classes.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div><StudentTable students={shownStudents} classNames={classNames} select={(id) => setSelectedStudent(id)} /></section></>}

      {page === "student-new" && <><button className="back-link" onClick={() => go("students")}><ArrowLeft size={16} /> 학생 목록으로</button><PageHeading eyebrow="STUDENT MANAGEMENT" title={editing ? "학생 정보 수정" : "신규 학생 등록"} description="학생의 기본 정보와 수강 정보를 입력해 주세요." /><form onSubmit={saveStudent} className="panel form-panel"><div className="form-section-title"><div><h2>학생 정보</h2><p>입력한 정보는 현재 학원에 안전하게 저장됩니다.</p></div><span className="required-note">* 필수 입력</span></div><div className="form-grid">
        <Field label="학생 이름" required><input required value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} placeholder="이름을 입력해 주세요" /></Field>
        <Field label="생년월일" required><input required type="date" value={studentForm.birth} onChange={(e) => setStudentForm({ ...studentForm, birth: e.target.value })} /></Field>
        <Field label="학생 연락처" required><input required type="tel" value={studentForm.phone} onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} placeholder="010-0000-0000" /></Field>
        <Field label="보호자 연락처" required><input required type="tel" value={studentForm.guardian} onChange={(e) => setStudentForm({ ...studentForm, guardian: e.target.value })} placeholder="010-0000-0000" /></Field>
        <Field label="학교·학년" required><input required value={studentForm.school} onChange={(e) => setStudentForm({ ...studentForm, school: e.target.value })} placeholder="학교와 학년을 입력해 주세요" /></Field>
        <Field label="등록일" required><input required type="date" value={studentForm.enrolled} onChange={(e) => setStudentForm({ ...studentForm, enrolled: e.target.value })} /></Field>
        <Field label="주소" required><input required value={studentForm.address} onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })} placeholder="주소를 입력해 주세요" /></Field>
        <Field label="메모" required><input required value={studentForm.memo} onChange={(e) => setStudentForm({ ...studentForm, memo: e.target.value })} placeholder="메모를 입력해 주세요" /></Field>
        </div><fieldset className="class-selector"><legend>수강 반 <i>*</i></legend><p>하나 이상의 반을 선택해 주세요.</p><div>{classes.map((c) => <label key={c.id}><input type="checkbox" checked={studentForm.classes.includes(c.id)} onChange={(e) => setStudentForm({ ...studentForm, classes: e.target.checked ? [...studentForm.classes, c.id] : studentForm.classes.filter((id) => id !== c.id) })} />{c.name}</label>)}</div></fieldset>{error && <p className="error-message" role="alert">{error}</p>}<div className="form-actions"><Button variant="outline" onClick={() => go("students")}>취소</Button><Button type="submit">{editing ? "변경 사항 저장" : "학생 등록하기"} <ArrowRight size={16} /></Button></div></form></>}

      {page === "classes" && <><PageHeading eyebrow="CLASS MANAGEMENT" title="반 관리" description="학원에서 운영하는 반을 확인해 보세요." action={<Button onClick={() => { setClassForm(emptyClass()); go("class-new"); }}><Plus size={17} /> 반 등록</Button>} />{message && <div className="success-message">{message}</div>}<div className="class-grid">{classes.map((c) => <article className="panel class-card" key={c.id}><div className="class-card-top"><span className="class-subject">{c.subject || "분야 미지정"}</span><BookOpen size={18} /></div><h2>{c.name}</h2><p>{c.grade || "대상 미지정"} · {c.room || "강의실 미지정"}</p><div className="class-meta"><span><UsersRound size={15} /> {activeStudents.filter((s) => s.classes.includes(c.id)).length}명{c.capacity && ` / ${c.capacity}명`}</span><span>{c.teacher || "담당자 미지정"}</span></div></article>)}</div></>}
      {page === "class-new" && <><button className="back-link" onClick={() => go("classes")}><ArrowLeft size={16} /> 반 목록으로</button><PageHeading eyebrow="CLASS MANAGEMENT" title="반 등록" description="새로운 반의 정보를 입력해 주세요." /><form onSubmit={saveClass} className="panel form-panel"><div className="form-section-title"><div><h2>반 정보</h2><p>반 정보는 현재 학원에 안전하게 저장됩니다.</p></div></div><div className="form-grid">{([{ key: "name", label: "반 이름" }, { key: "subject", label: "과목·분야" }, { key: "teacher", label: "담당 직원" }, { key: "grade", label: "대상 학년" }, { key: "capacity", label: "정원", type: "number" }, { key: "room", label: "강의실" }, { key: "start", label: "운영 시작일", type: "date" }, { key: "end", label: "운영 종료일", type: "date" }, { key: "memo", label: "메모" }] as const).map((field) => <Field label={field.label} key={field.key}><input type={"type" in field ? field.type : "text"} min={field.key === "capacity" ? "1" : undefined} value={classForm[field.key]} onChange={(e) => setClassForm({ ...classForm, [field.key]: e.target.value })} /></Field>)}</div>{error && <p className="error-message" role="alert">{error}</p>}<div className="form-actions"><Button variant="outline" onClick={() => go("classes")}>취소</Button><Button type="submit">반 등록하기 <ArrowRight size={16} /></Button></div></form></>}

      {(page === "attendance" || page === "attendance-list") && <><PageHeading eyebrow="ATTENDANCE" title={labels[page]} description="날짜와 반을 선택해 학생별 출결을 확인하세요." action={page === "attendance" ? <Button onClick={saveAttendance} disabled={savingAttendance || !attendanceClass}>{savingAttendance ? "저장 중..." : "출결 저장"} <Check size={16} /></Button> : undefined} /><section className="panel list-panel">{message && <div className="success-message">{message}</div>}{error && <p className="error-message" role="alert">{error}</p>}<div className="attendance-controls"><Field label="날짜"><input type="date" value={selectedDate} onChange={(e) => setAttendanceDate(e.target.value)} /></Field><Field label="반 선택"><select value={attendanceClass} onChange={(e) => setAttendanceClass(e.target.value)}><option value="" disabled>반 선택</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><div className="list-heading"><div><h2>출결 현황</h2><p>선택한 날짜와 반의 출결 기록은 안전하게 저장됩니다.</p></div><span className="sample-label">{todayEntries.filter(([key]) => key.split("|")[1] === attendanceClass).length}건 입력</span></div><div className="attendance-list">{students.filter((s) => s.status === "재원" && s.classes.includes(attendanceClass)).map((s) => { const entry = attendance[attendanceKey(s.id)]; return <div className="attendance-row" key={s.id}><div className="person-cell"><span className="person-avatar">{s.name.slice(0, 1)}</span><div><strong>{s.name}</strong><small>{s.school}</small></div></div>{page === "attendance" ? <><select aria-label={`${s.name} 출결 상태`} value={entry?.status ?? ""} onChange={(e) => updateAttendance(s.id, { status: e.target.value as AttendanceStatus })}><option value="" disabled>미입력</option>{(["출석", "결석", "지각", "조퇴", "보강"] as const).map((status) => <option key={status}>{status}</option>)}</select><input aria-label={`${s.name} 출결 메모`} placeholder={entry ? "메모 (선택)" : "상태를 먼저 선택해 주세요"} disabled={!entry} value={entry?.memo ?? ""} onChange={(e) => updateAttendance(s.id, { memo: e.target.value })} /></> : <><span className="status-pill">{entry?.status ?? "미입력"}</span><span className="attendance-memo">{entry?.memo || "—"}</span></>}</div>})}{!students.some((s) => s.status === "재원" && s.classes.includes(attendanceClass)) && <Empty title="표시할 학생이 없어요" text="선택한 반에 재원 중인 학생이 없습니다." />}</div></section></>}

      {(page === "billing" || page === "payments") && <>
        <PageHeading eyebrow="TUITION MANAGEMENT" title={labels[page]} description={page === "billing" ? "월별 청구 내역을 등록하고 납부 현황을 관리하세요." : "납부 완료로 기록한 수강료를 확인하세요."} action={page === "billing" && canManageBilling ? <Button onClick={startBilling} disabled={!activeStudents.length}><Plus size={17} /> 청구 등록</Button> : undefined} />
        {message && <div className="success-message">{message}</div>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!canManageBilling && <div className="placeholder-info billing-permission-note"><CircleAlert size={17} /><span>청구 등록과 납부 상태 변경은 학원 관리자만 할 수 있습니다.</span></div>}
        <section className="billing-summary">
          {[{ label: "청구 합계", value: billingCharges.reduce((total, charge) => total + charge.amount, 0) }, { label: "납부 완료", value: billingCharges.filter((charge) => charge.status === "paid").reduce((total, charge) => total + charge.amount, 0) }, { label: "미납", value: billingCharges.filter((charge) => charge.status === "unpaid").reduce((total, charge) => total + charge.amount, 0) }].map((item) => <div className="panel billing-summary-card" key={item.label}><span>{item.label}</span><strong>{item.value.toLocaleString("ko-KR")}<small>원</small></strong></div>)}
        </section>
        <section className="panel list-panel">
          <div className="billing-toolbar">
            <div><h2>{billingQueryPeriod.replace("-", "년 ")}월 수강료</h2><p>결제 처리는 하지 않으며, 수납 상태를 수기로 기록합니다.</p></div>
            <Field label="청구 월"><input type="month" value={billingQueryPeriod} onChange={(event) => { setBillingPeriod(event.target.value); if (billingFormOpen) setBillingForm((current) => ({ ...current, dueDate: `${event.target.value}-10` })); }} /></Field>
          </div>
          {billingFormOpen && <form className="billing-form" onSubmit={saveBilling}>
            <div className="form-grid">
              <Field label="학생" required><select required value={billingForm.studentId} onChange={(event) => setBillingForm({ ...billingForm, studentId: event.target.value })}><option value="" disabled>학생 선택</option>{activeStudents.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select></Field>
              <Field label="청구 금액 (원)" required><input required type="number" min="1" max="1000000000" step="1" value={billingForm.amount} onChange={(event) => setBillingForm({ ...billingForm, amount: event.target.value })} placeholder="예: 300000" /></Field>
              <Field label="납부 기한" required><input required type="date" value={billingForm.dueDate} onChange={(event) => setBillingForm({ ...billingForm, dueDate: event.target.value })} /></Field>
              <Field label="메모"><input maxLength={1000} value={billingForm.memo} onChange={(event) => setBillingForm({ ...billingForm, memo: event.target.value })} placeholder="선택 입력" /></Field>
            </div>
            <div className="form-actions"><Button type="button" variant="outline" onClick={() => setBillingFormOpen(false)}>취소</Button><Button type="submit" disabled={savingBilling}>{savingBilling ? "저장 중..." : "청구 등록"} <ArrowRight size={16} /></Button></div>
          </form>}
          {page === "billing" && !activeStudents.length && <Empty title="재원 학생이 없습니다" text="청구 내역을 만들려면 먼저 학생을 등록해 주세요." />}
          {(() => {
            const visibleCharges = page === "payments"
              ? billingCharges.filter((charge) => charge.status === "paid")
              : billingCharges;
            if (!visibleCharges.length) {
              return <Empty title={page === "payments" ? "납부 완료 내역이 없습니다" : "이번 달 청구가 없습니다"} text={page === "payments" ? "납부 완료로 기록한 내역이 여기에 표시됩니다." : "청구 등록 버튼으로 학생별 수강료를 추가해 보세요."} />;
            }
            return <div className="table-wrap"><table><thead><tr><th>학생</th><th>청구 월</th><th>청구 금액</th><th>납부 기한</th><th>상태</th><th>납부일</th>{canManageBilling && <th>관리</th>}</tr></thead><tbody>{visibleCharges.map((charge) => <tr key={charge.id}><td><strong>{charge.student_name}</strong>{charge.memo && <small className="billing-memo">{charge.memo}</small>}</td><td>{charge.billing_period}</td><td>{charge.amount.toLocaleString("ko-KR")}원</td><td>{dateLabel(charge.due_date)}</td><td><span className={`status-pill ${charge.status === "paid" ? "active" : ""}`}>{charge.status === "paid" ? "납부 완료" : "미납"}</span></td><td>{charge.paid_at ? dateLabel(new Date(charge.paid_at).toISOString().slice(0, 10)) : "—"}</td>{canManageBilling && <td><button className="billing-status-button" onClick={() => void updateBillingStatus(charge)}>{charge.status === "paid" ? "미납으로 변경" : "납부 처리"}</button></td>}</tr>)}</tbody></table></div>;
          })()}
        </section>
      </>}
      {page === "billing-settings" && <><PageHeading eyebrow="TUITION MANAGEMENT" title={labels[page]} description="자동 청구 설정은 아직 지원하지 않습니다." /><section className="panel placeholder-panel"><Empty title="정기 청구 설정은 준비 중이에요" text="현재는 청구 내역에서 학생별 월 수강료를 직접 등록하고 납부 상태를 관리할 수 있습니다." /></section></>}
      {(["consultations", "schedule", "academy", "staff", "permissions"] as Page[]).includes(page) && <><PageHeading eyebrow={page === "consultations" ? "STUDENT MANAGEMENT" : page === "schedule" ? "CLASS MANAGEMENT" : "ACADEMY SETTINGS"} title={labels[page]} description="논의한 기능을 차근차근 연결하고 있습니다." /><section className="panel placeholder-panel"><Empty title={`${labels[page]} 기능을 준비하고 있어요`} text="이 화면은 메뉴 구성 확인을 위한 자리입니다. 실제 데이터 저장이나 업무 처리는 아직 지원하지 않습니다." /><div className="placeholder-info"><CircleAlert size={17} /><span>{page === "schedule" ? "수업 일정과 휴강 처리 방식은 아직 정해지지 않았습니다." : ["staff", "permissions", "academy"].includes(page) ? "계정, 학원별 데이터 분리, 직원 권한은 아직 연결되지 않았습니다." : "기능을 준비하고 있습니다."}</span></div></section></>}
      <footer className="footer"><Logo /><span>학원 관리의 시작, 유클리온과 함께.</span><small>로그인 후 학원 데이터 관리</small></footer>
    </main>
  </div>;
}

function StudentTable({ students, classNames, select }: { students: Student[]; classNames: (ids: string[]) => string; select: (id: string) => void }) {
  if (!students.length) return <Empty title="학생이 없습니다" text="검색 조건을 변경하거나 새로운 학생을 등록해 보세요." />;
  return <div className="table-wrap"><table><thead><tr><th>학생</th><th>학교·학년</th><th>수강 반</th><th>등록일</th><th>상태</th><th><span className="sr-only">상세</span></th></tr></thead><tbody>{students.map((s) => <tr key={s.id}><td><button className="table-person" onClick={() => select(s.id)}><span className="person-avatar">{s.name.slice(0, 1)}</span><span><strong>{s.name}</strong><small>{s.phone}</small></span></button></td><td>{s.school}</td><td>{classNames(s.classes) || "—"}</td><td>{dateLabel(s.enrolled)}</td><td><span className={`status-pill ${s.status === "재원" ? "active" : ""}`}>{s.status}</span></td><td><button className="table-arrow" onClick={() => select(s.id)} aria-label={`${s.name} 상세 보기`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div>;
}
