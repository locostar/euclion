import { getAcademyContext, apiJson } from "@/lib/api-context";

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
  fingerprint_status: "not_registered" | "pending_device" | "ready";
  monthly_tuition: number;
  memo: string | null;
  class_id: string | null;
};

type ClassRow = {
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

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const [studentRows, classRows] = await Promise.all([
    result.context.env.DB.prepare(
      `SELECT s.id, s.name, s.birth_date, s.phone, s.guardian_phone,
              s.gender, s.school, s.grade, s.graduated_school, s.address,
              s.enrolled_on, s.status, s.fingerprint_status, s.memo, cs.class_id,
              COALESCE((
                SELECT SUM(c.monthly_fee)
                FROM class_students fee_cs
                INNER JOIN classes c
                  ON c.id = fee_cs.class_id AND c.organization_id = fee_cs.organization_id
                WHERE fee_cs.organization_id = s.organization_id
                  AND fee_cs.student_id = s.id
              ), 0) + COALESCE((
                SELECT so.monthly_fee FROM seat_occupancy so
                WHERE so.organization_id = s.organization_id AND so.student_id = s.id
                LIMIT 1
              ), 0) AS monthly_tuition
       FROM students s
       LEFT JOIN class_students cs
         ON cs.organization_id = s.organization_id
        AND cs.student_id = s.id
       WHERE s.organization_id = ?
       ORDER BY s.created_at DESC, s.name`,
    )
      .bind(result.context.organizationId)
      .all<StudentRow>(),
    result.context.env.DB.prepare(
      `SELECT c.id, c.name, c.subject, c.teacher, c.grade, c.capacity, c.monthly_fee,
              c.room, c.starts_on, c.ends_on, c.memo,
              COUNT(CASE WHEN s.status = 'active' THEN 1 END) AS student_count
       FROM classes c
       LEFT JOIN class_students cs
         ON cs.organization_id = c.organization_id AND cs.class_id = c.id
       LEFT JOIN students s
         ON s.organization_id = cs.organization_id AND s.id = cs.student_id
       WHERE c.organization_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC, c.name`,
    )
      .bind(result.context.organizationId)
      .all<ClassRow>(),
  ]);

  const students = new Map<string, Omit<StudentRow, "class_id"> & { classIds: string[] }>();
  for (const row of studentRows.results) {
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
      monthly_tuition: row.monthly_tuition,
      memo: row.memo,
      classIds: [],
    };
    if (row.class_id) student.classIds.push(row.class_id);
    students.set(row.id, student);
  }

  return apiJson({
    students: [...students.values()],
    classes: classRows.results,
  });
}
