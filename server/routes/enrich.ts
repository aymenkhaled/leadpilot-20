import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { jobs, companies, contacts, workspaceApiKeys, usageLog, waterfallConfigs, workspaces } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";
import { decryptApiKey } from "../crypto.js";
import { DomainResolver } from "../services/domain-resolver.js";

const router = Router();
router.use(requireAuth);

// POST /api/enrich/job/:jobId
router.post("/job/:jobId", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, req.params.jobId), eq(jobs.workspaceId, wid)),
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    if (job.isAnonymous || !job.companyName) {
      return res.json({ success: false, reason: "Anonymous job posting, skipping enrichment" });
    }

    const results: any = { domain: null, contacts: [] };

    // Step 1: Domain resolution
    if (!job.companyDomain && job.companyName) {
      try {
        const serperKey = await db.query.workspaceApiKeys.findFirst({
          where: and(eq(workspaceApiKeys.workspaceId, wid), eq(workspaceApiKeys.provider, "serper"), eq(workspaceApiKeys.isActive, true)),
        });
        const serperApiKey = serperKey ? decryptApiKey(serperKey.keyEncrypted, serperKey.keyIv, serperKey.keyTag) : undefined;

        const resolver = new DomainResolver(serperApiKey);
        const domain = await resolver.resolve(job.companyName, job.sourceUrl || undefined);

        if (domain) {
          results.domain = domain;
          await db.update(jobs).set({ companyDomain: domain, domainResolved: true, updatedAt: new Date() }).where(eq(jobs.id, job.id));

          // Upsert company
          const existing = await db.query.companies.findFirst({
            where: and(eq(companies.workspaceId, wid), eq(companies.domain, domain)),
          });

          if (!existing) {
            const [company] = await db.insert(companies).values({
              workspaceId: wid,
              name: job.companyName,
              domain,
            }).returning();
            await db.update(jobs).set({ companyId: company.id }).where(eq(jobs.id, job.id));
          } else {
            await db.update(jobs).set({ companyId: existing.id }).where(eq(jobs.id, job.id));
          }
        }
      } catch (e) {
        console.warn("Domain resolution failed:", e);
      }
    }

    // Step 2: Waterfall enrichment for contacts
    const domain = job.companyDomain || results.domain;
    if (domain) {
      const { EnrichmentOrchestrator } = await import("../services/enrichment-orchestrator.js");
      const orch = new EnrichmentOrchestrator(wid);
      const enrichResult = await orch.enrich(domain, job.companyName || "", job.id);
      results.contacts = enrichResult.contacts;

      if (enrichResult.contacts.length > 0) {
        await db.update(jobs).set({
          contactFound: true,
          contactVerified: enrichResult.contacts.some(c => c.emailVerified),
          enrichedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(jobs.id, job.id));
      }

      // Log usage
      await db.insert(usageLog).values({
        workspaceId: wid,
        action: "enrich",
        provider: enrichResult.provider || "waterfall",
        creditsUsed: enrichResult.creditsUsed.toString(),
        isByok: enrichResult.isByok,
        metadata: { jobId: job.id, domain },
      });
    }

    res.json({ success: true, ...results });
  } catch (err: any) {
    console.error("Enrichment error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrich/domain
router.post("/domain", async (req: AuthRequest, res) => {
  try {
    const { companyName, sourceUrl } = z.object({
      companyName: z.string(),
      sourceUrl: z.string().optional(),
    }).parse(req.body);

    const wid = req.user!.workspaceId;
    const serperKey = await db.query.workspaceApiKeys.findFirst({
      where: and(eq(workspaceApiKeys.workspaceId, wid), eq(workspaceApiKeys.provider, "serper"), eq(workspaceApiKeys.isActive, true)),
    });
    const serperApiKey = serperKey ? decryptApiKey(serperKey.keyEncrypted, serperKey.keyIv, serperKey.keyTag) : undefined;

    const resolver = new DomainResolver(serperApiKey);
    const domain = await resolver.resolve(companyName, sourceUrl);

    res.json({ domain });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
