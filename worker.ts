// @ts-expect-error `.open-next/worker.js` is generated at build time.
import { default as handler } from "./.open-next/worker.js";
import { createMonthlyTuitionCharges } from "./src/lib/recurring-billing";

export default {
  fetch: handler.fetch,
  async scheduled(controller, env) {
    const dateParts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(controller.scheduledTime);
    const year = dateParts.find((part) => part.type === "year")?.value;
    const month = dateParts.find((part) => part.type === "month")?.value;
    if (!year || !month) {
      throw new Error("청구 월을 계산하지 못했습니다.");
    }

    const period = `${year}-${month}`;
    const created = await createMonthlyTuitionCharges(
      env.DB,
      period,
      `${period}-10`,
    );
    console.info("월 자동 청구 생성 완료", { period, created });
  },
} satisfies ExportedHandler<CloudflareEnv>;
