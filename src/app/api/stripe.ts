import Stripe from "stripe";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY as string) || "dummy_stripe_secret_key", {
  apiVersion: "2026-05-27.dahlia",
});

export { stripe };
