import axios from "axios";

export interface ScrapedJob {
  platform: string;
  title: string;
  description?: string;
  companyName?: string;
  companyDomain?: string;
  location?: string;
  remote?: boolean;
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: string;
  sourceUrl?: string;
  postedAt?: string;
  skills?: string[];
  externalId?: string;
}

const UA = "Mozilla/5.0 (compatible; LeadPilot/2.0; +https://leadpilot.app)";
const TIMEOUT = 15000;

export class JobScraper {

  // ─── Remotive ───────────────────────────────────────────────────
  async scrapeRemotive(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    try {
      const res = await axios.get("https://remotive.com/api/remote-jobs", {
        params: { search: keyword, limit: Math.min(limit, 100) },
        headers: { "User-Agent": UA },
        timeout: TIMEOUT,
      });
      const jobs = res.data?.jobs || [];
      return jobs.slice(0, limit).map((j: any) => ({
        platform: "Remotive",
        title: this.cleanText(j.title || ""),
        description: this.cleanHtml(j.description || ""),
        companyName: j.company_name,
        companyDomain: this.extractDomain(j.company_url),
        location: j.candidate_required_location || "Remote",
        remote: true,
        sourceUrl: j.url,
        postedAt: j.publication_date,
        skills: j.tags || [],
        externalId: j.id ? `remotive-${j.id}` : undefined,
      }));
    } catch (e: any) {
      console.warn("Remotive scrape failed:", e.message);
      return [];
    }
  }

  // ─── Jobicy ─────────────────────────────────────────────────────
  async scrapeJobicy(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    try {
      const res = await axios.get("https://jobicy.com/api/v2/remote-jobs", {
        params: { count: Math.min(limit, 50), tag: keyword },
        headers: { "User-Agent": UA },
        timeout: TIMEOUT,
      });
      const jobs = res.data?.jobs || [];
      return jobs.slice(0, limit).map((j: any) => ({
        platform: "Jobicy",
        title: this.cleanText(j.jobTitle || ""),
        description: this.cleanHtml(j.jobDescription || j.jobExcerpt || ""),
        companyName: j.companyName,
        companyDomain: this.extractDomain(j.companyUrl),
        location: j.jobGeo || "Remote",
        remote: true,
        sourceUrl: j.url,
        postedAt: j.pubDate,
        skills: (j.jobIndustry || []).concat(j.jobType || []),
        externalId: j.id ? `jobicy-${j.id}` : undefined,
      }));
    } catch (e: any) {
      console.warn("Jobicy scrape failed:", e.message);
      return [];
    }
  }

  // ─── Arbeitnow ──────────────────────────────────────────────────
  async scrapeArbeitnow(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    try {
      const res = await axios.get("https://arbeitnow.com/api/job-board-api", {
        headers: { "User-Agent": UA, Accept: "application/json" },
        timeout: TIMEOUT,
        maxRedirects: 5,
      });
      const jobs: any[] = res.data?.data || [];
      const q = keyword.toLowerCase();
      const filtered = jobs.filter((j: any) =>
        (j.title || "").toLowerCase().includes(q) ||
        (j.tags || []).some((t: string) => t.toLowerCase().includes(q)) ||
        (j.description || "").toLowerCase().includes(q)
      );
      return filtered.slice(0, limit).map((j: any) => ({
        platform: "Arbeitnow",
        title: this.cleanText(j.title || ""),
        description: this.cleanHtml(j.description || ""),
        companyName: j.company_name,
        location: j.location || "Remote",
        remote: j.remote || false,
        sourceUrl: j.url,
        postedAt: j.created_at,
        skills: j.tags || [],
        externalId: j.slug ? `arbeitnow-${j.slug}` : undefined,
      }));
    } catch (e: any) {
      console.warn("Arbeitnow scrape failed:", e.message);
      return [];
    }
  }

