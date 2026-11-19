import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const { id } = await params;
  const student = await result.context.env.DB.prepare(
    "SELECT id FROM students WHERE organization_id = ? AND id = ? LIMIT 1",
  ).bind(result.context.organizationId, id).first<{ id: string }>();
  if (!student) return apiError(404, "STUDENT_NOT_FOUND", "학생을 찾을 수 없습니다.");

  const rows = await result.context.env.DB.prepare(
    `SELECT id, from_room, from_seat, to_room, to_seat, moved_at
     FROM seat_move_history WHERE organization_id = ? AND student_id = ?
     ORDER BY moved_at DESC, id DESC`,
  ).bind(result.context.organizationId, id).all<{
    id: string;
    from_room: number;
    from_seat: number;
    to_room: number;
    to_seat: number;
    moved_at: number;
  }>();
  return apiJson(rows.results);
}
