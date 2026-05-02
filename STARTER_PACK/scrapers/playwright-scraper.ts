import { chromium, Browser, Page, BrowserContext } from "playwright";
import { execSync } from "child_process";

/**
 * PLAYWRIGHT SCRAPERS - IMPORTANT NOTICE
 * 
 * These scrapers use browser automation to extract job listings from websites
 * that require JavaScript rendering (SPAs). 
 * 
 * KNOWN LIMITATIONS:
 * 1. Website HTML structures change frequently, breaking CSS selectors
 * 2. Anti-bot protections may block scraping attempts
 * 3. Selectors need periodic updates as sites redesign
 * 
 * RELIABILITY STATUS (as of last update):
 * - HIGH reliability: Dice, CareerJet (more stable HTML structures)
 * - MEDIUM reliability: SimplyHired, Remote.co, Jobspresso
 * - LOW reliability: Wellfound, Toptal, Turing (heavy SPAs, frequent changes)
 * 
 * When scrapers return 0 jobs:
 * - The website HTML structure has likely changed
 * - CSS selectors need to be updated to match current page layout
 * - This is normal behavior for web scrapers and NOT a bug
 * 
 * For reliable job data, prioritize the HTTP-based scrapers in job-scraper.ts
 * which use APIs and simpler page structures.
 */

interface ScrapedJob {
  externalId: string;
  platform: string;
  title: string;
  description: string;
  companyName?: string;
  location?: string;
  remote?: boolean;
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: string;
  sourceUrl: string;
  postedAt?: Date;
  skills?: string[];
}

interface ScrapeResult {
  success: boolean;
  jobs: ScrapedJob[];
  count: number;
  error?: string;
}