  // ─── Himalayas ──────────────────────────────────────────────────
  async scrapeHimalayas(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    try {
      const res = await axios.get("https://himalayas.app/jobs/api", {
        params: { q: keyword, limit: Math.min(limit, 100) },
        headers: { "User-Agent": UA },
        timeout: TIMEOUT,
      });
      const jobs: any[] = res.data?.jobs || [];
      return jobs.slice(0, limit).map((j: any) => ({
        platform: "Himalayas",
        title: this.cleanText(j.title || ""),
        description: this.cleanHtml(j.description || j.content || ""),
        companyName: j.company?.name || j.companyName,
        companyDomain: this.extractDomain(j.company?.url || j.companyUrl),
        location: j.location || "Remote",
        remote: true,
        sourceUrl: j.applicationLink || j.url,
        postedAt: j.publishedAt || j.createdAt,
        skills: j.skills || j.tags || [],
        externalId: j.slug ? `himalayas-${j.slug}` : undefined,
      }));
    } catch (e: any) {
      console.warn("Himalayas scrape failed:", e.message);
      return [];
    }
  }

  // ─── RemoteOK ───────────────────────────────────────────────────
  async scrapeRemoteOK(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    try {
      const res = await axios.get("https://remoteok.com/api", {
        headers: { "User-Agent": UA, Accept: "application/json" },
        timeout: TIMEOUT,
      });
      const data = res.data as any[];
      const q = keyword.toLowerCase();
      return data
        .filter((j: any) => j.position && (
          j.position.toLowerCase().includes(q) ||
          (j.tags || []).some((t: string) => t.toLowerCase().includes(q))
        ))
        .slice(0, limit)
        .map((j: any) => ({
          platform: "RemoteOK",
          title: j.position || "Unknown Position",
          description: this.cleanHtml(j.description || ""),
          companyName: j.company,
          companyDomain: this.extractDomain(j.company_website),
          location: "Remote",
          remote: true,
          sourceUrl: j.url || `https://remoteok.com/jobs/${j.id}`,
          postedAt: j.date || undefined,
          skills: j.tags || [],
          externalId: j.id ? `remoteok-${j.id}` : undefined,
          budgetMin: j.salary_min ? Number(j.salary_min) : undefined,
          budgetMax: j.salary_max ? Number(j.salary_max) : undefined,
          budgetType: j.salary_min ? "annual" : undefined,
        }));
    } catch (e: any) {
      console.warn("RemoteOK scrape failed:", e.message);
      return [];
    }
  }

  // ─── WeWorkRemotely (RSS) ────────────────────────────────────────
  async scrapeWeWorkRemotely(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    const categories = [
      "programming", "design", "marketing", "devops-sysadmin",
      "customer-support", "sales", "product", "writing", "data-science",
    ];
    const jobs: ScrapedJob[] = [];
    const q = keyword.toLowerCase();

    for (const cat of categories) {
      if (jobs.length >= limit) break;
      try {
        const res = await axios.get(
          `https://weworkremotely.com/categories/remote-${cat}-jobs.rss`,
          { headers: { "User-Agent": UA }, timeout: 10000 }
        );
        const xml = res.data as string;
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

        for (const item of items) {
          if (jobs.length >= limit) break;
          const title = this.extractXml(item, "title");
          if (!title || !title.toLowerCase().includes(q)) continue;
          const link = this.extractXml(item, "link");
          const description = this.extractXml(item, "description");
          const region = this.extractXml(item, "region");
          const company = this.extractXml(item, "company");
          jobs.push({
            platform: "WeWorkRemotely",
            title: this.cleanText(title),
            description: this.cleanHtml(description || ""),
            companyName: company ? this.cleanText(company) : undefined,
            sourceUrl: link || undefined,
            location: region || "Remote",
            remote: true,
            externalId: link ? `wwr-${Buffer.from(link).toString("base64").slice(0, 20)}` : undefined,
          });
        }
      } catch {}
    }

    return jobs;
  }

