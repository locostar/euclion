"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { paymentMethodLabels, type PaymentMethod } from "@/lib/payment-method";

type SummaryRow = { payment_method: PaymentMethod | null; amount: number; count: number };

export function DashboardSales({ currentPeriod, openSales }: { currentPeriod: string; openSales: (period: string) => void }) {
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const period = selectedPeriod || currentPeriod;
  const [result, setResult] = useState<{ period: string; rows: SummaryRow[] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(period);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    void (async () => {
      setError("");
      try {
        const response = await fetch(`/api/sales?period=${encodeURIComponent(period)}&summary=1`, { signal: controller.signal });
        if (!response.ok) throw new Error("매출 요약을 불러오지 못했습니다.");
        const data = await response.json() as { summary: SummaryRow[] };
        setResult({ period, rows: data.summary });
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "매출 요약을 불러오지 못했습니다.");
      }
    })();
    return () => controller.abort();
  }, [period, valid, attempt]);

  const rows = result?.period === period ? result.rows : null;
  const total = rows?.reduce((sum, row) => sum + row.amount, 0);

  return <section className="panel dashboard-sales">
    <div className="panel-heading"><div><h2>월별 수납 현황</h2><p>납부 처리일 기준 · 수기 기록</p></div></div>
    <label className="field dashboard-sales-period">수납 월
      <input type="month" value={period} onChange={(event) => setSelectedPeriod(event.target.value)} />
    </label>
    {!valid ? <p className="dashboard-sales-note">수납 월을 선택해 주세요.</p> : error ? <div role="alert" className="dashboard-sales-error"><p>{error}</p><button type="button" className="text-link" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div> : !rows ? <p className="dashboard-sales-note" role="status">수납 현황을 불러오고 있어요.</p> : <>
      <div className="dashboard-sales-total"><span>총 수납</span><strong>{total?.toLocaleString("ko-KR")}원</strong></div>
      <ul className="dashboard-sales-list">
        {([...Object.entries(paymentMethodLabels), ["unspecified", "수단 미지정"]] as [string, string][]).map(([method, label]) => {
          const row = rows.find((item) => (item.payment_method ?? "unspecified") === method);
          return <li key={method}><span>{label}</span><strong>{(row?.amount ?? 0).toLocaleString("ko-KR")}원</strong></li>;
        })}
      </ul>
      <button type="button" className="text-link dashboard-sales-link" onClick={() => openSales(period)}>납부 내역 자세히 보기 <ArrowRight size={15} /></button>
      <p className="dashboard-sales-note">실제 결제·환불·현금영수증 발행은 지원하지 않습니다.</p>
    </>}
  </section>;
}
