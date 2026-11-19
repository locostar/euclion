import { createAuth } from "../src/lib/auth";

const invitationTestWorker = {
  async fetch(request: Request, env: CloudflareEnv) {
    globalThis.fetch = async (input, init) => {
      if (String(input) !== "https://api.resend.com/emails") {
        throw new Error("Unexpected outbound request in invitation test");
      }
      await env.DB.prepare("INSERT INTO test_mail (body) VALUES (?)")
        .bind(String(init?.body))
        .run();
      return Response.json({ id: "test-message" });
    };

    return createAuth(env).handler(request);
  },
};

export default invitationTestWorker;
