const alphabetSize = 1_000_000;

export function newJoinCode() {
  const maximum = Math.floor(0x100000000 / alphabetSize) * alphabetSize;
  const random = new Uint32Array(1);
  do {
    crypto.getRandomValues(random);
  } while (random[0] >= maximum);
  return String(random[0] % alphabetSize).padStart(6, "0");
}

export async function hashJoinCode(secret: string, organizationId: string, code: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`academy-join:${organizationId}:${code}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isSameOrigin(request: Request, baseURL: string) {
  return request.headers.get("origin") === new URL(baseURL).origin;
}
