let currentEnv: CloudflareEnv;

export function setTestEnv(env: CloudflareEnv) {
  currentEnv = env;
}

export async function getCloudflareContext() {
  return { env: currentEnv };
}
