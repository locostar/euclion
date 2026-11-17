import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { classInput, isDate, parseJson } from "@/lib/request-validation";

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

  const classes = await result.context.env.DB.prepare(
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
    .all<ClassRow>();

  return apiJson(classes.results);
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, classInput);
  if ("response" in parsed) return parsed.response;
  const classroom = parsed.data;

  if (
    (classroom.startsOn && !isDate(classroom.startsOn)) ||
    (classroom.endsOn && !isDate(classroom.endsOn)) ||
    (classroom.startsOn &&
      classroom.endsOn &&
      classroom.startsOn > classroom.endsOn)
  ) {
    return apiError(400, "INVALID_DATE_RANGE", "운영 기간을 확인해 주세요.");
  }

  const id = crypto.randomUUID();
  await result.context.env.DB.prepare(
    `INSERT INTO classes
      (id, organization_id, name, subject, teacher, grade, capacity,
       room, starts_on, ends_on, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      result.context.organizationId,
      classroom.name,
      classroom.subject,
      classroom.teacher,
      classroom.grade,
      classroom.capacity ?? null,
      classroom.room,
      classroom.startsOn,
      classroom.endsOn,
      classroom.memo,
    )
    .run();

  return apiJson({ id }, { status: 201 });
}
