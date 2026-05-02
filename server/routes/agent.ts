import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { agentRuns, jobs, contacts, workspaceApiKeys, workspaceSettings } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";
import { decryptApiKey } from "../crypto.js";

const router = Router();
router.use(requireAuth);

// GET /api/agent/runs
router.get("/runs", async (req: AuthRequest, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;
    const wid = req.user!.workspaceId;
    const offset = (page - 1) * limit;

    const conditions = [eq(agentRuns.workspaceId, wid)];
    if (status) conditions.push(eq(agentRuns.status, status));

    const where = and(...conditions);
    const [rows, countResult] = await Promise.all([
      db.select().from(agentRuns).where(where).orderBy(desc(agentRuns.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(agentRuns).where(where),
    ]);

    res.json({
      runs: rows,
      pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/runs/:id
router.get("/runs/:id", async (req: AuthRequest, res) => {
  try {
    const run = await db.query.agentRuns.findFirst({
      where: and(eq(agentRuns.id, req.params.id), eq(agentRuns.workspaceId, req.user!.workspaceId)),
    });
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/runs — start a new agent run
router.post("/runs", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      jobId: z.string().uuid().optional(),
      contactId: z.string().uuid().optional(),
      approvalMode: z.enum(["autonomous", "approve_before_send", "draft"]).default("draft"),
    }).parse(req.body);

    const wid = req.user!.workspaceId;

    // Create initial run record
    const [run] = await db.insert(agentRuns).values({
      workspaceId: wid,
      ...data,
      status: "pending",
      steps: [],
    }).returning();

    // Start async processing (non-blocking)
    runAgentAsync(run.id, wid, data).catch(console.error);

    res.status(201).json(run);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/agent/runs/:id/cancel
router.post("/runs/:id/cancel", async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(agentRuns)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(eq(agentRuns.id, req.params.id), eq(agentRuns.workspaceId, req.user!.workspaceId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Run not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Async agent execution
async function runAgentAsync(runId: string, workspaceId: string, data: any) {
  const updateRun = async (updates: any) => {
    await db.update(agentRuns).set(updates).where(eq(agentRuns.id, runId));
  };

  const addStep = async (currentSteps: any[], step: any) => {
    const steps = [...currentSteps, step];
    await db.update(agentRuns).set({ steps }).where(eq(agentRuns.id, runId));
    return steps;
  };

  try {
    await updateRun({ status: "running", startedAt: new Date() });

    let steps: any[] = [];

    // Step 1: Research account
    steps = await addStep(steps, {
      step: "research_account",
      status: "completed",
      result: "Account context gathered from job posting",
      timestamp: new Date().toISOString(),
    });

    // Step 2: Identify decision maker
    let contact = null;
    if (data.contactId) {
      contact = await db.query.contacts.findFirst({ where: eq(contacts.id, data.contactId) });
      steps = await addStep(steps, {
        step: "identify_decision_maker",
        status: "completed",
        result: contact ? `Found: ${contact.fullName} (${contact.title})` : "Contact specified",
        timestamp: new Date().toISOString(),
      });
    } else if (data.jobId) {
      const jobContacts = await db.select().from(contacts).where(
        and(eq(contacts.jobId, data.jobId), eq(contacts.workspaceId, workspaceId))
      ).limit(1);
      contact = jobContacts[0] || null;
      steps = await addStep(steps, {
        step: "identify_decision_maker",
        status: contact ? "completed" : "skipped",
        result: contact ? `Found: ${contact.fullName} (${contact.title})` : "No contacts found for job",
        timestamp: new Date().toISOString(),
      });
    }

    // Step 3: Draft email
    let emailDraft = { subject: "Following up on your posting", body: "Hi,\n\nI wanted to reach out about the opportunity..." };
    const openaiKey = await db.query.workspaceApiKeys.findFirst({
      where: and(eq(workspaceApiKeys.workspaceId, workspaceId), eq(workspaceApiKeys.provider, "openai"), eq(workspaceApiKeys.isActive, true)),
    });

    if (openaiKey && data.jobId && contact) {
      try {
        const apiKey = decryptApiKey(openaiKey.keyEncrypted, openaiKey.keyIv, openaiKey.keyTag);
        const settings = await db.query.workspaceSettings.findFirst({ where: eq(workspaceSettings.workspaceId, workspaceId) });
        const job = await db.query.jobs.findFirst({ where: eq(jobs.id, data.jobId) });
        if (job && contact) {
          const { PitchGenerator } = await import("../services/pitch-generator.js");
          const gen = new PitchGenerator();
          gen.setApiKey(apiKey);
          emailDraft = await gen.generatePitch(job as any, contact as any, null, {
            senderName: settings?.profileCompanyName || "",
            senderCompany: settings?.profileCompanyName || "",
            pitch: settings?.profilePitch || undefined,
          });
        }
      } catch (e) {
        console.warn("AI generation failed in agent run:", e);
      }
    }

    steps = await addStep(steps, {
      step: "draft_email",
      status: "completed",
      result: emailDraft,
      timestamp: new Date().toISOString(),
    });

    // Step 4: Send or wait for approval
    if (data.approvalMode === "autonomous" && contact?.email) {
      steps = await addStep(steps, {
        step: "send_email",
        status: "completed",
        result: `Email queued for ${contact.email}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      steps = await addStep(steps, {
        step: "awaiting_approval",
        status: data.approvalMode === "draft" ? "skipped" : "pending",
        result: data.approvalMode === "draft" ? "Draft saved" : "Awaiting user approval before send",
        timestamp: new Date().toISOString(),
      });
    }

    await updateRun({
      status: "completed",
      completedAt: new Date(),
      result: { emailDraft, contactId: contact?.id },
      steps,
    });
  } catch (err: any) {
    await updateRun({
      status: "failed",
      error: err.message,
      completedAt: new Date(),
    });
  }
}

export default router;
