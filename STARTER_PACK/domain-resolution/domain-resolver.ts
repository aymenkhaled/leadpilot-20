import axios from "axios";
import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

interface DomainResolutionResult {
  domain: string | null;
  method: "direct" | "snippet" | "company_search" | "inference" | "description_search";
  confidence: number;
  source?: string;
}

export class DomainResolver {
  private serperApiKey: string | null = null;

  setApiKey(key: string) {
    this.serperApiKey = key;
  }

  async resolve(
    jobDescription: string,
    companyName?: string | null
  ): Promise<DomainResolutionResult | null> {
    if (this.isAnonymousCompany(companyName)) {
      console.log(`[DomainResolver] Skipping anonymous/private company: "${companyName}"`);
      return null;
    }

    let domain = this.extractFromDescription(jobDescription);
    if (domain) {
      const valid = await this.validateDomain(domain);
      if (valid) {
        return { domain, method: "direct", confidence: 95 };
      }
    }

    if (companyName && !this.isGenericCompanyName(companyName)) {
      domain = this.inferFromCompanyName(companyName);
      if (domain) {
        const valid = await this.validateDomain(domain);
        if (valid && this.domainMatchesCompany(domain, companyName)) {
          return { domain, method: "inference", confidence: 70 };
        }
      }
    }

    if (this.serperApiKey && companyName && !this.isGenericCompanyName(companyName)) {
      domain = await this.resolveViaCompanySearch(companyName);
      if (domain) {
        return { domain, method: "company_search", confidence: 80 };
      }
    }

    if (this.serperApiKey && jobDescription.length > 200) {
      domain = await this.resolveViaDescriptionSearch(jobDescription, companyName);
      if (domain) {
        return { domain, method: "description_search", confidence: 85 };
      }
    }

    if (this.serperApiKey && jobDescription.length > 100) {
      domain = await this.resolveViaSnippet(jobDescription, companyName);
      if (domain) {
        return { domain, method: "snippet", confidence: 75 };
      }
    }

    return null;
  }

  isAnonymousCompany(companyName?: string | null): boolean {
    if (!companyName) return false;
    const lower = companyName.toLowerCase().trim();
    if (lower.length < 2) return false;

    const anonymousPatterns = [
      "private", "private client", "privateclient", "confidential",
      "anonymous", "undisclosed", "stealth", "stealth startup",
      "n/a", "na", "none", "unknown", "not specified", "not disclosed",
      "client", "the client", "a client", "our client",
      "company", "the company", "a company",
      "employer", "the employer", "hiring company",
      "startup", "a startup", "tech startup",
      "agency", "staffing", "staffing agency", "recruitment",
      "recruiter", "recruiting", "recruiting agency",
      "various", "multiple", "tbd", "tba",
      "nan", "null", "undefined", "test",
    ];

    if (anonymousPatterns.includes(lower)) return true;
    if (/^(private|confidential|anonymous|undisclosed|stealth)\b/i.test(lower)) return true;
    if (/\b(staffing|recruiting|recruitment)\s+(agency|firm|company)$/i.test(lower)) return true;

    if (this.isJobAggregator(lower)) return true;

    return false;
  }

  private isJobAggregator(name: string): boolean {
    const aggregators = [
      "lensa", "lensa inc", "lensa, inc",
      "ziprecruiter", "ladders", "the ladders",
      "talent.com", "adzuna", "jooble",
      "careerjet", "neuvoo", "jobrapido",
      "hired", "vettery", "triplebyte",
      "crossover", "crossover for work",
      "hays", "robert half", "adecco",
      "manpower", "manpowergroup", "randstad",
      "kelly services", "kforce",
    ];
    return aggregators.includes(name);
  }

