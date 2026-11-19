"use client";

import {
  ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleAlert, ClipboardCheck,
  Fingerprint, Menu, MessageSquareText, Plus, Search, Sparkles, Trash2,
  UsersRound, WalletCards, X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { AuthGate } from "../auth-gate";
import { authClient } from "@/lib/auth-client";
import { DEFAULT_GUARDIAN_REMINDER } from "@/lib/guardian-reminder";
import { StaffManagement } from "../staff-management";

type Page = "dashboard" | "students" | "withdrawn-students" | "student-new" | "consultations" | "classes" | "class-new" | "schedule" | "attendance" | "attendance-list" | "seats" | "billing" | "billing-settings" | "payments" | "academy" | "staff" | "permissions";
type Student = {
  id: string; name: string; birth: string; phone: string; guardian: string; gender: "male" | "female" | "";
  school: string; grade: string; graduatedSchool: string; address: string; enrolled: string; classes: string[];
  memo: string; tuitionAdjustment: string; tuitionAdjustmentReason: string;
  status: "재원" | "퇴원"; fingerprintStatus: "not_registered" | "pending_device" | "ready" | "registered";
  classTuition: number; seatTuition: number; monthlyTuition: number;
};
type ClassRoom = { id: string; name: string; subject: string; teacher: string; grade: string[]; capacity: string; monthlyFee: string; room: string; start: string; end: string; memo: string };
type AttendanceStatus = "출석" | "결석" | "지각" | "조퇴" | "보강";
type AttendanceEntry = { status: AttendanceStatus; memo: string };
type Attendance = Record<string, AttendanceEntry>;
type ConsultationRecord = {
  id: string;
  student_id: string;
  student_name: string;
  consultation_date: string;
  category: string;
  summary: string;
  next_action: string | null;
  created_at: number;
};
type AssessmentRecord = {
  id: string;
  student_id: string;
  student_name: string;
  assessment_type: "mock_exam" | "vocabulary";
  assessment_date: string;
  title: string;
  subject: string;
  grade: number | null;
  score: number | null;
  max_score: number | null;
  note: string | null;
};

const menus: { label: string; items: [string, Page][] }[] = [
  { label: "학생 관리", items: [["학생 목록", "students"], ["퇴원 학생", "withdrawn-students"], ["신규 학생 등록", "student-new"], ["상담·학습 관리", "consultations"]] },
  { label: "수업 관리", items: [["반 목록", "classes"], ["반 등록", "class-new"], ["수업 일정", "schedule"]] },
  { label: "수강료 관리", items: [["청구 내역", "billing"], ["정기 청구 설정", "billing-settings"], ["납부 내역", "payments"]] },
  { label: "학원 관리", items: [["학원 정보", "academy"], ["직원 관리", "staff"], ["직원별 권한", "permissions"]] },
];
const labels: Record<Page, string> = {
  dashboard: "대시보드", students: "학생 목록", "withdrawn-students": "퇴원 학생", "student-new": "신규 학생 등록", consultations: "상담·학습 관리",
  classes: "반 목록", "class-new": "반 등록", schedule: "수업 일정", attendance: "출결 입력",
  "attendance-list": "출결 조회", seats: "좌석 배치도", billing: "청구 내역", "billing-settings": "정기 청구 설정",
  payments: "납부·환불 내역", academy: "학원 정보", staff: "직원 관리", permissions: "직원별 권한",
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateLabel = (value: string) => value.replaceAll("-", ".");
const formatNumber = (value: number) => value.toLocaleString("ko-KR");
const emptyStudent = (): Omit<Student, "id" | "status" | "fingerprintStatus" | "classTuition" | "seatTuition" | "monthlyTuition"> => ({ name: "", birth: "", phone: "", guardian: "", gender: "", school: "", grade: "", graduatedSchool: "", address: "", enrolled: "", classes: [], tuitionAdjustment: "0", tuitionAdjustmentReason: "", memo: "" });
const classGrades = ["고1", "고2", "고3", "재수", "삼수", "N수"];
const emptyClass = (): Omit<ClassRoom, "id"> => ({ name: "", subject: "", teacher: "", grade: [], capacity: "", monthlyFee: "0", room: "", start: "", end: "", memo: "" });
const subscribeDate = (callback: () => void) => {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
};

function routePage(pathname: string): Page {
  const [section, detail, action] = pathname.split("/").filter(Boolean);
  if (!section) return "dashboard";
  if (section === "students") {
    if (detail === "new") return "student-new";
    if (detail === "withdrawn") return "withdrawn-students";
    if (action === "edit") return "student-new";
    return "students";
  }
  if (section === "classes" && (detail === "new" || action === "edit")) return "class-new";
  if (section === "attendance" && detail === "history") return "attendance-list";
  if (section === "billing" && detail === "settings") return "billing-settings";
  if ((["consultations", "classes", "schedule", "attendance", "seats", "billing", "payments", "academy", "staff", "permissions"] as string[]).includes(section)) {
    return section as Page;
  }
  return "dashboard";
}

function pagePath(page: Page, studentId: string | null = null, editingId: string | null = null) {
  if (page === "dashboard") return "/";
  if (page === "students" && studentId) return `/students/${encodeURIComponent(studentId)}`;
  if (page === "student-new") {
    return editingId
      ? `/students/${encodeURIComponent(editingId)}/edit`
      : "/students/new";
  }
  if (page === "withdrawn-students") return "/students/withdrawn";
  if (page === "class-new") return "/classes/new";
  if (page === "attendance-list") return "/attendance/history";
  if (page === "billing-settings") return "/billing/settings";
  return `/${page}`;
}

function navigateWithinWorkspace(path: string) {
  if (window.location.pathname !== path || window.location.search || window.location.hash) {
    window.history.pushState(null, "", path);
  }
}

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
  gender: "male" | "female" | null;
  school: string | null;
  grade: string | null;
  graduated_school: string | null;
  address: string | null;
  enrolled_on: string;
  status: "active" | "withdrawn";
  fingerprint_status: "not_registered" | "pending_device" | "ready" | "registered";
  class_tuition: number;
  seat_tuition: number;
  monthly_tuition_adjustment: number;
  tuition_adjustment_reason: string | null;
  monthly_tuition: number;
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
  monthly_fee: number;
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
type SeatOccupancy = {
  id: string;
  room_number: number;
  seat_number: number;
  student_id: string | null;
  student_name: string;
  school: string | null;
  grade: string | null;
  gender: "male" | "female" | null;
  status: "present" | "absent" | "exited";
  entered_at: number;
  total_duration_ms: number;
  monthly_fee: number;
  is_demo: boolean;
};
type SeatPrice = { room_number: number; seat_number: number; monthly_fee: number };

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
    gender: row.gender ?? "",
    school: row.school ?? "",
    grade: row.grade ?? "",
    graduatedSchool: row.graduated_school ?? "",
    address: row.address ?? "",
    enrolled: row.enrolled_on,
    classes: row.classIds,
    memo: row.memo ?? "",
    tuitionAdjustment: row.monthly_tuition_adjustment.toString(),
    tuitionAdjustmentReason: row.tuition_adjustment_reason ?? "",
    status: row.status === "active" ? "재원" : "퇴원",
    fingerprintStatus: row.fingerprint_status,
    classTuition: row.class_tuition,
    seatTuition: row.seat_tuition,
    monthlyTuition: row.monthly_tuition,
  };
}

const seatRooms = Array.from({ length: 8 }, (_, index) => ({
  number: index + 1,
  side: index < 4 ? "좌측 구역" : "우측 구역",
  capacity: index < 4 ? 10 : 6,
}));

