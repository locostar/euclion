import { getAcademyContext, apiJson } from "@/lib/api-context";
import { DEFAULT_GUARDIAN_REMINDER } from "@/lib/guardian-reminder";
import { parseJson } from "@/lib/request-validation";
import { z } from "zod";

const reminderInput = z.object({
  message: z.string().trim().min(1).max(1000),
});

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const settings = await result.context.env.DB.prepare(
    "SELECT guardian_reminder_message FROM academy_preferences WHERE organization_id = ? LIMIT 1",
  )
    .bind(result.context.organizationId)
    .first<{ guardian_reminder_message: string }>();

  return apiJson({ message: settings?.guardian_reminder_message ?? DEFAULT_GUARDIAN_REMINDER });
}

export async function PUT(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, reminderInput);
  if ("response" in parsed) return parsed.response;

  await result.context.env.DB.prepare(
    `INSERT INTO academy_preferences
      (organization_id, guardian_reminder_message, updated_at)
     VALUES (?, ?, cast(unixepoch('subsecond') * 1000 as integer))
     ON CONFLICT (organization_id) DO UPDATE SET
       guardian_reminder_message = excluded.guardian_reminder_message,
       updated_at = excluded.updated_at`,
  )
    .bind(result.context.organizationId, parsed.data.message)
    .run();

  return apiJson({ saved: true });
}
