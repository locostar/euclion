import { createAuth } from "../src/lib/auth";
import { POST as join } from "../src/app/api/academy/join/route";
import { POST as generate } from "../src/app/api/academy/join-code/route";
import { GET as getAcademy, POST as createAcademy } from "../src/app/api/academy/route";
import { setTestEnv } from "./academy-test-context";

const academyTestWorker = {
  async fetch(request: Request, env: CloudflareEnv) {
    setTestEnv(env);
    const path = new URL(request.url).pathname;
    if (path === "/api/academy/join") return join(request);
    if (path === "/api/academy/join-code") return generate(request);
    if (path === "/api/academy") return request.method === "POST" ? createAcademy(request) : getAcademy(request);
    return createAuth(env).handler(request);
  },
};

export default academyTestWorker;
