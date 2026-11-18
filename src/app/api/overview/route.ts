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
              s.enrolled_on, s.status, s.memo, cs.class_id
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
      `SELECT c.id, c.name, c.subject, c.teacher, c.grade, c.capacity,
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
