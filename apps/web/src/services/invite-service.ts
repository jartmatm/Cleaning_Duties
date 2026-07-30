import { supabase } from "./supabase-client";

type InviteUserInput = {
  fullName: string;
  email: string;
  password: string;
  role: "Manager" | "Cleaner";
  companyId: string;
  siteIds: string[];
};

async function functionErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "context" in error && (error as { context?: unknown }).context instanceof Response) {
    const response = (error as { context: Response }).context;
    try {
      const body = await response.clone().json() as { error?: unknown; message?: unknown };
      const message = body.error ?? body.message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    } catch {
      const message = await response.clone().text();
      if (message.trim()) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "The user account could not be created.";
}

export async function inviteUser(input: InviteUserInput) {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: {
      full_name: input.fullName,
      email: input.email,
      password: input.password,
      role: input.role,
      company_id: input.companyId,
      site_ids: input.siteIds,
    },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error));
  }

  return data as { userId: string };
}

export function inviteCleaner(input: Omit<InviteUserInput, "role">) {
  return inviteUser({ ...input, role: "Cleaner" });
}

export function inviteManager(input: Omit<InviteUserInput, "role">) {
  return inviteUser({ ...input, role: "Manager" });
}
