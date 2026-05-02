import axios from "axios";

interface ScrapedJob {
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

export class JobScraper {
  async scrapeUpwork(keyword: string, limit: number = 25): Promise<ScrapedJob[]> {
    try {
      // Upwork RSS feed (public, no auth needed)
      const query = encodeURIComponent(keyword);
      const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${query}&sort=recency`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadPilot/2.0)" },
        timeout: 15000,
      });

      const jobs: ScrapedJob[] = [];
      const xml = response.data as string;
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

      for (const item of items.slice(0, limit)) {
        const title = this.extractXml(item, "title");
        const link = this.extractXml(item, "link");
        const description = this.extractXml(item, "description");
        const pubDate = this.extractXml(item, "pubDate");

        if (!title) continue;

        const budget = this.extractBudget(description || "");

        jobs.push({
          platform: "Upwork",
          title: this.cleanText(title),
          description: this.cleanHtml(description || ""),
          sourceUrl: link || undefined,
          postedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
          budgetMin: budget.min,
          budgetMax: budget.max,
          budgetType: budget.type,
          externalId: link ? `upwork-${Buffer.from(link).toString("base64").slice(0, 20)}` : undefined,
          remote: true,
        });
      }

      return jobs;
    } catch (e: any) {
      console.warn("Upwork scrape failed:", e.message);
      return [];
    }
  }

  async scrapeRemoteOK(keyword: string): Promise<ScrapedJob[]> {
    try {
      const response = await axios.get("https://remoteok.com/api", {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LeadPilot/2.0)",
          Accept: "application/json",
        },
        timeout: 15000,
      });

      const data = response.data as any[];
      const query = keyword.toLowerCase();

      return data
        .filter((j: any) => j.position && (
          j.position.toLowerCase().includes(query) ||
          (j.tags || []).some((t: string) => t.toLowerCase().includes(query))
        ))
        .slice(0, 25)
        .map((j: any) => ({
          platform: "RemoteOK",
          title: j.position || "Unknown Position",
          description: j.description || "",
          companyName: j.company,
          companyDomain: j.company_website?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0],
          location: "Remote",
          remote: true,
          sourceUrl: j.url || `https://remoteok.com/jobs/${j.id}`,
          postedAt: j.date || undefined,
          skills: j.tags || [],
          externalId: j.id ? `remoteok-${j.id}` : undefined,
        }));
    } catch (e: any) {
      console.warn("RemoteOK scrape failed:", e.message);
      return [];
    }
  }

  async scrapeWeWorkRemotely(keyword: string): Promise<ScrapedJob[]> {
    try {
      const categories = ["programming", "design", "marketing", "devops-sysadmin"];
      const jobs: ScrapedJob[] = [];
      const query = keyword.toLowerCase();

      for (const cat of categories) {
        const url = `https://weworkremotely.com/categories/remote-${cat}-jobs.rss`;
        try {
          const response = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadPilot/2.0)" },
            timeout: 10000,
          });

          const xml = response.data as string;
          const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

          for (const item of items) {
            const title = this.extractXml(item, "title");
            if (!title || !title.toLowerCase().includes(query)) continue;

            const link = this.extractXml(item, "link");
            const description = this.extractXml(item, "description");
            const region = this.extractXml(item, "region");

            jobs.push({
              platform: "WeWorkRemotely",
              title: this.cleanText(title),
              description: this.cleanHtml(description || ""),
              sourceUrl: link || undefined,
              location: region || "Remote",
              remote: true,
              externalId: link ? `wwr-${Buffer.from(link).toString("base64").slice(0, 20)}` : undefined,
            });
          }
        } catch {}
      }

      return jobs.slice(0, 25);
    } catch (e: any) {
      console.warn("WeWorkRemotely scrape failed:", e.message);
      return [];
    }
  }

  async scrapeFreelancer(keyword: string, limit: number = 25): Promise<ScrapedJob[]> {
    // Freelancer public API
    try {
      const query = encodeURIComponent(keyword);
      const response = await axios.get(
        `https://www.freelancer.com/api/projects/0.1/projects/active/?query=${query}&limit=${limit}&job_details=true`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 15000,
        }
      );

      const projects = response.data?.result?.projects || [];
      return projects.map((p: any) => ({
        platform: "Freelancer",
        title: p.title,
        description: p.description || "",
        remote: true,
        budgetMin: p.budget?.minimum,
        budgetMax: p.budget?.maximum,
        budgetType: p.hourly_project_info ? "hourly" : "fixed",
        sourceUrl: `https://www.freelancer.com/projects/${p.seo_url || p.id}`,
        postedAt: p.submitdate ? new Date(p.submitdate * 1000).toISOString() : undefined,
        externalId: `freelancer-${p.id}`,
      }));
    } catch (e: any) {
      console.warn("Freelancer scrape failed:", e.message);
      return [];
    }
  }

  private extractXml(text: string, tag: string): string | null {
    const match = text.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match ? (match[1] || match[2] || "").trim() : null;
  }

  private cleanHtml(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 5000);
  }

  private cleanText(text: string): string {
    return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
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
