"use client";

import { Grip, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { defaultDashboardLayout, dashboardLayoutSchema, type DashboardLayout } from "@/lib/dashboard-layout";

type CardId = DashboardLayout[number]["id"];

export function DashboardCards({ cards }: { cards: Record<CardId, { title: string; content: ReactNode }> }) {
  const [layout, setLayout] = useState<DashboardLayout>(defaultDashboardLayout);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<CardId | null>(null);
  const activeDrag = useRef<CardId | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/dashboard-layout", { signal: controller.signal });
        if (!response.ok) throw new Error("대시보드 배치를 불러오지 못했습니다. 페이지를 새로고침해 주세요.");
        const data = await response.json() as { layout: unknown };
        const parsed = dashboardLayoutSchema.safeParse(data.layout);
        if (!parsed.success) throw new Error("대시보드 배치 형식이 올바르지 않습니다.");
        setLayout(parsed.data);
        setLoaded(true);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "대시보드 배치를 불러오지 못했습니다.");
      }
    })();
    return () => controller.abort();
  }, []);

  async function save(next: DashboardLayout) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setLayout(next);
    setError("");
    try {
      const response = await fetch("/api/dashboard-layout", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("배치를 저장하지 못했습니다. 다시 저장해 주세요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "배치를 저장하지 못했습니다. 다시 저장해 주세요.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function move(source: CardId, targetIndex: number) {
    const sourceIndex = layout.findIndex((item) => item.id === source);
    if (!loaded || savingRef.current || sourceIndex < 0 || targetIndex < 0 || targetIndex >= layout.length || sourceIndex === targetIndex) return;
    const next = [...layout];
    next.splice(targetIndex, 0, ...next.splice(sourceIndex, 1));
    void save(next);
  }

  function endDrag() {
    activeDrag.current = null;
    setDragged(null);
  }

  return <>
    <div className="dashboard-layout-toolbar">
      <span>우측 상단 아이콘을 끌어 이동하고, 우측 하단 모서리에서 크기를 바꾸세요. 배치는 내 계정에 자동 저장됩니다.</span>
      {saving && <span role="status">배치 저장 중...</span>}
      {loaded && error && <button type="button" className="button button-outline" onClick={() => void save(layout)} disabled={saving}>다시 저장</button>}
      <button type="button" className="button button-outline" onClick={() => void save(defaultDashboardLayout)} disabled={!loaded || saving}>기본 배치</button>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="dashboard-card-grid">
      {layout.map((card, index) => <div key={card.id} data-dashboard-card={card.id} className={`dashboard-card-wrap dashboard-card-${card.size}${dragged === card.id ? " dashboard-card-dragging" : ""}`}
        onDragOver={(event) => { if (loaded && !savingRef.current && activeDrag.current) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
        onDrop={(event) => {
          event.preventDefault();
          const source = activeDrag.current;
          if (source && event.dataTransfer.getData("text/plain") === source) move(source, index);
          endDrag();
        }}>
        {cards[card.id].content}
        <button type="button" className="dashboard-drag-handle" disabled={!loaded || saving}
          aria-label={`${cards[card.id].title} 이동`} title="드래그하여 이동 (키보드 방향키로 순서 변경)"
          draggable={loaded && !saving}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); move(card.id, index - 1); }
            if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); move(card.id, index + 1); }
          }}
          onDragStart={(event) => { activeDrag.current = card.id; setDragged(card.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.id); }}
          onDragEnd={endDrag}
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse" && !savingRef.current) {
              event.currentTarget.setPointerCapture(event.pointerId);
              activeDrag.current = card.id;
              setDragged(card.id);
            }
          }}
          onPointerUp={(event) => {
            if (event.pointerType === "mouse" || activeDrag.current !== card.id) return;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-dashboard-card]")?.getAttribute("data-dashboard-card");
            move(card.id, layout.findIndex((item) => item.id === target));
            endDrag();
          }}
          onPointerCancel={endDrag}><Grip size={18} aria-hidden="true" /></button>
        <button type="button" className="dashboard-resize-handle" disabled={!loaded || saving}
          aria-label={`${cards[card.id].title} ${card.size === "small" ? "크게" : "작게"}`}
          title={card.size === "small" ? "카드 크게" : "카드 작게"}
          onClick={() => void save(layout.map((item) => item.id === card.id ? { ...item, size: item.size === "small" ? "large" : "small" } : item))}>
          {card.size === "small" ? <Maximize2 size={16} aria-hidden="true" /> : <Minimize2 size={16} aria-hidden="true" />}
        </button>
      </div>)}
    </div>
  </>;
}
