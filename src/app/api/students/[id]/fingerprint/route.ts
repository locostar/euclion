import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const { id } = await params;
  const updated = await result.context.env.DB.prepare(
    `UPDATE students
     SET fingerprint_status = 'pending_device',
         updated_at = cast(unixepoch('subsecond') * 1000 as integer)
     WHERE id = ? AND organization_id = ? AND status = 'active'`,
  )
    .bind(id, result.context.organizationId)
    .run();

  if (!updated.meta.changes) {
    return apiError(404, "STUDENT_NOT_FOUND", "지문 등록을 요청할 재원 학생을 찾을 수 없습니다.");
  }

  return apiJson({
    status: "pending_device",
    deviceConnected: false,
    message: "지문 스캔 기기가 연결되면 등록 요청이 전달됩니다.",
  });
}
