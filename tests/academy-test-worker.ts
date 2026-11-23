import { createAuth } from "../src/lib/auth";
import { POST as join } from "../src/app/api/academy/join/route";
import { POST as generate } from "../src/app/api/academy/join-code/route";
import { GET as getAcademy, POST as createAcademy } from "../src/app/api/academy/route";
import { setTestEnv } from "./academy-test-context";
import { GET as getBilling, PATCH as patchBilling } from "../src/app/api/billing/route";
import { GET as getSales } from "../src/app/api/sales/route";
import { GET as getLayout, PUT as putLayout } from "../src/app/api/dashboard-layout/route";
import { GET as getStudentAnalysis, PUT as putStudentAnalysis, POST as postAdmission, DELETE as deleteAdmission } from "../src/app/api/student-analysis/route";

const academyTestWorker = {
  async fetch(request: Request, env: CloudflareEnv) {
    setTestEnv(env);
    const path = new URL(request.url).pathname;
    if (path === "/api/academy/join") return join(request);
    if (path === "/api/academy/join-code") return generate(request);
    if (path === "/api/academy") return request.method === "POST" ? createAcademy(request) : getAcademy(request);
    if (path === "/api/billing") return request.method === "PATCH" ? patchBilling(request) : getBilling(request);
    if (path === "/api/sales") return getSales(request);
    if (path === "/api/dashboard-layout") return request.method === "PUT" ? putLayout(request) : getLayout(request);
    if (path === "/api/student-analysis") {
      if (request.method === "PUT") return putStudentAnalysis(request);
      if (request.method === "POST") return postAdmission(request);
      if (request.method === "DELETE") return deleteAdmission(request);
      return getStudentAnalysis(request);
    }
    return createAuth(env).handler(request);
  },
};

export default academyTestWorker;
