import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { workspaceSettings, workspaceApiKeys, waterfallConfigs, workspaces } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";
import { encryptApiKey, decryptApiKey } from "../crypto.js";

const router = Router();
router.use(requireAuth);

// GET /api/settings
router.get("/", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const settings = await db.query.workspaceSettings.findFirst({
      where: eq(workspaceSettings.workspaceId, wid),
    });
    res.json(settings || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings
router.patch("/", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const existing = await db.query.workspaceSettings.findFirst({ where: eq(workspaceSettings.workspaceId, wid) });

    if (existing) {
      const [updated] = await db.update(workspaceSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(workspaceSettings.workspaceId, wid))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(workspaceSettings)
        .values({ workspaceId: wid, ...req.body })
        .returning();
      return res.json(created);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/api-keys
router.get("/api-keys", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const keys = await db.select({
      id: workspaceApiKeys.id,
      provider: workspaceApiKeys.provider,
      isByok: workspaceApiKeys.isByok,
      isActive: workspaceApiKeys.isActive,
      lastTestedAt: workspaceApiKeys.lastTestedAt,
      lastTestResult: workspaceApiKeys.lastTestResult,
      createdAt: workspaceApiKeys.createdAt,
    }).from(workspaceApiKeys).where(eq(workspaceApiKeys.workspaceId, wid));

    // Never return encrypted key — just show masked provider status
    res.json(keys.map(k => ({ ...k, hasKey: true })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/api-keys/:provider
router.put("/api-keys/:provider", async (req: AuthRequest, res) => {
  try {
    const { key } = z.object({ key: z.string().min(1) }).parse(req.body);
    const wid = req.user!.workspaceId;
    const provider = req.params.provider;

    const { encrypted, iv, tag } = encryptApiKey(key);

    const existing = await db.query.workspaceApiKeys.findFirst({
      where: and(eq(workspaceApiKeys.workspaceId, wid), eq(workspaceApiKeys.provider, provider)),
    });

    if (existing) {
      const [updated] = await db.update(workspaceApiKeys)
        .set({ keyEncrypted: encrypted, keyIv: iv, keyTag: tag, isActive: true })
        .where(eq(workspaceApiKeys.id, existing.id))
        .returning();
      return res.json({ id: updated.id, provider: updated.provider, isActive: updated.isActive });
    } else {
      const [created] = await db.insert(workspaceApiKeys)
        .values({ workspaceId: wid, provider, keyEncrypted: encrypted, keyIv: iv, keyTag: tag })
        .returning();
      return res.status(201).json({ id: created.id, provider: created.provider, isActive: created.isActive });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/settings/api-keys/:provider
router.delete("/api-keys/:provider", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    await db.delete(workspaceApiKeys).where(
      and(eq(workspaceApiKeys.workspaceId, wid), eq(workspaceApiKeys.provider, req.params.provider))
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/api-keys/:provider/test
router.post("/api-keys/:provider/test", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const apiKey = await db.query.workspaceApiKeys.findFirst({
      where: and(eq(workspaceApiKeys.workspaceId, wid), eq(workspaceApiKeys.provider, req.params.provider)),
    });

    if (!apiKey) return res.status(404).json({ error: "API key not configured" });

    const decrypted = decryptApiKey(apiKey.keyEncrypted, apiKey.keyIv, apiKey.keyTag);
    let success = false;
    let message = "Test not implemented for this provider";

    // Test OpenAI
    if (req.params.provider === "openai") {
      try {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: decrypted });
        await client.models.list();
        success = true;
        message = "OpenAI connection successful";
      } catch {
        message = "Invalid OpenAI API key";
      }
    }

    await db.update(workspaceApiKeys)
      .set({ lastTestedAt: new Date(), lastTestResult: success ? "ok" : message })
      .where(eq(workspaceApiKeys.id, apiKey.id));

    res.json({ success, message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/waterfall
router.get("/waterfall", async (req: AuthRequest, res) => {
  try {
    const configs = await db.select().from(waterfallConfigs)
      .where(eq(waterfallConfigs.workspaceId, req.user!.workspaceId));
    res.json(configs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/waterfall
router.post("/waterfall", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().default("Default"),
      steps: z.array(z.object({
        provider: z.string(),
        minConfidence: z.number().min(0).max(100).default(70),
        stopOnFound: z.boolean().default(true),
        useBYOK: z.boolean().default(false),
      })).default([]),
      isDefault: z.boolean().default(false),
    }).parse(req.body);

    const [config] = await db.insert(waterfallConfigs).values({
      workspaceId: req.user!.workspaceId,
      ...data,
    }).returning();

    res.status(201).json(config);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/settings/waterfall/:id
router.patch("/waterfall/:id", async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(waterfallConfigs)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(waterfallConfigs.id, req.params.id), eq(waterfallConfigs.workspaceId, req.user!.workspaceId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
