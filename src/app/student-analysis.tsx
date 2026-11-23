"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { analysisGrades, snapshotSchema, type AnalysisGroup, type AdmissionInput } from "@/lib/student-analysis";

type Student = { id: string; name: string; school: string | null; grade: string | null; graduated_school: string | null; status: string; enrolled_on: string };
type Snapshot = { period: string; groups_json: string };
type Admission = { id: string; student_id: string; student_name: string; admission_year: number; university: string; department: string; outcome: AdmissionInput["outcome"]; cohort: AdmissionInput["cohort"]; graduated_school: string; admission_detail: string; source: string };
type AnalysisData = { students: Student[]; snapshots: Snapshot[]; admissions: Admission[] };
type Form = { id?: string; studentId: string; year: string; university: string; department: string; outcome: AdmissionInput["outcome"]; cohort: AdmissionInput["cohort"]; graduatedSchool: string; detail: string; source: string };
const emptyForm = (): Form => ({ studentId: "", year: String(new Date().getFullYear()), university: "", department: "", outcome: "진학", cohort: "미지정", graduatedSchool: "", detail: "", source: "" });
const getMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(new Date());
const format = (count: number) => count.toLocaleString("ko-KR");

function readGroups(snapshot: Snapshot): AnalysisGroup[] {
  const parsed = snapshotSchema.safeParse({ period: snapshot.period, groups: JSON.parse(snapshot.groups_json) });
  if (!parsed.success) throw new Error(`${snapshot.period} 현황 데이터 형식이 올바르지 않습니다.`);
  return parsed.data.groups;
}

