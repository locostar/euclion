import { z } from "zod";

export const dashboardCardIds = ["students", "attendance", "unpaid", "quick", "tasks", "recent", "sales", "analysis"] as const;
const cardId = z.enum(dashboardCardIds);
const currentDashboardCardSchema = z.object({
    id: cardId,
    width: z.number().min(10).max(100),
    height: z.number().int().min(160).max(1400).nullable(),
    visible: z.boolean().optional(),
  });
const dashboardCardSchema = z.union([
  currentDashboardCardSchema,
  z.object({ id: cardId, size: z.enum(["small", "large"]) }).transform((card) => ({
    id: card.id,
    width: card.size === "small" ? 33.33 : 66.67,
    height: null,
  })),
]);
export type DashboardLayout = z.infer<typeof currentDashboardCardSchema>[];
export const defaultDashboardLayout: DashboardLayout = [
  { id: "students", width: 33.33, height: null }, { id: "attendance", width: 33.33, height: null },
  { id: "unpaid", width: 33.33, height: null }, { id: "quick", width: 66.67, height: null },
  { id: "tasks", width: 33.33, height: null }, { id: "recent", width: 66.67, height: null },
  { id: "sales", width: 33.33, height: null },
  { id: "analysis", width: 33.33, height: null },
];
export const dashboardLayoutSchema = z.array(dashboardCardSchema)
  .refine((cards) => {
    const ids = new Set(cards.map((card) => card.id));
    return ids.size === cards.length && dashboardCardIds.slice(0, 6).every((id) => ids.has(id));
  })
  .transform((cards) => [...cards, ...defaultDashboardLayout.filter((item) =>
    (item.id === "sales" || item.id === "analysis") && !cards.some((card) => card.id === item.id))]);
