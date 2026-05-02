import axios from "axios";

const JOB_AGGREGATOR_BLACKLIST = new Set([
  "linkedin.com", "indeed.com", "glassdoor.com", "greenhouse.io", "lever.co",
  "ashbyhq.com", "smartrecruiters.com", "jobvite.com", "recruitee.com",
  "bamboohr.com", "workable.com", "workday.com", "icims.com", "taleo.net",
  "successfactors.com", "brassring.com", "ziprecruiter.com", "dice.com",
  "monster.com", "careerbuilder.com", "simplyhired.com", "wellfound.com",
  "angel.co", "remoteok.com", "remoteok.io", "weworkremotely.com",
  "upwork.com", "freelancer.com", "toptal.com", "hired.com", "otta.com",
  "builtin.com", "stackoverflow.com", "github.com", "twitter.com", "x.com",
]);

export class DomainResolver {
  private serperApiKey: string | undefined;

  constructor(serperApiKey?: string) {
    this.serperApiKey = serperApiKey;
  }

  async resolve(companyName: string, sourceUrl?: string): Promise<string | null> {
    // 1. Try to extract from sourceUrl if it's not a job aggregator
    if (sourceUrl) {
      const fromUrl = this.extractFromUrl(sourceUrl);
      if (fromUrl) return fromUrl;
    }

    // 2. Try Serper Google search
    if (this.serperApiKey) {
      const fromSearch = await this.searchWithSerper(companyName);
      if (fromSearch) return fromSearch;
    }

    // 3. Heuristic: clean company name → domain guess
    return this.heuristicDomain(companyName);
  }

  private extractFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      const hostname = parsed.hostname.replace(/^www\./, "");
      if (JOB_AGGREGATOR_BLACKLIST.has(hostname)) return null;
      // Check if it's a real company domain (not a job aggregator subdomain)
      const parts = hostname.split(".");
      if (parts.length >= 2) return hostname;
    } catch {}
    return null;
  }

  private async searchWithSerper(companyName: string): Promise<string | null> {
    try {
      const response = await axios.post(
        "https://google.serper.dev/search",
        { q: `${companyName} official website`, num: 3 },
        {
          headers: { "X-API-KEY": this.serperApiKey, "Content-Type": "application/json" },
          timeout: 8000,
        }
      );

      const organic = response.data?.organic || [];
      for (const result of organic) {
        const link = result.link || "";
        try {
          const parsed = new URL(link);
          const hostname = parsed.hostname.replace(/^www\./, "");
          if (!JOB_AGGREGATOR_BLACKLIST.has(hostname) && hostname.includes(".")) {
            return hostname;
          }
        } catch {}
      }
    } catch (e) {
      console.warn("Serper search failed:", e);
    }
    return null;
  }

  private heuristicDomain(companyName: string): string | null {
    // Best-effort: clean the company name and guess a .com domain
    const cleaned = companyName
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|co|company|technologies|solutions|group|services|labs|ai|io)\b/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

    if (cleaned.length < 2) return null;
    return `${cleaned}.com`;
  }

  isBlacklisted(domain: string): boolean {
    const normalized = domain.replace(/^www\./, "").toLowerCase();
    return JOB_AGGREGATOR_BLACKLIST.has(normalized);
  }
}
