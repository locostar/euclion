import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { parseJson } from "@/lib/request-validation";
import { snapshotSchema, admissionSchema } from "@/lib/student-analysis";

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;
  const { env, organizationId } = result.context;
  const [students, snapshots, admissions] = await env.DB.batch([
    env.DB.prepare("SELECT id, name, school, grade, graduated_school, status, enrolled_on FROM students WHERE organization_id = ? ORDER BY name, id").bind(organizationId),
    env.DB.prepare("SELECT period, groups_json, updated_at FROM student_monthly_snapshots WHERE organization_id = ? ORDER BY period DESC").bind(organizationId),
    env.DB.prepare(`SELECT a.id, a.student_id, s.name AS student_name, a.admission_year, a.university, a.department, a.outcome, a.cohort, a.graduated_school, a.admission_detail, a.source
      FROM student_admission_results a JOIN students s ON s.id = a.student_id AND s.organization_id = a.organization_id
      WHERE a.organization_id = ? ORDER BY a.admission_year DESC, s.name, a.id`).bind(organizationId),
  ]);
  return apiJson({ students: students.results, snapshots: snapshots.results, admissions: admissions.results });
}

export async function PUT(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;
  const parsed = await parseJson(request, snapshotSchema);
  if ("response" in parsed) return parsed.response;
  await result.context.env.DB.prepare(`INSERT INTO student_monthly_snapshots (organization_id, period, groups_json)
    VALUES (?, ?, ?) ON CONFLICT (organization_id, period) DO UPDATE SET groups_json = excluded.groups_json,
    updated_at = cast(unixepoch('subsecond') * 1000 as integer)`)
    .bind(result.context.organizationId, parsed.data.period, JSON.stringify(parsed.data.groups)).run();
  return apiJson({ saved: true });
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;
  const parsed = await parseJson(request, admissionSchema);
  if ("response" in parsed) return parsed.response;
  const { env, organizationId } = result.context;
  const data = parsed.data;
  const student = await env.DB.prepare("SELECT id FROM students WHERE id = ? AND organization_id = ?").bind(data.studentId, organizationId).first();
  if (!student) return apiError(404, "STUDENT_NOT_FOUND", "학생을 찾을 수 없습니다.");
  if (data.id) {
    const updated = await env.DB.prepare(`UPDATE student_admission_results SET student_id = ?, admission_year = ?, university = ?, department = ?, outcome = ?, cohort = ?, graduated_school = ?, admission_detail = ?, source = ?, updated_at = cast(unixepoch('subsecond') * 1000 as integer) WHERE id = ? AND organization_id = ?`)
      .bind(data.studentId, data.year, data.university, data.department, data.outcome, data.cohort, data.graduatedSchool, data.detail, data.source, data.id, organizationId).run();
    if (!updated.meta.changes) return apiError(404, "RESULT_NOT_FOUND", "진학 기록을 찾을 수 없습니다.");
    return apiJson({ saved: true });
  }
  await env.DB.prepare(`INSERT INTO student_admission_results (id, organization_id, student_id, admission_year, university, department, outcome, cohort, graduated_school, admission_detail, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), organizationId, data.studentId, data.year, data.university, data.department, data.outcome, data.cohort, data.graduatedSchool, data.detail, data.source).run();
  return apiJson({ saved: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 80) return apiError(400, "INVALID_ID", "진학 기록을 확인해 주세요.");
  const deleted = await result.context.env.DB.prepare("DELETE FROM student_admission_results WHERE id = ? AND organization_id = ?").bind(id, result.context.organizationId).run();
  if (!deleted.meta.changes) return apiError(404, "RESULT_NOT_FOUND", "진학 기록을 찾을 수 없습니다.");
  return apiJson({ deleted: true });
}