  // ─── Upwork (RSS) ───────────────────────────────────────────────
  async scrapeUpwork(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    try {
      const q = encodeURIComponent(keyword);
      const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${q}&sort=recency`;
      const res = await axios.get(url, {
        headers: { "User-Agent": UA },
        timeout: TIMEOUT,
      });
      const xml = res.data as string;
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      return items.slice(0, limit).map((item) => {
        const title = this.extractXml(item, "title");
        const link = this.extractXml(item, "link");
        const description = this.extractXml(item, "description");
        const pubDate = this.extractXml(item, "pubDate");
        const budget = this.extractBudget(description || "");
        return {
          platform: "Upwork",
          title: this.cleanText(title || "Untitled"),
          description: this.cleanHtml(description || ""),
          sourceUrl: link || undefined,
          postedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
          budgetMin: budget.min,
          budgetMax: budget.max,
          budgetType: budget.type,
          remote: true,
          externalId: link ? `upwork-${Buffer.from(link).toString("base64").slice(0, 20)}` : undefined,
        };
      }).filter(j => j.title);
    } catch (e: any) {
      console.warn("Upwork scrape failed:", e.message);
      return [];
    }
  }

  // ─── Freelancer (public API) ─────────────────────────────────────
  async scrapeFreelancer(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    try {
      const q = encodeURIComponent(keyword);
      const res = await axios.get(
        `https://www.freelancer.com/api/projects/0.1/projects/active/?query=${q}&limit=${limit}&job_details=true`,
        { headers: { "User-Agent": UA }, timeout: TIMEOUT }
      );
      const projects = res.data?.result?.projects || [];
      return projects.map((p: any) => ({
        platform: "Freelancer",
        title: this.cleanText(p.title || ""),
        description: this.cleanText(p.description || ""),
        remote: true,
        budgetMin: p.budget?.minimum,
        budgetMax: p.budget?.maximum,
        budgetType: p.hourly_project_info ? "hourly" : "fixed",
        sourceUrl: `https://www.freelancer.com/projects/${p.seo_url || p.id}`,
        postedAt: p.submitdate ? new Date(p.submitdate * 1000).toISOString() : undefined,
        externalId: p.id ? `freelancer-${p.id}` : undefined,
      }));
    } catch (e: any) {
      console.warn("Freelancer scrape failed:", e.message);
      return [];
    }
  }

  // ─── Multi-platform fallback (tries all free APIs) ───────────────
  async scrapeAll(keyword: string, limit = 25): Promise<ScrapedJob[]> {
    const results = await Promise.allSettled([
      this.scrapeRemotive(keyword, limit),
      this.scrapeJobicy(keyword, Math.ceil(limit / 2)),
      this.scrapeRemoteOK(keyword, Math.ceil(limit / 2)),
      this.scrapeWeWorkRemotely(keyword, Math.ceil(limit / 2)),
    ]);

    const jobs: ScrapedJob[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") jobs.push(...r.value);
    }

    // Deduplicate by title+company
    const seen = new Set<string>();
    return jobs.filter(j => {
      const key = `${j.title?.toLowerCase()}-${j.companyName?.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private extractXml(text: string, tag: string): string | null {
    const match = text.match(
      new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
    );
    return match ? (match[1] || match[2] || "").trim() : null;
  }

  cleanHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#\d+;/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ {2,}/g, " ")
      .trim()
      .substring(0, 8000);
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();
  }

  private extractDomain(url?: string): string | undefined {
    if (!url) return undefined;
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || undefined;
    }
  }

  private extractBudget(text: string): { min?: number; max?: number; type?: string } {
    const hourly = text.match(/\$(\d+(?:\.\d+)?)\s*[-–]\s*\$(\d+(?:\.\d+)?)\s*\/\s*hr/i);
    if (hourly) return { min: parseFloat(hourly[1]), max: parseFloat(hourly[2]), type: "hourly" };
    const fixed = text.match(/\$(\d[\d,]*)\s*[-–]\s*\$(\d[\d,]*)/);
    if (fixed) {
      const min = parseFloat(fixed[1].replace(/,/g, ""));
      const max = parseFloat(fixed[2].replace(/,/g, ""));
      return { min, max, type: min < 1000 ? "hourly" : "fixed" };
    }
    const single = text.match(/\$(\d[\d,]+)/);
    if (single) {
      const val = parseFloat(single[1].replace(/,/g, ""));
      return { min: val, type: val < 500 ? "hourly" : "fixed" };
    }
    return {};
  }
}
