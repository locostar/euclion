import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import {
  isBillingPeriod,
  isDate,
  parseJson,
  tuitionChargeInput,
  tuitionChargeStatusInput,
} from "@/lib/request-validation";

type TuitionChargeRow = {
  id: string;
  student_id: string;
  student_name: string;
  billing_period: string;
  amount: number;
  due_date: string;
  status: "unpaid" | "paid";
  paid_at: number | null;
  payment_method: "card" | "cash" | "pay" | "transfer" | "other" | null;
  memo: string | null;
};

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const period = new URL(request.url).searchParams.get("period") ?? "";
  if (!isBillingPeriod(period)) {
    return apiError(400, "INVALID_BILLING_PERIOD", "청구 월을 선택해 주세요.");
  }

  const charges = await result.context.env.DB.prepare(
    `SELECT tc.id, tc.student_id, s.name AS student_name,
            tc.billing_period, tc.amount, tc.due_date, tc.status,
            tc.paid_at, tc.payment_method, tc.memo
     FROM tuition_charges tc
     INNER JOIN students s
       ON s.id = tc.student_id AND s.organization_id = tc.organization_id
     WHERE tc.organization_id = ? AND tc.billing_period = ?
     ORDER BY tc.due_date, s.name`,
  )
    .bind(result.context.organizationId, period)
    .all<TuitionChargeRow>();

  return apiJson(charges.results);
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, tuitionChargeInput);
  if ("response" in parsed) return parsed.response;
  const charge = parsed.data;

  if (!isDate(charge.dueDate)) {
    return apiError(400, "INVALID_DUE_DATE", "납부 기한을 확인해 주세요.");
  }

  const student = await result.context.env.DB.prepare(
    `SELECT id FROM students
     WHERE id = ? AND organization_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(charge.studentId, result.context.organizationId)
    .first<{ id: string }>();
  if (!student) {
    return apiError(404, "STUDENT_NOT_FOUND", "재원 중인 학생을 찾을 수 없습니다.");
  }

  const inserted = await result.context.env.DB.prepare(
    `INSERT INTO tuition_charges
      (id, organization_id, student_id, billing_period, amount, due_date, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (organization_id, student_id, billing_period) DO NOTHING`,
  )
    .bind(
      crypto.randomUUID(),
      result.context.organizationId,
      charge.studentId,
      charge.billingPeriod,
      charge.amount,
      charge.dueDate,
      charge.memo,
    )
    .run();

  if (inserted.meta.changes === 0) {
    return apiError(409, "CHARGE_ALREADY_EXISTS", "해당 월의 청구 내역이 이미 있습니다.");
  }

  return apiJson({ created: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, tuitionChargeStatusInput);
  if ("response" in parsed) return parsed.response;

  const updated = await result.context.env.DB.prepare(
    `UPDATE tuition_charges
     SET status = ?,
         paid_at = CASE WHEN ? = 'paid'
           THEN COALESCE(paid_at, cast(unixepoch('subsecond') * 1000 as integer))
           ELSE NULL
         END,
         payment_method = CASE WHEN ? = 'paid' THEN ? ELSE NULL END,
         updated_at = cast(unixepoch('subsecond') * 1000 as integer)
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(
      parsed.data.status,
      parsed.data.status,
      parsed.data.status,
      parsed.data.paymentMethod ?? null,
      parsed.data.chargeId,
      result.context.organizationId,
    )
    .run();

  if (updated.meta.changes === 0) {
    return apiError(404, "CHARGE_NOT_FOUND", "청구 내역을 찾을 수 없습니다.");
  }

  return apiJson({ updated: true });
}
