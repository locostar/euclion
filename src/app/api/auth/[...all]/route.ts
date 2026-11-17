import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";

async function handleAuth(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  return createAuth(env).handler(request);
}

export { handleAuth as GET, handleAuth as POST };
