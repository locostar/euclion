export async function createMonthlyTuitionCharges(
  db: D1Database,
  period: string,
  dueDate: string,
) {
  const result = await db.prepare(
    `INSERT INTO tuition_charges
      (id, organization_id, student_id, billing_period, amount, due_date, memo)
     SELECT lower(hex(randomblob(16))), s.organization_id, s.id, ?,
            MAX(0, SUM(c.monthly_fee) + COALESCE(MAX(so.monthly_fee), 0)
              + s.monthly_tuition_adjustment),
            ?, '월 자동 청구'
     FROM students s
     INNER JOIN class_students cs
       ON cs.organization_id = s.organization_id AND cs.student_id = s.id
     INNER JOIN classes c
       ON c.organization_id = cs.organization_id AND c.id = cs.class_id
     LEFT JOIN seat_occupancy so
       ON so.organization_id = s.organization_id AND so.student_id = s.id
     WHERE s.status = 'active'
       AND (c.starts_on IS NULL OR c.starts_on < date(? || '-01', '+1 month'))
       AND (c.ends_on IS NULL OR c.ends_on >= ? || '-01')
     GROUP BY s.organization_id, s.id
     HAVING MAX(0, SUM(c.monthly_fee) + COALESCE(MAX(so.monthly_fee), 0)
       + s.monthly_tuition_adjustment) > 0
     ON CONFLICT (organization_id, student_id, billing_period) DO NOTHING`,
  )
    .bind(period, dueDate, period, period)
    .run();

  return result.meta.changes;
}
