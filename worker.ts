// @ts-expect-error `.open-next/worker.js` is generated at build time.
import { default as handler } from "./.open-next/worker.js";
import { createDueMonthlyTuitionCharges } from "./src/lib/recurring-billing";

export default {
  async fetch(request, env, ctx) {
    const response = await handler.fetch(request, env, ctx);
    if (
      response.ok &&
      new URL(request.url).pathname.startsWith("/_next/static/")
    ) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },
  async scheduled(controller, env) {
    const dateParts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(controller.scheduledTime);
    const year = dateParts.find((part) => part.type === "year")?.value;
    const month = dateParts.find((part) => part.type === "month")?.value;
    const day = dateParts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) {
      throw new Error("청구 기준일을 계산하지 못했습니다.");
    }

    const today = `${year}-${month}-${day}`;
    const created = await createDueMonthlyTuitionCharges(env.DB, today);
    console.info("월 자동 청구 생성 완료", { today, created });
  },
} satisfies ExportedHandler<CloudflareEnv>;
