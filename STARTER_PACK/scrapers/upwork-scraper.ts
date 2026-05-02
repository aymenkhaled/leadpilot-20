import axios from "axios";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "playwright";
import { execSync } from "child_process";

chromium.use(StealthPlugin());

interface UpworkJob {
  externalId: string;
  platform: string;
  title: string;
  description: string;
  clientName?: string;
  clientSpent?: string;
  clientRating?: string;
  clientHires?: string;
  clientLocation?: string;
  clientCompanyName?: string;
  clientCompanyUrl?: string;
  clientCompanyDomain?: string;
  clientIndustry?: string;
  clientPaymentVerified?: boolean;
  clientJobsPosted?: number;
  clientTotalSpent?: string;
  clientHireRate?: string;
  clientOpenJobs?: number;
  clientMemberSince?: string;
  location?: string;
  url: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: string;
  postedAt?: string;
  skills: string[];
  category?: string;
  proposals?: string;
  experienceLevel?: string;
  projectLength?: string;
  connectionsNeeded?: string;
}

interface UpworkScraperResult {
  success: boolean;
  jobs: UpworkJob[];
  count: number;
  method: string;
  error?: string;
}

interface UpworkCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  sameSite?: string;
  httpOnly?: boolean;
  secure?: boolean;
  expirationDate?: number;
  hostOnly?: boolean;
  session?: boolean;
  storeId?: string;
}

function isLocalEnvironment(): boolean {
  const isReplit = !!process.env.REPL_SLUG || !!process.env.REPL_ID || !!process.env.REPLIT_DEPLOYMENT;
  const isCloud = !!process.env.RENDER || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.HEROKU_APP_NAME || !!process.env.VERCEL;
  return !isReplit && !isCloud;
}

