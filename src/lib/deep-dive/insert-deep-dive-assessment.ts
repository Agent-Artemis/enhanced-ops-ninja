import type { SupabaseClient } from "@supabase/supabase-js";

export function isDuplicateKeyError(code: string | undefined): boolean {
  return code === "23505";
}

export type InsertDeepDiveResult =
  | { ok: true; id?: string; duplicate?: boolean }
  | { ok: false; error: { message: string; code?: string } };

type InsertDeepDiveOptions = {
  /** When insert hits a unique violation, fetch the latest row id for this email. */
  lookupIdOnDuplicate?: boolean;
  email?: string;
};

/**
 * Plain INSERT into deep_dive_assessments — never uses upsert / ON CONFLICT.
 * Duplicate key (Postgres 23505) is treated as success.
 */
export async function insertDeepDiveAssessment(
  client: SupabaseClient,
  row: Record<string, unknown>,
  options?: InsertDeepDiveOptions,
): Promise<InsertDeepDiveResult> {
  const { data, error } = await client.from("deep_dive_assessments").insert(row).select("id").single();

  if (!error) {
    return { ok: true, id: typeof data?.id === "string" ? data.id : undefined };
  }

  if (isDuplicateKeyError(error.code)) {
    if (options?.lookupIdOnDuplicate && options.email) {
      const { data: existing, error: lookupError } = await client
        .from("deep_dive_assessments")
        .select("id")
        .eq("email", options.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        return { ok: false, error: { message: lookupError.message, code: lookupError.code } };
      }

      return {
        ok: true,
        id: typeof existing?.id === "string" ? existing.id : undefined,
        duplicate: true,
      };
    }

    return { ok: true, duplicate: true };
  }

  return { ok: false, error: { message: error.message, code: error.code } };
}