export function StudentAnalysis() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [period, setPeriod] = useState(getMonth);
  const [groups, setGroups] = useState<AnalysisGroup[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/student-analysis");
    if (!response.ok) throw new Error("학생 분석 자료를 불러오지 못했습니다.");
    const next = await response.json() as AnalysisData;
    for (const snapshot of next.snapshots) readGroups(snapshot);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (active) {
        setData(next);
        const snapshot = next.snapshots.find((item) => item.period === getMonth());
        if (snapshot) setGroups(readGroups(snapshot));
      }
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "자료를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [load]);

  const active = data?.students.filter((student) => student.status === "active") ?? [];
  const currentGroups = active.reduce<AnalysisGroup[]>((items, student) => {
    const grade = analysisGrades.find((item) => item === student.grade) ?? "미지정";
    const school = (["재수", "삼수", "N수"].includes(grade) ? student.graduated_school : student.school) || "미지정";
    const row = items.find((item) => item.grade === grade && item.school === school);
    if (row) row.count += 1;
    else items.push({ school, grade, count: 1 });
    return items;
  }, []);
  const saved = data?.snapshots.find((item) => item.period === period);
  const previousPeriod = `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`;
  const previous = data?.snapshots.find((item) => item.period === previousPeriod);
  const total = saved ? readGroups(saved).reduce((sum, group) => sum + group.count, 0) : null;
  const previousTotal = previous ? readGroups(previous).reduce((sum, group) => sum + group.count, 0) : null;
  const year = period.slice(0, 4);
  const registrations = data?.students.filter((student) => student.enrolled_on.startsWith(`${year}-`)).length ?? 0;
  const previousRegistrations = data?.students.filter((student) => student.enrolled_on.startsWith(`${Number(year) - 1}-`)).length ?? 0;
  const universityCounts = (data?.admissions ?? []).filter((item) => item.admission_year === Number(year) && item.outcome === "진학")
    .reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.university]: (counts[item.university] ?? 0) + 1 }), {});
  const repeatAdmissions = (data?.admissions ?? []).filter((item) => item.admission_year === Number(year) && item.outcome === "진학" && ["재수", "삼수", "N수"].includes(item.cohort));

  function choosePeriod(value: string) {
    setPeriod(value);
    const item = data?.snapshots.find((snapshot) => snapshot.period === value);
    setGroups(item ? readGroups(item) : []);
    setMessage("");
  }

  async function submitSnapshot(event: FormEvent) {
    event.preventDefault();
    const parsed = snapshotSchema.safeParse({ period, groups });
    if (!parsed.success) { setError("월, 학교, 학년, 인원을 확인해 주세요. 같은 학교와 학년은 한 번만 입력할 수 있습니다."); return; }
    if (saved && !window.confirm(`${period}에 저장된 현황을 입력한 내용으로 덮어쓸까요?`)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/student-analysis", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) throw new Error("월별 현황을 저장하지 못했습니다.");
      setData(await load());
      setMessage(`${period} 현황을 저장했습니다.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "월별 현황을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  async function submitAdmission(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/student-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, year: Number(form.year) }) });
      if (!response.ok) throw new Error("진학 기록을 저장하지 못했습니다. 학생과 입력 내용을 확인해 주세요.");
      setData(await load()); setForm(emptyForm()); setMessage("진학 기록을 저장했습니다.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "진학 기록을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  async function deleteAdmission(id: string) {
    if (!window.confirm("이 진학 기록을 삭제할까요?")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/student-analysis?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("진학 기록을 삭제하지 못했습니다.");
      setData(await load()); setMessage("진학 기록을 삭제했습니다.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "진학 기록을 삭제하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">STUDENT ANALYSIS</div><h1>학생·진학 분석</h1><p>월별 재원 현황과 학생별 대학 진학 결과를 기록하고 비교합니다.</p></div></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {message && <p className="success-message" role="status">{message}</p>}
    {!data ? <section className="panel">{error ? <button className="button button-outline" onClick={() => void load().then((next) => { setData(next); const snapshot = next.snapshots.find((item) => item.period === period); setGroups(snapshot ? readGroups(snapshot) : []); setError(""); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "자료를 불러오지 못했습니다."))}>다시 시도</button> : "분석 자료를 불러오고 있습니다."}</section> : <>
      <section className="panel analysis-section">
        <h2>재원 인원 비교</h2>
        <p>직접 저장한 월말 현황 기준입니다. 해당 월을 저장하지 않으면 비교하지 않습니다.</p>
        <label className="field analysis-period">기준 월<input type="month" value={period} onChange={(event) => choosePeriod(event.target.value)} /></label>
        <div className="sales-summary">
          <div className="sales-summary-card"><span>{period} 재원</span><strong>{total === null ? "기록 없음" : `${format(total)}명`}</strong></div>
          <div className="sales-summary-card"><span>{previousPeriod} 재원</span><strong>{previousTotal === null ? "기록 없음" : `${format(previousTotal)}명`}</strong></div>
          <div className="sales-summary-card"><span>전년 같은 월 대비</span><strong>{total === null || previousTotal === null ? "비교 불가" : `${total - previousTotal > 0 ? "+" : ""}${format(total - previousTotal)}명`}</strong></div>
        </div>
        <p>연도별 비교는 같은 월을 선택하세요. 12월을 선택하면 연말 인원을 비교합니다.</p>
        <div className="table-wrap"><table><thead><tr><th>기록 월</th><th>재원 인원</th></tr></thead><tbody>{data.snapshots.map((item) => <tr key={item.period}><td><button className="text-link" onClick={() => choosePeriod(item.period)}>{item.period}</button></td><td>{format(readGroups(item).reduce((sum, row) => sum + row.count, 0))}명</td></tr>)}</tbody></table></div>
        {!data.snapshots.length && <p>저장된 월별 현황이 없습니다.</p>}
        <p>{year}년 등록일 기준 학생 {format(registrations)}명 · 전년 {format(previousRegistrations)}명 · 차이 {registrations - previousRegistrations > 0 ? "+" : ""}{format(registrations - previousRegistrations)}명. 이는 현재 학생 기록의 등록일 기준이며 재등록 이력이나 과거 재원 인원은 아닙니다.</p>
      </section>
      <section className="panel analysis-section">
        <h2>학교·학년별 월말 인원 입력</h2><p>재수·삼수·N수는 졸업 고등학교를 입력합니다. 전체 월말 인원을 입력한 후 저장하세요. 빈 목록을 저장하면 0명으로 기록됩니다.</p>
        <form onSubmit={submitSnapshot}>
          <div className="analysis-rows">{groups.map((group, index) => <div className="analysis-row" key={index}>
            <label className="field">학교<input required maxLength={120} value={group.school} onChange={(e) => setGroups(groups.map((row, i) => i === index ? { ...row, school: e.target.value } : row))} /></label>
            <label className="field">학년<select value={group.grade} onChange={(e) => setGroups(groups.map((row, i) => i === index ? { ...row, grade: analysisGrades.find((g) => g === e.target.value) ?? "미지정" } : row))}>{analysisGrades.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
            <label className="field">인원<input required type="number" min="0" max="100000" value={group.count} onChange={(e) => setGroups(groups.map((row, i) => i === index ? { ...row, count: e.target.valueAsNumber } : row))} /></label>
            <button type="button" className="button button-outline" onClick={() => setGroups(groups.filter((_, i) => i !== index))} aria-label={`${index + 1}번째 항목 제거`}>제거</button>
          </div>)}</div>
          <div className="analysis-actions"><button type="button" className="button button-outline" onClick={() => setGroups([...groups, { school: "", grade: "고1", count: 0 }])}>학교·학년 추가</button>
            <button type="button" className="button button-outline" onClick={() => { if (window.confirm(`${period} 입력 내용을 현재 재원 학생 현황으로 바꿀까요? 현재 현황은 과거 월말 현황과 다를 수 있습니다.`)) setGroups(currentGroups); }}>현재 재원 현황 가져오기</button>
            <button type="submit" className="button button-primary" disabled={saving || !period}>월별 현황 저장</button></div>
        </form>
        <p>현재 재원 분포: {format(active.length)}명 (재수생은 졸업 학교 기준). 현재 학생 정보가 바뀌어도 저장된 과거 월 현황은 자동 변경되지 않습니다.</p>
        <div className="table-wrap"><table><thead><tr><th>현재 학교·졸업 학교</th><th>현재 학년</th><th>인원</th></tr></thead><tbody>{currentGroups.map((row) => <tr key={JSON.stringify([row.school, row.grade])}><td>{row.school}</td><td>{row.grade}</td><td>{format(row.count)}명</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel analysis-section">
        <h2>대학 진학·입결 기록</h2><p>학생별 지원·합격·진학 결과와 확인한 점수·등급 등 입결 및 출처를 직접 입력합니다. 공식 대학 입결을 자동 조회하거나 추정하지 않습니다.</p>
        <form onSubmit={submitAdmission} className="analysis-form">
          <label className="field">학생<select required value={form.studentId} onChange={(e) => { const student = data.students.find((s) => s.id === e.target.value); setForm({ ...form, studentId: e.target.value, cohort: analysisGrades.find((g) => g === student?.grade) ?? "미지정", graduatedSchool: student?.graduated_school ?? "" }); }}><option value="">학생 선택</option>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status === "active" ? "재원" : "퇴원"})</option>)}</select></label>
          <label className="field">입학 연도<input required type="number" min="1900" max="2100" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
          <label className="field">대학교<input required maxLength={120} value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} /></label>
          <label className="field">학과<input maxLength={120} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
          <label className="field">결과<select value={form.outcome} onChange={(e) => { const outcome = ["합격", "불합격", "대기", "진학"].find((value) => value === e.target.value); if (outcome === "합격" || outcome === "불합격" || outcome === "대기" || outcome === "진학") setForm({ ...form, outcome }); }}><option>진학</option><option>합격</option><option>불합격</option><option>대기</option></select></label>
          <label className="field">당시 학년·재수 구분<select value={form.cohort} onChange={(e) => setForm({ ...form, cohort: analysisGrades.find((g) => g === e.target.value) ?? "미지정" })}>{analysisGrades.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
          <label className="field">졸업 고등학교<input maxLength={120} value={form.graduatedSchool} onChange={(e) => setForm({ ...form, graduatedSchool: e.target.value })} /></label>
          <label className="field">입결·전형 메모<input maxLength={1000} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="예: 전형, 점수·등급과 기준 연도" /></label>
          <label className="field">입결 출처<input maxLength={500} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="공식 발표 자료명 또는 URL" /></label>
          <div className="analysis-actions"><button className="button button-primary" disabled={saving}>{form.id ? "수정 저장" : "진학 기록 추가"}</button>{form.id && <button type="button" className="button button-outline" onClick={() => setForm(emptyForm())}>수정 취소</button>}</div>
        </form>
        <h3>{year}년 기록된 진학 결과</h3>
        <p>{format(data.admissions.filter((item) => item.admission_year === Number(year) && item.outcome === "진학").length)}건 진학 · 여러 결과를 기록할 수 있으므로 학생 수와 다를 수 있습니다.</p>
        <div className="sales-summary">{Object.entries(universityCounts).map(([university, count]) => <div className="sales-summary-card" key={university}><span>{university}</span><strong>{format(count)}건</strong></div>)}</div>
        <p>{year}년 재수·삼수·N수 진학 기록: {format(repeatAdmissions.length)}건</p>
        <div className="table-wrap"><table><thead><tr><th>졸업 학교</th><th>구분</th><th>진학 대학·학과</th></tr></thead><tbody>{repeatAdmissions.map((item) => <tr key={item.id}><td>{item.graduated_school || "미입력"}</td><td>{item.cohort}</td><td>{item.university} {item.department}</td></tr>)}</tbody></table></div>
        <div className="table-wrap"><table><thead><tr><th>연도</th><th>학생</th><th>당시 구분·졸업 학교</th><th>대학교·학과</th><th>결과</th><th>입결·출처</th><th>관리</th></tr></thead><tbody>{data.admissions.map((item) => <tr key={item.id}><td>{item.admission_year}</td><td>{item.student_name}</td><td>{item.cohort} · {item.graduated_school || "미입력"}</td><td>{item.university} {item.department}</td><td>{item.outcome}</td><td>{item.admission_detail || "미입력"}<br />{item.source || "출처 미입력"}</td><td><button className="text-link" onClick={() => setForm({ id: item.id, studentId: item.student_id, year: String(item.admission_year), university: item.university, department: item.department, outcome: item.outcome, cohort: item.cohort, graduatedSchool: item.graduated_school, detail: item.admission_detail, source: item.source })}>수정</button> <button className="text-link" disabled={saving} onClick={() => void deleteAdmission(item.id)}>삭제</button></td></tr>)}</tbody></table></div>
        {!data.admissions.length && <p>등록된 진학 기록이 없습니다.</p>}
      </section>
    </>}
  </>;
}