function findChromiumPath(): string | undefined {
  const paths = [
    "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
  ];
  for (const p of paths) {
    try {
      const fs = require("fs");
      if (fs.existsSync(p)) {
        console.log(`[Upwork] Found Chromium at known path: ${p}`);
        return p;
      }
    } catch {}
  }
  try {
    const result = execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null || which google-chrome-stable 2>/dev/null", { encoding: "utf-8" }).trim();
    if (result) {
      console.log(`[Upwork] Found system Chromium at: ${result}`);
      return result;
    }
  } catch {}
  try {
    const playwrightPath = execSync("npx playwright install --dry-run chromium 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
    if (playwrightPath) {
      console.log(`[Upwork] Playwright Chromium available`);
    }
  } catch {}
  return undefined;
}

function normalizeCookiesForPlaywright(cookies: UpworkCookie[]): Array<{ name: string; value: string; domain: string; path: string; httpOnly?: boolean; secure?: boolean; sameSite?: "Strict" | "Lax" | "None"; expires?: number }> {
  return cookies
    .filter(c => c.name && c.value)
    .map(c => {
      let domain = c.domain || ".upwork.com";
      if (!domain.startsWith(".") && !domain.startsWith("www")) {
        domain = domain;
      }

      let sameSite: "Strict" | "Lax" | "None" | undefined;
      if (c.sameSite) {
        const s = c.sameSite.toLowerCase();
        if (s === "strict") sameSite = "Strict";
        else if (s === "lax") sameSite = "Lax";
        else if (s === "none" || s === "no_restriction" || s === "unspecified") sameSite = "None";
      }

      return {
        name: c.name,
        value: c.value,
        domain,
        path: c.path || "/",
        httpOnly: c.httpOnly,
        secure: c.secure ?? (sameSite === "None" ? true : undefined),
        sameSite,
        expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
      };
    });
}

export class UpworkScraper {
  private apifyApiKey: string | null = null;
  private cookies: UpworkCookie[] | null = null;
  private chromiumPath: string | undefined;

  setApiKey(key: string) {
    this.apifyApiKey = key;
  }

  setCookies(cookies: UpworkCookie[]) {
    this.cookies = cookies;
  }

  loadCookiesFromEnv(): boolean {
    try {
      let cookieStr = process.env.UPWORK_COOKIES;
      if (!cookieStr) {
        try {
          const fs = require("fs");
          const path = require("path");
          const localFile = path.join(process.cwd(), "upwork_cookies.json");
          if (fs.existsSync(localFile)) {
            cookieStr = fs.readFileSync(localFile, "utf-8");
            console.log(`[Upwork] Loaded cookies from local file: ${localFile}`);
          }
        } catch {}
      }
      if (!cookieStr) return false;
      const parsed = JSON.parse(cookieStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.cookies = parsed;
        const upworkCookies = parsed.filter((c: any) => c.domain?.includes("upwork"));
        console.log(`[Upwork] Loaded ${parsed.length} cookies (${upworkCookies.length} Upwork-specific)`);
        if (upworkCookies.length === 0) {
          console.warn("[Upwork] WARNING: No cookies with 'upwork' domain found. Did you export cookies while on upwork.com?");
        }
        return true;
      }
      return false;
    } catch (e: any) {
      console.error("[Upwork] Failed to parse UPWORK_COOKIES:", e.message);
      console.error("[Upwork] Expected format: JSON array from Cookie-Editor extension. Example: [{\"name\":\"...\",\"value\":\"...\",\"domain\":\".upwork.com\",...}]");
      return false;
    }
  }

  hasCookies(): boolean {
    return !!this.cookies && this.cookies.length > 0;
  }

  isConfigured(): boolean {
    return this.hasCookies();
  }

  private buildCookieHeader(): string {
    if (!this.cookies || this.cookies.length === 0) return "";
    return this.cookies
      .filter(c => c.name && c.value)
      .map(c => `${c.name}=${c.value}`)
      .join("; ");
  }

  private getXsrfToken(): string | undefined {
    if (!this.cookies) return undefined;
    const xsrf = this.cookies.find(c => c.name === "XSRF-TOKEN" || c.name === "x-upwork-xsrf-token");
    return xsrf?.value;
  }

  private getOauthToken(): string | undefined {
    if (!this.cookies) return undefined;
    const oauth = this.cookies.find(c => c.name === "oauth2_global_js_token" || c.name === "master_access_token");
    return oauth?.value;
  }

  async scrapeViaDirectApi(
    searchTerm: string,
    options: { pages?: number; limit?: number } = {}
  ): Promise<UpworkScraperResult> {
    const allJobs: UpworkJob[] = [];
    const maxPages = options.pages || 3;
    const limit = options.limit || 50;
    const cookieHeader = this.buildCookieHeader();
    const xsrfToken = this.getXsrfToken();
    const oauthToken = this.getOauthToken();

    if (!cookieHeader) {
      return { success: false, jobs: [], count: 0, method: "direct-api", error: "No cookies available" };
    }

    console.log(`[Upwork API] Starting direct API scrape for "${searchTerm}" (pages: ${maxPages}, limit: ${limit})`);
    console.log(`[Upwork API] XSRF token: ${xsrfToken ? "present" : "missing"}, OAuth: ${oauthToken ? "present" : "missing"}`);

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Cookie": cookieHeader,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.upwork.com/nx/search/jobs/",
      "Origin": "https://www.upwork.com",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (xsrfToken) {
      headers["X-Upwork-Xsrf-Token"] = xsrfToken;
      headers["x-odesk-csrf-token"] = xsrfToken;
    }
    if (oauthToken) {
      headers["Authorization"] = `Bearer ${oauthToken}`;
    }

    for (let pageNum = 1; pageNum <= maxPages && allJobs.length < limit; pageNum++) {
      try {
        const offset = (pageNum - 1) * 20;
        const encodedQuery = encodeURIComponent(searchTerm);

        const apiEndpoints = [
          `https://www.upwork.com/api/v3/search/jobs/url?q=${encodedQuery}&sort=recency&per_page=20&page=${pageNum}`,
          `https://www.upwork.com/ab/jobs/search/url?q=${encodedQuery}&sort=recency&per_page=20&page=${pageNum}`,
          `https://www.upwork.com/search/jobs/url?q=${encodedQuery}&sort=recency&per_page=20&page=${pageNum}`,
          `https://www.upwork.com/api/v3/search/jobs?q=${encodedQuery}&paging=${offset};20&sort=recency`,
        ];

        let foundJobs = false;

        for (const apiUrl of apiEndpoints) {
          try {
            console.log(`[Upwork API] Trying: ${apiUrl.slice(0, 100)}...`);
            const response = await axios.get(apiUrl, {
              headers,
              timeout: 20000,
              maxRedirects: 5,
              validateStatus: (status) => status < 500,
            });

            if (response.status === 403 || response.status === 401) {
              console.log(`[Upwork API] ${response.status} on ${apiUrl.includes("v3") ? "v3" : "other"} endpoint`);
              continue;
            }

            if (response.status !== 200) {
              console.log(`[Upwork API] Status ${response.status} from ${apiUrl.slice(0, 80)}`);
              continue;
            }

            const data = response.data;
            if (typeof data === "string" && (data.includes("Cloudflare") || data.includes("Just a moment"))) {
              console.log(`[Upwork API] Cloudflare challenge on this endpoint, trying next...`);
              continue;
            }

            const jobList = data?.searchResults?.jobs ||
              data?.results ||
              data?.jobs ||
              data?.data?.searchResults?.jobs ||
              data?.data?.results ||
              data?.data?.jobs ||
              (Array.isArray(data?.data) ? data.data : null);

            if (jobList && Array.isArray(jobList) && jobList.length > 0) {
              console.log(`[Upwork API] Got ${jobList.length} jobs from API (page ${pageNum})`);
              const parsed = this.parseApiJobData(jobList);
              for (const job of parsed) {
                if (allJobs.length < limit) allJobs.push(job);
              }
              foundJobs = true;
              break;
            }

            if (data && typeof data === "object") {
              const keys = Object.keys(data).slice(0, 10).join(", ");
              console.log(`[Upwork API] Response keys: ${keys} (no job list found)`);
            }
          } catch (endpointErr: any) {
            console.log(`[Upwork API] Endpoint error: ${endpointErr.message?.slice(0, 100)}`);
            continue;
          }
        }

        if (!foundJobs && pageNum === 1) {
          console.log("[Upwork API] No endpoints returned jobs on first page, trying GraphQL...");
          try {
            const gqlResult = await this.tryGraphQLSearch(searchTerm, headers, limit);
            if (gqlResult.length > 0) {
              console.log(`[Upwork API] GraphQL returned ${gqlResult.length} jobs`);
              for (const job of gqlResult) {
                if (allJobs.length < limit) allJobs.push(job);
              }
              foundJobs = true;
            }
          } catch (gqlErr: any) {
            console.log(`[Upwork API] GraphQL error: ${gqlErr.message?.slice(0, 100)}`);
          }
        }

        if (!foundJobs && pageNum === 1) {
          console.log("[Upwork API] All API methods failed, trying HTML scrape via axios...");
          try {
            const htmlResult = await this.scrapeSearchPageHtml(searchTerm, headers, limit);
            if (htmlResult.length > 0) {
              console.log(`[Upwork API] HTML scrape returned ${htmlResult.length} jobs`);
              for (const job of htmlResult) {
                if (allJobs.length < limit) allJobs.push(job);
              }
              foundJobs = true;
            }
          } catch (htmlErr: any) {
            console.log(`[Upwork API] HTML scrape error: ${htmlErr.message?.slice(0, 100)}`);
          }
        }

        if (!foundJobs) {
          console.log(`[Upwork API] No jobs found on page ${pageNum}`);
          if (pageNum === 1) break;
        }

        if (pageNum < maxPages && allJobs.length < limit) {
          const delay = 1500 + Math.random() * 2000;
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (pageErr: any) {
        console.error(`[Upwork API] Page ${pageNum} error: ${pageErr.message}`);
        if (pageNum === 1) break;
      }
    }

    if (allJobs.length > 0) {
      console.log(`[Upwork API] Direct API scrape: ${allJobs.length} jobs (with client data: ${allJobs.filter(j => j.clientCompanyName).length})`);
      return { success: true, jobs: allJobs, count: allJobs.length, method: "direct-api" };
    }

    return {
      success: false,
      jobs: [],
      count: 0,
      method: "direct-api",
      error: "All Upwork API endpoints blocked or returned no data. Cookies may be expired — re-export from Cookie-Editor.",
    };
  }

  private async tryGraphQLSearch(searchTerm: string, headers: Record<string, string>, limit: number): Promise<UpworkJob[]> {
    const gqlQueries = [
      {
        url: "https://www.upwork.com/api/graphql",
        body: {
          query: `query {
            search(filter: {query: "${searchTerm.replace(/"/g, '\\"')}"}, pagination: {offset: 0, count: 20}, sortBy: RECENCY) {
              results {
                id title description
                client { totalSpent totalHires location { city country } company { name } }
                budget { amount currencyCode }
                hourlyBudgetMin hourlyBudgetMax
                skills { name }
                publishedOn
              }
            }
          }`,
        },
      },
      {
        url: "https://www.upwork.com/api/graphql/v1",
        body: {
          operationName: "JobSearch",
          variables: { query: searchTerm, limit: 20, offset: 0 },
          query: `query JobSearch($query: String!, $limit: Int, $offset: Int) {
            jobSearch(query: $query, limit: $limit, offset: $offset, sortBy: RECENCY) {
              edges { node { id title snippet budget { amount } hourlyRate { min max } skills { name } client { totalSpent location { country } company { name } } createdOn } }
            }
          }`,
        },
      },
    ];

    for (const gql of gqlQueries) {
      try {
        const resp = await axios.post(gql.url, gql.body, {
          headers: { ...headers, "Content-Type": "application/json" },
          timeout: 15000,
          validateStatus: (s) => s < 500,
        });

        if (resp.status !== 200) continue;

        const data = resp.data;
        const results = data?.data?.search?.results ||
          data?.data?.jobSearch?.edges?.map((e: any) => e.node) ||
          data?.data?.results;

        if (results && Array.isArray(results) && results.length > 0) {
          return this.parseApiJobData(results);
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  private async scrapeSearchPageHtml(searchTerm: string, headers: Record<string, string>, limit: number): Promise<UpworkJob[]> {
    try {
      const url = `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(searchTerm)}&sort=recency`;
      const resp = await axios.get(url, {
        headers: { ...headers, Accept: "text/html,application/xhtml+xml" },
        timeout: 20000,
        validateStatus: (s) => s < 500,
      });

      if (resp.status !== 200 || typeof resp.data !== "string") return [];

      const html = resp.data as string;

      if (html.includes("Just a moment") || html.includes("Cloudflare")) {
        console.log("[Upwork API] HTML page has Cloudflare challenge");
        return [];
      }

      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const jobs = this.findJobsInObject(nextData);
          if (jobs && jobs.length > 0) {
            console.log(`[Upwork API] Found ${jobs.length} jobs from __NEXT_DATA__`);
            return this.parseApiJobData(jobs).slice(0, limit);
          }
        } catch {}
      }

      const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
      if (apolloMatch) {
        try {
          const apolloData = JSON.parse(apolloMatch[1]);
          const jobEntries = Object.values(apolloData).filter((v: any) => v?.title && (v?.ciphertext || v?.id));
          if (jobEntries.length > 0) {
            console.log(`[Upwork API] Found ${jobEntries.length} jobs from Apollo state`);
            return this.parseApiJobData(jobEntries).slice(0, limit);
          }
        } catch {}
      }

      return [];
    } catch {
      return [];
    }
  }

  private findJobsInObject(obj: any): any[] | null {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj) && obj.length > 0 && obj[0] && (obj[0].title || obj[0].ciphertext)) return obj;
    for (const key of Object.keys(obj)) {
      const result = this.findJobsInObject(obj[key]);
      if (result) return result;
    }
    return null;
  }

  async fetchJobDetails(jobId: string): Promise<UpworkJob | null> {
    if (!this.cookies) this.loadCookiesFromEnv();
    const cookieHeader = this.buildCookieHeader();
    if (!cookieHeader) return null;

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Cookie": cookieHeader,
      "Accept": "application/json, text/plain, */*",
      "Referer": `https://www.upwork.com/jobs/~${jobId}`,
      "X-Requested-With": "XMLHttpRequest",
    };
    const xsrf = this.getXsrfToken();
    if (xsrf) {
      headers["X-Upwork-Xsrf-Token"] = xsrf;
      headers["x-odesk-csrf-token"] = xsrf;
    }
    const oauth = this.getOauthToken();
    if (oauth) headers["Authorization"] = `Bearer ${oauth}`;

    const detailEndpoints = [
      `https://www.upwork.com/api/v3/job/details/${jobId}`,
      `https://www.upwork.com/job-details/jobdetails/api/job/${jobId}/summary`,
      `https://www.upwork.com/api/v3/application-profile/job/${jobId}`,
    ];

    for (const url of detailEndpoints) {
      try {
        const resp = await axios.get(url, { headers, timeout: 15000, validateStatus: (s) => s < 500 });
        if (resp.status !== 200) continue;
        const data = resp.data;
        const job = data?.job || data?.profile || data;
        if (job && (job.title || job.ciphertext)) {
          console.log(`[Upwork API] Got job detail from ${url.includes("v3") ? "v3" : "detail"} endpoint`);
          const parsed = this.parseApiJobData([job]);
          return parsed[0] || null;
        }
      } catch {}
    }

    try {
      const htmlResp = await axios.get(`https://www.upwork.com/jobs/~${jobId}`, {
        headers: { ...headers, Accept: "text/html,application/xhtml+xml" },
        timeout: 15000,
        validateStatus: (s) => s < 500,
      });
      if (htmlResp.status === 200 && typeof htmlResp.data === "string") {
        const nextDataMatch = htmlResp.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          const nextData = JSON.parse(nextDataMatch[1]);
          const jobs = this.findJobsInObject(nextData);
          if (jobs && jobs.length > 0) {
            const parsed = this.parseApiJobData(jobs);
            return parsed[0] || null;
          }
        }
      }
    } catch {}

    return null;
  }

  async scrapeJobs(
    searchTerm: string,
    options: {
      category?: string;
      experienceLevel?: string;
      projectLength?: string;
      hoursPerWeek?: string;
      limit?: number;
      pages?: number;
    } = {}
  ): Promise<UpworkScraperResult> {
    if (!this.cookies) {
      this.loadCookiesFromEnv();
    }

    if (this.cookies && this.cookies.length > 0) {
      console.log(`[Upwork] Trying direct API method first (no browser needed)...`);
      try {
        const apiResult = await this.scrapeViaDirectApi(searchTerm, {
          pages: options.pages,
          limit: options.limit,
        });
        if (apiResult.success && apiResult.jobs.length > 0) {
          return apiResult;
        }
        console.log(`[Upwork] Direct API returned 0 jobs: ${apiResult.error || "unknown"}`);
      } catch (apiErr: any) {
        console.log(`[Upwork] Direct API error: ${apiErr.message}`);
      }

      const local = isLocalEnvironment();
      console.log(`[Upwork] Falling back to Playwright scraper (${local ? "LOCAL - should work" : "SERVER - may be blocked by Cloudflare"})`);
      try {
        const result = await this.scrapeViaCookies(searchTerm, options);
        if (result.success && result.jobs.length > 0) {
          return result;
        }
        console.log(`[Upwork] Cookie scraper returned ${result.jobs.length} jobs, error: ${result.error || 'none'}`);
        if (!local && result.error?.includes("Cloudflare")) {
          return {
            success: false,
            jobs: [],
            count: 0,
            method: "cookie-playwright-stealth",
            error: "Upwork blocked this server's datacenter IP. Try the bookmarklet method or run the project locally with residential internet.",
          };
        }
        return result;
      } catch (error: any) {
        console.error("[Upwork] Cookie scraper error:", error.message);
        return {
          success: false,
          jobs: [],
          count: 0,
          method: "cookie-playwright-stealth",
          error: `Scraper error: ${error.message}. ${!local ? "Try the bookmarklet method or run locally." : "Check your cookies are fresh (re-export from Cookie-Editor)."}`,
        };
      }
    }

    console.log("[Upwork] No cookies configured");
    return {
      success: false,
      jobs: [],
      count: 0,
      method: "none",
      error: "No Upwork cookies configured. Go to Settings > Upwork tab and paste your cookies from Cookie-Editor browser extension.",
    };
  }

  private parseApiJobData(apiJobs: any[]): UpworkJob[] {
    const results: UpworkJob[] = [];
    for (const item of apiJobs) {
      try {
        const ciphertext = item.ciphertext || item.uid || item.id || "";
        const externalId = ciphertext || `upwork-api-${Date.now()}-${results.length}`;
        
        const client = item.client || {};
        const buyer = item.buyer || client;
        const company = buyer.company || client.company || {};
        
        let budgetMin: number | undefined;
        let budgetMax: number | undefined;
        let budgetType: string | undefined;
        
        if (item.amount && item.amount.amount) {
          budgetMin = parseFloat(item.amount.amount);
          budgetType = "fixed";
        }
        if (item.hourlyBudget || item.hourlyBudgetMin || item.hourlyBudgetMax) {
          budgetMin = item.hourlyBudgetMin ? parseFloat(item.hourlyBudgetMin) : undefined;
          budgetMax = item.hourlyBudgetMax ? parseFloat(item.hourlyBudgetMax) : undefined;
          budgetType = "hourly";
        }
        if (item.budget) {
          if (typeof item.budget === "object") {
            budgetMin = item.budget.amount ? parseFloat(item.budget.amount) : undefined;
          } else {
            const parsed = this.parseBudgetFromText(String(item.budget));
            budgetMin = parsed[0];
            budgetMax = parsed[1];
          }
          budgetType = budgetType || "fixed";
        }
        if (item.fixedAmount) {
          budgetMin = parseFloat(item.fixedAmount);
          budgetType = "fixed";
        }

        const clientLocation = buyer.location?.city 
          ? `${buyer.location.city}, ${buyer.location.country || ""}`
          : buyer.location?.country || buyer.country || client.country || item.clientCountry || "";
        
        const companyName = company.name || company.companyName || buyer.companyName || client.companyName || "";
        const companyUrl = company.profileUrl || company.url || company.website || "";
        let companyDomain = "";
        if (companyUrl) {
          try {
            companyDomain = new URL(companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`).hostname.replace(/^www\./, "");
          } catch {}
        }

        const skills = (item.skills || item.attrs || []).map((s: any) => 
          typeof s === "string" ? s : s.prettyName || s.name || s.skill || ""
        ).filter(Boolean);

        results.push({
          externalId,
          platform: "Upwork",
          title: item.title || "Untitled",
          description: this.cleanDescription(item.description || item.snippet || ""),
          clientName: companyName || buyer.name || client.name || "",
          clientCompanyName: companyName,
          clientCompanyUrl: companyUrl,
          clientCompanyDomain: companyDomain,
          clientLocation,
          clientRating: buyer.feedback ? String(buyer.feedback) : buyer.rating ? String(buyer.rating) : client.feedback ? String(client.feedback) : "",
          clientSpent: buyer.totalSpent ? `$${buyer.totalSpent}` : client.totalSpent ? `$${client.totalSpent}` : buyer.spentAmount ? `$${buyer.spentAmount}` : "",
          clientPaymentVerified: buyer.paymentVerificationStatus === "VERIFIED" || buyer.isPaymentMethodVerified === true || client.paymentVerified === true,
          clientJobsPosted: buyer.jobsPosted || buyer.totalPostedJobs || client.jobsPosted,
          clientTotalSpent: buyer.totalSpent ? String(buyer.totalSpent) : client.totalSpent ? String(client.totalSpent) : undefined,
          clientHireRate: buyer.hireRate ? String(buyer.hireRate) : client.hireRate ? String(client.hireRate) : undefined,
          clientOpenJobs: buyer.openJobs || client.activeOpenings,
          clientMemberSince: buyer.memberSince || buyer.registrationDate || client.memberSince,
          clientIndustry: company.industry || buyer.industry || client.industry || "",
          clientHires: buyer.totalHires ? String(buyer.totalHires) : client.hires ? String(client.hires) : "",
          url: ciphertext ? `https://www.upwork.com/jobs/~${ciphertext}` : item.url || "",
          budgetMin,
          budgetMax,
          budgetType,
          postedAt: this.normalizeTimestamp(item.createdOn || item.publishedOn || item.postedOn || item.createdAt),
          skills,
          category: item.category?.name || item.subcategory?.name || item.occupations?.category?.prefLabel || "",
          proposals: item.totalApplicants ? String(item.totalApplicants) : item.proposalsTier || "",
          experienceLevel: item.tierLabel || item.experienceLevel || item.contractorTier?.label || "",
          projectLength: item.duration || item.durationLabel || item.engagementDuration?.label || "",
          connectionsNeeded: item.connectPrice ? String(item.connectPrice) : "",
        });
      } catch (e: any) {
        console.error(`[Upwork] Failed to parse API job: ${e.message}`);
      }
    }
    return results;
  }

  private async scrapeViaCookies(
    searchTerm: string,
    options: {
      category?: string;
      experienceLevel?: string;
      projectLength?: string;
      hoursPerWeek?: string;
      limit?: number;
      pages?: number;
    }
  ): Promise<UpworkScraperResult> {
    let browser: Browser | null = null;
    const allJobs: UpworkJob[] = [];
    const maxPages = options.pages || 3;
    const limit = options.limit || 50;
    const local = isLocalEnvironment();

    try {
      if (!this.chromiumPath) {
        this.chromiumPath = findChromiumPath();
      }

      console.log(`[Upwork] Environment: ${local ? "LOCAL (residential IP)" : "SERVER (datacenter IP)"}`);
      console.log(`[Upwork] Chromium path: ${this.chromiumPath || "using Playwright bundled"}`);
      console.log(`[Upwork] Cookies loaded: ${this.cookies?.length || 0}`);

      const launchOptions: any = {
        headless: local ? false : true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
          "--disable-web-security",
        ],
      };

      if (this.chromiumPath) {
        launchOptions.executablePath = this.chromiumPath;
      }

      browser = await chromium.launch(launchOptions);

      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: "en-US",
        timezoneId: "America/New_York",
      });

      if (this.cookies) {
        const playwrightCookies = normalizeCookiesForPlaywright(this.cookies);
        console.log(`[Upwork] Loading ${playwrightCookies.length} normalized cookies (from ${this.cookies.length} raw)`);
        const essentialCookies = ["oauth2_global_js_token", "master_access_token", "XSRF-TOKEN", "visitor_id"];
        const foundEssential = essentialCookies.filter(name => playwrightCookies.some(c => c.name === name));
        console.log(`[Upwork] Essential cookies found: ${foundEssential.join(", ") || "NONE - session may not work"}`);
        await context.addCookies(playwrightCookies);
      }

      const page = await context.newPage();

      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
        (window as any).chrome = { runtime: {} };
      });

      for (let pageNum = 1; pageNum <= maxPages && allJobs.length < limit; pageNum++) {
        const encodedQuery = encodeURIComponent(searchTerm);
        const url = `https://www.upwork.com/nx/search/jobs/?q=${encodedQuery}&sort=recency&page=${pageNum}&per_page=20`;
        
        console.log(`[Upwork] Scraping page ${pageNum}: ${url}`);

        const apiResponses: any[] = [];
        
        const responseHandler = async (response: any) => {
          try {
            const reqUrl = response.url();
            const isSearchApi = reqUrl.includes("/search/jobs") || 
                               reqUrl.includes("/ab/feed/search") ||
                               reqUrl.includes("/api/graphql") ||
                               reqUrl.includes("/graphql") ||
                               reqUrl.includes("/job-postings/search") ||
                               reqUrl.includes("/ontology-api/") ||
                               reqUrl.includes("/visitor/v1/visitor-search");
            
            if (isSearchApi && response.status() === 200) {
              const contentType = response.headers()["content-type"] || "";
              if (contentType.includes("json")) {
                const body = await response.json().catch(() => null);
                if (body) {
                  console.log(`[Upwork] Intercepted API: ${reqUrl.slice(0, 100)}`);
                  apiResponses.push(body);
                }
              }
            }
          } catch {}
        };
        
        page.on("response", responseHandler);

        await page.goto(url, { 
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        await page.waitForTimeout(4000 + Math.random() * 2000);

        page.removeListener("response", responseHandler);

        const pageTitle = await page.title();
        console.log(`[Upwork] Page title: "${pageTitle}"`);

        if (pageTitle.includes("Challenge") || pageTitle.includes("Just a moment")) {
          console.log("[Upwork] Cloudflare challenge detected");
          await page.waitForTimeout(5000);
          const retryTitle = await page.title();
          if (retryTitle.includes("Challenge") || retryTitle.includes("Just a moment")) {
            return {
              success: false,
              jobs: [],
              count: 0,
              method: "cookie-playwright-stealth",
              error: "Cloudflare blocked the server. Use the bookmarklet to scrape from your browser instead.",
            };
          }
        }

        const isLoggedIn = await page.evaluate(() => {
          return !document.querySelector('[data-test="login-link"]') && 
                 !document.title.includes('Log In');
        });

        if (!isLoggedIn) {
          return {
            success: false,
            jobs: [],
            count: 0,
            method: "cookie-playwright-stealth",
            error: "Upwork session expired. Please update your cookies in Settings.",
          };
        }

        let apiJobsFound = false;
        for (const apiData of apiResponses) {
          const jobList = apiData.searchResults?.jobs || 
                         apiData.results || 
                         apiData.jobs || 
                         apiData.data?.searchResults?.jobs ||
                         apiData.data?.results ||
                         apiData.data?.jobs ||
                         apiData.data?.jobSearchResults?.results ||
                         apiData.data?.search?.jobs ||
                         (apiData.data && Array.isArray(apiData.data) ? apiData.data : null);
          
          if (jobList && Array.isArray(jobList) && jobList.length > 0) {
            console.log(`[Upwork] Found ${jobList.length} jobs from API response`);
            const parsed = this.parseApiJobData(jobList);
            for (const job of parsed) {
              if (allJobs.length < limit) allJobs.push(job);
            }
            apiJobsFound = true;
            break;
          }
        }

        if (!apiJobsFound) {
          console.log(`[Upwork] No API data intercepted on page ${pageNum}, trying direct API call...`);
          
          const directApiJobs = await page.evaluate(async (query: string) => {
            const apiUrls = [
              `/ab/jobs/search/url?q=${encodeURIComponent(query)}&sort=recency&per_page=20`,
              `/search/jobs/url?q=${encodeURIComponent(query)}&sort=recency&per_page=20`,
            ];
            
            for (const apiUrl of apiUrls) {
              try {
                const resp = await fetch(apiUrl, {
                  credentials: "include",
                  headers: {
                    "Accept": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                  },
                });
                if (resp.ok) {
                  const data = await resp.json();
                  return data;
                }
              } catch {}
            }
            return null;
          }, searchTerm);

          if (directApiJobs) {
            const jobList = directApiJobs.searchResults?.jobs || 
                           directApiJobs.results || 
                           directApiJobs.jobs ||
                           directApiJobs.data?.searchResults?.jobs;
            
            if (jobList && Array.isArray(jobList) && jobList.length > 0) {
              console.log(`[Upwork] Direct API call returned ${jobList.length} jobs`);
              const parsed = this.parseApiJobData(jobList);
              for (const job of parsed) {
                if (allJobs.length < limit) allJobs.push(job);
              }
              apiJobsFound = true;
            }
          }
        }

        if (!apiJobsFound) {
          console.log(`[Upwork] API interception failed on page ${pageNum}, falling back to DOM scraping`);
          
          try {
            await page.waitForSelector('section.air3-card-section, article[data-test="JobTile"], [data-test="job-tile-list"]', { timeout: 10000 });
          } catch {
            await page.waitForTimeout(2000);
          }

          const domJobs = await page.evaluate(() => {
            const jobs: any[] = [];
            const jobTiles = document.querySelectorAll(
              'article[data-test="JobTile"], section.air3-card-section, [data-ev-label="search_results_impression"]'
            );

            jobTiles.forEach(tile => {
              const titleEl = tile.querySelector('a[data-test="job-title-link"], h2 a, h3 a, a[href*="/jobs/~"]');
              const descEl = tile.querySelector('[data-test="job-description-text"], [data-test="UpCLineClamp"], p.mb-0');
              const budgetEl = tile.querySelector('[data-test="is-fixed-price"], [data-test="budget"]');
              const hourlyEl = tile.querySelector('[data-test="hourly-rate"]');
              const locationEl = tile.querySelector('[data-test="client-location"]');
              const ratingEl = tile.querySelector('[data-test="client-rating"]');
              const spentEl = tile.querySelector('[data-test="client-spent"], [data-test="total-spent"]');
              const skillEls = tile.querySelectorAll('[data-test="token"] span, .air3-token span, a[data-test="skill"]');
              const skills = Array.from(skillEls).map(s => s.textContent?.trim()).filter(Boolean);

              if (titleEl) {
                jobs.push({
                  title: titleEl.textContent?.trim(),
                  url: (titleEl as HTMLAnchorElement).href,
                  description: descEl?.textContent?.trim(),
                  budget: budgetEl?.textContent?.trim(),
                  hourlyRate: hourlyEl?.textContent?.trim(),
                  clientLocation: locationEl?.textContent?.trim(),
                  clientRating: ratingEl?.textContent?.trim(),
                  clientSpent: spentEl?.textContent?.trim(),
                  skills,
                });
              }
            });
            return jobs;
          });

          for (const raw of domJobs) {
            if (allJobs.length >= limit) break;
            const jobIdMatch = raw.url?.match(/~([a-zA-Z0-9]+)/);
            const externalId = jobIdMatch ? jobIdMatch[1] : `upwork-dom-${Date.now()}-${allJobs.length}`;
            const [bMin, bMax] = this.parseBudgetFromText(raw.budget, raw.hourlyRate);

            allJobs.push({
              externalId,
              platform: "Upwork",
              title: raw.title || "Untitled",
              description: this.cleanDescription(raw.description || ""),
              clientLocation: raw.clientLocation,
              clientRating: raw.clientRating,
              clientSpent: raw.clientSpent,
              url: raw.url || "",
              budgetMin: bMin,
              budgetMax: bMax,
              budgetType: raw.hourlyRate ? "hourly" : raw.budget ? "fixed" : undefined,
              skills: raw.skills || [],
            });
          }
        }

        if (allJobs.length === 0 && pageNum === 1) {
          console.log(`[Upwork] No jobs found on first page`);
          break;
        }

        if (pageNum < maxPages && allJobs.length < limit) {
          const delay = 2000 + Math.random() * 3000;
          console.log(`[Upwork] Waiting ${Math.round(delay)}ms before next page...`);
          await page.waitForTimeout(delay);
        }
      }

      console.log(`[Upwork] Stealth scraper total: ${allJobs.length} jobs (with client data: ${allJobs.filter(j => j.clientCompanyName).length})`);

      return {
        success: allJobs.length > 0,
        jobs: allJobs,
        count: allJobs.length,
        method: "cookie-playwright-stealth",
      };
    } catch (error: any) {
      console.error("[Upwork] Stealth cookie scraper error:", error.message);
      return {
        success: false,
        jobs: allJobs,
        count: allJobs.length,
        method: "cookie-playwright-stealth",
        error: error.message,
      };
    } finally {
      if (browser) {
        try { await browser.close(); } catch {}
      }
    }
  }

  private parseBudgetFromText(
    budgetText?: string,
    hourlyText?: string
  ): [number | undefined, number | undefined] {
    if (hourlyText) {
      const rangeMatch = hourlyText.match(/\$?([\d,.]+)\s*[-–]\s*\$?([\d,.]+)/);
      if (rangeMatch) {
        return [parseFloat(rangeMatch[1].replace(/,/g, "")), parseFloat(rangeMatch[2].replace(/,/g, ""))];
      }
      const singleMatch = hourlyText.match(/\$?([\d,.]+)/);
      if (singleMatch) return [parseFloat(singleMatch[1].replace(/,/g, "")), undefined];
    }

    if (budgetText) {
      const rangeMatch = budgetText.match(/\$?([\d,]+)\s*[-–]\s*\$?([\d,]+)/);
      if (rangeMatch) {
        return [parseInt(rangeMatch[1].replace(/,/g, "")), parseInt(rangeMatch[2].replace(/,/g, ""))];
      }
      const singleMatch = budgetText.match(/\$?([\d,]+)/);
      if (singleMatch) return [parseInt(singleMatch[1].replace(/,/g, "")), undefined];
    }

    return [undefined, undefined];
  }

  private async scrapeViaApify(
    searchTerm: string,
    options: {
      category?: string;
      experienceLevel?: string;
      projectLength?: string;
      hoursPerWeek?: string;
      limit?: number;
    }
  ): Promise<UpworkScraperResult> {
    const APIFY_UPWORK_ACTORS = [
      "neatrat/upwork-job-scraper",
      "getdataforme/upwork-actor",
      "upwork-vibe/upwork-scraper",
    ];

    for (const actorId of APIFY_UPWORK_ACTORS) {
      try {
        console.log(`[Upwork] Trying Apify actor: ${actorId}`);
        
        let input: any;
        if (actorId === "neatrat/upwork-job-scraper") {
          input = { keyword: searchTerm, maxItems: options.limit || 50 };
        } else if (actorId === "getdataforme/upwork-actor") {
          input = { searchQueries: [searchTerm], maxItems: options.limit || 50 };
        } else {
          input = { keywords: searchTerm, maxResults: options.limit || 50 };
        }

        const runResponse = await axios.post(
          `https://api.apify.com/v2/acts/${actorId}/runs`,
          input,
          {
            headers: { "Content-Type": "application/json" },
            params: { token: this.apifyApiKey, waitForFinish: 120 },
            timeout: 180000,
          }
        );

        if (!runResponse.data.data?.defaultDatasetId) continue;

        const datasetId = runResponse.data.data.defaultDatasetId;
        const itemsResponse = await axios.get(
          `https://api.apify.com/v2/datasets/${datasetId}/items`,
          { params: { token: this.apifyApiKey, format: "json" }, timeout: 30000 }
        );

        const items = itemsResponse.data || [];
        if (items.length === 0) continue;

        const jobs: UpworkJob[] = items.map((item: any) => ({
          externalId: item.id || item.jobId || `upwork-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          platform: "Upwork",
          title: item.title || item.jobTitle || "Untitled",
          description: this.cleanDescription(item.description || item.snippet || ""),
          clientName: item.client?.name || item.clientName || item.client,
          location: item.client?.location || item.location || item.clientCountry,
          url: item.url || item.jobUrl || `https://www.upwork.com/jobs/${item.id || ""}`,
          budgetMin: this.parseBudget(item.budget || item.hourlyRate)?.[0],
          budgetMax: this.parseBudget(item.budget || item.hourlyRate)?.[1],
          budgetType: item.hourlyRate ? "hourly" : "fixed",
          postedAt: item.postedTime || item.createdAt,
          skills: item.skills || [],
        }));

        return { success: true, jobs, count: jobs.length, method: `apify:${actorId}` };
      } catch (error: any) {
        console.error(`[Upwork] Actor ${actorId} failed: ${error.message}`);
        continue;
      }
    }

    return { success: false, jobs: [], count: 0, method: "apify", error: "All Apify actors failed" };
  }

  private async scrapeViaRss(
    searchTerm: string,
    limit: number
  ): Promise<UpworkScraperResult> {
    try {
      console.log(`[Upwork] Attempting RSS feed for: "${searchTerm}"`);
      const encodedQuery = encodeURIComponent(searchTerm);
      const rssUrl = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodedQuery}&sort=recency`;

      const response = await axios.get(rssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LeadPilot/1.0)",
          "Accept": "application/rss+xml, application/xml, text/xml",
        },
        timeout: 15000,
      });

      if (response.status === 403 || response.status === 410) {
        return { success: false, jobs: [], count: 0, method: "rss", error: "RSS feed blocked" };
      }

      const jobs = this.parseRssResponse(response.data, limit);
      return { success: jobs.length > 0, jobs, count: jobs.length, method: "rss" };
    } catch (error: any) {
      return { success: false, jobs: [], count: 0, method: "rss", error: error.message };
    }
  }

  private parseRssResponse(xmlData: string, limit: number): UpworkJob[] {
    const jobs: UpworkJob[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xmlData)) !== null && jobs.length < limit) {
      const item = match[1];
      const title = this.extractXmlValue(item, "title");
      const link = this.extractXmlValue(item, "link");
      const description = this.extractXmlValue(item, "description");
      const pubDate = this.extractXmlValue(item, "pubDate");

      if (!title || !link) continue;

      const budgetMatch = description?.match(/Budget[:\s]*\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/i);
      const hourlyMatch = description?.match(/Hourly[:\s]*\$?([\d.]+)(?:\s*-\s*\$?([\d.]+))?/i);

      jobs.push({
        externalId: this.extractJobIdFromUrl(link) || `upwork-rss-${Date.now()}-${jobs.length}`,
        platform: "Upwork",
        title: this.decodeHtmlEntities(title),
        description: this.cleanDescription(description || ""),
        url: link,
        budgetMin: budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, "")) : hourlyMatch ? parseFloat(hourlyMatch[1]) : undefined,
        budgetMax: budgetMatch?.[2] ? parseInt(budgetMatch[2].replace(/,/g, "")) : hourlyMatch?.[2] ? parseFloat(hourlyMatch[2]) : undefined,
        budgetType: hourlyMatch ? "hourly" : budgetMatch ? "fixed" : undefined,
        postedAt: pubDate,
        skills: this.extractSkillsFromDescription(description || ""),
      });
    }

    return jobs;
  }

  private extractXmlValue(xml: string, tag: string): string | undefined {
    const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"));
    if (cdataMatch) return cdataMatch[1].trim();
    const simpleMatch = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return simpleMatch ? simpleMatch[1].trim() : undefined;
  }

  private extractJobIdFromUrl(url: string): string | undefined {
    const match = url.match(/~([a-zA-Z0-9]+)/);
    return match ? match[1] : undefined;
  }

  private parseBudget(budget: string | number | undefined): [number | undefined, number | undefined] {
    if (!budget) return [undefined, undefined];
    if (typeof budget === "number") return [budget, undefined];
    const rangeMatch = budget.match(/\$?([\d,]+)\s*-\s*\$?([\d,]+)/);
    if (rangeMatch) return [parseInt(rangeMatch[1].replace(/,/g, "")), parseInt(rangeMatch[2].replace(/,/g, ""))];
    const singleMatch = budget.match(/\$?([\d,]+)/);
    if (singleMatch) return [parseInt(singleMatch[1].replace(/,/g, "")), undefined];
    return [undefined, undefined];
  }

  private normalizeTimestamp(ts: any): string | undefined {
    if (!ts) return undefined;
    if (typeof ts === "string") return ts;
    if (typeof ts === "number") {
      if (ts < 1e12) return new Date(ts * 1000).toISOString();
      return new Date(ts).toISOString();
    }
    return String(ts);
  }

  private cleanDescription(description: string): string {
    return description
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  private extractSkillsFromDescription(description: string): string[] {
    const skillsMatch = description.match(/Skills?[:\s]*([^.]+)/i);
    if (skillsMatch) {
      return skillsMatch[1]
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 50)
        .slice(0, 10);
    }
    return [];
  }
}

export const upworkScraper = new UpworkScraper();
