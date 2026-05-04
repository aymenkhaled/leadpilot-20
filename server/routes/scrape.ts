import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { jobs, scrapeRuns, intentSignals } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/scrape/platforms
router.get("/platforms", (_req, res) => {
  res.json({
    platforms: [
      { id: "all",            name: "All Free Platforms (Remotive + Jobicy + RemoteOK + WeWorkRemotely)", requiresKey: false },
      { id: "remotive",       name: "Remotive",           requiresKey: false },
      { id: "jobicy",         name: "Jobicy",              requiresKey: false },
      { id: "remoteok",       name: "RemoteOK",            requiresKey: false },
      { id: "weworkremotely", name: "We Work Remotely",    requiresKey: false },
      { id: "arbeitnow",      name: "Arbeitnow",           requiresKey: false },
      { id: "himalayas",      name: "Himalayas",           requiresKey: false },
      { id: "upwork",         name: "Upwork (RSS)",        requiresKey: false },
      { id: "freelancer",     name: "Freelancer",          requiresKey: false },
    ],
  });
});

const scrapeSchema = z.object({
  platform: z.string(),
  keyword: z.string().min(1),
  location: z.string().default(""),
  resultsWanted: z.number().min(1).max(200).default(25),
  hoursOld: z.number().default(72),
  sites: z.array(z.string()).optional(),
});

// POST /api/scrape
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = scrapeSchema.parse(req.body);
    const wid = req.user!.workspaceId;

    const [run] = await db.insert(scrapeRuns).values({
      workspaceId: wid,
      platform: data.platform,
      keyword: data.keyword,
      location: data.location,
      status: "running",
    }).returning();

    res.status(202).json({ runId: run.id, message: "Scrape started" });

    executeScrape(run.id, wid, data).catch(console.error);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/scrape/runs
router.get("/runs", async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const runs = await db.select().from(scrapeRuns)
      .where(eq(scrapeRuns.workspaceId, req.user!.workspaceId))
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(limit);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scrape/runs/:id
router.get("/runs/:id", async (req: AuthRequest, res) => {
  try {
    const run = await db.query.scrapeRuns.findFirst({
      where: and(eq(scrapeRuns.id, req.params.id), eq(scrapeRuns.workspaceId, req.user!.workspaceId)),
    });
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function executeScrape(runId: string, workspaceId: string, data: z.infer<typeof scrapeSchema>) {
  const updateRun = async (updates: any) => {
    await db.update(scrapeRuns).set(updates).where(eq(scrapeRuns.id, runId));
  };

  try {
    const { JobScraper } = await import("../services/job-scraper.js");
    const scraper = new JobScraper();

    let scrapedJobs: any[] = [];

    const p = data.platform.toLowerCase();
    const kw = data.keyword;
    const lim = data.resultsWanted;

    if (p === "all") {
      scrapedJobs = await scraper.scrapeAll(kw, lim);
    } else if (p === "remotive") {
      scrapedJobs = await scraper.scrapeRemotive(kw, lim);
    } else if (p === "jobicy") {
      scrapedJobs = await scraper.scrapeJobicy(kw, lim);
    } else if (p === "remoteok") {
      scrapedJobs = await scraper.scrapeRemoteOK(kw, lim);
    } else if (p === "weworkremotely") {
      scrapedJobs = await scraper.scrapeWeWorkRemotely(kw, lim);
    } else if (p === "arbeitnow") {
      scrapedJobs = await scraper.scrapeArbeitnow(kw, lim);
    } else if (p === "himalayas") {
      scrapedJobs = await scraper.scrapeHimalayas(kw, lim);
    } else if (p === "upwork") {
      scrapedJobs = await scraper.scrapeUpwork(kw, lim);
    } else if (p === "freelancer") {
      scrapedJobs = await scraper.scrapeFreelancer(kw, lim);
    } else {
      // Unknown platform → try all
      scrapedJobs = await scraper.scrapeAll(kw, lim);
    }

    console.log(`[scrape] platform=${data.platform} keyword="${kw}" → ${scrapedJobs.length} jobs found`);

    let newCount = 0;
    const savedJobIds: string[] = [];

    for (const job of scrapedJobs) {
      try {
        if (job.externalId) {
          const existing = await db.query.jobs.findFirst({
            where: and(eq(jobs.workspaceId, workspaceId), eq(jobs.externalId, job.externalId)),
          });
          if (existing) continue;
        }

        const [saved] = await db.insert(jobs).values({
          workspaceId,
          platform: job.platform || data.platform,
          title: job.title,
          description: job.description,
          companyName: job.companyName,
          companyDomain: job.companyDomain,
          location: job.location,
          remote: job.remote || false,
          budgetMin: job.budgetMin,
          budgetMax: job.budgetMax,
          budgetType: job.budgetType,
          sourceUrl: job.sourceUrl,
          postedAt: job.postedAt ? new Date(job.postedAt) : null,
          skills: job.skills || [],
          externalId: job.externalId,
          isAnonymous: !job.companyName || ["confidential", "stealth", "undisclosed"].some(
            k => (job.companyName || "").toLowerCase().includes(k)
          ),
        }).returning();

        newCount++;
        savedJobIds.push(saved.id);

        await generateSignals(workspaceId, saved, job);
      } catch (e) {
        console.warn("Failed to save job:", e);
      }
    }

    await updateRun({
      status: "completed",
      jobsFound: scrapedJobs.length,
      jobsNew: newCount,
      completedAt: new Date(),
    });

    console.log(`[scrape] Done — ${newCount} new jobs saved, signals generated`);
  } catch (err: any) {
    console.error("[scrape] Fatal error:", err.message);
    await updateRun({ status: "failed", error: err.message, completedAt: new Date() });
  }
}

async function generateSignals(workspaceId: string, savedJob: any, raw: any) {
  try {
    const signals: any[] = [];

    // Hiring spike — any tech/engineering job with a company is a hiring signal
    if (savedJob.companyName && !savedJob.isAnonymous) {
      signals.push({
        workspaceId,
        jobId: savedJob.id,
        type: "hiring_spike",
        title: `${savedJob.companyName} is hiring — ${savedJob.title}`,
        description: savedJob.location
          ? `New ${savedJob.remote ? "remote" : savedJob.location} opening detected`
          : "New job opening detected via job board scrape",
        strength: (raw.budgetMax && raw.budgetMax > 5000) || (raw.skills && raw.skills.length > 5)
          ? "strong" : "moderate",
        sourceName: raw.platform || "Job Board",
        sourceUrl: savedJob.sourceUrl,
      });
    }

    // Budget signal — high-value contract
    if (savedJob.budgetMax && savedJob.budgetMax >= 2000) {
      signals.push({
        workspaceId,
        jobId: savedJob.id,
        type: "funding",
        title: `High-value contract: ${savedJob.title}`,
        description: `Budget up to $${savedJob.budgetMax.toLocaleString()} ${savedJob.budgetType || ""} at ${savedJob.companyName || "company"}`,
        strength: savedJob.budgetMax >= 10000 ? "strong" : "moderate",
        sourceName: raw.platform || "Job Board",
        sourceUrl: savedJob.sourceUrl,
      });
    }

    for (const sig of signals) {
      await db.insert(intentSignals).values(sig).catch(() => {});
    }
  } catch (e) {
    console.warn("Signal generation failed:", e);
  }
}

export default router;