  private isGenericCompanyName(companyName: string): boolean {
    const lower = companyName.toLowerCase().trim();
    if (/^client\s*#?\s*\d*$/i.test(lower)) return true;
    if (/^client\s*#?\s*unknown$/i.test(lower)) return true;
    if (lower.length <= 2) return true;
    return false;
  }

  domainMatchesCompany(domain: string, companyName: string): boolean {
    const domainBase = domain.replace(/\.(com|io|co|org|net|ai|dev|app|tech|xyz|de|uk|us|ca|fr)$/, "")
      .replace(/[^a-z0-9]/gi, "").toLowerCase();
    const companyClean = companyName
      .toLowerCase()
      .replace(/\s*(inc\.?|llc|ltd|gmbh|ag|corp\.?|corporation|company|co\.?|group|solutions|technologies|software)\s*$/i, "")
      .replace(/[^a-z0-9]/gi, "");

    if (domainBase.length < 2 || companyClean.length < 2) return false;

    if (domainBase === companyClean) return true;

    if (companyClean.length >= 5 && domainBase.includes(companyClean)) return true;
    if (domainBase.length >= 5 && companyClean.includes(domainBase)) return true;

    const stopWords = new Set(["the", "and", "for", "its", "our", "new", "all", "one", "big", "top", "best", "first", "united", "national", "global", "prime", "digital", "tech", "web", "app"]);
    const companyWords = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (companyWords.length >= 2) {
      const companyInitials = companyWords.map(w => w[0]).join("");
      if (companyInitials.length >= 3 && domainBase === companyInitials) return true;
    }

    if (companyWords.length === 1 && companyWords[0].length >= 5 && domainBase.startsWith(companyWords[0])) return true;
    if (companyWords.length >= 2) {
      const joined = companyWords.join("");
      if (domainBase === joined) return true;
      if (joined.length >= 6 && domainBase.startsWith(joined.substring(0, Math.min(joined.length, 8)))) return true;
    }

    return false;
  }

  extractFromDescription(description: string): string | null {
    const urlPatterns = [
      /https?:\/\/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/gi,
      /(?:visit|check out|see|website[:\s]+)(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/gi,
      /\b(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]{2,}\.(com|io|co|org|net|ai))\b/gi,
    ];

    for (const pattern of urlPatterns) {
      const matches = description.match(pattern);
      if (matches && matches.length > 0) {
        const match = matches[0];
        const domainMatch = match.match(
          /([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/
        );
        if (domainMatch) {
          const domain = domainMatch[1].toLowerCase().replace(/^www\./, "");
          if (!this.isJobBoard(domain) && !this.isSocialSite(domain)) {
            return domain;
          }
        }
      }
    }
    return null;
  }

  inferFromCompanyName(companyName: string): string | null {
    const cleaned = companyName
      .toLowerCase()
      .replace(/\s*(inc\.?|llc|ltd|gmbh|ag|corp\.?|corporation|company|co\.?)\s*$/i, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

    if (cleaned.length < 3) return null;

    const invalidDomainNames = [
      "nan", "null", "undefined", "test", "none", "unknown",
      "private", "confidential", "anonymous", "company", "startup",
      "client", "employer", "recruiter", "various", "multiple",
    ];
    if (invalidDomainNames.includes(cleaned)) return null;

    return `${cleaned}.com`;
  }

  private extractDistinctivePhrases(description: string): string[] {
    const cleaned = description
      .replace(/<[^>]*>/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const sentences = cleaned.split(/[.!?\n]+/).filter(s => s.trim().length > 30);

    const genericPatterns = [
      /we are (looking for|seeking|hiring)/i,
      /^(about|requirements|qualifications|responsibilities|what you|who you|your role)/i,
      /years of experience/i,
      /competitive salary/i,
      /equal opportunity/i,
      /benefits include/i,
      /apply (now|today|here)/i,
      /job description/i,
      /^\s*(must have|nice to have|preferred|required|desired)/i,
    ];

    const distinctive = sentences.filter(s => {
      const trimmed = s.trim();
      if (trimmed.length < 40 || trimmed.length > 200) return false;
      return !genericPatterns.some(p => p.test(trimmed));
    });

    return distinctive.slice(0, 5);
  }

  async resolveViaDescriptionSearch(description: string, companyName?: string | null): Promise<string | null> {
    if (!this.serperApiKey) return null;

    try {
      const phrases = this.extractDistinctivePhrases(description);
      if (phrases.length === 0) return null;

      const bestPhrase = phrases[0].trim();
      const words = bestPhrase.split(/\s+/);
      const searchPhrase = words.slice(0, Math.min(words.length, 15)).join(" ");

      if (searchPhrase.length < 30) return null;

      console.log(`[DomainResolver] Description search with: "${searchPhrase.substring(0, 60)}..."`);

      const response = await axios.post(
        "https://google.serper.dev/search",
        {
          q: `"${searchPhrase}"`,
          num: 10,
        },
        {
          headers: { "X-API-KEY": this.serperApiKey },
          timeout: 10000,
        }
      );

      const results = response.data.organic || [];

      for (const result of results) {
        const link = result.link || "";
        const domain = await this.extractDomainFromAtsOrCareerPage(link, companyName);
        if (domain) {
          console.log(`[DomainResolver] Found domain via description search: ${domain} from ${link}`);
          return domain;
        }
      }

      for (const result of results) {
        try {
          const url = new URL(result.link);
          const domain = url.hostname.replace(/^www\./, "");
          if (!this.isJobBoard(domain) && !this.isSocialSite(domain) && !this.isGenericSite(domain)) {
            if (companyName && this.domainMatchesCompany(domain, companyName)) {
              console.log(`[DomainResolver] Found matching company domain via description search: ${domain}`);
              return domain;
            }
            if (!companyName) {
              const valid = await this.validateDomain(domain);
              if (valid) {
                console.log(`[DomainResolver] Found domain via description search (no company name): ${domain}`);
                return domain;
              }
            }
          }
        } catch {}
      }
    } catch (error: any) {
      console.error("[DomainResolver] Description search error:", error.message);
    }

    return null;
  }

  private async extractDomainFromAtsOrCareerPage(link: string, companyName?: string | null): Promise<string | null> {
    const atsPatterns = [
      { regex: /boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/, platform: "greenhouse" },
      { regex: /jobs\.lever\.co\/([a-zA-Z0-9_-]+)/, platform: "lever" },
      { regex: /([a-zA-Z0-9_-]+)\.workable\.com/, platform: "workable" },
      { regex: /jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/, platform: "ashby" },
      { regex: /([a-zA-Z0-9_-]+)\.recruitee\.com/, platform: "recruitee" },
    ];

    for (const { regex, platform } of atsPatterns) {
      const match = link.match(regex);
      if (match && match[1] !== "www" && match[1] !== "apply") {
        const slug = match[1];
        const validatedDomain = await this.resolveSlugToDomain(slug);
        if (validatedDomain) {
          if (companyName && !this.domainMatchesCompany(validatedDomain, companyName)) {
            console.log(`[DomainResolver] ATS slug "${slug}" → ${validatedDomain} does NOT match company "${companyName}", skipping`);
            return null;
          }
          console.log(`[DomainResolver] ATS slug "${slug}" on ${platform} → ${validatedDomain}`);
          return validatedDomain;
        }
        console.log(`[DomainResolver] ATS slug "${slug}" on ${platform}: no valid domain found`);
        return null;
      }
    }

    if (link.includes("/careers") || link.includes("/jobs") || link.includes("/job/") || link.includes("/opening")) {
      try {
        const url = new URL(link);
        const domain = url.hostname.replace(/^www\./, "");
        if (!this.isJobBoard(domain) && !this.isSocialSite(domain) && !this.isGenericSite(domain)) {
          return domain;
        }
      } catch {}
    }

    return null;
  }

  private async resolveSlugToDomain(slug: string): Promise<string | null> {
    const cleaned = slug.toLowerCase().replace(/[_-]/g, "");
    if (cleaned.length < 2) return null;

    const tlds = [".com", ".io", ".co", ".org", ".ai", ".dev", ".app"];
    for (const tld of tlds) {
      const candidate = `${cleaned}${tld}`;
      const valid = await this.validateDomain(candidate);
      if (valid) {
        return candidate;
      }
    }
    return null;
  }

  async resolveViaSnippet(description: string, companyName?: string | null): Promise<string | null> {
    if (!this.serperApiKey) return null;

    try {
      const words = description
        .replace(/<[^>]*>/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3);
      if (words.length < 20) return null;

      const snippet = words.slice(20, 40).join(" ");
      if (snippet.length < 50) return null;

      const response = await axios.post(
        "https://google.serper.dev/search",
        {
          q: `"${snippet}"`,
          num: 5,
        },
        {
          headers: { "X-API-KEY": this.serperApiKey },
          timeout: 10000,
        }
      );

      const results = response.data.organic || [];

      for (const result of results) {
        const link = result.link || "";
        const domain = await this.extractDomainFromAtsOrCareerPage(link, companyName);
        if (domain) {
          return domain;
        }
      }

      for (const result of results) {
        try {
          const url = new URL(result.link);
          const domain = url.hostname.replace(/^www\./, "");
          if (!this.isJobBoard(domain) && !this.isSocialSite(domain) && !this.isGenericSite(domain)) {
            if (companyName && this.domainMatchesCompany(domain, companyName)) {
              return domain;
            }
          }
        } catch {}
      }
    } catch (error: any) {
      console.error("[DomainResolver] Snippet search error:", error.message);
    }

    return null;
  }

  async resolveViaCompanySearch(companyName: string): Promise<string | null> {
    if (!this.serperApiKey) return null;

    try {
      const response = await axios.post(
        "https://google.serper.dev/search",
        {
          q: `"${companyName}" official website`,
          num: 5,
        },
        {
          headers: { "X-API-KEY": this.serperApiKey },
          timeout: 10000,
        }
      );

      const results = response.data.organic || [];
      const knowledgeGraph = response.data.knowledgeGraph;

      if (knowledgeGraph?.website) {
        try {
          const url = new URL(knowledgeGraph.website);
          const domain = url.hostname.replace(/^www\./, "");
          if (!this.isJobBoard(domain) && !this.isSocialSite(domain)) {
            console.log(`[DomainResolver] Found domain via knowledge graph: ${domain}`);
            return domain;
          }
        } catch {}
      }

      for (const result of results) {
        try {
          const url = new URL(result.link);
          const domain = url.hostname.replace(/^www\./, "");
          if (!this.isJobBoard(domain) && !this.isSocialSite(domain) && !this.isGenericSite(domain)) {
            if (this.domainMatchesCompany(domain, companyName)) {
              return domain;
            }
          }
        } catch {}
      }

      for (const result of results) {
        try {
          const url = new URL(result.link);
          const domain = url.hostname.replace(/^www\./, "");

          if (!this.isJobBoard(domain) && !this.isSocialSite(domain) && !this.isGenericSite(domain)) {
            const title = (result.title || "").toLowerCase();
            const snippet = (result.snippet || "").toLowerCase();
            const companyLower = companyName.toLowerCase();

            if (title.includes(companyLower) || snippet.includes(companyLower)) {
              return domain;
            }
          }
        } catch {}
      }
    } catch (error: any) {
      console.error("[DomainResolver] Company search error:", error.message);
    }

    return null;
  }

  private isJobBoard(domain: string): boolean {
    const jobBoards = [
      "linkedin.com", "indeed.com", "glassdoor.com",
      "upwork.com", "fiverr.com", "freelancer.com",
      "monster.com", "ziprecruiter.com", "dice.com",
      "careerbuilder.com", "simplyhired.com",
      "weworkremotely.com", "remoteok.com",
      "greenhouse.io", "lever.co", "workable.com",
      "smartrecruiters.com", "breezy.hr", "recruitee.com",
      "ashbyhq.com", "bamboohr.com", "icims.com",
      "jobvite.com", "myworkdayjobs.com", "taleo.net",
      "lensa.com", "talent.com", "jooble.org",
      "careerjet.com", "neuvoo.com", "adzuna.com",
      "themuse.com", "angel.co", "wellfound.com",
      "hired.com", "triplebyte.com", "toptal.com",
      "himalayas.app", "remotive.com", "arbeitnow.com",
      "dribbble.com", "news.ycombinator.com",
    ];
    return jobBoards.some((jb) => domain.includes(jb));
  }

  private isSocialSite(domain: string): boolean {
    const socialSites = [
      "facebook.com", "twitter.com", "x.com",
      "instagram.com", "youtube.com", "tiktok.com",
      "wikipedia.org", "reddit.com",
      "crunchbase.com", "bloomberg.com",
      "medium.com", "substack.com",
      "github.com", "gitlab.com", "bitbucket.org",
      "pinterest.com", "quora.com",
      "linkedin.com", "in.linkedin.com",
    ];
    return socialSites.some((s) => domain.includes(s));
  }

  private isGenericSite(domain: string): boolean {
    const genericSites = [
      "google.com", "bing.com", "yahoo.com",
      "amazonaws.com", "cloudfront.net",
      "wordpress.com", "blogspot.com",
      "studentaid.gov", "usa.gov",
      "stackexchange.com", "stackoverflow.com",
      "nytimes.com", "wsj.com", "forbes.com",
      "techcrunch.com", "bbc.com", "cnn.com",
    ];
    return genericSites.some((s) => domain.includes(s));
  }

  async validateDomain(domain: string): Promise<boolean> {
    try {
      await dnsLookup(domain);
      return true;
    } catch {
      try {
        await dnsLookup(`www.${domain}`);
        return true;
      } catch {
        return false;
      }
    }
  }
}

export const domainResolver = new DomainResolver();
