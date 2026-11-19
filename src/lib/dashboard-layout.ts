import { z } from "zod";

export const dashboardCardIds = ["students", "attendance", "unpaid", "quick", "tasks", "recent"] as const;
export const dashboardLayoutSchema = z.array(z.object({
  id: z.enum(dashboardCardIds),
  size: z.enum(["small", "large"]),
})).length(dashboardCardIds.length).refine((cards) => new Set(cards.map((card) => card.id)).size === dashboardCardIds.length);

export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;
export const defaultDashboardLayout: DashboardLayout = [
  { id: "students", size: "small" }, { id: "attendance", size: "small" },
  { id: "unpaid", size: "small" }, { id: "quick", size: "large" },
  { id: "tasks", size: "small" }, { id: "recent", size: "large" },
];
