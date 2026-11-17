import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "@/db/auth-schema";
import { authPlugins } from "./auth-plugins";
import { sendEmail } from "./email";

function requireEnvironmentValue(name: string, value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} is not configured.`);
  }
  return normalized;
}

export function createAuth(env: CloudflareEnv) {
  const baseURL = requireEnvironmentValue(
    "BETTER_AUTH_URL",
    env.BETTER_AUTH_URL,
  );

  return betterAuth({
    appName: "Euclion",
    baseURL,
    secret: requireEnvironmentValue(
      "BETTER_AUTH_SECRET",
      env.BETTER_AUTH_SECRET,
    ),
    trustedOrigins: [baseURL],
    database: drizzleAdapter(drizzle(env.DB, { schema: authSchema }), {
      provider: "sqlite",
      schema: authSchema,
    }),
    plugins: authPlugins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subject: "Euclion 비밀번호 재설정",
          text: `비밀번호를 재설정하려면 다음 링크를 여세요:\n${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subject: "Euclion 이메일 주소 확인",
          text: `이메일 주소를 확인하려면 다음 링크를 여세요:\n${url}`,
        });
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 10,
    },
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });
}
