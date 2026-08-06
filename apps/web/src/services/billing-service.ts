import { apiUrl } from "./api-client";
import { supabase } from "./supabase-client";

export type BillingStatus = {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  hasSubscription: boolean;
};

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Your session is no longer valid.");
  }

  return accessToken;
}

async function billingRequest<T>(path: string, options: RequestInit = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Billing request failed.");
  }

  return response.json() as Promise<T>;
}

export async function getBillingStatus(companyId: string) {
  return billingRequest<BillingStatus>(`/billing/status/${companyId}`);
}

export async function createCheckoutSession(companyId: string) {
  return billingRequest<{ url: string }>("/billing/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });
}

export async function createPortalSession(companyId: string) {
  return billingRequest<{ url: string }>("/billing/create-portal-session", {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });
}
