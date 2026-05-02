import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { webhooks } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";
import { randomBytes, createHmac } from "crypto";

const router = Router();
router.use(requireAuth);

// GET /api/webhooks
router.get("/", async (req: AuthRequest, res) => {
  try {
    const hooks = await db.select().from(webhooks).where(eq(webhooks.workspaceId, req.user!.workspaceId));
    // Never expose secret
    res.json(hooks.map(h => ({ ...h, secret: "***" })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      url: z.string().url(),
      events: z.array(z.string()),
    }).parse(req.body);

    const secret = randomBytes(32).toString("hex");

    const [hook] = await db.insert(webhooks).values({
      workspaceId: req.user!.workspaceId,
      url: data.url,
      events: data.events,
      secret,
    }).returning();

    res.status(201).json({ ...hook, secret });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/webhooks/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    await db.delete(webhooks).where(
      and(eq(webhooks.id, req.params.id), eq(webhooks.workspaceId, req.user!.workspaceId))
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: fire webhook
export async function fireWebhook(workspaceId: string, event: string, payload: any) {
  try {
    const hooks = await db.select().from(webhooks).where(
      and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.isActive, true))
    );

    for (const hook of hooks) {
      const events = hook.events as string[];
      if (!events.includes(event) && !events.includes("*")) continue;

      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const sig = createHmac("sha256", hook.secret).update(body).digest("hex");

      try {
        await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-LeadPilot-Signature": `sha256=${sig}`,
            "X-LeadPilot-Event": event,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        await db.update(webhooks).set({ lastFiredAt: new Date() }).where(eq(webhooks.id, hook.id));
      } catch (e) {
        console.warn(`Webhook delivery failed for ${hook.url}:`, e);
      }
    }
  } catch (e) {
    console.error("fireWebhook error:", e);
  }
}

export default router;