function formatDuration(enteredAt: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - enteredAt) / 60_000));
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 ${minutes % 60}분`;
}

function daysUntilDue(dueDate: string, todayDate: string) {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const today = Date.parse(`${todayDate}T00:00:00Z`);
  return Math.round((due - today) / 86_400_000);
}

function toClassroom(row: ClassApi): ClassRoom {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject ?? "",
    teacher: row.teacher ?? "",
    grade: row.grade?.split(",").map((grade) => grade.trim()).filter(Boolean) ?? [],
    capacity: row.capacity?.toString() ?? "",
    monthlyFee: row.monthly_fee.toString(),
    room: row.room ?? "",
    start: row.starts_on ?? "",
    end: row.ends_on ?? "",
    memo: row.memo ?? "",
  };
}

function classDuration(start: string, end: string) {
  if (!start && !end) return "운영기간 미정";
  if (!start || !end) return `${start ? `시작 ${dateLabel(start)}` : `종료 ${dateLabel(end)}`} · 기간 미정`;
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  const weeks = Math.max(1, Math.ceil((endTime - startTime + 1) / (7 * 86_400_000)));
  return `${dateLabel(start)} ~ ${dateLabel(end)} · ${weeks}주`;
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
const seatStatusLabels: Record<SeatOccupancy["status"], string> = {
  present: "출석",
  absent: "결석",
  exited: "퇴실",
};

function Dashboard({ academy, user }: {
  academy: { id: string; name: string; role: string };
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const currentDate = useSyncExternalStore(subscribeDate, today, () => "");
  const page = routePage(pathname);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [attendance, setAttendance] = useState<Attendance>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [classEditing, setClassEditing] = useState<string | null>(null);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [fingerprintRequested, setFingerprintRequested] = useState(false);
  const [savingFingerprint, setSavingFingerprint] = useState(false);
  const [classForm, setClassForm] = useState(emptyClass);
  const [search, setSearch] = useState("");
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
  const [seatOccupancies, setSeatOccupancies] = useState<SeatOccupancy[]>([]);
  const [seatPrices, setSeatPrices] = useState<Record<string, number>>({});
  const [dashboardTasks, setDashboardTasks] = useState<{ period: string; charges: BillingCharge[]; unseatedCount: number } | null>(null);
  const [selectedUnseatedStudentId, setSelectedUnseatedStudentId] = useState<string | null>(null);
  const [pricingSeat, setPricingSeat] = useState<{ roomNumber: number; seatNumber: number } | null>(null);
  const [seatPriceForm, setSeatPriceForm] = useState("0");
  const [seatClock, setSeatClock] = useState(() => Date.now());
  const [savingSeat, setSavingSeat] = useState(false);
  const [savingSeatPrice, setSavingSeatPrice] = useState(false);
  const [savingDemo, setSavingDemo] = useState(false);
  const [movingSeatStudentId, setMovingSeatStudentId] = useState<string | null>(null);
  const [learningStudentId, setLearningStudentId] = useState("");
  const [learningTab, setLearningTab] = useState<"consultations" | "mock_exam" | "vocabulary">("consultations");
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [consultationForm, setConsultationForm] = useState({
    date: today(), category: "학습", summary: "", nextAction: "",
  });
  const [mockExamForm, setMockExamForm] = useState({
    date: today(), title: "", subject: "국어", grade: "3", score: "",
  });
  const [vocabularyForm, setVocabularyForm] = useState({
    date: today(), title: "영단어 시험", score: "", maxScore: "",
  });
  const [savingLearningRecord, setSavingLearningRecord] = useState(false);
  const [guardianReminder, setGuardianReminder] = useState(DEFAULT_GUARDIAN_REMINDER);
  const [savingGuardianReminder, setSavingGuardianReminder] = useState(false);
  const [reminderPreview, setReminderPreview] = useState("");
  const selectedDate = attendanceDate || currentDate;
  const canManageBilling = ["owner", "admin", "member"].includes(academy.role);
  const billingQueryPeriod = page === "dashboard"
    ? currentDate.slice(0, 7)
    : billingPeriod || currentDate.slice(0, 7);
  const needsRoster = [
    "dashboard", "students", "withdrawn-students", "student-new", "classes",
    "class-new", "attendance", "attendance-list", "seats", "billing", "payments", "consultations",
  ].includes(page);
  const activeStudents = students.filter((s) => s.status === "재원");
  const selectedLearningStudent = activeStudents.find((student) => student.id === learningStudentId)
    ?? activeStudents[0];

  const reloadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const dashboardQuery = page === "dashboard" && billingQueryPeriod
        ? `?include=dashboard&period=${encodeURIComponent(billingQueryPeriod)}`
        : "";
      const overview = await requestJson<{
        students: StudentApi[];
        classes: ClassApi[];
        billingCharges?: BillingCharge[];
        seatOccupancies?: SeatOccupancy[];
        seatPrices?: SeatPrice[];
      }>(`/api/overview${dashboardQuery}`, { signal });
      if (signal?.aborted) return;
      setStudents(overview.students.map(toStudent));
      setClasses(overview.classes.map(toClassroom));
      setAttendanceClass((current) => current || overview.classes[0]?.id || "");
      if (page === "dashboard") {
        if (!overview.billingCharges || !overview.seatOccupancies || !overview.seatPrices) {
          throw new Error("대시보드 정보를 모두 불러오지 못했습니다.");
        }
        setBillingCharges(overview.billingCharges);
        setSeatOccupancies(overview.seatOccupancies);
        setSeatPrices(Object.fromEntries(
          overview.seatPrices.map((price) => [`${price.room_number}:${price.seat_number}`, price.monthly_fee]),
        ));
        const seatedIds = new Set(overview.seatOccupancies.flatMap((seat) => seat.student_id ? [seat.student_id] : []));
        setDashboardTasks({
          period: billingQueryPeriod,
          charges: overview.billingCharges,
          unseatedCount: overview.students.filter((student) => student.status === "active" && !seatedIds.has(student.id)).length,
        });
      }
      setRosterLoaded(true);
      setDataError("");
    } catch (caught) {
      if (signal?.aborted) return;
      setDataError(caught instanceof Error ? caught.message : "학원 정보를 불러오지 못했습니다.");
    }
  }, [billingQueryPeriod, page]);

  useEffect(() => {
    if (!needsRoster || page === "dashboard" || rosterLoaded) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void reloadData(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [billingQueryPeriod, needsRoster, page, rosterLoaded, reloadData]);

  useEffect(() => {
    if (page !== "dashboard" || !billingQueryPeriod) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void reloadData(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [billingQueryPeriod, page, reloadData]);

  useEffect(() => {
    const studentId = selectedLearningStudent?.id;
    if (page !== "consultations" || !studentId) return;

    let active = true;
    const query = `?studentId=${encodeURIComponent(studentId)}`;
    Promise.all([
      requestJson<ConsultationRecord[]>(`/api/consultations${query}`),
      requestJson<AssessmentRecord[]>(`/api/assessments${query}`),
    ]).then(([consultationRows, assessmentRows]) => {
      if (!active) return;
      setConsultations(consultationRows);
      setAssessments(assessmentRows);
      setDataError("");
    }).catch((caught: unknown) => {
      if (active) {
        setDataError(caught instanceof Error ? caught.message : "상담·시험 기록을 불러오지 못했습니다.");
      }
    });

    return () => { active = false; };
  }, [page, selectedLearningStudent?.id]);

  useEffect(() => {
    if (
      !["attendance", "attendance-list"].includes(page) ||
      !selectedDate ||
      !attendanceClass
    ) {
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
  }, [page, selectedDate, attendanceClass]);

  useEffect(() => {
    if (
      !["billing", "payments"].includes(page) ||
      !billingQueryPeriod
    ) return;

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
  }, [page, billingQueryPeriod]);

  const reloadSeats = useCallback(async () => {
    const [rows, prices] = await Promise.all([
      requestJson<SeatOccupancy[]>("/api/seats"),
      requestJson<SeatPrice[]>("/api/seats/pricing"),
    ]);
    setSeatOccupancies(rows);
    setSeatPrices(Object.fromEntries(
      prices.map((price) => [`${price.room_number}:${price.seat_number}`, price.monthly_fee]),
    ));
    setDataError("");
  }, []);

  useEffect(() => {
    if (page !== "seats") return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      reloadSeats().catch((caught: unknown) => {
        if (active) {
          setDataError(caught instanceof Error ? caught.message : "좌석 현황을 불러오지 못했습니다.");
        }
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [page, reloadSeats]);

  useEffect(() => {
    if (page !== "seats") return;
    const timer = window.setInterval(() => setSeatClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (page !== "billing-settings") return;
    let active = true;
    requestJson<{ message: string }>("/api/settings/guardian-reminder")
      .then(({ message: savedMessage }) => {
        if (active) setGuardianReminder(savedMessage);
      })
      .catch((caught: unknown) => {
        if (active) setDataError(caught instanceof Error ? caught.message : "알림 기본 메시지를 불러오지 못했습니다.");
      });
    return () => { active = false; };
  }, [page]);

  const [routeSection, routeStudentId, routeAction] = pathname.split("/").filter(Boolean);
  const selectedStudentId =
    routeSection === "students" &&
    routeStudentId &&
    routeStudentId !== "new" &&
    routeStudentId !== "withdrawn" &&
    routeAction !== "edit"
      ? decodeURIComponent(routeStudentId)
      : null;
  const routeEditingStudent =
    routeSection === "students" && routeAction === "edit"
      ? students.find((student) => student.id === decodeURIComponent(routeStudentId ?? ""))
      : undefined;
  const routeEditingClass =
    routeSection === "classes" && routeAction === "edit"
      ? classes.find((classroom) => classroom.id === decodeURIComponent(routeStudentId ?? ""))
      : undefined;

  useEffect(() => {
    if (!routeEditingStudent || editing === routeEditingStudent.id) return;
    const {
      id,
      status: _status,
      fingerprintStatus: _fingerprintStatus,
      classTuition: _classTuition,
      seatTuition: _seatTuition,
      monthlyTuition: _monthlyTuition,
      ...form
    } = routeEditingStudent;
    void _status;
    void _fingerprintStatus;
    void _classTuition;
    void _seatTuition;
    void _monthlyTuition;
    startTransition(() => {
      setStudentForm(form);
      setEditing(id);
    });
  }, [routeEditingStudent, editing]);

  useEffect(() => {
    if (!routeEditingClass || classEditing === routeEditingClass.id) return;
    startTransition(() => {
      setClassForm(routeEditingClass);
      setClassEditing(routeEditingClass.id);
    });
  }, [routeEditingClass, classEditing]);

  const go = (next: Page) => {
    if (next === "class-new") {
      setClassForm(emptyClass());
      setClassEditing(null);
    }
    navigateWithinWorkspace(pagePath(next));
    setMobileOpen(false);
    setNoticeOpen(false);
    setError("");
    setMessage("");
  };
  const showStudent = (id: string) => {
    navigateWithinWorkspace(pagePath("students", id));
    setMobileOpen(false);
    setError("");
    setMessage("");
  };
  const startNewStudent = () => { setStudentForm({ ...emptyStudent(), enrolled: today() }); setEditing(null); setFingerprintRequested(false); go("student-new"); };
  const classNames = (ids: string[]) => ids.map((id) => classes.find((item) => item.id === id)?.name).filter(Boolean).join(", ");
  const seatedStudentIds = new Set(seatOccupancies.flatMap((seat) => seat.student_id ? [seat.student_id] : []));
  const unseatedStudents = activeStudents
    .filter((student) => !seatedStudentIds.has(student.id))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const selectedUnseatedStudent = unseatedStudents.find(
    (student) => student.id === selectedUnseatedStudentId,
  );
  const taskCharges = dashboardTasks?.period === currentDate.slice(0, 7) && currentDate
    ? dashboardTasks.charges.filter((charge) => charge.status === "unpaid")
    : [];
  const dueOrOverdueCount = taskCharges.filter((charge) => daysUntilDue(charge.due_date, currentDate) <= 0).length;
  const dueSoonCount = taskCharges.filter((charge) => {
    const days = daysUntilDue(charge.due_date, currentDate);
    return days > 0 && days <= 7;
  }).length;
  const shownStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      const text = [s.name, s.phone, s.guardian, s.gender, s.school, s.grade, s.enrolled, ...s.classes.map((id) => classes.find((c) => c.id === id)?.name ?? "")].join(" ").toLowerCase();
      return (!term || text.includes(term)) && (classFilter === "전체 반" || s.classes.includes(classFilter));
    });
  }, [students, classes, search, classFilter]);
  const todayEntries = Object.entries(attendance).filter(([key]) => key.startsWith(`${selectedDate}|`));
  const selected = students.find((s) => s.id === selectedStudentId);
  const studentClassTuition = studentForm.classes.reduce(
    (total, classId) => total + Number(classes.find((classroom) => classroom.id === classId)?.monthlyFee ?? 0),
    0,
  );
  const studentSeatTuition = editing
    ? students.find((student) => student.id === editing)?.seatTuition ?? 0
    : 0;
  const studentTuitionAdjustment = Number.isFinite(Number(studentForm.tuitionAdjustment))
    ? Number(studentForm.tuitionAdjustment)
    : 0;
  const studentMonthlyTuitionPreview = Math.max(
    0,
    studentClassTuition + studentSeatTuition + studentTuitionAdjustment,
  );

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
        gender: studentForm.gender,
        school: studentForm.school,
        grade: studentForm.grade,
        graduatedSchool: studentForm.graduatedSchool,
        address: studentForm.address,
        enrolledOn: studentForm.enrolled,
        status: students.find((student) => student.id === editing)?.status === "퇴원" ? "withdrawn" : "active",
        monthlyTuitionAdjustment: studentTuitionAdjustment,
        tuitionAdjustmentReason: studentForm.tuitionAdjustmentReason,
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
      let fingerprintMessage = "";
      if (fingerprintRequested && body.status === "active") {
        try {
          await requestJson<{ status: string }>(
            `/api/students/${encodeURIComponent(saved.id)}/fingerprint`,
            { method: "POST" },
          );
          fingerprintMessage = " 지문 등록 요청은 기기 연결 대기 상태입니다.";
        } catch (caught) {
          fingerprintMessage = ` 학생 정보는 저장했지만 지문 등록 요청은 처리되지 않았습니다: ${caught instanceof Error ? caught.message : "다시 시도해 주세요."}`;
        }
      }
      await reloadData();
      setEditing(null);
      setFingerprintRequested(false);
      navigateWithinWorkspace(pagePath("students", saved.id));
      setMessage(`학생 정보를 저장했습니다.${fingerprintMessage}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "학생 정보를 저장하지 못했습니다.");
    }
  }
  function editStudent(student: Student) {
    const {
      id,
      status: _status,
      fingerprintStatus: _fingerprintStatus,
      classTuition: _classTuition,
      seatTuition: _seatTuition,
      monthlyTuition: _monthlyTuition,
      ...form
    } = student;
    void _status;
    void _fingerprintStatus;
    void _classTuition;
    void _seatTuition;
    void _monthlyTuition;
    setStudentForm(form);
    setEditing(id);
    setFingerprintRequested(false);
    setMessage("");
    navigateWithinWorkspace(pagePath("student-new", null, id));
  }
  async function requestFingerprint(studentId: string) {
    setSavingFingerprint(true);
    setError("");
    try {
      const response = await requestJson<{ status: string; deviceConnected: boolean }>(
        `/api/students/${encodeURIComponent(studentId)}/fingerprint`,
        { method: "POST" },
      );
      await reloadData();
      setFingerprintRequested(false);
      setMessage(response.deviceConnected
        ? "지문 스캔 기기가 등록 준비를 마쳤습니다."
        : "지문 등록 요청을 저장했습니다. 스캔 기기 연결을 기다리고 있습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "지문 등록 요청을 처리하지 못했습니다.");
    } finally {
      setSavingFingerprint(false);
    }
  }
  async function prepareFingerprintRegistration() {
    if (editing) {
      await requestFingerprint(editing);
      return;
    }
    setFingerprintRequested(true);
    setMessage("학생 정보를 저장하면 지문 등록 요청이 기기 연결 대기 상태로 기록됩니다.");
  }
  async function updateStudentStatus(student: Student, status: "active" | "withdrawn") {
    if (status === "withdrawn" && !window.confirm(`${student.name} 학생을 퇴원 처리할까요? 배정된 좌석은 자동으로 비워집니다.`)) return;
    setError("");
    setMessage("");
    try {
      await requestJson<{ id: string }>(`/api/students/${encodeURIComponent(student.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: student.name,
          birthDate: student.birth,
          phone: student.phone,
          guardianPhone: student.guardian,
          gender: student.gender,
          school: student.school,
          grade: student.grade,
          graduatedSchool: student.graduatedSchool,
          address: student.address,
          enrolledOn: student.enrolled,
          status,
          monthlyTuitionAdjustment: Number.isFinite(Number(student.tuitionAdjustment))
            ? Number(student.tuitionAdjustment)
            : 0,
          tuitionAdjustmentReason: student.tuitionAdjustmentReason,
          memo: student.memo,
          classIds: student.classes,
        }),
      });
      await reloadData();
      setMessage(status === "withdrawn" ? "학생을 퇴원 처리하고 좌석을 비웠습니다." : "학생을 재원 상태로 복귀시켰습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "학생 상태를 변경하지 못했습니다.");
    }
  }
  async function saveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classForm.name.trim()) { setError("반 이름을 입력해 주세요."); return; }
    setError("");
    try {
      await requestJson<{ id: string }>(
        classEditing ? `/api/classes?id=${encodeURIComponent(classEditing)}` : "/api/classes",
        {
        method: classEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: classForm.name,
          subject: classForm.subject,
          teacher: classForm.teacher,
          grade: classForm.grade,
          capacity: classForm.capacity ? Number(classForm.capacity) : null,
          monthlyFee: Number(classForm.monthlyFee || 0),
          room: classForm.room,
          startsOn: classForm.start || null,
          endsOn: classForm.end || null,
          memo: classForm.memo,
        }),
      });
      await reloadData();
      setClassForm(emptyClass());
      setClassEditing(null);
      go("classes");
      setMessage(classEditing ? "반 정보를 수정했습니다." : "반을 등록했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "반 정보를 저장하지 못했습니다.");
    }
  }
  function editClass(classroom: ClassRoom) {
    setClassForm(classroom);
    setClassEditing(classroom.id);
    setError("");
    setMessage("");
    navigateWithinWorkspace(`/classes/${encodeURIComponent(classroom.id)}/edit`);
  }
  async function deleteClass(classroom: ClassRoom) {
    if (!window.confirm(
      `${classroom.name} 반을 삭제할까요? 학생의 반 배정과 이 반의 출결 기록도 함께 삭제됩니다.`,
    )) return;
    setError("");
    setMessage("");
    try {
      await requestJson<{ deleted: boolean }>(`/api/classes?id=${encodeURIComponent(classroom.id)}`, {
        method: "DELETE",
      });
      await reloadData();
      setMessage(`${classroom.name} 반을 삭제했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "반을 삭제하지 못했습니다.");
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
      setMessage(`${formatNumber(entries.length)}명의 출결을 저장했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "출결을 저장하지 못했습니다.");
    } finally {
      setSavingAttendance(false);
    }
  }
  async function reloadLearningRecords(studentId: string) {
    const query = `?studentId=${encodeURIComponent(studentId)}`;
    const [consultationRows, assessmentRows] = await Promise.all([
      requestJson<ConsultationRecord[]>(`/api/consultations${query}`),
      requestJson<AssessmentRecord[]>(`/api/assessments${query}`),
    ]);
    setConsultations(consultationRows);
    setAssessments(assessmentRows);
  }
  async function saveConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLearningStudent) return;
    setSavingLearningRecord(true);
    setError("");
    try {
      await requestJson<{ id: string }>("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedLearningStudent.id,
          consultationDate: consultationForm.date,
          category: consultationForm.category,
          summary: consultationForm.summary,
          nextAction: consultationForm.nextAction,
        }),
      });
      await reloadLearningRecords(selectedLearningStudent.id);
      setConsultationForm((current) => ({ ...current, summary: "", nextAction: "" }));
      setMessage(`${selectedLearningStudent.name} 학생의 상담 기록을 저장했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "상담 기록을 저장하지 못했습니다.");
    } finally {
      setSavingLearningRecord(false);
    }
  }
  async function saveAssessment(
    event: FormEvent<HTMLFormElement>,
    assessmentType: "mock_exam" | "vocabulary",
  ) {
    event.preventDefault();
    if (!selectedLearningStudent) return;
    setSavingLearningRecord(true);
    setError("");
    const payload = assessmentType === "mock_exam"
      ? {
        studentId: selectedLearningStudent.id,
        assessmentType,
        assessmentDate: mockExamForm.date,
        title: mockExamForm.title,
        subject: mockExamForm.subject,
        grade: Number(mockExamForm.grade),
        score: mockExamForm.score === "" ? null : Number(mockExamForm.score),
        note: "",
      }
      : {
        studentId: selectedLearningStudent.id,
        assessmentType,
        assessmentDate: vocabularyForm.date,
        title: vocabularyForm.title,
        score: Number(vocabularyForm.score),
        maxScore: Number(vocabularyForm.maxScore),
        note: "",
      };
    try {
      await requestJson<{ id: string }>("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await reloadLearningRecords(selectedLearningStudent.id);
      if (assessmentType === "mock_exam") {
        setMockExamForm((current) => ({ ...current, score: "" }));
        setMessage(`${selectedLearningStudent.name} 학생의 ${mockExamForm.title} ${mockExamForm.subject} 등급을 저장했습니다.`);
      } else {
        setVocabularyForm((current) => ({ ...current, score: "", maxScore: "" }));
        setMessage(`${selectedLearningStudent.name} 학생의 영단어 시험 결과를 저장했습니다.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "시험 결과를 저장하지 못했습니다.");
    } finally {
      setSavingLearningRecord(false);
    }
  }
  async function deleteLearningRecord(kind: "consultations" | "assessments", id: string) {
    if (!selectedLearningStudent || !window.confirm("이 기록을 삭제할까요?")) return;
    setError("");
    try {
      await requestJson<{ deleted: boolean }>(`/api/${kind}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await reloadLearningRecords(selectedLearningStudent.id);
      setMessage("기록을 삭제했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "기록을 삭제하지 못했습니다.");
    }
  }
  function startBilling() {
    const firstStudent = activeStudents[0];
    setBillingForm({
      studentId: firstStudent?.id ?? "",
      amount: firstStudent?.monthlyTuition ? String(firstStudent.monthlyTuition) : "",
      dueDate: billingQueryPeriod ? `${billingQueryPeriod}-10` : "",
      memo: "",
    });
    setBillingFormOpen(true);
    setError("");
    setMessage("");
  }
  function selectBillingStudent(studentId: string) {
    const student = activeStudents.find((item) => item.id === studentId);
    setBillingForm((current) => ({
      ...current,
      studentId,
      amount: student?.monthlyTuition ? String(student.monthlyTuition) : "",
    }));
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
  async function assignSeat(
    studentId: string,
    destination: { roomNumber: number; seatNumber: number },
  ) {
    setSavingSeat(true);
    setError("");
    try {
      await requestJson<{ assigned: boolean }>("/api/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...destination, studentId }),
      });
      await Promise.all([reloadSeats(), reloadData()]);
      setSelectedUnseatedStudentId(null);
      setMessage("좌석을 배정했습니다. 출입 상태는 지문 스캔 연동 시 자동 반영됩니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "좌석을 배정하지 못했습니다.");
    } finally {
      setSavingSeat(false);
    }
  }
  async function saveSeatPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pricingSeat) return;
    setSavingSeatPrice(true);
    setError("");
    try {
      await requestJson<{ saved: boolean }>("/api/seats/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pricingSeat, monthlyFee: Number(seatPriceForm || 0) }),
      });
      await Promise.all([reloadSeats(), reloadData()]);
      setPricingSeat(null);
      setMessage("좌석의 월 원비를 저장했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "좌석 원비를 저장하지 못했습니다.");
    } finally {
      setSavingSeatPrice(false);
    }
  }
  async function moveSeat(studentId: string, destination: { roomNumber: number; seatNumber: number }) {
    setSavingSeat(true);
    setError("");
    try {
      await requestJson<{ moved: boolean }>("/api/seats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...destination, studentId }),
      });
      await Promise.all([reloadSeats(), reloadData()]);
      setMovingSeatStudentId(null);
      setMessage("학생 좌석을 이동했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "좌석을 이동하지 못했습니다.");
    } finally {
      setSavingSeat(false);
    }
  }
  function showParentReminderNotConnected(charge: BillingCharge) {
    setReminderPreview(
      guardianReminder
        .replaceAll("{학생명}", charge.student_name)
        .replaceAll("{학원명}", academy.name)
        .replaceAll("{납부일}", dateLabel(charge.due_date))
        .replaceAll("{금액}", formatNumber(charge.amount)),
    );
    setMessage("카카오톡 연동 전이라 실제 메시지는 발송되지 않았습니다.");
  }
  async function saveGuardianReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingGuardianReminder(true);
    setError("");
    setMessage("");
    try {
      await requestJson<{ saved: boolean }>("/api/settings/guardian-reminder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: guardianReminder }),
      });
      setMessage("보호자 알림 기본 메시지를 저장했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알림 기본 메시지를 저장하지 못했습니다.");
    } finally {
      setSavingGuardianReminder(false);
    }
  }
  async function changeDemoSeats(action: "add" | "remove") {
    setSavingDemo(true);
    setError("");
    try {
      const result = await requestJson<{ created?: number; deleted?: number }>(
        action === "add" ? "/api/seats" : "/api/seats?demo=true",
        { method: action === "add" ? "PUT" : "DELETE" },
      );
      await reloadSeats();
      setSelectedUnseatedStudentId(null);
      setMessage(action === "add"
        ? `${formatNumber(result.created ?? 0)}명의 더미 좌석 데이터를 추가했습니다.`
        : `${formatNumber(result.deleted ?? 0)}개의 더미 좌석 데이터를 삭제했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "더미 좌석 데이터를 처리하지 못했습니다.");
    } finally {
      setSavingDemo(false);
    }
  }
  return <div className="app">
    <div className="demo-bar"><CircleAlert size={15} /> <span><strong>보안 연결됨</strong> · 로그인한 학원 구성원에게만 데이터가 표시됩니다.</span></div>
    <header className="header"><div className="header-inner">
      <button className="logo-button" onClick={() => go("dashboard")} aria-label="Euclion 대시보드"><Logo /></button>
      <nav className={`nav ${mobileOpen ? "nav-open" : ""}`} aria-label="주 메뉴">
        <button className={`nav-home ${page === "dashboard" ? "nav-active" : ""}`} onClick={() => go("dashboard")}>홈</button>
        <button className={`nav-home ${page === "seats" ? "nav-active" : ""}`} onClick={() => go("seats")}>좌석 배치도</button>
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
        <div className="header-divider" /><div className="account"><div className="avatar">{user.name.slice(0, 1)}</div><div><strong>{user.name}</strong><span>{academy.name} · {academy.role === "owner" ? "원장" : academy.role === "admin" ? "관리자" : "팀원"}</span></div><button className="auth-text-button" onClick={() => void authClient.signOut()}>로그아웃</button></div>
        <button className="mobile-toggle icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={mobileOpen}>{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div></header>

    <main className="main">
      {dataError && <p className="error-message" role="alert">{dataError}</p>}
      {page === "dashboard" && <>
        <div className="dashboard-welcome"><div><div className="eyebrow"><span className="eyebrow-dot" /> EUCLION WORKSPACE</div><h1>안녕하세요, {user.name}님 <span>✳</span></h1><p>{academy.name}의 하루를 편리하게 관리해 보세요.</p></div><div className="date-chip"><CalendarDays size={16} /> 오늘 <span>{currentDate ? dateLabel(currentDate) : "—"}</span></div></div>
        <div className="section-title"><div><h2>한눈에 보는 우리 학원</h2><p>학원의 주요 현황을 확인해 보세요.</p></div><span className="sample-label">실시간 데이터</span></div>
        <div className="stats">
          <button className="stat-card" onClick={() => go("students")}><div className="stat-top"><span className="stat-icon mint"><UsersRound size={20} /></span><ArrowRight size={17} /></div><div className="stat-label">재원 학생</div><div className="stat-number">{formatNumber(activeStudents.length)}<small>명</small></div><div className="stat-foot"><span className="green-dot" /> 현재 재원 중인 학생</div></button>
          <button className="stat-card" onClick={() => go("seats")}><div className="stat-top"><span className="stat-icon blue"><ClipboardCheck size={20} /></span><ArrowRight size={17} /></div><div className="stat-label">오늘 출석한 좌석</div><div className="stat-number">{formatNumber(seatOccupancies.filter((seat) => seat.status !== "absent").length)}<small>석</small></div><div className="stat-foot"><span className="blue-dot" /> 좌석 배치도에서 관리</div></button>
          <button className="stat-card" onClick={() => { setBillingPeriod(""); go("billing"); }}><div className="stat-top"><span className="stat-icon peach"><WalletCards size={20} /></span><ArrowRight size={17} /></div><div className="stat-label">이번 달 미납 수강료</div><div className="stat-number pending-number">{dashboardTasks?.period === currentDate.slice(0, 7) && currentDate && !dataError ? formatNumber(taskCharges.reduce((total, charge) => total + charge.amount, 0)) : "—"}<small>원</small></div><div className="stat-foot">{dataError ? "내역을 불러오지 못했습니다" : dashboardTasks?.period === currentDate.slice(0, 7) && currentDate ? `${formatNumber(taskCharges.length)}건 미납` : "내역을 불러오고 있어요"}</div></button>
        </div>
        <div className="dashboard-grid"><section className="panel quick-panel"><div className="panel-heading"><div><h2>빠른 실행</h2><p>자주 사용하는 업무를 바로 시작하세요.</p></div><span className="panel-icon"><Sparkles size={17} /></span></div>
          <div className="quick-grid">
            {[{ icon: <Plus size={19} />, title: "학생 등록", desc: "새로운 학생 추가", action: startNewStudent, tone: "mint" }, { icon: <UsersRound size={19} />, title: "좌석 배치도", desc: "좌석과 출결 상태 관리", action: () => go("seats"), tone: "blue" }, { icon: <BookOpen size={19} />, title: "반 관리", desc: "운영 중인 반 확인", action: () => go("classes"), tone: "purple" }, { icon: <MessageSquareText size={19} />, title: "상담·학습 관리", desc: "상담 및 시험 성적 추이", action: () => go("consultations"), tone: "peach" }].map((item) => <button className="quick-item" onClick={item.action} key={item.title}><span className={`quick-icon ${item.tone}`}>{item.icon}</span><span><strong>{item.title}</strong><small>{item.desc}</small></span><ChevronRight size={16} /></button>)}
          </div></section>
          <section className="panel"><div className="panel-heading"><div><h2>확인이 필요한 업무</h2><p>이번 달 청구와 좌석 배정 현황입니다.</p></div><Bell size={18} className="muted-icon" /></div>
            {!dashboardTasks || dashboardTasks.period !== currentDate.slice(0, 7) || !currentDate || dataError
              ? <div className="dashboard-empty"><strong>{dataError ? "업무 현황을 불러오지 못했습니다." : "업무 현황을 불러오고 있어요."}</strong></div>
              : <div className="dashboard-tasks">
                <button onClick={() => { setBillingPeriod(""); go("billing"); }}><span><strong>납부 기한 당일·경과</strong><small>이번 달 청구 기준</small></span><b>{formatNumber(dueOrOverdueCount)}건</b><ChevronRight size={16} /></button>
                <button onClick={() => { setBillingPeriod(""); go("billing"); }}><span><strong>납부 기한 7일 이내</strong><small>이번 달 청구 기준</small></span><b>{formatNumber(dueSoonCount)}건</b><ChevronRight size={16} /></button>
                <button onClick={() => go("seats")}><span><strong>좌석 미배정</strong><small>재원 학생 기준</small></span><b>{formatNumber(dashboardTasks.unseatedCount)}명</b><ChevronRight size={16} /></button>
                <p>지난달 청구는 청구 내역에서 해당 월을 선택해 확인해 주세요. 알림은 자동 발송되지 않습니다.</p>
              </div>}
          </section>
        </div>
        <section className="panel recent-panel"><div className="panel-heading"><div><h2>학생 현황</h2><p>등록된 학생 목록을 확인해 보세요.</p></div><button className="text-link" onClick={() => go("students")}>전체 보기 <ArrowRight size={15} /></button></div><StudentTable students={activeStudents.slice(0, 4)} classNames={classNames} select={showStudent} /></section>
      </>}

      {page === "students" && selected && <><button className="back-link" onClick={() => go("students")}><ArrowLeft size={16} /> 학생 목록으로</button><PageHeading eyebrow="STUDENT MANAGEMENT" title={selected.name} description={`${selected.status} · 등록일 ${dateLabel(selected.enrolled)}`} action={<div className="student-detail-actions"><Button variant="outline" onClick={() => editStudent(selected)}>정보 수정</Button>{selected.status === "재원" ? <Button variant="outline" onClick={() => void updateStudentStatus(selected, "withdrawn")}>퇴원 처리</Button> : <Button onClick={() => void updateStudentStatus(selected, "active")}>재원 복귀</Button>}</div>} />{message && <div className="success-message">{message}</div>}{error && <p className="error-message" role="alert">{error}</p>}<div className="panel detail-panel"><h2>학생 기본 정보</h2><div className="detail-grid">{[["이름", selected.name], ["성별", selected.gender === "male" ? "남학생" : selected.gender === "female" ? "여학생" : "미지정"], ["생년월일", selected.birth], ["학생 연락처", selected.phone], ["보호자 연락처", selected.guardian], ["학교", selected.school], ["학년·수험 상태", selected.grade], ...(selected.graduatedSchool ? [["졸업 고등학교", selected.graduatedSchool]] : []), ["주소", selected.address], ["등록일", selected.enrolled], ["수강 반", classNames(selected.classes) || "없음"], ["메모", selected.memo]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div>{selected.status === "재원" && <div className="detail-note"><CircleAlert size={17} /> 지문 장치 연동 전에는 학생의 좌석 출입 상태가 자동 변경되지 않습니다.</div>}</>}
      {page === "students" && selected && <section className="panel student-tuition-card"><span>월 수강료 합계</span><strong>{formatNumber(selected.monthlyTuition)}원</strong><small>반 {formatNumber(selected.classTuition)}원 + 좌석 {formatNumber(selected.seatTuition)}원 {Number(selected.tuitionAdjustment) >= 0 ? "+" : "−"} 개인 조정 {formatNumber(Math.abs(Number(selected.tuitionAdjustment)))}원</small>{selected.tuitionAdjustmentReason && <small>조정 사유: {selected.tuitionAdjustmentReason}</small>}</section>}
      {page === "students" && selected && selected.status === "재원" && <section className="panel fingerprint-panel"><div><h2><Fingerprint size={18} /> 지문 등록 상태</h2><p>{selected.fingerprintStatus === "registered" ? "학생의 지문 등록이 완료되었습니다." : selected.fingerprintStatus === "ready" ? "스캔 기기가 학생의 지문 등록을 받을 준비가 되었습니다." : selected.fingerprintStatus === "pending_device" ? "지문 등록 요청을 보관 중이며, 스캔 기기 연결을 기다리고 있습니다." : "아직 지문 등록 요청이 없습니다."}</p><span className={`fingerprint-status fingerprint-${selected.fingerprintStatus}`}>{selected.fingerprintStatus === "registered" ? "지문 저장 완료" : selected.fingerprintStatus === "ready" ? "스캔 준비 완료" : selected.fingerprintStatus === "pending_device" ? "기기 연결 대기" : "미등록"}</span></div><Button variant="outline" disabled={savingFingerprint || selected.fingerprintStatus === "registered"} onClick={() => void requestFingerprint(selected.id)}>{savingFingerprint ? "요청 중..." : selected.fingerprintStatus === "registered" ? "지문 저장 완료" : "지문 등록 요청"}</Button></section>}

      {page === "students" && !selected && <><PageHeading eyebrow="STUDENT MANAGEMENT" title="학생 관리" description="학교와 학년·수험 상태를 나누어 관리합니다." action={<Button onClick={startNewStudent}><Plus size={17} /> 신규 학생 등록</Button>} />{message && <div className="success-message">{message}</div>}<section className="panel list-panel"><div className="list-heading"><div><h2>재원 학생 <span>{formatNumber(shownStudents.filter((student) => student.status === "재원").length)}</span></h2><p>학생을 선택하면 상세 정보를 볼 수 있습니다. 퇴원 학생은 별도 메뉴에서 확인합니다.</p></div></div><div className="filters"><label className="search-field"><Search size={17} /><input placeholder="이름, 연락처, 학교, 학년, 등록일 검색" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="학생 검색" /></label><select aria-label="수강 반" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}><option>전체 반</option>{classes.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div><StudentTable students={shownStudents.filter((student) => student.status === "재원")} classNames={classNames} select={showStudent} /></section></>}
      {page === "withdrawn-students" && <><PageHeading eyebrow="STUDENT ARCHIVE" title="퇴원 학생" description="퇴원 처리된 학생 정보를 보관하며, 재원 상태로 복귀할 수 있습니다." />{message && <div className="success-message">{message}</div>}{error && <p className="error-message" role="alert">{error}</p>}<section className="panel list-panel"><div className="list-heading"><div><h2>보관된 학생 <span>{formatNumber(students.filter((student) => student.status === "퇴원").length)}</span></h2><p>학생을 선택해 상세 정보와 재원 복귀 기능을 확인하세요.</p></div></div><StudentTable students={students.filter((student) => student.status === "퇴원")} classNames={classNames} select={showStudent} /></section></>}

      {page === "student-new" && <><button className="back-link" onClick={() => go("students")}><ArrowLeft size={16} /> 학생 목록으로</button><PageHeading eyebrow="STUDENT MANAGEMENT" title={editing ? "학생 정보 수정" : "신규 학생 등록"} description="학생의 기본 정보와 수강 정보를 입력해 주세요." /><form onSubmit={saveStudent} className="panel form-panel"><div className="form-section-title"><div><h2>학생 정보</h2><p>입력한 정보는 현재 학원에 안전하게 저장됩니다.</p></div><span className="required-note">* 필수 입력</span></div><div className="form-grid">
        <Field label="학생 이름" required><input required value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} placeholder="이름을 입력해 주세요" /></Field>
        <Field label="성별" required><select required value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as Student["gender"] })}><option value="" disabled>성별 선택</option><option value="male">남학생</option><option value="female">여학생</option></select></Field>
        <Field label="생년월일" required><input required type="date" value={studentForm.birth} onChange={(e) => setStudentForm({ ...studentForm, birth: e.target.value })} /></Field>
        <Field label="학생 연락처" required><input required type="tel" value={studentForm.phone} onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} placeholder="010-0000-0000" /></Field>
        <Field label="보호자 연락처" required><input required type="tel" value={studentForm.guardian} onChange={(e) => setStudentForm({ ...studentForm, guardian: e.target.value })} placeholder="010-0000-0000" /></Field>
        <Field label="학교" required={!["재수", "삼수", "N수"].includes(studentForm.grade)}><input required={!["재수", "삼수", "N수"].includes(studentForm.grade)} maxLength={120} value={studentForm.school} onChange={(e) => setStudentForm({ ...studentForm, school: e.target.value })} placeholder="예: 인천해송고등학교" /></Field>
        <Field label="학년·수험 상태" required><select required value={studentForm.grade} onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}><option value="" disabled>학년 또는 수험 상태 선택</option>{["고1", "고2", "고3", "재수", "삼수", "N수"].map((grade) => <option value={grade} key={grade}>{grade}</option>)}</select></Field>
        {["재수", "삼수", "N수"].includes(studentForm.grade) && <Field label="졸업 고등학교" required><input required maxLength={120} value={studentForm.graduatedSchool} onChange={(e) => setStudentForm({ ...studentForm, graduatedSchool: e.target.value })} placeholder="졸업한 고등학교 이름" /></Field>}
        <Field label="등록일" required><input required type="date" value={studentForm.enrolled} onChange={(e) => setStudentForm({ ...studentForm, enrolled: e.target.value })} /></Field>
        <Field label="주소" required><input required value={studentForm.address} onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })} placeholder="주소를 입력해 주세요" /></Field>
        <Field label="메모"><input value={studentForm.memo} onChange={(e) => setStudentForm({ ...studentForm, memo: e.target.value })} placeholder="메모 (선택)" /></Field>
        </div><fieldset className="class-selector"><legend>수강 반 <i>*</i></legend><p>수강할 반을 선택하면 반별 월 수강료가 자동 합산됩니다.</p><div>{classes.map((c) => <label key={c.id}><input type="checkbox" checked={studentForm.classes.includes(c.id)} onChange={(e) => setStudentForm({ ...studentForm, classes: e.target.checked ? [...studentForm.classes, c.id] : studentForm.classes.filter((id) => id !== c.id) })} />{c.name} · 월 {formatNumber(Number(c.monthlyFee))}원</label>)}</div></fieldset><section className="tuition-adjustment-panel"><div><strong>월 수강료 예상</strong><span>반 {formatNumber(studentClassTuition)}원 + 좌석 {formatNumber(studentSeatTuition)}원 {studentTuitionAdjustment >= 0 ? "+" : "−"} 개인 조정 {formatNumber(Math.abs(studentTuitionAdjustment))}원</span><b>{formatNumber(studentMonthlyTuitionPreview)}원</b></div><div className="form-grid"><Field label="개인별 월 원비 조정 (원)"><input type="text" inputMode="numeric" pattern="-?[0-9,]*" value={studentForm.tuitionAdjustment === "-" ? "-" : formatNumber(Number(studentForm.tuitionAdjustment || 0))} onChange={(event) => { const digits = event.target.value.replace(/\D/g, ""); const adjustment = event.target.value.trim().startsWith("-") ? `-${digits}` : digits; setStudentForm({ ...studentForm, tuitionAdjustment: adjustment }); }} /><small>할인은 음수, 추가 수납은 양수로 입력합니다.</small></Field><Field label="조정 사유"><input maxLength={300} value={studentForm.tuitionAdjustmentReason} onChange={(event) => setStudentForm({ ...studentForm, tuitionAdjustmentReason: event.target.value })} placeholder="예: 형제 할인, 장학 할인" /></Field></div></section>{error && <p className="error-message" role="alert">{error}</p>}<div className="form-actions"><Button variant="outline" onClick={() => go("students")}>취소</Button><Button type="submit">{editing ? "변경 사항 저장" : "학생 등록하기"} <ArrowRight size={16} /></Button></div></form></>}

      {page === "student-new" && <section className="panel fingerprint-panel"><div><h2><Fingerprint size={18} /> 지문 등록</h2><p>{fingerprintRequested ? "학생 저장 후 등록 요청이 기기 연결 대기 상태로 보관됩니다." : "버튼을 누르면 등록 요청을 기록합니다. 지문 기기 연결 후 스캔 대기 요청을 전달합니다."}</p>{editing && <span className={`fingerprint-status fingerprint-${students.find((student) => student.id === editing)?.fingerprintStatus ?? "not_registered"}`}>{students.find((student) => student.id === editing)?.fingerprintStatus === "registered" ? "지문 저장 완료" : students.find((student) => student.id === editing)?.fingerprintStatus === "ready" ? "스캔 준비 완료" : students.find((student) => student.id === editing)?.fingerprintStatus === "pending_device" ? "기기 연결 대기" : "미등록"}</span>}</div><Button variant="outline" onClick={() => void prepareFingerprintRegistration()} disabled={savingFingerprint || (fingerprintRequested && !editing) || (editing !== null && students.find((student) => student.id === editing)?.fingerprintStatus === "registered")}>{savingFingerprint ? "요청 중..." : fingerprintRequested && !editing ? "등록 요청 준비됨" : editing && students.find((student) => student.id === editing)?.fingerprintStatus === "registered" ? "지문 저장 완료" : editing ? "지문 등록 요청" : "지문등록 버튼"}</Button></section>}

      {page === "classes" && <><PageHeading eyebrow="CLASS MANAGEMENT" title="반 관리" description="학원에서 운영하는 반을 확인하고 수정·삭제할 수 있습니다." action={<Button onClick={() => { setClassForm(emptyClass()); setClassEditing(null); setError(""); go("class-new"); }}><Plus size={17} /> 반 등록</Button>} />{message && <div className="success-message">{message}</div>}{error && <p className="error-message" role="alert">{error}</p>}<div className="class-grid">{classes.map((c) => <article className="panel class-card" key={c.id}><div className="class-card-top"><span className="class-subject">{c.subject || "분야 미지정"}</span><BookOpen size={18} /></div><h2>{c.name}</h2><p>{c.grade.join(" · ") || "대상 미지정"} · {c.room || "강의실 미지정"}</p><p className="class-period">{classDuration(c.start, c.end)}</p><p className="class-fee">월 수강료 {formatNumber(Number(c.monthlyFee))}원</p><div className="class-meta"><span><UsersRound size={15} /> {formatNumber(activeStudents.filter((s) => s.classes.includes(c.id)).length)}명{c.capacity && ` / ${formatNumber(Number(c.capacity))}명`}</span><span>{c.teacher || "담당자 미지정"}</span></div><div className="class-actions"><Button variant="outline" onClick={() => editClass(c)}>수정</Button><Button variant="ghost" onClick={() => void deleteClass(c)}>삭제</Button></div></article>)}</div>{!classes.length && <section className="panel placeholder-panel"><Empty title="등록된 반이 없습니다" text="반 등록을 눌러 첫 반을 추가해 보세요." /></section>}</>}
      {page === "class-new" && <><button className="back-link" onClick={() => go("classes")}><ArrowLeft size={16} /> 반 목록으로</button><PageHeading eyebrow="CLASS MANAGEMENT" title={classEditing ? "반 수정" : "반 등록"} description={classEditing ? "반 정보를 변경해 주세요." : "새로운 반의 정보를 입력해 주세요."} /><form onSubmit={saveClass} className="panel form-panel"><div className="form-section-title"><div><h2>반 정보</h2><p>반 정보는 현재 학원에 안전하게 저장됩니다.</p></div></div><div className="form-grid">{([{ key: "name", label: "반 이름" }, { key: "subject", label: "과목·분야" }, { key: "teacher", label: "담당 직원" }, { key: "grade", label: "대상 학년" }, { key: "capacity", label: "정원", type: "number" }, { key: "monthlyFee", label: "월 수강료 (원)" }, { key: "room", label: "강의실" }, { key: "start", label: "운영 시작일", type: "date" }, { key: "end", label: "운영 종료일", type: "date" }, { key: "memo", label: "메모" }] as const).map((field) => <Field label={field.label} key={field.key}>{field.key === "monthlyFee" ? <input type="text" inputMode="numeric" pattern="[0-9,]*" value={formatNumber(Number(classForm.monthlyFee || 0))} onChange={(e) => setClassForm({ ...classForm, monthlyFee: e.target.value.replace(/\D/g, "") })} /> : field.key === "grade" ? <div className="grade-checkboxes">{classGrades.map((grade) => <label key={grade}><input type="checkbox" checked={classForm.grade.includes(grade)} onChange={(event) => setClassForm({ ...classForm, grade: event.target.checked ? [...classForm.grade, grade] : classForm.grade.filter((item) => item !== grade) })} />{grade}</label>)}</div> : <input type={"type" in field ? field.type : "text"} min={field.key === "capacity" ? "1" : undefined} value={classForm[field.key]} onChange={(e) => setClassForm({ ...classForm, [field.key]: e.target.value })} />}</Field>)}</div>{error && <p className="error-message" role="alert">{error}</p>}<div className="form-actions"><Button variant="outline" onClick={() => go("classes")}>취소</Button><Button type="submit">{classEditing ? "변경 사항 저장" : "반 등록하기"} <ArrowRight size={16} /></Button></div></form></>}

      {(page === "attendance" || page === "attendance-list") && <><PageHeading eyebrow="ATTENDANCE" title={labels[page]} description="날짜와 반을 선택해 학생별 출결을 확인하세요." action={page === "attendance" ? <Button onClick={saveAttendance} disabled={savingAttendance || !attendanceClass}>{savingAttendance ? "저장 중..." : "출결 저장"} <Check size={16} /></Button> : undefined} /><section className="panel list-panel">{message && <div className="success-message">{message}</div>}{error && <p className="error-message" role="alert">{error}</p>}<div className="attendance-controls"><Field label="날짜"><input type="date" value={selectedDate} onChange={(e) => setAttendanceDate(e.target.value)} /></Field><Field label="반 선택"><select value={attendanceClass} onChange={(e) => setAttendanceClass(e.target.value)}><option value="" disabled>반 선택</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><div className="list-heading"><div><h2>출결 현황</h2><p>선택한 날짜와 반의 출결 기록은 안전하게 저장됩니다.</p></div><span className="sample-label">{formatNumber(todayEntries.filter(([key]) => key.split("|")[1] === attendanceClass).length)}건 입력</span></div><div className="attendance-list">{students.filter((s) => s.status === "재원" && s.classes.includes(attendanceClass)).map((s) => { const entry = attendance[attendanceKey(s.id)]; return <div className="attendance-row" key={s.id}><div className="person-cell"><span className="person-avatar">{s.name.slice(0, 1)}</span><div><strong>{s.name}</strong><small>{[s.school, s.grade].filter(Boolean).join(" · ")}</small></div></div>{page === "attendance" ? <><select aria-label={`${s.name} 출결 상태`} value={entry?.status ?? ""} onChange={(e) => updateAttendance(s.id, { status: e.target.value as AttendanceStatus })}><option value="" disabled>미입력</option>{(["출석", "결석", "지각", "조퇴", "보강"] as const).map((status) => <option key={status}>{status}</option>)}</select><input aria-label={`${s.name} 출결 메모`} placeholder={entry ? "메모 (선택)" : "상태를 먼저 선택해 주세요"} disabled={!entry} value={entry?.memo ?? ""} onChange={(e) => updateAttendance(s.id, { memo: e.target.value })} /></> : <><span className="status-pill">{entry?.status ?? "미입력"}</span><span className="attendance-memo">{entry?.memo || "—"}</span></>}</div>})}{!students.some((s) => s.status === "재원" && s.classes.includes(attendanceClass)) && <Empty title="표시할 학생이 없어요" text="선택한 반에 재원 중인 학생이 없습니다." />}</div></section></>}

      {page === "seats" && <>
        <PageHeading eyebrow="STUDY ROOM" title="좌석 배치도" description="좌석에 마우스를 올리면 학생, 입실 시각, 누적 이용 시간이 표시됩니다." action={<div className="seat-demo-actions"><Button variant="outline" onClick={() => void changeDemoSeats("add")} disabled={savingDemo || seatOccupancies.some((seat) => seat.is_demo)}>더미 데이터 추가</Button><Button variant="outline" onClick={() => void changeDemoSeats("remove")} disabled={savingDemo || !seatOccupancies.some((seat) => seat.is_demo)}>더미 데이터 삭제</Button></div>} />
        {message && <div className="success-message">{message}</div>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="seat-info panel"><div><strong>총 {formatNumber(64)}석</strong><span>홀수 방은 남학생 · 짝수 방은 여학생 전용</span></div><div className="seat-legend"><span><i className="seat-legend-present" /> 출석(입실)</span><span><i className="seat-legend-absent" /> 결석(미스캔)</span><span><i className="seat-legend-free" /> 공좌석</span><span><i className="seat-legend-exited" /> 퇴실</span></div></div>
        {movingSeatStudentId && <div className="panel seat-move-banner"><span><strong>{students.find((student) => student.id === movingSeatStudentId)?.name}</strong> 학생을 이동할 빈 좌석을 선택해 주세요.</span><Button variant="outline" disabled={savingSeat} onClick={() => setMovingSeatStudentId(null)}>이동 취소</Button></div>}
        <section className="panel seat-unassigned-panel">
          <div className="seat-unassigned-heading">
            <div><h2>좌석 미배정 학생 <span>{formatNumber(unseatedStudents.length)}명</span></h2><p>{selectedUnseatedStudent ? `${selectedUnseatedStudent.name} 학생이 선택되었습니다. 성별에 맞는 빈 좌석을 눌러 배정하세요.` : "학생 이름을 선택한 다음 배치도에서 빈 좌석을 누르면 배정됩니다."}</p></div>
            {selectedUnseatedStudent && <Button variant="outline" disabled={savingSeat} onClick={() => setSelectedUnseatedStudentId(null)}>선택 취소</Button>}
          </div>
          {unseatedStudents.length ? <div className="seat-unassigned-list">{unseatedStudents.map((student) => <button
            type="button"
            className={`seat-unassigned-student ${student.id === selectedUnseatedStudentId ? "seat-unassigned-student-selected" : ""}`}
            key={student.id}
            disabled={savingSeat || !student.gender}
            aria-pressed={student.id === selectedUnseatedStudentId}
            onClick={() => {
              setMovingSeatStudentId(null);
              setSelectedUnseatedStudentId(student.id === selectedUnseatedStudentId ? null : student.id);
            }}
          ><strong>{student.name}</strong><span>{student.gender ? student.gender === "male" ? "남학생" : "여학생" : "성별 미지정"}</span><small>{[student.school, student.grade].filter(Boolean).join(" · ") || "학교·학년 미입력"}</small></button>)}</div> : <p className="seat-unassigned-empty">좌석 배정을 기다리는 재원 학생이 없습니다.</p>}
        </section>
        {pricingSeat && <form className="panel seat-price-form" onSubmit={saveSeatPrice}>
          <div><h2>{formatNumber(pricingSeat.roomNumber)}번 방 · {formatNumber(pricingSeat.seatNumber)}번 좌석 원비</h2><p>이 좌석에 배정된 학생의 월 수강료에 더해집니다.</p></div>
          <Field label="월 좌석 원비 (원)"><input type="text" inputMode="numeric" pattern="[0-9,]*" value={formatNumber(Number(seatPriceForm || 0))} onChange={(event) => setSeatPriceForm(event.target.value.replace(/\D/g, ""))} /></Field>
          <div className="seat-form-actions"><Button variant="outline" onClick={() => setPricingSeat(null)}>취소</Button><Button type="submit" disabled={savingSeatPrice}>{savingSeatPrice ? "저장 중..." : "원비 저장"} <Check size={16} /></Button></div>
        </form>}
        <div className="seat-map">{["좌측 구역", "우측 구역"].map((side) => <section className="seat-side panel" key={side}><div className="seat-side-heading"><div><h2>{side}</h2><p>{side === "좌측 구역" ? "각 방 10석" : "각 방 6석"} · {side === "좌측 구역" ? "홀수 방 남학생" : "짝수 방 여학생"}</p></div><span className="seat-hall-label">복도</span></div><div className="seat-room-list">{seatRooms.filter((room) => room.side === side).map((room) => <article className={`seat-room ${room.number <= 4 ? "room-left" : "room-right"}`} key={room.number}><div className="seat-room-heading"><h3>{formatNumber(room.number)}번 방 · {room.number % 2 === 1 ? "남학생" : "여학생"}</h3><span>{formatNumber(seatOccupancies.filter((seat) => seat.room_number === room.number).length)} / {formatNumber(room.capacity)}석</span></div><div className={`seat-grid ${room.number <= 4 ? "seat-grid-left" : "seat-grid-right"}`}>{Array.from({ length: room.capacity }, (_, index) => {
          const seatNumber = index + 1;
          const occupant = seatOccupancies.find((seat) => seat.room_number === room.number && seat.seat_number === seatNumber);
          const roomGender = room.number % 2 === 1 ? "male" : "female";
          const assignmentStudent = movingSeatStudentId
            ? students.find((student) => student.id === movingSeatStudentId)
            : selectedUnseatedStudent;
          const canAssignHere = assignmentStudent?.gender === roomGender;
          return <div className={`seat-cell ${occupant ? `seat-status-${occupant.status}` : "seat-status-vacant"}`} key={seatNumber}>
            <button type="button" className={`seat-tile ${occupant ? `seat-tile-${occupant.status}` : "seat-tile-vacant"} ${!occupant && canAssignHere ? "seat-tile-ready" : ""}`} disabled={savingSeat || (!occupant && !canAssignHere)} onClick={() => {
              const destination = { roomNumber: room.number, seatNumber };
              if (!occupant && movingSeatStudentId) {
                void moveSeat(movingSeatStudentId, destination);
              } else if (occupant && !selectedUnseatedStudent && !movingSeatStudentId && !occupant.is_demo && occupant.student_id) {
                setSelectedUnseatedStudentId(null);
                setMovingSeatStudentId(occupant.student_id);
              } else if (!occupant && selectedUnseatedStudent && canAssignHere) {
                void assignSeat(selectedUnseatedStudent.id, destination);
              }
            }} aria-label={occupant ? `${room.number}번 방 ${seatNumber}번 좌석, ${occupant.student_name}, ${seatStatusLabels[occupant.status]}${!occupant.is_demo ? ", 이동하려면 선택" : ""}` : `${room.number}번 방 ${seatNumber}번 좌석, 공좌석${canAssignHere ? `, ${assignmentStudent?.name} 배정` : ""}`}><span className="seat-tile-number">{formatNumber(seatNumber)}번</span>{occupant ? <><span className="seat-full-name">{occupant.student_name}</span><span className="seat-tile-status">{seatStatusLabels[occupant.status]}</span></> : <span className="seat-tile-status">{canAssignHere ? "배정" : "공좌석"}</span>}</button>
            <div className="seat-tooltip" role="tooltip"><strong>{occupant ? <>{occupant.student_name}{occupant.is_demo && <small className="demo-tag">더미</small>}</> : "공좌석"}</strong>{occupant && <><span>{[occupant.school, occupant.grade].filter(Boolean).join(" · ")}</span><span>입실 {new Date(occupant.entered_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span><span>오늘 누적 {formatDuration(0, occupant.total_duration_ms + (occupant.status === "present" ? Math.max(0, seatClock - occupant.entered_at) : 0))}</span></>}<span>월 좌석 원비 {formatNumber(seatPrices[`${room.number}:${seatNumber}`] ?? 0)}원</span><button type="button" onClick={(event) => { event.stopPropagation(); setPricingSeat({ roomNumber: room.number, seatNumber }); setSeatPriceForm(String(seatPrices[`${room.number}:${seatNumber}`] ?? 0)); }}>좌석 원비 설정</button></div>
          </div>;
        })}</div></article>)}</div></section>)}</div>
        <div className="placeholder-info seat-future-note"><CircleAlert size={17} /><span>좌석 출입 상태는 학생별 스캔 API에서 출석·퇴실로 전환되고 15초마다 화면에 반영됩니다. 실제 지문 판독기 연동과 좌석 조명은 기기 연동 단계가 남아 있습니다. 퇴원 처리 시 좌석은 자동으로 비워집니다.</span></div>
      </>}

      {(page === "billing" || page === "payments") && <>
        <PageHeading eyebrow="TUITION MANAGEMENT" title={labels[page]} description={page === "billing" ? "학생 등록 시 첫 청구가 생성되며, 이후 최초 등록일 기준 월별 청구가 자동 생성됩니다." : "납부 완료로 기록한 수강료를 확인하세요."} action={page === "billing" && canManageBilling ? <Button onClick={startBilling} disabled={!activeStudents.length}><Plus size={17} /> 청구 등록</Button> : undefined} />
        {message && <div className="success-message">{message}</div>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!canManageBilling && <div className="placeholder-info billing-permission-note"><CircleAlert size={17} /><span>청구 등록과 납부 상태 변경은 학원 관리자만 할 수 있습니다.</span></div>}
        <section className="billing-summary">
          {[{ label: "청구 합계", value: billingCharges.reduce((total, charge) => total + charge.amount, 0) }, { label: "납부 완료", value: billingCharges.filter((charge) => charge.status === "paid").reduce((total, charge) => total + charge.amount, 0) }, { label: "미납", value: billingCharges.filter((charge) => charge.status === "unpaid").reduce((total, charge) => total + charge.amount, 0) }].map((item) => <div className="panel billing-summary-card" key={item.label}><span>{item.label}</span><strong>{formatNumber(item.value)}<small>원</small></strong></div>)}
        </section>
        {reminderPreview && <section className="panel reminder-preview"><div className="panel-heading"><div><h2>보호자 알림 미리보기</h2><p>카카오톡 연동 전이라 실제 메시지는 전송되지 않습니다.</p></div><Button variant="ghost" onClick={() => setReminderPreview("")}>닫기 <X size={16} /></Button></div><pre>{reminderPreview}</pre></section>}
        <section className="panel list-panel">
          <div className="billing-toolbar">
            <div><h2>{billingQueryPeriod.replace("-", "년 ")}월 수강료</h2><p>결제 처리는 하지 않으며, 수납 상태를 수기로 기록합니다.</p></div>
            <Field label="청구 월"><input type="month" value={billingQueryPeriod} onChange={(event) => { setBillingPeriod(event.target.value); if (billingFormOpen) setBillingForm((current) => ({ ...current, dueDate: `${event.target.value}-10` })); }} /></Field>
          </div>
          {billingFormOpen && <form className="billing-form" onSubmit={saveBilling}>
            <div className="form-grid">
              <Field label="학생" required><select required value={billingForm.studentId} onChange={(event) => selectBillingStudent(event.target.value)}><option value="" disabled>학생 선택</option>{activeStudents.map((student) => <option value={student.id} key={student.id}>{student.name} · 기본 {formatNumber(student.monthlyTuition)}원</option>)}</select></Field>
              <Field label="청구 금액 (원)" required><input required type="text" inputMode="numeric" pattern="[0-9,]*" value={billingForm.amount ? formatNumber(Number(billingForm.amount)) : ""} onChange={(event) => setBillingForm({ ...billingForm, amount: event.target.value.replace(/\D/g, "") })} placeholder="예: 300,000" /></Field>
              <Field label="납부 기한" required><input required type="date" value={billingForm.dueDate} onChange={(event) => setBillingForm({ ...billingForm, dueDate: event.target.value })} /></Field>
              <Field label="메모"><input maxLength={1000} value={billingForm.memo} onChange={(event) => setBillingForm({ ...billingForm, memo: event.target.value })} placeholder="선택 입력" /></Field>
            </div>
            <p className="tuition-estimate-note">기본 금액은 학생의 수강 반 원비 합계와 배정 좌석의 원비를 반영합니다. 청구 시 금액은 직접 조정할 수 있습니다.</p>
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
            return <div className="table-wrap"><table><thead><tr><th>학생</th><th>청구 월</th><th>청구 금액</th><th>납부 기한</th><th>상태</th><th>납부일</th>{canManageBilling && <th>관리</th>}</tr></thead><tbody>{visibleCharges.map((charge) => {
              const daysRemaining = daysUntilDue(charge.due_date, currentDate);
              const dueClass = charge.status === "unpaid"
                ? daysRemaining <= 0 ? "billing-due-today" : daysRemaining <= 7 ? "billing-due-soon" : ""
                : "";
              const canRemind = charge.status === "unpaid" && daysRemaining > 0;
              return <tr className={dueClass} key={charge.id}><td><strong>{charge.student_name}</strong>{charge.memo && <small className="billing-memo">{charge.memo}</small>}</td><td>{charge.billing_period}</td><td>{formatNumber(charge.amount)}원</td><td>{dateLabel(charge.due_date)}{dueClass === "billing-due-soon" && <small className="due-hint">결제일 {daysRemaining}일 전</small>}{dueClass === "billing-due-today" && <small className="due-hint">결제일</small>}</td><td><span className={`status-pill ${charge.status === "paid" ? "active" : ""}`}>{charge.status === "paid" ? "납부 완료" : "미납"}</span></td><td>{charge.paid_at ? dateLabel(new Date(charge.paid_at).toISOString().slice(0, 10)) : "—"}</td>{canManageBilling && <td className="billing-actions"><button className="billing-status-button" onClick={() => void updateBillingStatus(charge)}>{charge.status === "paid" ? "미납으로 변경" : "납부 처리"}</button>{canRemind && <button className="billing-reminder-button" onClick={() => showParentReminderNotConnected(charge)}>미리보기</button>}</td>}</tr>;
            })}</tbody></table></div>;
          })()}
        </section>
      </>}
      {page === "billing-settings" && <><PageHeading eyebrow="TUITION MANAGEMENT" title={labels[page]} description="보호자 알림에 사용할 기본 문구를 설정합니다." />{message && <div className="success-message">{message}</div>}{error && <p className="error-message" role="alert">{error}</p>}<form onSubmit={saveGuardianReminder} className="panel form-panel reminder-settings-form"><div className="form-section-title"><div><h2>보호자 알림 기본 메시지</h2><p>중괄호 항목은 발송 대상 정보로 바뀝니다. 현재는 미리보기만 가능하며 실제 발송은 되지 않습니다.</p></div></div><Field label="기본 메시지" required><textarea required maxLength={1000} rows={7} value={guardianReminder} onChange={(event) => setGuardianReminder(event.target.value)} /></Field><div className="reminder-tokens"><span>{`{학생명}`}</span><span>{`{학원명}`}</span><span>{`{납부일}`}</span><span>{`{금액}`}</span></div><div className="form-actions"><Button type="submit" disabled={savingGuardianReminder || !guardianReminder.trim()}>{savingGuardianReminder ? "저장 중..." : "기본 메시지 저장"} <Check size={16} /></Button></div></form></>}
      {page === "consultations" && <>
        <PageHeading eyebrow="STUDENT COUNSELING & LEARNING" title="상담·학습 관리" description="학생별 상담 내용, 모의고사 등급 변화, 매일 영단어 시험 결과를 기록하고 확인합니다." />
        {message && <div className="success-message">{message}</div>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!activeStudents.length ? <section className="panel"><Empty title="재원 학생이 없습니다" text="학생을 등록하면 상담과 시험 기록을 관리할 수 있습니다." /></section> : <>
          <section className="panel learning-toolbar">
            <Field label="학생 선택"><select value={selectedLearningStudent?.id ?? ""} onChange={(event) => { setLearningStudentId(event.target.value); setConsultations([]); setAssessments([]); setMessage(""); setError(""); }}><option value="" disabled>학생 선택</option>{activeStudents.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.grade || "학년 미입력"}</option>)}</select></Field>
            <div className="learning-tabs" role="tablist" aria-label="상담 및 학습 기록 종류">
              {([["consultations", "상담 기록"], ["mock_exam", "모의고사 성적"], ["vocabulary", "영단어 시험"]] as const).map(([tab, title]) => <button type="button" role="tab" aria-selected={learningTab === tab} className={learningTab === tab ? "learning-tab learning-tab-active" : "learning-tab"} key={tab} onClick={() => { setLearningTab(tab); setError(""); setMessage(""); }}>{title}</button>)}
            </div>
          </section>
          {learningTab === "consultations" && <>
            <form className="panel learning-form" onSubmit={saveConsultation}>
              <div className="panel-heading"><div><h2>상담 기록 추가</h2><p>{selectedLearningStudent?.name} 학생과 나눈 상담 내용을 기록합니다.</p></div><MessageSquareText size={19} className="muted-icon" /></div>
              <div className="form-grid">
                <Field label="상담 날짜" required><input type="date" required value={consultationForm.date} onChange={(event) => setConsultationForm({ ...consultationForm, date: event.target.value })} /></Field>
                <Field label="상담 유형" required><select value={consultationForm.category} onChange={(event) => setConsultationForm({ ...consultationForm, category: event.target.value })}>{["학습", "생활", "진로", "학부모", "기타"].map((category) => <option key={category} value={category}>{category} 상담</option>)}</select></Field>
                <Field label="상담 내용" required><textarea required maxLength={3000} rows={4} value={consultationForm.summary} onChange={(event) => setConsultationForm({ ...consultationForm, summary: event.target.value })} placeholder="학습 상황, 고민, 상담한 내용을 기록해 주세요." /></Field>
                <Field label="후속 조치"><textarea maxLength={1000} rows={3} value={consultationForm.nextAction} onChange={(event) => setConsultationForm({ ...consultationForm, nextAction: event.target.value })} placeholder="다음 상담 전까지 확인할 내용 (선택)" /></Field>
              </div>
              <div className="form-actions"><Button type="submit" disabled={savingLearningRecord}>{savingLearningRecord ? "저장 중..." : "상담 기록 저장"} <Check size={16} /></Button></div>
            </form>
            <section className="panel learning-record-panel"><div className="panel-heading"><div><h2>상담 이력</h2><p>{formatNumber(consultations.length)}건의 상담 기록</p></div></div>
              {consultations.length ? <div className="learning-record-list">{consultations.map((record) => <article className="learning-record" key={record.id}><div className="learning-record-meta"><strong>{dateLabel(record.consultation_date)}</strong><span>{record.category} 상담</span></div><div className="learning-record-content"><p>{record.summary}</p>{record.next_action && <small><b>후속 조치</b> {record.next_action}</small>}</div><button type="button" className="icon-button learning-delete" aria-label="상담 기록 삭제" onClick={() => void deleteLearningRecord("consultations", record.id)}><Trash2 size={16} /></button></article>)}</div> : <Empty title="상담 기록이 없습니다" text="학생 상담을 기록하면 이곳에 날짜별로 쌓입니다." />}
            </section>
          </>}
          {learningTab === "mock_exam" && <>
            <section className="panel grade-trend-panel"><div className="panel-heading"><div><h2>수능 등급 추이</h2><p>{selectedLearningStudent?.name} 학생의 과목별 모의고사 등급 변화 · 숫자가 낮을수록 높은 등급입니다.</p></div></div><GradeTrendChart assessments={assessments.filter((assessment) => assessment.assessment_type === "mock_exam")} /></section>
            <form className="panel learning-form" onSubmit={(event) => void saveAssessment(event, "mock_exam")}>
              <div className="panel-heading"><div><h2>모의고사 성적 입력</h2><p>시험과 과목별 등급을 기록하면 위 그래프에 추이가 표시됩니다.</p></div><BookOpen size={19} className="muted-icon" /></div>
              <div className="form-grid learning-exam-fields">
                <Field label="시험 날짜" required><input type="date" required value={mockExamForm.date} onChange={(event) => setMockExamForm({ ...mockExamForm, date: event.target.value })} /></Field>
                <Field label="시험 이름" required><input required maxLength={120} value={mockExamForm.title} onChange={(event) => setMockExamForm({ ...mockExamForm, title: event.target.value })} placeholder="예: 2027학년도 6월 모의평가" /></Field>
                <Field label="과목" required><input required maxLength={40} value={mockExamForm.subject} onChange={(event) => setMockExamForm({ ...mockExamForm, subject: event.target.value })} placeholder="예: 국어, 수학, 생활과 윤리" /></Field>
                <Field label="수능 등급" required><select value={mockExamForm.grade} onChange={(event) => setMockExamForm({ ...mockExamForm, grade: event.target.value })}>{Array.from({ length: 9 }, (_, index) => String(index + 1)).map((grade) => <option key={grade} value={grade}>{grade}등급</option>)}</select></Field>
                <Field label="원점수 (선택)"><input type="number" min="0" max="100" value={mockExamForm.score} onChange={(event) => setMockExamForm({ ...mockExamForm, score: event.target.value })} placeholder="0~100점" /></Field>
              </div>
              <div className="form-actions"><Button type="submit" disabled={savingLearningRecord || !mockExamForm.title.trim()}>{savingLearningRecord ? "저장 중..." : "모의고사 성적 저장"} <Check size={16} /></Button></div>
            </form>
            <section className="panel learning-record-panel"><div className="panel-heading"><div><h2>모의고사 성적 이력</h2><p>과목·시험별 등급 및 원점수</p></div></div>
              {assessments.filter((assessment) => assessment.assessment_type === "mock_exam").length ? <div className="table-wrap"><table><thead><tr><th>시험 날짜</th><th>시험</th><th>과목</th><th>등급</th><th>원점수</th><th></th></tr></thead><tbody>{assessments.filter((assessment) => assessment.assessment_type === "mock_exam").map((record) => <tr key={record.id}><td>{dateLabel(record.assessment_date)}</td><td>{record.title}</td><td>{record.subject}</td><td><span className="grade-pill">{record.grade}등급</span></td><td>{record.score === null ? "—" : `${record.score}점`}</td><td><button type="button" className="icon-button learning-delete" aria-label="모의고사 결과 삭제" onClick={() => void deleteLearningRecord("assessments", record.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div> : <Empty title="모의고사 성적이 없습니다" text="시험 결과를 입력하면 과목별 성적 이력을 확인할 수 있습니다." />}
            </section>
          </>}
          {learningTab === "vocabulary" && <>
            <section className="panel vocabulary-summary"><div><span>기록된 시험</span><strong>{formatNumber(assessments.filter((assessment) => assessment.assessment_type === "vocabulary").length)}<small>회</small></strong></div><div><span>최근 시험</span><strong>{assessments.find((assessment) => assessment.assessment_type === "vocabulary") ? dateLabel(assessments.find((assessment) => assessment.assessment_type === "vocabulary")!.assessment_date) : "—"}</strong></div><div><span>최근 정답률</span><strong>{(() => { const latest = assessments.find((assessment) => assessment.assessment_type === "vocabulary"); return latest?.max_score ? `${Math.round((latest.score ?? 0) * 100 / latest.max_score)}%` : "—"; })()}</strong></div></section>
            <form className="panel learning-form" onSubmit={(event) => void saveAssessment(event, "vocabulary")}>
              <div className="panel-heading"><div><h2>영단어 시험 결과 입력</h2><p>학생용 앱 연동 전까지는 학원장·관리자가 결과를 대신 기록할 수 있습니다.</p></div><BookOpen size={19} className="muted-icon" /></div>
              <div className="form-grid">
                <Field label="시험 날짜" required><input type="date" required value={vocabularyForm.date} onChange={(event) => setVocabularyForm({ ...vocabularyForm, date: event.target.value })} /></Field>
                <Field label="시험 이름"><input maxLength={120} value={vocabularyForm.title} onChange={(event) => setVocabularyForm({ ...vocabularyForm, title: event.target.value })} placeholder="예: Day 12 단어 시험" /></Field>
                <Field label="맞힌 개수" required><input type="number" min="0" max="1000" required value={vocabularyForm.score} onChange={(event) => setVocabularyForm({ ...vocabularyForm, score: event.target.value })} /></Field>
                <Field label="전체 문항 수" required><input type="number" min="1" max="1000" required value={vocabularyForm.maxScore} onChange={(event) => setVocabularyForm({ ...vocabularyForm, maxScore: event.target.value })} /></Field>
              </div>
              <div className="form-actions"><Button type="submit" disabled={savingLearningRecord}>{savingLearningRecord ? "저장 중..." : "영단어 결과 저장"} <Check size={16} /></Button></div>
            </form>
            <section className="panel learning-record-panel"><div className="panel-heading"><div><h2>영단어 시험 이력</h2><p>날짜별 정답 개수와 정답률을 확인합니다.</p></div></div>
              {assessments.filter((assessment) => assessment.assessment_type === "vocabulary").length ? <div className="table-wrap"><table><thead><tr><th>날짜</th><th>시험</th><th>결과</th><th>정답률</th><th></th></tr></thead><tbody>{assessments.filter((assessment) => assessment.assessment_type === "vocabulary").map((record) => <tr key={record.id}><td>{dateLabel(record.assessment_date)}</td><td>{record.title || "영단어 시험"}</td><td>{record.score} / {record.max_score}</td><td>{record.max_score ? `${Math.round((record.score ?? 0) * 100 / record.max_score)}%` : "—"}</td><td><button type="button" className="icon-button learning-delete" aria-label="영단어 결과 삭제" onClick={() => void deleteLearningRecord("assessments", record.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div> : <Empty title="영단어 시험 기록이 없습니다" text="매일 본 시험의 맞힌 개수와 전체 문항 수를 기록해 보세요." />}
            </section>
          </>}
        </>}
      </>}
      {page === "staff" && <StaffManagement academyName={academy.name} currentUserEmail={user.email} currentRole={academy.role} />}
      {(["schedule", "academy", "permissions"] as Page[]).includes(page) && <><PageHeading eyebrow={page === "schedule" ? "CLASS MANAGEMENT" : "ACADEMY SETTINGS"} title={labels[page]} description="논의한 기능을 차근차근 연결하고 있습니다." /><section className="panel placeholder-panel"><Empty title={`${labels[page]} 기능을 준비하고 있어요`} text="이 화면은 메뉴 구성 확인을 위한 자리입니다. 실제 데이터 저장이나 업무 처리는 아직 지원하지 않습니다." /><div className="placeholder-info"><CircleAlert size={17} /><span>{page === "schedule" ? "수업 일정과 휴강 처리 방식은 아직 정해지지 않았습니다." : "계정, 학원별 데이터 분리, 직원 권한은 아직 연결되지 않았습니다."}</span></div></section></>}
      <footer className="footer"><Logo /><span>학원 관리의 시작, 유클리온과 함께.</span><small>로그인 후 학원 데이터 관리</small></footer>
    </main>
  </div>;
}

function StudentTable({ students, classNames, select }: { students: Student[]; classNames: (ids: string[]) => string; select: (id: string) => void }) {
  if (!students.length) return <Empty title="학생이 없습니다" text="검색 조건을 변경하거나 새로운 학생을 등록해 보세요." />;
  return <div className="table-wrap"><table><thead><tr><th>학생</th><th>성별</th><th>학교</th><th>학년·수험 상태</th><th>수강 반</th><th>등록일</th><th>상태</th><th><span className="sr-only">상세</span></th></tr></thead><tbody>{students.map((s) => <tr key={s.id}><td><button className="table-person" onClick={() => select(s.id)}><span className="person-avatar">{s.name.slice(0, 1)}</span><span><strong>{s.name}</strong><small>{s.phone}</small></span></button></td><td>{s.gender === "male" ? "남학생" : s.gender === "female" ? "여학생" : "미지정"}</td><td>{s.school || "—"}</td><td>{s.grade || "—"}</td><td>{classNames(s.classes) || "—"}</td><td>{dateLabel(s.enrolled)}</td><td><span className={`status-pill ${s.status === "재원" ? "active" : ""}`}>{s.status}</span></td><td><button className="table-arrow" onClick={() => select(s.id)} aria-label={`${s.name} 상세 보기`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div>;
}

function GradeTrendChart({ assessments }: { assessments: AssessmentRecord[] }) {
  const mockExams = assessments.filter(
    (assessment) => assessment.assessment_type === "mock_exam" && assessment.grade !== null,
  );
  const sessions = [...new Map(
    mockExams.map((assessment) => [
      `${assessment.assessment_date}|${assessment.title}`,
      { date: assessment.assessment_date, title: assessment.title },
    ]),
  ).values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ko"),
  ).slice(-8);
  const visibleKeys = new Set(sessions.map(({ date, title }) => `${date}|${title}`));
  const visibleExams = mockExams.filter(
    (assessment) => visibleKeys.has(`${assessment.assessment_date}|${assessment.title}`),
  );
  const subjects = [...new Set(visibleExams.map((assessment) => assessment.subject))];
  if (!sessions.length) {
    return <Empty title="아직 표시할 성적이 없습니다" text="모의고사 성적을 입력하면 최대 8회차까지 등급 변화가 표시됩니다." />;
  }

  const width = Math.max(520, sessions.length * 90 + 80);
  const x = (index: number) => sessions.length === 1
    ? width / 2
    : 48 + index * (width - 96) / (sessions.length - 1);
  const y = (grade: number) => 18 + (grade - 1) * 21;
  const colors: Record<string, string> = {
    국어: "#2f8059", 수학: "#397bb8", 영어: "#bd6a3b",
    한국사: "#9068ae",
  };
  const palette = ["#c19732", "#c55672", "#438b8b", "#9a7046"];

  return <div className="grade-chart-scroll">
    <svg className="grade-chart" viewBox={`0 0 ${width} 226`} role="img" aria-label="모의고사 과목별 수능 등급 추이">
      {Array.from({ length: 9 }, (_, index) => {
        const grade = index + 1;
        const position = y(grade);
        return <g key={grade}><line x1="38" x2={width - 12} y1={position} y2={position} className="grade-chart-grid" /><text x="22" y={position + 4} className="grade-chart-axis">{grade}</text></g>;
      })}
      {subjects.map((subject) => {
        const points = visibleExams.flatMap((assessment) => {
          if (assessment.subject !== subject || assessment.grade === null) return [];
          const index = sessions.findIndex(
            (session) => session.date === assessment.assessment_date && session.title === assessment.title,
          );
          return index < 0 ? [] : [{ x: x(index), y: y(assessment.grade), assessment }];
        }).sort((a, b) => a.x - b.x);
        if (!points.length) return null;
        const color = colors[subject] ?? palette[subjects.indexOf(subject) % palette.length];
        return <g key={subject}><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />{points.map(({ x: pointX, y: pointY, assessment }) => <circle cx={pointX} cy={pointY} r="4" fill={color} key={assessment.id}><title>{`${assessment.title} · ${assessment.subject} ${assessment.grade}등급`}</title></circle>)}</g>;
      })}
      {sessions.map((session, index) => <text key={`${session.date}|${session.title}`} x={x(index)} y="216" textAnchor="middle" className="grade-chart-date">{session.date.slice(5).replace("-", ".")}</text>)}
    </svg>
    <div className="grade-chart-legend">{subjects.map((subject) => <span key={subject}><i style={{ backgroundColor: colors[subject] ?? palette[subjects.indexOf(subject) % palette.length] }} />{subject}</span>)}</div>
    <p className="grade-chart-note">1등급에 가까울수록 그래프 위쪽에 표시됩니다. 날짜가 같은 시험은 시험명 기준으로 회차를 나눕니다.</p>
  </div>;
}
