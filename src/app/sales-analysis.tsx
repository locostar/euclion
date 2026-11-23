"use client";

import { useEffect, useState } from "react";
import { paymentMethodLabels, type PaymentMethod } from "@/lib/payment-method";

type RecordRow = { id: string; student_name: string; amount: number; paid_at: number; payment_method: PaymentMethod | null; billing_period: string };
const currency = (value: number) => value.toLocaleString("ko-KR");

export function SalesAnalysis({ initialPeriod }: { initialPeriod?: string }) {
  const [period, setPeriod] = useState(() => initialPeriod || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(new Date()));
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const validPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(period);

  useEffect(() => {
    if (!validPeriod) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/sales?period=${encodeURIComponent(period)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("매출 내역을 불러오지 못했습니다.");
        const data = await response.json() as { records: RecordRow[] };
        setRecords(data.records);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "매출 내역을 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [period, validPeriod]);

  return <>
    <div className="page-heading"><div><div className="eyebrow">SALES ANALYSIS</div><h1>매출 분석</h1><p>수기로 납부 완료한 수강료를 실제 수납 처리일 기준으로 집계합니다.</p></div></div>
    <section className="panel sales-panel">
      <div className="billing-toolbar"><div><h2>수납 현황</h2><p>실제 결제 및 환불 처리는 지원하지 않습니다. 현금영수증 발행은 연동 준비 중입니다.</p></div><label className="field">수납 월<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label></div>
      {!validPeriod ? <p className="error-message" role="alert">수납 월을 선택해 주세요.</p> : error ? <p className="error-message" role="alert">{error}</p> : loading ? <p>매출 내역을 불러오고 있습니다.</p> : <>
        <div className="sales-summary">
          {[{ label: "총 수납", value: records.reduce((sum, item) => sum + item.amount, 0) }, ...Object.entries(paymentMethodLabels).map(([method, label]) => ({ label, value: records.filter((row) => row.payment_method === method).reduce((sum, row) => sum + row.amount, 0) })), { label: "수단 미지정", value: records.filter((row) => !row.payment_method).reduce((sum, row) => sum + row.amount, 0) }].map((item) => <div className="sales-summary-card" key={item.label}><span>{item.label}</span><strong>{currency(item.value)}원</strong></div>)}
        </div>
        <h2>납부 내역</h2>
        {records.length ? <div className="table-wrap"><table><thead><tr><th>수납일</th><th>학생</th><th>청구 월</th><th>결제 수단</th><th>금액</th><th>현금영수증</th></tr></thead><tbody>{records.map((row) => <tr key={row.id}><td>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(row.paid_at)}</td><td>{row.student_name}</td><td>{row.billing_period}</td><td>{row.payment_method ? paymentMethodLabels[row.payment_method] : "미지정"}</td><td>{currency(row.amount)}원</td><td>{row.payment_method === "cash" ? <button className="button button-outline" disabled title="현금영수증 서비스 연동 전입니다">발행 준비 중</button> : "—"}</td></tr>)}</tbody></table></div> : <p className="staff-loading">해당 월의 납부 완료 내역이 없습니다.</p>}
      </>}
    </section>
  </>;
}
