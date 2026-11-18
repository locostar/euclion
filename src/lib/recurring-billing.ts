function addMonthsClamped(date: string, months: number) {
  const [yearText, monthText, dayText] = date.split("-");
  const firstOfTargetMonth = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1 + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(
      firstOfTargetMonth.getUTCFullYear(),
      firstOfTargetMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  const day = Math.min(Number(dayText), lastDay);

  return `${firstOfTargetMonth.getUTCFullYear()}-${String(firstOfTargetMonth.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type RecurringChargeRow = {
  student_id: string;
  organization_id: string;
  monthly_tuition_adjustment: number;
  anchor_date: string;
  invoice_count: number;
  monthly_fee: number;
  starts_on: string | null;
  ends_on: string | null;
  seat_fee: number;
};

export async function createDueMonthlyTuitionCharges(
  db: D1Database,
  today: string,
) {
  const result = await db.prepare(
    `SELECT s.id AS student_id, s.organization_id,
            s.monthly_tuition_adjustment,
            MIN(tc.due_date) AS anchor_date,
            COUNT(DISTINCT tc.id) AS invoice_count,
            c.monthly_fee, c.starts_on, c.ends_on,
            COALESCE(MAX(so.monthly_fee), 0) AS seat_fee
     FROM students s
     INNER JOIN class_students cs
       ON cs.organization_id = s.organization_id AND cs.student_id = s.id
     INNER JOIN classes c
       ON c.organization_id = cs.organization_id AND c.id = cs.class_id
     INNER JOIN tuition_charges tc
       ON tc.organization_id = s.organization_id AND tc.student_id = s.id
     LEFT JOIN seat_occupancy so
       ON so.organization_id = s.organization_id AND so.student_id = s.id
     WHERE s.status = 'active'
     GROUP BY s.id, c.id
     ORDER BY s.id`,
  )
    .all<RecurringChargeRow>();

  const students = new Map<string, {
    organizationId: string;
    adjustment: number;
    anchorDate: string;
    invoiceCount: number;
    classes: { monthlyFee: number; startsOn: string | null; endsOn: string | null }[];
    seatFee: number;
  }>();

  for (const row of result.results) {
    const student = students.get(row.student_id) ?? {
      organizationId: row.organization_id,
      adjustment: row.monthly_tuition_adjustment,
      anchorDate: row.anchor_date,
      invoiceCount: row.invoice_count,
      classes: [],
      seatFee: row.seat_fee,
    };
    student.classes.push({
      monthlyFee: row.monthly_fee,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    });
    students.set(row.student_id, student);
  }

  const statements = [];
  for (const [studentId, student] of students) {
    const dueDate = addMonthsClamped(student.anchorDate, student.invoiceCount);
    if (dueDate > today) continue;

    const monthlyClassFee = student.classes
      .filter(({ startsOn, endsOn }) =>
        (!startsOn || startsOn <= dueDate) && (!endsOn || endsOn >= dueDate),
      )
      .reduce((total, classroom) => total + classroom.monthlyFee, 0);
    const amount = Math.max(0, monthlyClassFee + student.seatFee + student.adjustment);
    statements.push(
      db.prepare(
        `INSERT INTO tuition_charges
          (id, organization_id, student_id, billing_period, amount, due_date,
           memo, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, '월 자동 청구',
           CASE WHEN ? = 0 THEN 'paid' ELSE 'unpaid' END,
           CASE WHEN ? = 0 THEN cast(unixepoch('subsecond') * 1000 as integer)
             ELSE NULL END)
         ON CONFLICT (organization_id, student_id, billing_period) DO NOTHING`,
      ).bind(
        crypto.randomUUID(),
        student.organizationId,
        studentId,
        dueDate.slice(0, 7),
        amount,
        dueDate,
        amount,
        amount,
      ),
    );
  }

  if (!statements.length) return 0;
  const inserted = await db.batch(statements);
  return inserted.reduce((total, result) => total + result.meta.changes, 0);
}

export { addMonthsClamped };
