import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { isBillingPeriod } from "@/lib/request-validation";

export async function GET(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;
  const period = new URL(request.url).searchParams.get("period") ?? "";
  if (!isBillingPeriod(period)) return apiError(400, "INVALID_PERIOD", "매출 월을 확인해 주세요.");
  const start = Date.parse(`${period}-01T00:00:00+09:00`);
  const [year, month] = period.split("-").map(Number);
  const end = Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000;
  const rows = await result.context.env.DB.prepare(
    `SELECT tc.id, s.name AS student_name, tc.amount, tc.paid_at, tc.payment_method, tc.billing_period
     FROM tuition_charges tc JOIN students s
       ON s.id = tc.student_id AND s.organization_id = tc.organization_id
     WHERE tc.organization_id = ? AND tc.status = 'paid'
       AND tc.paid_at >= ? AND tc.paid_at < ?
     ORDER BY tc.paid_at DESC, tc.id`,
  ).bind(result.context.organizationId, start, end).all<{
    id: string; student_name: string; amount: number; paid_at: number;
    payment_method: "card" | "cash" | "pay" | "transfer" | "other" | null; billing_period: string;
  }>();
  return apiJson({ records: rows.results });
}
