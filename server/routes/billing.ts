import { Router } from "express";
import { db } from "../db.js";
import { workspaces } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();

const PLANS = {
  free: { name: "Free", price: 0, credits: 50, priceId: null },
  pro: { name: "Pro", price: 79, credits: 2000, priceId: process.env.STRIPE_PRO_PRICE_ID },
  agency: { name: "Agency", price: 249, credits: 10000, priceId: process.env.STRIPE_AGENCY_PRICE_ID },
};

// GET /api/billing/plans
router.get("/plans", (_req, res) => {
  res.json(PLANS);
});

// GET /api/billing/status
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, req.user!.workspaceId),
    });
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    res.json({
      plan: workspace.plan,
      credits: parseFloat(workspace.credits?.toString() ?? "0"),
      subscriptionStatus: workspace.subscriptionStatus,
      stripeCustomerId: workspace.stripeCustomerId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/create-checkout
router.post("/create-checkout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { plan } = req.body;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const planConfig = PLANS[plan as keyof typeof PLANS];
    if (!planConfig?.priceId) {
      return res.status(400).json({ error: "Invalid plan or no price configured" });
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, req.user!.workspaceId),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5000"}/app/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5000"}/app/settings/billing`,
      metadata: { workspaceId: req.user!.workspaceId, plan },
      customer: workspace?.stripeCustomerId || undefined,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/portal
router.post("/portal", requireAuth, async (req: AuthRequest, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(503).json({ error: "Stripe not configured" });

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, req.user!.workspaceId),
    });

    if (!workspace?.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || "http://localhost:5000"}/app/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/webhook (Stripe webhook)
router.post("/webhook", express_raw_body(), async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const sig = req.headers["stripe-signature"] as string;
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const { workspaceId, plan } = session.metadata;
        const planConfig = PLANS[plan as keyof typeof PLANS];

        await db.update(workspaces).set({
          plan,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          subscriptionStatus: "active",
          credits: ((parseFloat("0") || 0) + (planConfig?.credits || 0)).toString(),
          updatedAt: new Date(),
        }).where(eq(workspaces.id, workspaceId));
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        // Find workspace by stripeSubscriptionId
        const ws = await db.query.workspaces.findFirst({
          where: eq(workspaces.stripeSubscriptionId, sub.id),
        });
        if (ws) {
          await db.update(workspaces).set({
            plan: "free",
            subscriptionStatus: "cancelled",
            updatedAt: new Date(),
          }).where(eq(workspaces.id, ws.id));
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

function express_raw_body() {
  return (req: any, res: any, next: any) => {
    if (req.headers["stripe-signature"]) {
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk: string) => { data += chunk; });
      req.on("end", () => { req.body = data; next(); });
    } else {
      next();
    }
  };
}

export default router;
