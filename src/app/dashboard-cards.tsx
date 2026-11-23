"use client";

import { Grip, MoveDiagonal2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { defaultDashboardLayout, dashboardLayoutSchema, type DashboardLayout } from "@/lib/dashboard-layout";

type CardId = DashboardLayout[number]["id"];
type Ghost = { id: CardId; x: number; y: number; width: number; height: number };
type Gesture = {
  kind: "move" | "resize";
  id: CardId;
  pointerId: number;
  startX: number;
  startY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  containerWidth: number;
  gap: number;
  initial: DashboardLayout;
  next: DashboardLayout;
  moved: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DashboardCards({ cards }: { cards: Record<CardId, { title: string; content: ReactNode }> }) {
  const [layout, setLayout] = useState<DashboardLayout>(defaultDashboardLayout);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
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

  function startGesture(event: PointerEvent<HTMLButtonElement>, id: CardId, kind: Gesture["kind"]) {
    if (!loaded || savingRef.current || gestureRef.current || event.button !== 0 || !gridRef.current) return;
    const card = event.currentTarget.closest<HTMLElement>("[data-dashboard-card]");
    if (!card) return;
    event.preventDefault();
    const rect = card.getBoundingClientRect();
    gestureRef.current = {
      kind, id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      containerWidth: gridRef.current.clientWidth,
      gap: parseFloat(getComputedStyle(gridRef.current).columnGap) || 0,
      initial: layout, next: layout, moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resize(gesture: Gesture, dx: number, dy: number) {
    const minWidth = Math.min(240, gesture.containerWidth);
    const width = clamp(gesture.width + dx, minWidth, gesture.containerWidth);
    const percentage = Math.round(clamp((width + gesture.gap) / (gesture.containerWidth + gesture.gap) * 100, 10, 100) * 100) / 100;
    const height = Math.round(clamp(gesture.height + dy, 160, 1400));
    return gesture.initial.map((item) => item.id === gesture.id ? { ...item, width: percentage, height } : item);
  }

  function updateGesture(event: PointerEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
    gesture.moved = true;
    if (gesture.kind === "move") {
      setGhost({ id: gesture.id, x: gesture.left + dx, y: gesture.top + dy, width: gesture.width, height: gesture.height });
    } else {
      gesture.next = resize(gesture, dx, dy);
      setLayout(gesture.next);
    }
  }

  function finishGesture(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setGhost(null);
    if (cancelled) {
      if (gesture.kind === "resize") setLayout(gesture.initial);
      return;
    }
    if (!gesture.moved) return;
    if (gesture.kind === "resize") {
      void save(gesture.next);
    } else {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-dashboard-card]")?.getAttribute("data-dashboard-card");
      move(gesture.id, layout.findIndex((item) => item.id === target));
    }
  }

  function keyboardResize(id: CardId, key: string, element: HTMLButtonElement) {
    const card = element.closest<HTMLElement>("[data-dashboard-card]");
    if (!card || !gridRef.current) return;
    const rect = card.getBoundingClientRect();
    const gesture: Gesture = {
      kind: "resize", id, pointerId: 0, startX: 0, startY: 0, left: rect.left, top: rect.top,
      width: rect.width, height: rect.height, containerWidth: gridRef.current.clientWidth,
      gap: parseFloat(getComputedStyle(gridRef.current).columnGap) || 0,
      initial: layout, next: layout, moved: true,
    };
    void save(resize(gesture, key === "ArrowRight" ? 16 : key === "ArrowLeft" ? -16 : 0, key === "ArrowDown" ? 16 : key === "ArrowUp" ? -16 : 0));
  }

  return <>
    <div className="dashboard-layout-toolbar">
      <span>우측 상단 아이콘을 끌어 이동하고, 우측 하단 모서리를 끌어 크기를 조절하세요. 배치는 내 계정에 자동 저장됩니다.</span>
      {saving && <span role="status">배치 저장 중...</span>}
      {loaded && error && <button type="button" className="button button-outline" onClick={() => void save(layout)} disabled={saving}>다시 저장</button>}
      <button type="button" className="button button-outline" onClick={() => void save(defaultDashboardLayout)} disabled={!loaded || saving}>기본 배치</button>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="dashboard-card-grid" ref={gridRef}>
      {layout.map((card, index) => <div key={card.id} data-dashboard-card={card.id}
        className={`dashboard-card-wrap${ghost?.id === card.id ? " dashboard-card-dragging" : ""}`}
        style={{ flexBasis: `calc(${card.width}% - ${(1 - card.width / 100) * 18}px)`, height: card.height ?? undefined }}>
        {cards[card.id].content}
        <button type="button" className="dashboard-drag-handle" disabled={!loaded || saving}
          aria-label={`${cards[card.id].title} 이동`} title="드래그하여 이동 (키보드 방향키로 순서 변경)"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); move(card.id, index - 1); }
            if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); move(card.id, index + 1); }
          }}
          onPointerDown={(event) => startGesture(event, card.id, "move")} onPointerMove={updateGesture}
          onPointerUp={finishGesture} onPointerCancel={(event) => finishGesture(event, true)}
          onLostPointerCapture={(event) => finishGesture(event, true)}><Grip size={18} aria-hidden="true" /></button>
        <button type="button" className="dashboard-resize-handle" disabled={!loaded || saving}
          aria-label={`${cards[card.id].title} 크기 조절`} title="모서리를 끌어 크기 조절 (키보드 방향키 사용 가능)"
          onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              keyboardResize(card.id, event.key, event.currentTarget);
            }
          }}
          onPointerDown={(event) => startGesture(event, card.id, "resize")} onPointerMove={updateGesture}
          onPointerUp={finishGesture} onPointerCancel={(event) => finishGesture(event, true)}
          onLostPointerCapture={(event) => finishGesture(event, true)}>
          <MoveDiagonal2 size={16} aria-hidden="true" />
        </button>
      </div>)}
    </div>
    {ghost && createPortal(<div className="workspace-dashboard dashboard-card-ghost" inert aria-hidden="true"
      style={{ left: ghost.x, top: ghost.y, width: ghost.width, height: ghost.height }}>
      <div className="dashboard-card-wrap">{cards[ghost.id].content}</div>
    </div>, document.body)}
  </>;
}
