import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { isSameDateInTimeZone } from "@/lib/date-utils";
import { parseJson, seatScanInput } from "@/lib/request-validation";

type SeatAccessRow = {
  id: string;
  status: "present" | "absent" | "in_use" | "exited";
  entered_at: number;
  total_duration_ms: number;
};

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, seatScanInput);
  if ("response" in parsed) return parsed.response;

  const seat = await result.context.env.DB.prepare(
    `SELECT so.id, so.status, so.entered_at, so.total_duration_ms
     FROM seat_occupancy so
     INNER JOIN students s
       ON s.id = so.student_id AND s.organization_id = so.organization_id
     WHERE so.organization_id = ? AND so.student_id = ? AND s.status = 'active'
     LIMIT 1`,
  )
    .bind(result.context.organizationId, parsed.data.studentId)
    .first<SeatAccessRow>();

  if (!seat) {
    return apiError(404, "ASSIGNED_SEAT_NOT_FOUND", "배정된 좌석을 찾을 수 없습니다.");
  }

  const now = Date.now();
  const isSameDay = isSameDateInTimeZone(seat.entered_at, now, "Asia/Seoul");
  const isEntering = !isSameDay || seat.status !== "in_use";
  const nextStatus = isEntering ? "in_use" : "exited";
  const nextEnteredAt = isEntering ? now : seat.entered_at;
  const nextTotalDuration = isEntering
    ? isSameDay ? seat.total_duration_ms : 0
    : seat.total_duration_ms + Math.max(0, now - seat.entered_at);

  const updated = await result.context.env.DB.prepare(
    `UPDATE seat_occupancy
     SET status = ?, entered_at = ?, total_duration_ms = ?
     WHERE id = ? AND organization_id = ? AND status = ? AND entered_at = ?`,
  )
    .bind(
      nextStatus,
      nextEnteredAt,
      nextTotalDuration,
      seat.id,
      result.context.organizationId,
      seat.status,
      seat.entered_at,
    )
    .run();

  if (updated.meta.changes === 0) {
    return apiError(409, "SEAT_SCAN_CONFLICT", "좌석 상태가 변경되었습니다. 다시 스캔해 주세요.");
  }

  return apiJson({
    status: nextStatus,
    event: isEntering ? "entry" : "exit",
    total_duration_ms: nextTotalDuration,
  });
}
