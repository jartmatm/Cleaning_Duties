import Stripe from "stripe";
import { env } from "./env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY in environment");
  }

  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-07-29.dahlia",
    appInfo: {
      name: "Cleaning Duties",
      version: "1.0.0",
    },
  });

  return stripeClient;
}
