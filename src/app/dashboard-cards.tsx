"use client";

import { useEffect, useState, type ReactNode } from "react";
import { defaultDashboardLayout, dashboardLayoutSchema, type DashboardLayout } from "@/lib/dashboard-layout";

type CardId = DashboardLayout[number]["id"];

export function DashboardCards({ cards }: { cards: Record<CardId, { title: string; content: ReactNode }> }) {
  const [layout, setLayout] = useState<DashboardLayout>(defaultDashboardLayout);
  const [savedLayout, setSavedLayout] = useState<DashboardLayout>(defaultDashboardLayout);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<CardId | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/dashboard-layout", { signal: controller.signal });
        if (!response.ok) throw new Error("대시보드 배치를 불러오지 못했습니다.");
        const data = await response.json() as { layout: unknown };
        const parsed = dashboardLayoutSchema.safeParse(data.layout);
        if (!parsed.success) throw new Error("대시보드 배치 형식이 올바르지 않습니다.");
        setLayout(parsed.data);
        setSavedLayout(parsed.data);
        setLoaded(true);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "대시보드 배치를 불러오지 못했습니다.");
      }
    })();
    return () => controller.abort();
  }, []);

  function move(from: number, to: number) {
    if (to < 0 || to >= layout.length || from === to) return;
    setLayout((current) => {
      const next = [...current];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard-layout", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(layout),
      });
      if (!response.ok) throw new Error("배치를 저장하지 못했습니다. 다시 시도해 주세요.");
      setSavedLayout(layout);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "배치를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="dashboard-layout-toolbar">
      <span>{editing ? "카드를 끌어 이동하거나 순서 버튼을 사용하세요." : "대시보드 배치는 내 계정에만 적용됩니다."}</span>
      {editing ? <><button type="button" className="button button-outline" onClick={() => { setLayout(savedLayout); setEditing(false); setError(""); }} disabled={saving}>취소</button><button type="button" className="button button-outline" onClick={() => setLayout(defaultDashboardLayout)} disabled={saving}>기본 배치</button><button type="button" className="button button-primary" onClick={() => void save()} disabled={saving}>{saving ? "저장 중..." : "배치 저장"}</button></> :
        <button type="button" className="button button-outline" onClick={() => setEditing(true)} disabled={!loaded}>카드 배치 편집</button>}
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="dashboard-card-grid">
      {layout.map((card, index) => <div key={card.id} data-dashboard-card={card.id} className={`dashboard-card-wrap dashboard-card-${card.size}${dragged === card.id ? " dashboard-card-dragging" : ""}`}
        onDragOver={(event) => { if (editing && !saving) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
        onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData("text/plain"); const sourceIndex = layout.findIndex((item) => item.id === source); if (!saving && sourceIndex >= 0) move(sourceIndex, index); setDragged(null); }}>
        {editing && <div className="dashboard-card-controls">
          <span draggable={!saving} onDragStart={(event) => { setDragged(card.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.id); }} onDragEnd={() => setDragged(null)}
            onPointerDown={(event) => { if (event.pointerType !== "mouse" && !saving) { event.currentTarget.setPointerCapture(event.pointerId); setDragged(card.id); } }}
            onPointerUp={(event) => { if (event.pointerType === "mouse" || !dragged) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-dashboard-card]")?.getAttribute("data-dashboard-card"); const targetIndex = layout.findIndex((item) => item.id === target); if (!saving && targetIndex >= 0) move(index, targetIndex); setDragged(null); }}
            onPointerCancel={() => setDragged(null)} className="dashboard-drag-handle" aria-label={`${cards[card.id].title} 끌어서 이동`}>⠿ 이동</span>
          <button type="button" disabled={saving || index === 0} onClick={() => move(index, index - 1)} aria-label={`${cards[card.id].title} 앞로 이동`}>←</button>
          <button type="button" disabled={saving || index === layout.length - 1} onClick={() => move(index, index + 1)} aria-label={`${cards[card.id].title} 뒤로 이동`}>→</button>
          <button type="button" disabled={saving} onClick={() => setLayout((current) => current.map((item) => item.id === card.id ? { ...item, size: item.size === "small" ? "large" : "small" } : item))}>{card.size === "small" ? "크게" : "작게"}</button>
        </div>}
        {cards[card.id].content}
      </div>)}
    </div>
  </>;
}
