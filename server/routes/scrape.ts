import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { jobs, scrapeRuns, workspaceApiKeys } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";
import { decryptApiKey } from "../crypto.js";

const router = Router();
router.use(requireAuth);

// GET /api/scrape/platforms
router.get("/platforms", (_req, res) => {
  res.json({
    platforms: [
      { id: "jobspy", name: "JobSpy (Indeed, LinkedIn, Glassdoor, Google, ZipRecruiter)", requiresKey: false },
      { id: "upwork", name: "Upwork", requiresKey: false },
      { id: "freelancer", name: "Freelancer", requiresKey: false },
      { id: "remoteok", name: "RemoteOK", requiresKey: false },
      { id: "weworkremotely", name: "We Work Remotely", requiresKey: false },
      { id: "linkedin_apify", name: "LinkedIn (via Apify)", requiresKey: true, keyProvider: "apify" },
      { id: "indeed_apify", name: "Indeed (via Apify)", requiresKey: true, keyProvider: "apify" },
      { id: "glassdoor_apify", name: "Glassdoor (via Apify)", requiresKey: true, keyProvider: "apify" },
      { id: "dice_apify", name: "Dice (via Apify)", requiresKey: true, keyProvider: "apify" },
      { id: "wellfound_apify", name: "Wellfound (via Apify)", requiresKey: true, keyProvider: "apify" },
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

    // Create scrape run record
    const [run] = await db.insert(scrapeRuns).values({
      workspaceId: wid,
      platform: data.platform,
      keyword: data.keyword,
      location: data.location,
      status: "running",
    }).returning();

    res.status(202).json({ runId: run.id, message: "Scrape started" });

    // Execute async
    executeScrape(run.id, wid, data).catch(console.error);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/scrape/runs
router.get("/runs", async (req: AuthRequest, res) => {
  try {
    const runs = await db.select().from(scrapeRuns)
      .where(eq(scrapeRuns.workspaceId, req.user!.workspaceId))
      .orderBy(scrapeRuns.startedAt)
      .limit(20);
    res.json(runs);
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
    let scrapedJobs: any[] = [];

    if (data.platform === "jobspy" || data.platform.includes("indeed") || data.platform.includes("linkedin")) {
      // Try JobSpy Python sidecar
      try {
        const response = await fetch("http://localhost:5001/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            search_term: data.keyword,
            location: data.location,
            sites: data.sites || ["indeed", "google"],
            results_wanted: data.resultsWanted,
            hours_old: data.hoursOld,
          }),
        });

        if (response.ok) {
          const result = await response.json() as any;
          scrapedJobs = result.jobs || [];
        }
      } catch (e) {
        console.warn("JobSpy sidecar unavailable, using fallback scraper");
        scrapedJobs = await fallbackScrape(data);
      }
    } else if (data.platform === "upwork") {
      scrapedJobs = await scrapeUpwork(data.keyword, data.resultsWanted);
    } else if (data.platform === "remoteok") {
      scrapedJobs = await scrapeRemoteOK(data.keyword);
    } else if (data.platform === "weworkremotely") {
      scrapedJobs = await scrapeWeWorkRemotely(data.keyword);
    } else {
      scrapedJobs = await fallbackScrape(data);
    }

    // Save jobs to DB, dedup by externalId
    let newCount = 0;
    for (const job of scrapedJobs) {
      try {
        // Check duplicate
        if (job.externalId) {
          const existing = await db.query.jobs.findFirst({
            where: and(eq(jobs.workspaceId, workspaceId), eq(jobs.externalId, job.externalId)),
          });
          if (existing) { continue; }
        }

        await db.insert(jobs).values({
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
        });
        newCount++;
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
  } catch (err: any) {
    await updateRun({ status: "failed", error: err.message, completedAt: new Date() });
  }
}

async function fallbackScrape(data: any): Promise<any[]> {
  // RSS/public feed scraping as fallback
  return [];
}

async function scrapeUpwork(keyword: string, limit: number): Promise<any[]> {
  try {
    const { JobScraper } = await import("../services/job-scraper.js");
    const scraper = new JobScraper();
    return await scraper.scrapeUpwork(keyword, limit);
  } catch {
    return [];
  }
}

async function scrapeRemoteOK(keyword: string): Promise<any[]> {
  try {
    const { JobScraper } = await import("../services/job-scraper.js");
    const scraper = new JobScraper();
    return await scraper.scrapeRemoteOK(keyword);
  } catch {
    return [];
  }
}

async function scrapeWeWorkRemotely(keyword: string): Promise<any[]> {
  try {
    const { JobScraper } = await import("../services/job-scraper.js");
    const scraper = new JobScraper();
    return await scraper.scrapeWeWorkRemotely(keyword);
  } catch {
    return [];
  }
}

export default router;
