import { z } from "zod";

export const dashboardCardIds = ["students", "attendance", "unpaid", "quick", "tasks", "recent"] as const;
const cardId = z.enum(dashboardCardIds);
const dashboardCardSchema = z.union([
  z.object({
    id: cardId,
    width: z.number().min(10).max(100),
    height: z.number().int().min(160).max(1400).nullable(),
  }),
  z.object({ id: cardId, size: z.enum(["small", "large"]) }).transform((card) => ({
    id: card.id,
    width: card.size === "small" ? 33.33 : 66.67,
    height: null,
  })),
]);
export const dashboardLayoutSchema = z.array(dashboardCardSchema)
  .length(dashboardCardIds.length).refine((cards) => new Set(cards.map((card) => card.id)).size === dashboardCardIds.length);

export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;
export const defaultDashboardLayout: DashboardLayout = [
  { id: "students", width: 33.33, height: null }, { id: "attendance", width: 33.33, height: null },
  { id: "unpaid", width: 33.33, height: null }, { id: "quick", width: 66.67, height: null },
  { id: "tasks", width: 33.33, height: null }, { id: "recent", width: 66.67, height: null },
];