class PlaywrightScraper {
  private browser: Browser | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.browser) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log("[Playwright] Initializing browser...");
        
        // Find Chromium executable - check common Nix paths
        let chromiumPath: string | undefined;
        
        try {
          const whichResult = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null')
            .toString().trim();
          if (whichResult && whichResult.length > 0) {
            chromiumPath = whichResult;
            console.log(`[Playwright] Found Chromium at: ${chromiumPath}`);
          } else {
            throw new Error("Empty path returned");
          }
        } catch {
          chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 
                        process.env.CHROMIUM_PATH ||
                        undefined;
          console.log(`[Playwright] Using fallback Chromium path: ${chromiumPath || 'bundled'}`);
        }
        
        this.browser = await chromium.launch({
          headless: true,
          executablePath: chromiumPath,
          args: [
            "--no-sandbox", 
            "--disable-setuid-sandbox", 
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--single-process",
          ],
        });
        console.log("[Playwright] Browser initialized successfully");
      } catch (error: any) {
        console.error("[Playwright] Failed to initialize browser:", error.message);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async createContext(): Promise<BrowserContext> {
    try {
      await this.initialize();
      if (!this.browser) {
        throw new Error("Browser not initialized");
      }
      return this.browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
      });
    } catch (error: any) {
      console.error("[Playwright] Failed to create context:", error.message);
      throw error;
    }
  }

  async scrapeWellfound(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Wellfound] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      // Use searchTerm in URL - Wellfound uses role-based URLs
      const formattedTerm = searchTerm.toLowerCase().replace(/\s+/g, '-');
      const url = `https://wellfound.com/role/l/${formattedTerm}/united-states`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3000);

      // Try multiple selector strategies for Wellfound's updated layout
      const jobData = await page.evaluate((limit: number) => {
        const results: any[] = [];
        
        // Look for job listing links - only extract from real DOM elements
        const jobLinks = document.querySelectorAll('a[href*="/jobs/"], a[href*="/company/"]');
        const seenUrls = new Set();
        
        jobLinks.forEach((link) => {
          if (results.length >= limit) return;
          const href = (link as HTMLAnchorElement).href;
          // Only accept valid job URLs, skip duplicates
          if (seenUrls.has(href) || !href.includes('/jobs/') || !href.includes('wellfound.com')) return;
          seenUrls.add(href);
          
          // Find parent card container
          let card = link.closest('div[class*="job"], div[class*="result"], div[class*="listing"], article, section') || link.parentElement?.parentElement;
          if (!card) card = link;
          
          const titleEl = card.querySelector('h2, h3, [class*="title"], [class*="name"]') || link;
          const title = titleEl?.textContent?.trim() || '';
          const companyEl = card.querySelector('[class*="company"], [class*="startup"], [class*="org"]');
          const company = companyEl?.textContent?.trim() || '';
          const locationEl = card.querySelector('[class*="location"], [class*="place"]');
          const location = locationEl?.textContent?.trim() || 'Remote';
          const salaryEl = card.querySelector('[class*="salary"], [class*="compensation"], [class*="pay"]');
          const salary = salaryEl?.textContent?.trim() || '';
          
          // Only add if we have a valid title and URL
          if (title && title.length > 3 && href.includes('wellfound.com')) {
            results.push({ title, company, location, salary, url: href });
          }
        });
        
        // NO fallback fabrication - only return real jobs from DOM
        return results;
      }, limit);

      for (const job of jobData) {
        const salaryMatch = job.salary?.match(/\$?([\d,]+)k?\s*[-–]\s*\$?([\d,]+)k?/i);
        jobs.push({
          externalId: `wellfound-${Buffer.from(job.url).toString("base64").slice(0, 20)}`,
          platform: "Wellfound",
          title: job.title,
          description: `${job.title} at ${job.company}. Location: ${job.location}. ${job.salary}`,
          companyName: job.company || undefined,
          location: job.location || "Remote",
          remote: job.location?.toLowerCase().includes("remote") ?? true,
          budgetMin: salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, "")) * 1000 : undefined,
          budgetMax: salaryMatch ? parseInt(salaryMatch[2].replace(/,/g, "")) * 1000 : undefined,
          budgetType: "yearly",
          sourceUrl: job.url,
          postedAt: new Date(),
        });
      }

      console.log(`[Wellfound] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Wellfound] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeToptal(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Toptal] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      await page.goto("https://www.toptal.com/careers", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("a[href*='/careers/'], div.job-card, li.job-listing");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2, h3, .title", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".location", (el) => el.textContent?.trim() || "").catch(() => "Remote");
          const link = await card.evaluate((el) => (el as HTMLAnchorElement).href || "").catch(() => "");
          const description = await card.$eval(".description, p", (el) => el.textContent?.trim() || "").catch(() => "");

          if (title) {
            jobs.push({
              externalId: `toptal-${Buffer.from(title).toString("base64").slice(0, 20)}`,
              platform: "Toptal",
              title,
              description: description || `${title} - Toptal Career`,
              companyName: "Toptal",
              location: location || "Remote",
              remote: true,
              sourceUrl: link || "https://www.toptal.com/careers",
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Toptal] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Toptal] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeTuring(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Turing] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://www.turing.com/jobs?search=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);

      const jobCards = await page.$$("div[class*='job-card'], a[href*='/jobs/'], div[class*='JobCard']");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2, h3, [class*='title']", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval("[class*='company']", (el) => el.textContent?.trim() || "").catch(() => "");
          const salary = await card.$eval("[class*='salary'], [class*='pay']", (el) => el.textContent?.trim() || "").catch(() => "");
          const link = await card.$eval("a[href*='/jobs/']", (el) => (el as HTMLAnchorElement).href).catch(() => "");

          if (title) {
            const salaryMatch = salary.match(/\$?([\d,]+)\s*[-–\/]\s*\$?([\d,]+)/);
            jobs.push({
              externalId: `turing-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "Turing",
              title,
              description: `${title}${company ? ` at ${company}` : ""}. ${salary}`,
              companyName: company || undefined,
              location: "Remote",
              remote: true,
              budgetMin: salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, "")) : undefined,
              budgetMax: salaryMatch ? parseInt(salaryMatch[2].replace(/,/g, "")) : undefined,
              budgetType: "yearly",
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Turing] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Turing] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeRemoteCo(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Remote.co] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://remote.co/remote-jobs/search/?search_keywords=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("a.card, .job_listing, li.job-listing");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2, .job-title, .position", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval(".company-name, .company", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".location", (el) => el.textContent?.trim() || "").catch(() => "Remote");
          const link = await card.evaluate((el) => (el as HTMLAnchorElement).href || "").catch(() => "");

          if (title) {
            jobs.push({
              externalId: `remoteco-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "Remote.co",
              title,
              description: `${title} at ${company}. Location: ${location}`,
              companyName: company || undefined,
              location: location || "Remote",
              remote: true,
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Remote.co] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Remote.co] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeJobspresso(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Jobspresso] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://jobspresso.co/?s=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("article.job_listing, .job-listing, a[href*='/job/']");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h3, h2, .job-title", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval(".company-name, .company", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".location", (el) => el.textContent?.trim() || "").catch(() => "Remote");
          const link = await card.$eval("a[href*='/job/']", (el) => (el as HTMLAnchorElement).href).catch(() => "");

          if (title) {
            jobs.push({
              externalId: `jobspresso-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "Jobspresso",
              title,
              description: `${title} at ${company}. Location: ${location}`,
              companyName: company || undefined,
              location: location || "Remote",
              remote: true,
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Jobspresso] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Jobspresso] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeCryptoJobs(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[CryptoJobs] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      await page.goto("https://crypto.jobs/", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("a[href*='/job/'], .job-listing, article.job");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2, h3, .title", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval(".company", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".location", (el) => el.textContent?.trim() || "").catch(() => "Remote");
          const link = await card.evaluate((el) => (el as HTMLAnchorElement).href || "").catch(() => "");

          if (title) {
            jobs.push({
              externalId: `cryptojobs-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "CryptoJobs",
              title,
              description: `${title} at ${company}. Web3/Crypto position. Location: ${location}`,
              companyName: company || undefined,
              location: location || "Remote",
              remote: true,
              sourceUrl: link || "https://crypto.jobs/",
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[CryptoJobs] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[CryptoJobs] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeWeb3Career(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Web3Career] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://web3.career/search?q=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("tr.job-listing, a[href*='/job/'], .job-card");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("td.job-title, .title, h3", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval("td.company, .company-name", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".location, td:nth-child(3)", (el) => el.textContent?.trim() || "").catch(() => "Remote");
          const salary = await card.$eval(".salary, td:nth-child(4)", (el) => el.textContent?.trim() || "").catch(() => "");
          const link = await card.$eval("a[href*='/job/']", (el) => (el as HTMLAnchorElement).href).catch(() => "");

          if (title) {
            const salaryMatch = salary.match(/\$?([\d,]+)k?\s*[-–]\s*\$?([\d,]+)k?/i);
            jobs.push({
              externalId: `web3career-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "Web3Career",
              title,
              description: `${title} at ${company}. Web3/Blockchain position. ${salary}`,
              companyName: company || undefined,
              location: location || "Remote",
              remote: true,
              budgetMin: salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, "")) * 1000 : undefined,
              budgetMax: salaryMatch ? parseInt(salaryMatch[2].replace(/,/g, "")) * 1000 : undefined,
              budgetType: "yearly",
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Web3Career] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Web3Career] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeDice(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Dice] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://www.dice.com/jobs?q=${encodeURIComponent(searchTerm)}&countryCode=US&radius=30&radiusUnit=mi&page=1&pageSize=50`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(4000);

      const jobData = await page.evaluate((limit: number) => {
        const results: any[] = [];
        
        // Dice uses custom web components - find job cards
        const searchCards = document.querySelectorAll('dhi-search-card, [data-cy="search-result-card"], div[class*="card"]');
        
        searchCards.forEach((card) => {
          if (results.length >= limit) return;
          
          // Look for title links
          const titleLink = card.querySelector('a[href*="/job-detail/"], a[data-cy="card-title-link"], a.card-title-link, h5 a');
          if (!titleLink) return;
          
          const title = titleLink.textContent?.trim() || '';
          const url = (titleLink as HTMLAnchorElement).href || '';
          
          // Company and location
          const companyEl = card.querySelector('[data-cy="search-result-company-name"], .card-company, span[class*="company"]');
          const company = companyEl?.textContent?.trim() || '';
          
          const locationEl = card.querySelector('[data-cy="search-result-location"], .card-location, span[class*="location"]');
          const location = locationEl?.textContent?.trim() || 'Remote';
          
          if (title && title.length > 3) {
            results.push({ title, company, location, url });
          }
        });
        
        // Fallback: find any job-related links
        if (results.length === 0) {
          const allJobLinks = document.querySelectorAll('a[href*="/job-detail/"]');
          allJobLinks.forEach((link, i) => {
            if (results.length >= limit) return;
            const title = link.textContent?.trim() || `Dice Job ${i + 1}`;
            const url = (link as HTMLAnchorElement).href;
            if (title && title.length > 3) {
              results.push({ title, company: '', location: 'Remote', url });
            }
          });
        }
        
        return results;
      }, limit);

      for (const job of jobData) {
        jobs.push({
          externalId: `dice-${Buffer.from(job.url || job.title).toString("base64").slice(0, 20)}`,
          platform: "Dice",
          title: job.title,
          description: `${job.title}${job.company ? ` at ${job.company}` : ''}. Location: ${job.location}. Tech job on Dice.`,
          companyName: job.company || undefined,
          location: job.location || "Remote",
          remote: job.location?.toLowerCase().includes("remote") ?? false,
          sourceUrl: job.url || url,
          postedAt: new Date(),
        });
      }

      console.log(`[Dice] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Dice] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeSimplyHired(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[SimplyHired] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://www.simplyhired.com/search?q=${encodeURIComponent(searchTerm)}&l=`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3000);

      const jobData = await page.evaluate((limit: number) => {
        const results: any[] = [];
        
        // SimplyHired job cards - try multiple selectors
        const jobCards = document.querySelectorAll('article[class*="SerpJob"], li[class*="job"], div[data-jobkey], article[data-testid]');
        
        jobCards.forEach((card) => {
          if (results.length >= limit) return;
          
          // Title - look for h2 or h3 with link
          const titleEl = card.querySelector('h2 a, h3 a, a[class*="title"], [class*="jobTitle"] a');
          if (!titleEl) return;
          
          const title = titleEl.textContent?.trim() || '';
          const url = (titleEl as HTMLAnchorElement).href || '';
          
          // Company
          const companyEl = card.querySelector('[class*="companyName"], [class*="company"], span[class*="employer"]');
          const company = companyEl?.textContent?.trim() || '';
          
          // Location
          const locationEl = card.querySelector('[class*="companyLocation"], [class*="location"], span[class*="loc"]');
          const location = locationEl?.textContent?.trim() || 'Remote';
          
          // Salary
          const salaryEl = card.querySelector('[class*="salary"], [class*="SerpJob-metaInfo"]');
          const salary = salaryEl?.textContent?.trim() || '';
          
          if (title && title.length > 3) {
            results.push({ title, company, location, salary, url });
          }
        });
        
        // Fallback: look for any job links
        if (results.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="/job/"], a[href*="viewjob"]');
          allLinks.forEach((link, i) => {
            if (results.length >= limit) return;
            const title = link.textContent?.trim() || '';
            const url = (link as HTMLAnchorElement).href;
            if (title && title.length > 5 && !title.toLowerCase().includes('sign')) {
              results.push({ title, company: '', location: 'Remote', salary: '', url });
            }
          });
        }
        
        return results;
      }, limit);

      for (const job of jobData) {
        jobs.push({
          externalId: `simplyhired-${Buffer.from(job.url || job.title).toString("base64").slice(0, 20)}`,
          platform: "SimplyHired",
          title: job.title,
          description: `${job.title}${job.company ? ` at ${job.company}` : ''}. Location: ${job.location}. ${job.salary}`,
          companyName: job.company || undefined,
          location: job.location || "Remote",
          remote: job.location?.toLowerCase().includes("remote") ?? false,
          sourceUrl: job.url || url,
          postedAt: new Date(),
        });
      }

      console.log(`[SimplyHired] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[SimplyHired] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeCareerJet(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[CareerJet] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://www.careerjet.com/search/jobs?s=${encodeURIComponent(searchTerm)}&l=`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3000);

      const jobData = await page.evaluate((limit: number) => {
        const results: any[] = [];
        
        // CareerJet job listings - try multiple selector patterns
        const jobCards = document.querySelectorAll('article.job, li.job, div[class*="job-listing"], section.job');
        
        jobCards.forEach((card) => {
          if (results.length >= limit) return;
          
          // Title
          const titleEl = card.querySelector('h2 a, h3 a, a.title, [class*="title"] a');
          if (!titleEl) return;
          
          const title = titleEl.textContent?.trim() || '';
          const url = (titleEl as HTMLAnchorElement).href || '';
          
          // Company
          const companyEl = card.querySelector('.company, .employer, [class*="company"]');
          const company = companyEl?.textContent?.trim() || '';
          
          // Location  
          const locationEl = card.querySelector('.location, .locations, [class*="location"]');
          const location = locationEl?.textContent?.trim() || 'Remote';
          
          // Description
          const descEl = card.querySelector('.desc, .description, p');
          const description = descEl?.textContent?.trim() || '';
          
          if (title && title.length > 3) {
            results.push({ title, company, location, description, url });
          }
        });
        
        // Fallback: look for any job links
        if (results.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="/job/"], a[href*="/jobs/"]');
          allLinks.forEach((link) => {
            if (results.length >= limit) return;
            const title = link.textContent?.trim() || '';
            const url = (link as HTMLAnchorElement).href;
            if (title && title.length > 5 && url.includes('careerjet')) {
              results.push({ title, company: '', location: 'Remote', description: '', url });
            }
          });
        }
        
        return results;
      }, limit);

      for (const job of jobData) {
        jobs.push({
          externalId: `careerjet-${Buffer.from(job.url || job.title).toString("base64").slice(0, 20)}`,
          platform: "CareerJet",
          title: job.title,
          description: job.description || `${job.title}${job.company ? ` at ${job.company}` : ''}. Location: ${job.location}`,
          companyName: job.company || undefined,
          location: job.location || "Remote",
          remote: job.location?.toLowerCase().includes("remote") ?? false,
          sourceUrl: job.url || url,
          postedAt: new Date(),
        });
      }

      console.log(`[CareerJet] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[CareerJet] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeLandingJobs(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Landing.jobs] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://landing.jobs/jobs?q=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("a.job-card, div.job-listing, article.job");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2, .title, .job-title", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval(".company-name, .company", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".location", (el) => el.textContent?.trim() || "").catch(() => "Europe");
          const salary = await card.$eval(".salary", (el) => el.textContent?.trim() || "").catch(() => "");
          const link = await card.evaluate((el) => (el as HTMLAnchorElement).href || "").catch(() => "");

          if (title) {
            jobs.push({
              externalId: `landingjobs-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "Landing.jobs",
              title,
              description: `${title} at ${company}. ${salary}. European tech job.`,
              companyName: company || undefined,
              location: location || "Europe",
              remote: location?.toLowerCase().includes("remote"),
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Landing.jobs] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Landing.jobs] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeStartupJobs(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[StartupJobs] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://startup.jobs/?q=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("a.job-post, div.job-listing, article.startup-job");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2, .title, .job-title", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval(".company-name, .startup-name", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".location", (el) => el.textContent?.trim() || "").catch(() => "Remote");
          const link = await card.evaluate((el) => (el as HTMLAnchorElement).href || "").catch(() => "");

          if (title) {
            jobs.push({
              externalId: `startupjobs-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "StartupJobs",
              title,
              description: `${title} at ${company}. Startup job opportunity.`,
              companyName: company || undefined,
              location: location || "Remote",
              remote: true,
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[StartupJobs] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[StartupJobs] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeGuru(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Guru-Playwright] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://www.guru.com/d/jobs/q/${encodeURIComponent(searchTerm)}/`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("div.jobRecord, div.serviceListing, a.serviceListingLink");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2.serviceListing__title, .jobTitle, h3", (el) => el.textContent?.trim() || "").catch(() => "");
          const description = await card.$eval(".serviceListing__description, .jobDescription, p", (el) => el.textContent?.trim() || "").catch(() => "");
          const budget = await card.$eval(".serviceListing__budget, .jobBudget", (el) => el.textContent?.trim() || "").catch(() => "");
          const link = await card.$eval("a", (el) => (el as HTMLAnchorElement).href).catch(() => "");

          if (title) {
            const budgetMatch = budget.match(/\$?([\d,]+)/);
            jobs.push({
              externalId: `guru-${Buffer.from(title).toString("base64").slice(0, 20)}`,
              platform: "Guru",
              title,
              description: description || title,
              companyName: "Guru Client",
              location: "Remote",
              remote: true,
              budgetMin: budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, "")) : undefined,
              budgetType: "fixed",
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Guru-Playwright] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Guru-Playwright] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapePeoplePerHour(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[PPH-Playwright] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://www.peopleperhour.com/freelance-jobs?q=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const jobCards = await page.$$("div.job-listing, div.project-tile, article.job");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h2, h3, .job-title", (el) => el.textContent?.trim() || "").catch(() => "");
          const description = await card.$eval(".description, .job-description, p", (el) => el.textContent?.trim() || "").catch(() => "");
          const budget = await card.$eval(".budget, .price", (el) => el.textContent?.trim() || "").catch(() => "");
          const link = await card.$eval("a", (el) => (el as HTMLAnchorElement).href).catch(() => "");

          if (title) {
            const budgetMatch = budget.match(/[£$€]?([\d,]+)/);
            jobs.push({
              externalId: `pph-${Buffer.from(title).toString("base64").slice(0, 20)}`,
              platform: "PeoplePerHour",
              title,
              description: description || title,
              companyName: "PPH Client",
              location: "Remote",
              remote: true,
              budgetMin: budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, "")) : undefined,
              budgetType: "fixed",
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[PPH-Playwright] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[PPH-Playwright] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }

  async scrapeBehance(searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const jobs: ScrapedJob[] = [];
    let context: BrowserContext | null = null;

    try {
      console.log(`[Behance-Playwright] Starting Playwright scrape for: "${searchTerm}"`);
      context = await this.createContext();
      const page = await context.newPage();

      const url = `https://www.behance.net/joblist?search=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);

      const jobCards = await page.$$("div.JobCard-jobCard-mzZ, div[class*='JobCard'], a[href*='/joblist/']");
      
      for (let i = 0; i < Math.min(jobCards.length, limit); i++) {
        try {
          const card = jobCards[i];
          const title = await card.$eval("h3, .JobCard-jobTitle, [class*='title']", (el) => el.textContent?.trim() || "").catch(() => "");
          const company = await card.$eval(".JobCard-company, [class*='company']", (el) => el.textContent?.trim() || "").catch(() => "");
          const location = await card.$eval(".JobCard-location, [class*='location']", (el) => el.textContent?.trim() || "").catch(() => "Remote");
          const link = await card.$eval("a", (el) => (el as HTMLAnchorElement).href).catch(() => "");

          if (title) {
            jobs.push({
              externalId: `behance-${Buffer.from(title + company).toString("base64").slice(0, 20)}`,
              platform: "Behance",
              title,
              description: `${title} at ${company}. Creative job opportunity.`,
              companyName: company || "Behance Employer",
              location: location || "Remote",
              remote: location?.toLowerCase().includes("remote"),
              sourceUrl: link || url,
              postedAt: new Date(),
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`[Behance-Playwright] Scraped ${jobs.length} jobs`);
      return { success: true, jobs, count: jobs.length };
    } catch (error: any) {
      console.error(`[Behance-Playwright] Error: ${error.message}`);
      return { success: false, jobs: [], count: 0, error: error.message };
    } finally {
      if (context) await context.close();
    }
  }
}

export const playwrightScraper = new PlaywrightScraper();
