import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPartnerUserByAuthId, type PartnerRow, type PartnerUserRow } from "./supabase";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — ignore
        }
      },
    },
  });
}

export interface PartnerSession {
  authId: string;
  email: string;
  user: PartnerUserRow;
  partner: PartnerRow;
}

export async function getPartnerSession(): Promise<PartnerSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const partnerContext = await getPartnerUserByAuthId(user.id);
  if (!partnerContext) return null;

  return {
    authId: user.id,
    email: user.email ?? "",
    user: partnerContext.user,
    partner: partnerContext.partner,
  };
}

export async function requirePartnerSession() {
  const session = await getPartnerSession();
  if (!session) return null;
  if (!session.partner.is_active) return null;
  return session;
}
