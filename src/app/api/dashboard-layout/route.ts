import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { dashboardLayoutSchema, defaultDashboardLayout } from "@/lib/dashboard-layout";
import { parseJson } from "@/lib/request-validation";

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;
  const { env, organizationId, userId } = result.context;
  const row = await env.DB.prepare("SELECT layout FROM dashboard_layout WHERE organization_id = ? AND user_id = ?")
    .bind(organizationId, userId).first<{ layout: string }>();
  if (!row) return apiJson({ layout: defaultDashboardLayout });
  let value: unknown;
  try {
    value = JSON.parse(row.layout);
  } catch {
    console.error("Invalid dashboard layout JSON");
    return apiError(500, "INVALID_LAYOUT", "저장된 배치를 불러오지 못했습니다.");
  }
  const parsed = dashboardLayoutSchema.safeParse(value);
  if (!parsed.success) {
    console.error("Invalid dashboard layout data");
    return apiError(500, "INVALID_LAYOUT", "저장된 배치를 불러오지 못했습니다.");
  }
  return apiJson({ layout: parsed.data });
}

export async function PUT(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;
  if (request.headers.get("origin") !== new URL(result.context.env.BETTER_AUTH_URL).origin) {
    return apiError(403, "INVALID_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }
  const parsed = await parseJson(request, dashboardLayoutSchema);
  if ("response" in parsed) return parsed.response;
  const { env, organizationId, userId } = result.context;
  await env.DB.prepare(
    `INSERT INTO dashboard_layout (organization_id, user_id, layout) VALUES (?, ?, ?)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET layout = excluded.layout`,
  ).bind(organizationId, userId, JSON.stringify(parsed.data)).run();
  return apiJson({ saved: true });
}
