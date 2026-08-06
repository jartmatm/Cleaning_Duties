import express, { Router } from "express";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { env } from "../lib/env";
import { createSupabaseAdminClient } from "../lib/supabase-admin";
import { getStripeClient } from "../lib/stripe";

type CompanyBillingRow = {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
};

type ProfileRow = {
  id: string;
  company_id: string;
  full_name: string;
  role: "Owner" | "Manager" | "Cleaner";
};

type BillingBody = {
  companyId?: string;
};

export const billingRouter = Router();

function appUrl(path = "/settings") {
  const baseUrl = env.APP_URL ?? "https://cleaning-duties-web.vercel.app";
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function unixToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

async function getAuthorizedBillingContext(request: Request, companyId: string | undefined) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  }
  if (!companyId) {
    throw Object.assign(new Error("companyId is required"), { statusCode: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    throw Object.assign(new Error("Your session is no longer valid"), { statusCode: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, role")
    .eq("id", authData.user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    throw Object.assign(new Error(profileError.message), { statusCode: 500 });
  }
  if (!profile || profile.company_id !== companyId || !["Owner", "Manager"].includes(profile.role)) {
    throw Object.assign(new Error("You are not allowed to manage billing for this company"), { statusCode: 403 });
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end")
    .eq("id", companyId)
    .maybeSingle<CompanyBillingRow>();

  if (companyError) {
    throw Object.assign(new Error(companyError.message), { statusCode: 500 });
  }
  if (!company) {
    throw Object.assign(new Error("Company not found"), { statusCode: 404 });
  }

  return { supabase, user: authData.user, profile, company };
}

async function getOrCreateStripeCustomer(context: Awaited<ReturnType<typeof getAuthorizedBillingContext>>) {
  const stripe = getStripeClient();

  if (context.company.stripe_customer_id) {
    return context.company.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: context.user.email ?? undefined,
    name: context.company.name,
    metadata: {
      company_id: context.company.id,
      owner_profile_id: context.profile.id,
    },
  });

  const { error } = await context.supabase
    .from("companies")
    .update({ stripe_customer_id: customer.id })
    .eq("id", context.company.id);

  if (error) {
    throw new Error(error.message);
  }

  return customer.id;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return unixToIso(periodEnd);
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : subscription?.id ?? null;
}

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const supabase = createSupabaseAdminClient();
  const companyId = subscription.metadata.company_id;
  const priceId = subscription.items.data[0]?.price.id ?? null;

  if (!companyId) {
    return;
  }

  const { error } = await supabase
    .from("companies")
    .update({
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      subscription_status: subscription.status,
      subscription_current_period_end: subscriptionPeriodEnd(subscription),
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("id", companyId);

  if (error) {
    throw new Error(error.message);
  }
}

async function clearSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const supabase = createSupabaseAdminClient();
  const companyId = subscription.metadata.company_id;

  if (!companyId) {
    return;
  }

  const { error } = await supabase
    .from("companies")
    .update({
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_status: "canceled",
      subscription_current_period_end: subscriptionPeriodEnd(subscription),
      subscription_cancel_at_period_end: false,
    })
    .eq("id", companyId);

  if (error) {
    throw new Error(error.message);
  }
}

function errorResponse(response: Response, error: unknown) {
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode
    : 500;
  const message = error instanceof Error ? error.message : "Unexpected billing error";
  return response.status(statusCode).json({ error: message });
}

billingRouter.post("/create-checkout-session", async (request, response) => {
  try {
    const { companyId } = request.body as BillingBody;
    const context = await getAuthorizedBillingContext(request, companyId);
    const stripe = getStripeClient();
    const priceId = env.STRIPE_PRICE_ID;

    if (!priceId) {
      return response.status(500).json({ error: "Missing STRIPE_PRICE_ID in environment" });
    }

    const customerId = await getOrCreateStripeCustomer(context);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      automatic_tax: { enabled: true },
      customer_update: {
        address: "auto",
        name: "auto",
      },
      tax_id_collection: { enabled: true },
      success_url: appUrl("/settings?billing=success"),
      cancel_url: appUrl("/settings?billing=canceled"),
      subscription_data: {
        metadata: {
          company_id: context.company.id,
        },
      },
      metadata: {
        company_id: context.company.id,
      },
    });

    return response.json({ url: session.url });
  } catch (error) {
    return errorResponse(response, error);
  }
});

billingRouter.post("/create-portal-session", async (request, response) => {
  try {
    const { companyId } = request.body as BillingBody;
    const context = await getAuthorizedBillingContext(request, companyId);
    const stripe = getStripeClient();
    const customerId = await getOrCreateStripeCustomer(context);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl("/settings"),
    });

    return response.json({ url: session.url });
  } catch (error) {
    return errorResponse(response, error);
  }
});

billingRouter.get("/status/:companyId", async (request, response) => {
  try {
    const context = await getAuthorizedBillingContext(request, request.params.companyId);
    return response.json({
      status: context.company.subscription_status,
      currentPeriodEnd: context.company.subscription_current_period_end,
      cancelAtPeriodEnd: context.company.subscription_cancel_at_period_end,
      hasCustomer: Boolean(context.company.stripe_customer_id),
      hasSubscription: Boolean(context.company.stripe_subscription_id),
    });
  } catch (error) {
    return errorResponse(response, error);
  }
});

export const stripeWebhookMiddleware = express.raw({ type: "application/json" });

export async function stripeWebhookHandler(request: Request, response: Response) {
  const stripe = getStripeClient();
  const signature = request.headers["stripe-signature"];

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return response.status(500).json({ error: "Missing STRIPE_WEBHOOK_SECRET in environment" });
  }
  if (typeof signature !== "string") {
    return response.status(400).json({ error: "Missing Stripe signature" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(request.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook signature";
    return response.status(400).json({ error: message });
  }

  try {
    if (
      event.type === "customer.subscription.created"
      || event.type === "customer.subscription.updated"
      || event.type === "invoice.paid"
      || event.type === "invoice.payment_failed"
    ) {
      const subscription = event.type.startsWith("customer.subscription")
        ? event.data.object as Stripe.Subscription
        : null;
      const invoiceSubscriptionId = event.type.startsWith("customer.subscription")
        ? null
        : getInvoiceSubscriptionId(event.data.object as Stripe.Invoice);
      const resolvedSubscription = subscription ?? (invoiceSubscriptionId ? await stripe.subscriptions.retrieve(invoiceSubscriptionId) : null);

      if (resolvedSubscription) {
        await upsertSubscriptionFromStripe(resolvedSubscription);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      await clearSubscriptionFromStripe(event.data.object as Stripe.Subscription);
    }

    return response.json({ received: true });
  } catch (error) {
    return errorResponse(response, error);
  }
}
