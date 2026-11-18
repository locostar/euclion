import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import {
  isDate,
  parseJson,
  studentInput,
} from "@/lib/request-validation";

type StudentRow = {
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
  monthly_tuition_adjustment: number;
  tuition_adjustment_reason: string | null;
  memo: string | null;
  class_id: string | null;
};

async function validateClasses(
  env: CloudflareEnv,
  organizationId: string,
  classIds: string[],
) {
  if (new Set(classIds).size !== classIds.length) return false;
  if (classIds.length === 0) return true;

  const placeholders = classIds.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `SELECT id FROM classes WHERE organization_id = ? AND id IN (${placeholders})`,
  )
    .bind(organizationId, ...classIds)
    .all<{ id: string }>();

  return result.results.length === classIds.length;
}

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const rows = await result.context.env.DB.prepare(
    `SELECT s.id, s.name, s.birth_date, s.phone, s.guardian_phone,
            s.gender, s.school, s.grade, s.graduated_school, s.address,
            s.enrolled_on, s.status, s.fingerprint_status,
            s.monthly_tuition_adjustment, s.tuition_adjustment_reason, s.memo,
            cs.class_id
     FROM students s
     LEFT JOIN class_students cs
       ON cs.organization_id = s.organization_id
      AND cs.student_id = s.id
     WHERE s.organization_id = ?
     ORDER BY s.created_at DESC, s.name`,
  )
    .bind(result.context.organizationId)
    .all<StudentRow>();

  const students = new Map<
    string,
    Omit<StudentRow, "class_id"> & { classIds: string[] }
  >();

  for (const row of rows.results) {
    const student = students.get(row.id) ?? {
      id: row.id,
      name: row.name,
      birth_date: row.birth_date,
      phone: row.phone,
      guardian_phone: row.guardian_phone,
      gender: row.gender,
      school: row.school,
      grade: row.grade,
      graduated_school: row.graduated_school,
      address: row.address,
      enrolled_on: row.enrolled_on,
      status: row.status,
      fingerprint_status: row.fingerprint_status,
      monthly_tuition_adjustment: row.monthly_tuition_adjustment,
      tuition_adjustment_reason: row.tuition_adjustment_reason,
      memo: row.memo,
      classIds: [],
    };
    if (row.class_id) student.classIds.push(row.class_id);
    students.set(row.id, student);
  }

  return apiJson([...students.values()]);
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, studentInput);
  if ("response" in parsed) return parsed.response;
  const student = parsed.data;
  if (!student.classIds.length) {
    return apiError(400, "CLASS_REQUIRED", "수강 반을 하나 이상 선택해 주세요.");
  }

  if (!isDate(student.enrolledOn) || (student.birthDate && !isDate(student.birthDate))) {
    return apiError(400, "INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }
  if (!(await validateClasses(result.context.env, result.context.organizationId, student.classIds))) {
    return apiError(400, "INVALID_CLASS", "선택한 반을 확인해 주세요.");
  }

  const classFees = student.classIds.length
    ? await result.context.env.DB.prepare(
      `SELECT COALESCE(SUM(monthly_fee), 0) AS amount
       FROM classes
       WHERE organization_id = ? AND id IN (${student.classIds.map(() => "?").join(", ")})`,
    )
      .bind(result.context.organizationId, ...student.classIds)
      .first<{ amount: number }>()
    : { amount: 0 };

  const id = crypto.randomUUID();
  const nowParts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(Date.now());
  const registeredOn = `${nowParts.find((part) => part.type === "year")?.value}-${nowParts.find((part) => part.type === "month")?.value}-${nowParts.find((part) => part.type === "day")?.value}`;
  const initialChargeAmount = Math.max(
    0,
    (classFees?.amount ?? 0) + student.monthlyTuitionAdjustment,
  );
  const statements = [
    result.context.env.DB.prepare(
      `INSERT INTO students
        (id, organization_id, name, birth_date, phone, guardian_phone, gender,
         school, grade, graduated_school, address, enrolled_on, status,
         monthly_tuition_adjustment, tuition_adjustment_reason, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).bind(
      id,
      result.context.organizationId,
      student.name,
      student.birthDate,
      student.phone,
      student.guardianPhone,
      student.gender,
      student.school,
      student.grade,
      student.graduatedSchool,
      student.address,
      student.enrolledOn,
      student.monthlyTuitionAdjustment,
      student.tuitionAdjustmentReason,
      student.memo,
    ),
    ...student.classIds.map((classId) =>
      result.context.env.DB.prepare(
        `INSERT INTO class_students (organization_id, class_id, student_id)
         VALUES (?, ?, ?)`,
      ).bind(result.context.organizationId, classId, id),
    ),
  ];

  statements.push(
    result.context.env.DB.prepare(
      `INSERT INTO tuition_charges
        (id, organization_id, student_id, billing_period, amount, due_date,
         memo, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, '최초 등록 청구',
         CASE WHEN ? = 0 THEN 'paid' ELSE 'unpaid' END,
         CASE WHEN ? = 0 THEN cast(unixepoch('subsecond') * 1000 as integer)
           ELSE NULL END)
       ON CONFLICT (organization_id, student_id, billing_period) DO NOTHING`,
    ).bind(
      crypto.randomUUID(),
      result.context.organizationId,
      id,
      registeredOn.slice(0, 7),
      initialChargeAmount,
      registeredOn,
      initialChargeAmount,
      initialChargeAmount,
    ),
  );

  await result.context.env.DB.batch(statements);
  return apiJson({ id }, { status: 201 });
}
