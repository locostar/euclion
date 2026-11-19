import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { isSameDateInTimeZone } from "@/lib/date-utils";
import { isBillingPeriod } from "@/lib/request-validation";

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
  class_tuition: number;
  seat_tuition: number;
  monthly_tuition_adjustment: number;
  tuition_adjustment_reason: string | null;
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

type BillingChargeRow = {
  id: string;
  student_id: string;
  student_name: string;
  billing_period: string;
  amount: number;
  due_date: string;
  status: "unpaid" | "paid";
  paid_at: number | null;
  memo: string | null;
};

type SeatRow = {
  id: string;
  room_number: number;
  seat_number: number;
  student_id: string | null;
  student_name: string;
  school: string | null;
  grade: string | null;
  gender: "male" | "female" | null;
  status: "present" | "absent" | "exited";
  entered_at: number;
  total_duration_ms: number;
  monthly_fee: number;
  is_demo: number;
};

type SeatPriceRow = {
  room_number: number;
  seat_number: number;
  monthly_fee: number;
};

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;
  const url = new URL(request.url);
  const includeDashboard = url.searchParams.get("include") === "dashboard";
  const period = url.searchParams.get("period") ?? "";
  if (includeDashboard && !isBillingPeriod(period)) {
    return apiError(400, "INVALID_BILLING_PERIOD", "청구 월을 선택해 주세요.");
  }

  const studentRowsPromise = result.context.env.DB.prepare(
    `SELECT s.id, s.name, s.birth_date, s.phone, s.guardian_phone,
              s.gender, s.school, s.grade, s.graduated_school, s.address,
              s.enrolled_on, s.status, s.fingerprint_status,
              s.monthly_tuition_adjustment, s.tuition_adjustment_reason, s.memo, cs.class_id,
              COALESCE((
                SELECT SUM(c.monthly_fee)
                FROM class_students fee_cs
                INNER JOIN classes c
                  ON c.id = fee_cs.class_id AND c.organization_id = fee_cs.organization_id
                WHERE fee_cs.organization_id = s.organization_id
                  AND fee_cs.student_id = s.id
              ), 0) AS class_tuition,
              COALESCE((
                SELECT so.monthly_fee FROM seat_occupancy so
                WHERE so.organization_id = s.organization_id AND so.student_id = s.id
                LIMIT 1
              ), 0) AS seat_tuition,
              MAX(0,
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
                ), 0) + s.monthly_tuition_adjustment
              ) AS monthly_tuition
       FROM students s
       LEFT JOIN class_students cs
         ON cs.organization_id = s.organization_id
        AND cs.student_id = s.id
       WHERE s.organization_id = ?
       ORDER BY s.created_at DESC, s.name`,
    )
      .bind(result.context.organizationId)
      .all<StudentRow>();
  const classRowsPromise = result.context.env.DB.prepare(
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
      .all<ClassRow>();
  const dashboardDataPromise = includeDashboard
    ? Promise.all([
        result.context.env.DB.prepare(
          `SELECT tc.id, tc.student_id, s.name AS student_name,
                  tc.billing_period, tc.amount, tc.due_date, tc.status,
                  tc.paid_at, tc.memo
           FROM tuition_charges tc
           INNER JOIN students s
             ON s.id = tc.student_id AND s.organization_id = tc.organization_id
           WHERE tc.organization_id = ? AND tc.billing_period = ?
           ORDER BY tc.due_date, s.name`,
        )
          .bind(result.context.organizationId, period)
          .all<BillingChargeRow>(),
        result.context.env.DB.prepare(
          `SELECT so.id, so.room_number, so.seat_number, so.student_id,
                  CASE WHEN so.student_id IS NOT NULL THEN s.name ELSE so.student_name END AS student_name,
                  CASE WHEN so.student_id IS NOT NULL THEN s.school ELSE so.school END AS school,
                  CASE WHEN so.student_id IS NOT NULL THEN s.grade ELSE so.grade END AS grade,
                  s.gender, so.status, so.entered_at, so.total_duration_ms,
                  so.monthly_fee, so.is_demo
           FROM seat_occupancy so
           LEFT JOIN students s
             ON s.id = so.student_id AND s.organization_id = so.organization_id
           WHERE so.organization_id = ?
           ORDER BY so.room_number, so.seat_number`,
        )
          .bind(result.context.organizationId)
          .all<SeatRow>(),
        result.context.env.DB.prepare(
          `SELECT room_number, seat_number, monthly_fee
           FROM seat_pricing
           WHERE organization_id = ?
           ORDER BY room_number, seat_number`,
        )
          .bind(result.context.organizationId)
          .all<SeatPriceRow>(),
      ])
    : Promise.resolve(null);
  const [studentRows, classRows, dashboardData] = await Promise.all([
    studentRowsPromise,
    classRowsPromise,
    dashboardDataPromise,
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
      class_tuition: row.class_tuition,
      seat_tuition: row.seat_tuition,
      monthly_tuition_adjustment: row.monthly_tuition_adjustment,
      tuition_adjustment_reason: row.tuition_adjustment_reason,
      monthly_tuition: row.monthly_tuition,
      memo: row.memo,
      classIds: [],
    };
    if (row.class_id) student.classIds.push(row.class_id);
    students.set(row.id, student);
  }

  const response: {
    students: (Omit<StudentRow, "class_id"> & { classIds: string[] })[];
    classes: ClassRow[];
    billingCharges?: BillingChargeRow[];
    seatOccupancies?: (Omit<SeatRow, "is_demo"> & { is_demo: boolean })[];
    seatPrices?: SeatPriceRow[];
  } = {
    students: [...students.values()],
    classes: classRows.results,
  };

  if (dashboardData) {
    const now = Date.now();
    response.billingCharges = dashboardData[0].results;
    response.seatOccupancies = dashboardData[1].results.map((row) => {
      const sameDay = isSameDateInTimeZone(row.entered_at, now, "Asia/Seoul");
      return {
        ...row,
        status: sameDay ? row.status : "absent",
        total_duration_ms: sameDay ? row.total_duration_ms : 0,
        is_demo: Boolean(row.is_demo),
      };
    });
    response.seatPrices = dashboardData[2].results;
  }

  return apiJson(response);
}
