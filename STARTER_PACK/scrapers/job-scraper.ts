import type { InsertJob } from "@shared/schema";
import { upworkScraper } from "./upwork-scraper";
import { playwrightScraper } from "./playwright-scraper";

interface ScrapedJob {
  title: string;
  description?: string;
  companyName?: string;
  companyDomain?: string;
  location?: string;
  remote?: boolean;
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: string;
  platform: string;
  externalId?: string;
  sourceUrl?: string;
  postedAt?: Date;
  skills?: string[];
}

interface ScrapeConfig {
  searchTerm: string;
  location?: string;
  platforms?: string[];
  resultsPerPlatform?: number;
  hoursOld?: number;
}

interface ScrapeResult {
  success: boolean;
  jobs: ScrapedJob[];
  errors: string[];
  platforms: {
    name: string;
    jobsFound: number;
    error?: string;
  }[];
}

// RemoteOK API response type
interface RemoteOKJob {
  id: string;
  epoch: number;
  date: string;
  company: string;
  company_logo: string;
  position: string;
  description: string;
  tags: string[];
  logo: string;
  url: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
}

// Remotive API response type
interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary?: string;
  description: string;
}

// Himalayas API response type
interface HimalayasJob {
  id: string;
  title: string;
  excerpt: string;
  companyName: string;
  companyLogo?: string;
  companySlug: string;
  publishedDate: string;
  location: string;
  seniority: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  categories: string[];
  applicationUrl?: string;
}

// FindWork API response type
interface FindWorkJob {
  id: string;
  role: string;
  company_name: string;
  company_num_employees?: string;
  employment_type: string;
  location: string;
  remote: boolean;
  logo?: string;
  url: string;
  text: string;
  date_posted: string;
  keywords: string[];
  source: string;
}

// JSearch API response type (RapidAPI - LinkedIn, Indeed, Glassdoor, ZipRecruiter)
interface JSearchJob {
  job_id: string;
  employer_name: string;
  employer_logo?: string;
  employer_website?: string;
  job_title: string;
  job_description: string;
  job_apply_link: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
  job_posted_at_datetime_utc?: string;
  job_publisher?: string;
  job_employment_type?: string;
  job_required_skills?: string[];
}

// Active Jobs DB API response type (RapidAPI - 130k+ ATS career sites)
interface ActiveJobsDBJob {
  id: string;
  title: string;
  company: string;
  company_url?: string;
  location: string;
  description: string;
  url: string;
  date_posted?: string;
  salary_min?: number;
  salary_max?: number;
  remote?: boolean;
}

// Adzuna API response type
interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  created: string;
  salary_min?: number;
  salary_max?: number;
  category?: { label: string };
}

// The Muse API response type
interface TheMuseJob {
  id: number;
  name: string;
  company: { name: string; short_name: string };
  locations: { name: string }[];
  levels: { name: string }[];
  categories: { name: string }[];
  publication_date: string;
  refs: { landing_page: string };
  contents?: string;
}

export class JobScraperService {
  private pythonMicroserviceUrl = "http://localhost:5001";

  /**
   * Scrape from RemoteOK's public JSON API
   * This is a free, reliable source with real job listings
   */
  async scrapeRemoteOK(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    try {
      console.log("[RemoteOK] Fetching jobs from API...");
      const response = await fetch("https://remoteok.com/api", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        result.errors.push(`RemoteOK API error: ${response.status}`);
        result.platforms.push({ name: "RemoteOK", jobsFound: 0, error: `HTTP ${response.status}` });
        return result;
      }

      const data: RemoteOKJob[] = await response.json();
      
      // First item is usually metadata, filter to actual jobs
      const actualJobs = data.filter(job => job.position && job.company);
      
      // Filter by search term if provided
      let filteredJobs = actualJobs;
      if (searchTerm) {
        const keywords = searchTerm.toLowerCase().split(' ');
        filteredJobs = actualJobs.filter(job => {
          const searchText = `${job.position} ${job.description || ''} ${job.tags?.join(' ') || ''}`.toLowerCase();
          return keywords.some(kw => searchText.includes(kw));
        });
      }

      // Map to our job format
      const jobs: ScrapedJob[] = filteredJobs.slice(0, limit).map(job => ({
        externalId: `remoteok-${job.id}`,
        platform: "RemoteOK",
        title: job.position,
        description: this.stripHtml(job.description || ''),
        companyName: job.company,
        location: job.location || "Remote / Worldwide",
        remote: true,
        budgetMin: job.salary_min || undefined,
        budgetMax: job.salary_max || undefined,
        budgetType: job.salary_min || job.salary_max ? "annual" : undefined,
        skills: job.tags || [],
        sourceUrl: job.url || `https://remoteok.com/remote-jobs/${job.id}`,
        postedAt: job.date ? new Date(job.date) : undefined,
      }));

      result.success = true;
      result.jobs = jobs;
      result.platforms.push({ name: "RemoteOK", jobsFound: jobs.length });
      console.log(`[RemoteOK] Fetched ${jobs.length} real jobs`);
      
    } catch (error: any) {
      console.error("[RemoteOK] API error:", error);
      result.errors.push(`RemoteOK error: ${error.message}`);
      result.platforms.push({ name: "RemoteOK", jobsFound: 0, error: error.message });
    }

    return result;
  }

  /**
   * Scrape from WeWorkRemotely RSS feed
   * Free, reliable source of remote jobs
   */
  async scrapeWeWorkRemotely(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    try {
      console.log("[WeWorkRemotely] Fetching jobs from RSS...");
      const response = await fetch("https://weworkremotely.com/remote-jobs.rss", {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
        },
      });

      if (!response.ok) {
        result.errors.push(`WeWorkRemotely RSS error: ${response.status}`);
        result.platforms.push({ name: "WeWorkRemotely", jobsFound: 0, error: `HTTP ${response.status}` });
        return result;
      }

      const xml = await response.text();
      const jobs = this.parseWeWorkRemotelyRSS(xml, searchTerm, limit);
      
      result.success = jobs.length > 0;
      result.jobs = jobs;
      result.platforms.push({ name: "WeWorkRemotely", jobsFound: jobs.length });
      console.log(`[WeWorkRemotely] Fetched ${jobs.length} real jobs`);
      
    } catch (error: any) {
      console.error("[WeWorkRemotely] RSS error:", error);
      result.errors.push(`WeWorkRemotely error: ${error.message}`);
      result.platforms.push({ name: "WeWorkRemotely", jobsFound: 0, error: error.message });
    }

    return result;
  }

  private parseWeWorkRemotelyRSS(xml: string, searchTerm?: string, limit: number = 100): ScrapedJob[] {
    const jobs: ScrapedJob[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && jobs.length < limit) {
      const itemXml = match[1];

      const title = this.extractXmlTag(itemXml, "title");
      const description = this.extractXmlTag(itemXml, "description");
      const link = this.extractXmlTag(itemXml, "link");
      const pubDate = this.extractXmlTag(itemXml, "pubDate");
      const creator = this.extractXmlTag(itemXml, "dc:creator") || this.extractXmlTag(itemXml, "creator");
      const region = this.extractXmlTag(itemXml, "region");

      if (!title) continue;

      // Clean the description - remove HTML, extract company info
      const cleanDescription = this.stripHtml(description || '');
      
      // Extract company name from title (format: "Company: Job Title")
      let companyName = creator;
      const titleMatch = title.match(/^([^:]+):\s*(.+)$/);
      if (titleMatch) {
        companyName = titleMatch[1].trim();
      }

      // Filter by search term if provided
      if (searchTerm) {
        const keywords = searchTerm.toLowerCase().split(' ');
        const searchText = `${title} ${cleanDescription}`.toLowerCase();
        if (!keywords.some(kw => searchText.includes(kw))) {
          continue;
        }
      }

      const skills = this.extractSkillsFromContent(title + ' ' + cleanDescription);
      
      // Extract external ID from URL
      const urlParts = link?.split('/') || [];
      const externalId = `wwr-${urlParts[urlParts.length - 1] || Date.now()}`;

      jobs.push({
        externalId,
        platform: "WeWorkRemotely",
        title,
        description: cleanDescription.substring(0, 5000),
        companyName: companyName || undefined,
        location: region || "Remote",
        remote: true,
        skills,
        sourceUrl: link,
        postedAt: pubDate ? new Date(pubDate) : undefined,
      });
    }

    return jobs;
  }

  /**
   * Scrape from Jobicy RSS feed
   * Free remote jobs feed
   */
  async scrapeJobicy(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    try {
      console.log("[Jobicy] Fetching jobs from JSON API...");
      const tag = searchTerm ? encodeURIComponent(searchTerm) : "developer";
      const response = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=${limit}&tag=${tag}`, {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        result.errors.push(`Jobicy API error: ${response.status}`);
        result.platforms.push({ name: "Jobicy", jobsFound: 0, error: `HTTP ${response.status}` });
        return result;
      }

      const data = await response.json();
      const jobicyJobs = data.jobs || [];

      const jobs: ScrapedJob[] = jobicyJobs.slice(0, limit).map((job: any) => ({
        externalId: `jobicy-${job.id}`,
        platform: "Jobicy",
        title: job.jobTitle || "Unknown Position",
        description: this.stripHtml(job.jobDescription || job.jobExcerpt || ''),
        companyName: job.companyName || undefined,
        location: job.jobGeo || "Remote",
        remote: true,
        skills: job.jobIndustry ? [job.jobIndustry] : [],
        sourceUrl: job.url || `https://jobicy.com/job/${job.id}`,
        postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
      }));
      
      result.success = jobs.length > 0;
      result.jobs = jobs;
      result.platforms.push({ name: "Jobicy", jobsFound: jobs.length });
      console.log(`[Jobicy] Fetched ${jobs.length} real jobs`);
      
    } catch (error: any) {
      console.error("[Jobicy] API error:", error);
      result.errors.push(`Jobicy error: ${error.message}`);
      result.platforms.push({ name: "Jobicy", jobsFound: 0, error: error.message });
    }

    return result;
  }

  /**
   * Scrape from Remotive API - FREE, high-quality remote jobs
   * Great company data for enrichment
   */
  async scrapeRemotive(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    try {
      console.log("[Remotive] Fetching jobs from API...");
      const url = searchTerm 
        ? `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(searchTerm)}&limit=${limit}`
        : `https://remotive.com/api/remote-jobs?limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        result.errors.push(`Remotive API error: ${response.status}`);
        result.platforms.push({ name: "Remotive", jobsFound: 0, error: `HTTP ${response.status}` });
        return result;
      }

      const data = await response.json();
      const remotiveJobs: RemotiveJob[] = data.jobs || [];
      
      const jobs: ScrapedJob[] = remotiveJobs.slice(0, limit).map(job => {
        // Parse salary if available
        let budgetMin: number | undefined;
        let budgetMax: number | undefined;
        if (job.salary) {
          const salaryMatch = job.salary.match(/\$?([\d,]+)\s*[-to]+\s*\$?([\d,]+)/i);
          if (salaryMatch) {
            budgetMin = parseInt(salaryMatch[1].replace(/,/g, ''));
            budgetMax = parseInt(salaryMatch[2].replace(/,/g, ''));
          }
        }

        return {
          externalId: `remotive-${job.id}`,
          platform: "Remotive",
          title: job.title,
          description: this.stripHtml(job.description || ''),
          companyName: job.company_name,
          location: job.candidate_required_location || "Remote",
          remote: true,
          budgetMin,
          budgetMax,
          budgetType: budgetMin || budgetMax ? "annual" : undefined,
          skills: job.tags || [],
          sourceUrl: job.url,
          postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
        };
      });

      result.success = jobs.length > 0;
      result.jobs = jobs;
      result.platforms.push({ name: "Remotive", jobsFound: jobs.length });
      console.log(`[Remotive] Fetched ${jobs.length} real jobs`);
      
    } catch (error: any) {
      console.error("[Remotive] API error:", error);
      result.errors.push(`Remotive error: ${error.message}`);
      result.platforms.push({ name: "Remotive", jobsFound: 0, error: error.message });
    }

    return result;
  }

  /**
   * Scrape from Himalayas API - FREE, curated remote jobs
   */
  async scrapeHimalayas(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    try {
      console.log("[Himalayas] Fetching jobs from API...");
      const response = await fetch("https://himalayas.app/jobs/api?limit=100", {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        result.errors.push(`Himalayas API error: ${response.status}`);
        result.platforms.push({ name: "Himalayas", jobsFound: 0, error: `HTTP ${response.status}` });
        return result;
      }

      const data = await response.json();
      const himalayasJobs = data.jobs || [];

      const jobs: ScrapedJob[] = himalayasJobs.slice(0, limit).map((job: any) => {
        const title = job.title || "Untitled Position";
        const company = job.companyName || "Unknown Company";
        
        return {
          externalId: `himalayas-${job.guid || title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}`,
          platform: "Himalayas",
          title,
          description: this.stripHtml(job.excerpt || job.description || ''),
          companyName: company,
          location: job.locationRestrictions?.join(', ') || "Remote",
          remote: true,
          budgetMin: job.minSalary,
          budgetMax: job.maxSalary,
          budgetType: (job.minSalary || job.maxSalary) ? "annual" : undefined,
          skills: job.categories || [],
          sourceUrl: job.applicationLink || `https://himalayas.app/jobs/${job.guid || ''}`,
          postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
        };
      });

      result.success = jobs.length > 0;
      result.jobs = jobs;
      result.platforms.push({ name: "Himalayas", jobsFound: jobs.length });
      console.log(`[Himalayas] Fetched ${jobs.length} real jobs`);
      
    } catch (error: any) {
      console.error("[Himalayas] API error:", error);
      result.errors.push(`Himalayas error: ${error.message}`);
      result.platforms.push({ name: "Himalayas", jobsFound: 0, error: error.message });
    }

    return result;
  }

  /**
   * Scrape from Findwork.dev API - FREE developer jobs
   */
  async scrapeFindwork(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    console.log(`[Findwork] API requires authentication - skipping`);
    return result;
  }

  /**
   * Scrape from Arbeitnow API - FREE EU/Global remote jobs
   */
  async scrapeArbeitnow(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    try {
      console.log("[Arbeitnow] Fetching jobs from API...");
      const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        result.errors.push(`Arbeitnow API error: ${response.status}`);
        result.platforms.push({ name: "Arbeitnow", jobsFound: 0, error: `HTTP ${response.status}` });
        return result;
      }

      const data = await response.json();
      const arbeitnowJobs = data.data || [];
      
      // Filter by search term if provided
      let filteredJobs = arbeitnowJobs;
      if (searchTerm) {
        const keywords = searchTerm.toLowerCase().split(' ');
        filteredJobs = arbeitnowJobs.filter((job: any) => {
          const searchText = `${job.title} ${job.description || ''} ${job.tags?.join(' ') || ''}`.toLowerCase();
          return keywords.some(kw => searchText.includes(kw));
        });
      }

      const jobs: ScrapedJob[] = filteredJobs.slice(0, limit).map((job: any) => ({
        externalId: `arbeitnow-${job.slug}`,
        platform: "Arbeitnow",
        title: job.title,
        description: this.stripHtml(job.description || ''),
        companyName: job.company_name,
        location: job.location || "Remote",
        remote: job.remote || false,
        skills: job.tags || [],
        sourceUrl: job.url,
        postedAt: job.created_at ? new Date(job.created_at * 1000) : undefined,
      }));

      result.success = jobs.length > 0;
      result.jobs = jobs;
      result.platforms.push({ name: "Arbeitnow", jobsFound: jobs.length });
      console.log(`[Arbeitnow] Fetched ${jobs.length} real jobs`);
      
    } catch (error: any) {
      console.error("[Arbeitnow] API error:", error);
      result.errors.push(`Arbeitnow error: ${error.message}`);
      result.platforms.push({ name: "Arbeitnow", jobsFound: 0, error: error.message });
    }

    return result;
  }

  /**
   * JSearch API (RapidAPI) - LinkedIn, Indeed, Glassdoor, ZipRecruiter
   * Requires RAPIDAPI_KEY in environment or settings
   */
  async scrapeJSearch(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "JSearch", jobsFound: 0 }],
    };

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      result.errors.push("JSearch: RAPIDAPI_KEY not configured");
      result.platforms[0].error = "API key not configured";
      return result;
    }

    try {
      console.log("[JSearch] Fetching jobs from LinkedIn/Indeed/Glassdoor...");
      const query = searchTerm || "developer";
      
      const response = await fetch(
        `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=2&date_posted=week`,
        {
          headers: {
            "X-RapidAPI-Key": rapidApiKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`JSearch API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        for (const job of data.data.slice(0, limit)) {
          const jsearchJob = job as JSearchJob;
          
          if (!jsearchJob.employer_name || !jsearchJob.job_apply_link) continue;
          
          const location = [jsearchJob.job_city, jsearchJob.job_state, jsearchJob.job_country]
            .filter(Boolean)
            .join(", ");

          result.jobs.push({
            title: jsearchJob.job_title || "Untitled Position",
            description: jsearchJob.job_description?.substring(0, 5000),
            companyName: jsearchJob.employer_name,
            location: location || "Remote",
            remote: jsearchJob.job_is_remote || false,
            budgetMin: jsearchJob.job_min_salary,
            budgetMax: jsearchJob.job_max_salary,
            budgetType: jsearchJob.job_salary_period || "annual",
            platform: `JSearch-${jsearchJob.job_publisher || "Unknown"}`,
            externalId: `jsearch-${jsearchJob.job_id}`,
            sourceUrl: jsearchJob.job_apply_link,
            postedAt: jsearchJob.job_posted_at_datetime_utc
              ? new Date(jsearchJob.job_posted_at_datetime_utc)
              : undefined,
            skills: jsearchJob.job_required_skills || [],
          });
        }

        result.success = true;
        result.platforms[0].jobsFound = result.jobs.length;
        console.log(`[JSearch] Fetched ${result.jobs.length} jobs from major platforms`);
      }
    } catch (error: any) {
      console.error("[JSearch] Error:", error.message);
      result.errors.push(`JSearch failed: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * The Muse API (FREE) - Curated company jobs with company profiles
   * No API key required for basic usage
   */
  async scrapeTheMuse(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "TheMuse", jobsFound: 0 }],
    };

    try {
      console.log("[TheMuse] Fetching curated company jobs...");
      
      const url = `https://www.themuse.com/api/public/jobs?page=1&descending=true`;
      
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "LeadPilot/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`TheMuse API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && Array.isArray(data.results)) {
        for (const job of data.results.slice(0, limit)) {
          const museJob = job as TheMuseJob;
          
          if (!museJob.company?.name || !museJob.refs?.landing_page) continue;

          const location = museJob.locations?.map(l => l.name).join(", ") || "Remote";
          const isRemote = location.toLowerCase().includes("remote") || 
                          location.toLowerCase().includes("flexible");

          result.jobs.push({
            title: museJob.name || "Untitled Position",
            description: museJob.contents?.substring(0, 5000) || `Job at ${museJob.company.name}`,
            companyName: museJob.company.name,
            location: location,
            remote: isRemote,
            platform: "TheMuse",
            externalId: `themuse-${museJob.id}`,
            sourceUrl: museJob.refs.landing_page,
            postedAt: museJob.publication_date ? new Date(museJob.publication_date) : undefined,
            skills: museJob.categories?.map(c => c.name) || [],
          });
        }

        result.success = true;
        result.platforms[0].jobsFound = result.jobs.length;
        console.log(`[TheMuse] Fetched ${result.jobs.length} curated jobs`);
      }
    } catch (error: any) {
      console.error("[TheMuse] Error:", error.message);
      result.errors.push(`TheMuse failed: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Adzuna API (FREE tier) - UK/EU/US job aggregation
   * Requires ADZUNA_APP_ID and ADZUNA_APP_KEY for premium, but has free tier
   */
  async scrapeAdzuna(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Adzuna", jobsFound: 0 }],
    };

    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    
    if (!appId || !appKey) {
      result.errors.push("Adzuna: API credentials not configured");
      result.platforms[0].error = "API credentials not configured";
      return result;
    }

    try {
      console.log("[Adzuna] Fetching jobs from UK/EU/US...");
      const query = searchTerm || "developer";
      
      const response = await fetch(
        `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(query)}&results_per_page=${limit}&sort_by=date`,
        {
          headers: { "Accept": "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error(`Adzuna API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && Array.isArray(data.results)) {
        for (const job of data.results) {
          const adzunaJob = job as AdzunaJob;
          
          if (!adzunaJob.company?.display_name || !adzunaJob.redirect_url) continue;

          const location = adzunaJob.location?.display_name || "Remote";
          const isRemote = location.toLowerCase().includes("remote");

          result.jobs.push({
            title: adzunaJob.title || "Untitled Position",
            description: adzunaJob.description?.substring(0, 5000),
            companyName: adzunaJob.company.display_name,
            location: location,
            remote: isRemote,
            budgetMin: adzunaJob.salary_min,
            budgetMax: adzunaJob.salary_max,
            budgetType: "annual",
            platform: "Adzuna",
            externalId: `adzuna-${adzunaJob.id}`,
            sourceUrl: adzunaJob.redirect_url,
            postedAt: adzunaJob.created ? new Date(adzunaJob.created) : undefined,
            skills: adzunaJob.category ? [adzunaJob.category.label] : [],
          });
        }

        result.success = true;
        result.platforms[0].jobsFound = result.jobs.length;
        console.log(`[Adzuna] Fetched ${result.jobs.length} jobs`);
      }
    } catch (error: any) {
      console.error("[Adzuna] Error:", error.message);
      result.errors.push(`Adzuna failed: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Call Python microservice for JobSpy (50+ platforms)
   * Falls back gracefully if Python service is not running
   */
  async scrapeWithJobSpy(config: ScrapeConfig): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    const sites = config.platforms || ["indeed", "google", "linkedin", "glassdoor", "zip_recruiter"];

    try {
      console.log("[JobSpy] Calling Python microservice...");
      const response = await fetch(`${this.pythonMicroserviceUrl}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_term: config.searchTerm,
          location: config.location || "",
          sites: sites,
          results_wanted: config.resultsPerPlatform || 100,
          hours_old: config.hoursOld || 72,
          country_indeed: "USA",
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JobSpy service error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.success && data.jobs) {
        result.success = true;
        result.jobs = data.jobs.map((j: any) => ({
          title: j.title || "Untitled",
          description: j.description,
          companyName: j.companyName || j.company_name || j.clientName,
          location: j.location,
          remote: j.remote || j.is_remote || false,
          budgetMin: j.budgetMin || j.budget_min,
          budgetMax: j.budgetMax || j.budget_max,
          budgetType: j.budgetMin || j.budgetMax || j.budget_min || j.budget_max ? "annual" : undefined,
          platform: j.platform || j.site || "JobSpy",
          externalId: j.externalId || j.external_id || `jobspy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sourceUrl: j.sourceUrl || j.source_url || j.job_url || j.url,
          postedAt: j.postedAt ? new Date(j.postedAt) : (j.posted_at ? new Date(j.posted_at) : undefined),
        }));

        // Build platform stats
        for (const site of sites) {
          const count = result.jobs.filter((j) => j.platform.toLowerCase() === site.toLowerCase()).length;
          result.platforms.push({ name: site, jobsFound: count });
        }
        console.log(`[JobSpy] Fetched ${result.jobs.length} real jobs from ${data.sites_scraped?.join(', ') || sites.join(', ')}`);
      } else {
        result.errors.push(data.error || "JobSpy returned no jobs");
      }
    } catch (error: any) {
      console.error("[JobSpy] Service error:", error.message);
      result.errors.push(`JobSpy service unavailable: ${error.message}`);
      for (const site of sites) {
        result.platforms.push({ name: site, jobsFound: 0, error: "Service unavailable" });
      }
    }

    return result;
  }

  /**
   * Scrape from Upwork using Apify or RSS fallback
   * Requires UPWORK_API_KEY (Apify token) for best results
   */
  async scrapeUpwork(searchTerm: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    try {
      const upworkApiKey = process.env.UPWORK_API_KEY;
      if (upworkApiKey) {
        upworkScraper.setApiKey(upworkApiKey);
      }

      const upworkResult = await upworkScraper.scrapeJobs(searchTerm, { limit });

      if (upworkResult.success && upworkResult.jobs.length > 0) {
        const jobs: ScrapedJob[] = upworkResult.jobs.map(job => ({
          externalId: job.externalId,
          platform: "Upwork",
          title: job.title,
          description: job.description,
          companyName: job.clientName,
          location: job.location,
          remote: true,
          budgetMin: job.budgetMin,
          budgetMax: job.budgetMax,
          budgetType: job.budgetType,
          skills: job.skills,
          sourceUrl: job.url,
          postedAt: job.postedAt ? new Date(job.postedAt) : undefined,
        }));

        result.success = true;
        result.jobs = jobs;
        result.platforms.push({ name: "Upwork", jobsFound: jobs.length });
        console.log(`[Upwork] Scraped ${jobs.length} jobs via ${upworkResult.method}`);
      } else {
        result.platforms.push({ name: "Upwork", jobsFound: 0, error: upworkResult.error || "No jobs found" });
        if (upworkResult.error) {
          result.errors.push(`Upwork: ${upworkResult.error}`);
        }
      }
    } catch (error: any) {
      console.error("[Upwork] Scraping error:", error.message);
      result.errors.push(`Upwork error: ${error.message}`);
      result.platforms.push({ name: "Upwork", jobsFound: 0, error: error.message });
    }

    return result;
  }

  /**
   * Working Nomads - Remote work job board (RSS)
   * FREE - No API key required
   */
  async scrapeWorkingNomads(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "WorkingNomads", jobsFound: 0 }],
    };

    try {
      console.log("[WorkingNomads] Fetching remote jobs...");
      const response = await fetch("https://www.workingnomads.com/api/exposed_jobs/", {
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`WorkingNomads API error: ${response.status}`);
      }

      const data = await response.json();
      const jobs = Array.isArray(data) ? data : [];

      result.jobs = jobs.slice(0, limit).map((job: any) => ({
        title: job.title || "Unknown Position",
        description: job.description || "",
        companyName: job.company_name || "",
        location: job.location || "Remote",
        remote: true,
        platform: "WorkingNomads",
        externalId: `workingnomads-${job.slug || job.id || Date.now()}`,
        sourceUrl: job.url || `https://www.workingnomads.com/jobs/${job.slug}`,
        postedAt: job.pub_date ? new Date(job.pub_date) : new Date(),
        skills: job.tags || [],
      }));

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[WorkingNomads] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[WorkingNomads] Error:", error.message);
      result.errors.push(`WorkingNomads: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Remote.co - Remote work job board (RSS)
   * FREE - No API key required
   */
  async scrapeRemoteCo(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Remote.co", jobsFound: 0 }],
    };

    console.log(`[RemoteCo] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * Jobspresso - Curated remote jobs (RSS)
   * FREE - No API key required
   */
  async scrapeJobspresso(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Jobspresso", jobsFound: 0 }],
    };

    console.log(`[Jobspresso] Platform discontinued or unavailable - skipping`);

    return result;
  }

  /**
   * Authentic Jobs - Design & tech jobs (RSS)
   * FREE - No API key required
   */
  async scrapeAuthenticJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "AuthenticJobs", jobsFound: 0 }],
    };

    console.log(`[AuthenticJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Crypto Jobs List - Blockchain/Web3 jobs
   * FREE - No API key required
   */
  async scrapeCryptoJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "CryptoJobs", jobsFound: 0 }],
    };

    console.log(`[CryptoJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Web3 Career - Blockchain jobs (RSS)
   * FREE - No API key required
   */
  async scrapeWeb3Career(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Web3Career", jobsFound: 0 }],
    };

    console.log(`[Web3Career] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Wellfound (formerly AngelList) - Startup jobs
   * FREE - No API key required
   */
  async scrapeWellfound(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Wellfound", jobsFound: 0 }],
    };

    console.log(`[Wellfound] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * Europe Remotely - EU remote jobs (RSS)
   * FREE - No API key required
   */
  async scrapeEuropeRemotely(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "EuropeRemotely", jobsFound: 0 }],
    };

    console.log(`[EuropeRemotely] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * JustRemote - Remote jobs across categories (RSS)
   * FREE - No API key required
   */
  async scrapeJustRemote(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "JustRemote", jobsFound: 0 }],
    };

    try {
      console.log("[JustRemote] Fetching remote developer jobs via HTML...");
      const response = await fetch("https://justremote.co/remote-developer-jobs", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`JustRemote HTML error: ${response.status}`);
      }

      const html = await response.text();
      const titleMatches = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi)];
      
      for (const m of titleMatches.slice(0, limit)) {
        const title = this.stripHtml(m[1]).trim();
        if (!title || title.length < 5 || title.includes('Find the') || title.includes('Stand out') || title.includes('Remote Jobs for')) continue;
        result.jobs.push({
          title,
          description: "",
          companyName: "JustRemote Listing",
          location: "Remote",
          remote: true,
          platform: "JustRemote",
          externalId: `justremote-${Buffer.from(title).toString("base64").slice(0, 20)}`,
          sourceUrl: `https://justremote.co/remote-developer-jobs`,
        });
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[JustRemote] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[JustRemote] Error:", error.message);
      result.errors.push(`JustRemote: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Dynamite Jobs - Remote startup jobs (RSS)
   * FREE - No API key required
   */
  async scrapeDynamiteJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "DynamiteJobs", jobsFound: 0 }],
    };

    console.log(`[DynamiteJobs] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * NoDesk - Remote work jobs (RSS)
   * FREE - No API key required
   */
  async scrapeNoDesk(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "NoDesk", jobsFound: 0 }],
    };

    console.log(`[NoDesk] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Skip The Drive - Remote jobs in USA (RSS)
   * FREE - No API key required
   */
  async scrapeSkipTheDrive(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "SkipTheDrive", jobsFound: 0 }],
    };

    console.log(`[SkipTheDrive] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Reed.co.uk - UK's #1 job site (RSS)
   * FREE - No API key required
   */
  async scrapeReedUK(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Reed.co.uk", jobsFound: 0 }],
    };

    console.log(`[Reed.co.uk] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * SimplyHired - Major job aggregator
   * FREE - No API key required (RSS feed)
   */
  async scrapeSimplyHired(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "SimplyHired", jobsFound: 0 }],
    };

    console.log(`[SimplyHired] Platform blocked - skipping`);
    return result;
  }

  /**
   * Indeed RSS - Indeed jobs via RSS feed
   * FREE - No API key required
   */
  async scrapeIndeedRSS(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "IndeedRSS", jobsFound: 0 }],
    };

    console.log(`[IndeedRSS] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Glassdoor RSS - Glassdoor jobs via RSS
   * FREE - No API key required
   */
  async scrapeGlassdoorRSS(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "GlassdoorRSS", jobsFound: 0 }],
    };

    console.log(`[GlassdoorRSS] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * ZipRecruiter RSS - ZipRecruiter jobs via RSS
   * FREE - No API key required
   */
  async scrapeZipRecruiterRSS(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "ZipRecruiterRSS", jobsFound: 0 }],
    };

    console.log(`[ZipRecruiterRSS] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * CareerJet - Global job search engine
   * FREE - No API key required
   */
  async scrapeCareerJet(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "CareerJet", jobsFound: 0 }],
    };

    console.log(`[CareerJet] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Dice - Tech jobs (RSS)
   * FREE - No API key required
   */
  async scrapeDice(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Dice", jobsFound: 0 }],
    };

    console.log(`[Dice] Platform blocked - skipping`);
    return result;
  }

  /**
   * Turing - Remote developer jobs (JSON API)
   * FREE - No API key required
   */
  async scrapeTuring(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Turing", jobsFound: 0 }],
    };

    console.log(`[Turing] Platform blocked - skipping`);
    return result;
  }

  /**
   * Toptal - Freelance developer jobs (RSS)
   * FREE - No API key required
   */
  async scrapeToptal(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Toptal", jobsFound: 0 }],
    };

    console.log(`[Toptal] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Remote OK Extra Categories - Programming, Design, Marketing, etc.
   * FREE - No API key required
   */
  async scrapeRemoteOKCategories(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "RemoteOK-Extra", jobsFound: 0 }],
    };

    const categories = ["dev", "design", "marketing", "sales", "support", "writing", "finance", "legal", "hr"];
    
    try {
      console.log("[RemoteOK-Extra] Fetching jobs from multiple categories...");
      
      for (const category of categories.slice(0, 5)) {
        try {
          const response = await fetch(`https://remoteok.com/api?tag=${category}`, {
            headers: { "Accept": "application/json" },
          });

          if (response.ok) {
            const data = await response.json();
            const jobs = Array.isArray(data) ? data.slice(1) : [];

            for (const job of jobs.slice(0, 10)) {
              if (!result.jobs.find(j => j.externalId === `remoteok-${job.id}`)) {
                result.jobs.push({
                  title: job.position || "Unknown Position",
                  description: this.stripHtml(job.description || ""),
                  companyName: job.company || "",
                  location: job.location || "Remote",
                  remote: true,
                  platform: "RemoteOK",
                  externalId: `remoteok-${job.id}`,
                  sourceUrl: job.url || `https://remoteok.com/l/${job.id}`,
                  postedAt: job.epoch ? new Date(job.epoch * 1000) : new Date(),
                  skills: job.tags || [],
                });
              }
            }
          }
        } catch (e) {
          // Continue with other categories
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[RemoteOK-Extra] Found ${result.jobs.length} additional jobs`);
    } catch (error: any) {
      console.error("[RemoteOK-Extra] Error:", error.message);
      result.errors.push(`RemoteOK-Extra: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Dribbble Jobs - Design jobs
   * FREE - No API key required
   */
  async scrapeDribbble(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Dribbble", jobsFound: 0 }],
    };

    try {
      console.log("[Dribbble] Fetching design jobs...");
      const response = await fetch("https://dribbble.com/jobs.rss", {
        headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
      });

      if (!response.ok) {
        throw new Error(`Dribbble RSS error: ${response.status}`);
      }

      const xml = await response.text();
      const baseJobs = this.parseGenericRSS(xml, "Dribbble", searchTerm, limit);
      for (const job of baseJobs) {
        const atMatch = job.title?.match(/^(.+?)\s+at\s+(.+)$/i);
        if (atMatch) {
          job.title = atMatch[1].trim();
          job.companyName = atMatch[2].trim();
        }
        if (!job.companyName) {
          const creatorMatch = xml.match(new RegExp(`<item>[\\s\\S]*?<title>[\\s\\S]*?${job.title?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?<dc:creator><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/dc:creator>`, 'i'));
          if (creatorMatch) {
            job.companyName = creatorMatch[1].trim();
          }
        }
      }
      result.jobs = baseJobs;
      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Dribbble] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[Dribbble] Error:", error.message);
      result.errors.push(`Dribbble: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Landing.jobs - EU tech jobs
   * FREE - No API key required
   */
  async scrapeLandingJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Landing.jobs", jobsFound: 0 }],
    };

    console.log(`[Landing.jobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Startup Jobs - Startup ecosystem jobs
   * FREE - No API key required
   */
  async scrapeStartupJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "StartupJobs", jobsFound: 0 }],
    };

    console.log(`[StartupJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape Greenhouse Jobs Board (FREE)
   * Many tech companies use Greenhouse ATS - publicly accessible
   * Key advantage: company domain is known from the slug, so no domain resolution needed
   */
  async scrapeGreenhouseJobs(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Greenhouse", jobsFound: 0 }],
    };

    const greenhouseCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "databricks", name: "Databricks", domain: "databricks.com" },
      { slug: "cloudflare", name: "Cloudflare", domain: "cloudflare.com" },
      { slug: "stripe", name: "Stripe", domain: "stripe.com" },
      { slug: "coupang", name: "Coupang", domain: "coupang.com" },
      { slug: "datadog", name: "Datadog", domain: "datadoghq.com" },
      { slug: "samsara", name: "Samsara", domain: "samsara.com" },
      { slug: "mongodb", name: "MongoDB", domain: "mongodb.com" },
      { slug: "okta", name: "Okta", domain: "okta.com" },
      { slug: "onemedical", name: "One Medical", domain: "onemedical.com" },
      { slug: "relativityhq", name: "Relativity", domain: "relativity.com" },
      { slug: "netskope", name: "Netskope", domain: "netskope.com" },
      { slug: "toast", name: "Toast", domain: "toasttab.com" },
      { slug: "roblox", name: "Roblox", domain: "roblox.com" },
      { slug: "roku", name: "Roku", domain: "roku.com" },
      { slug: "zscaler", name: "Zscaler", domain: "zscaler.com" },
      { slug: "intercom", name: "Intercom", domain: "intercom.com" },
      { slug: "rubrik", name: "Rubrik", domain: "rubrik.com" },
      { slug: "elastic", name: "Elastic", domain: "elastic.co" },
      { slug: "brex", name: "Brex", domain: "brex.com" },
      { slug: "figma", name: "Figma", domain: "figma.com" },
      { slug: "instacart", name: "Instacart", domain: "instacart.com" },
      { slug: "gitlab", name: "GitLab", domain: "gitlab.com" },
      { slug: "dropbox", name: "Dropbox", domain: "dropbox.com" },
      { slug: "reddit", name: "Reddit", domain: "reddit.com" },
      { slug: "lyft", name: "Lyft", domain: "lyft.com" },
      { slug: "qualtrics", name: "Qualtrics", domain: "qualtrics.com" },
      { slug: "asana", name: "Asana", domain: "asana.com" },
      { slug: "twilio", name: "Twilio", domain: "twilio.com" },
      { slug: "pinterest", name: "Pinterest", domain: "pinterest.com" },
      { slug: "postman", name: "Postman", domain: "postman.com" },
      { slug: "contentful", name: "Contentful", domain: "contentful.com" },
      { slug: "carta", name: "Carta", domain: "carta.com" },
      { slug: "gusto", name: "Gusto", domain: "gusto.com" },
      { slug: "vercel", name: "Vercel", domain: "vercel.com" },
      { slug: "duolingo", name: "Duolingo", domain: "duolingo.com" },
      { slug: "grammarly", name: "Grammarly", domain: "grammarly.com" },
      { slug: "discord", name: "Discord", domain: "discord.com" },
      { slug: "earnin", name: "Earnin", domain: "earnin.com" },
      { slug: "newrelic", name: "New Relic", domain: "newrelic.com" },
      { slug: "twitch", name: "Twitch", domain: "twitch.tv" },
      { slug: "launchdarkly", name: "LaunchDarkly", domain: "launchdarkly.com" },
      { slug: "amplitude", name: "Amplitude", domain: "amplitude.com" },
      { slug: "faire", name: "Faire", domain: "faire.com" },
      { slug: "webflow", name: "Webflow", domain: "webflow.com" },
      { slug: "chime", name: "Chime", domain: "chime.com" },
      { slug: "airtable", name: "Airtable", domain: "airtable.com" },
      { slug: "pagerduty", name: "PagerDuty", domain: "pagerduty.com" },
      { slug: "mixpanel", name: "Mixpanel", domain: "mixpanel.com" },
      { slug: "tailscale", name: "Tailscale", domain: "tailscale.com" },
      { slug: "calendly", name: "Calendly", domain: "calendly.com" },
      { slug: "mercury", name: "Mercury", domain: "mercury.com" },
      { slug: "algolia", name: "Algolia", domain: "algolia.com" },
      { slug: "cockroachlabs", name: "Cockroach Labs", domain: "cockroachlabs.com" },
      { slug: "marqeta", name: "Marqeta", domain: "marqeta.com" },
      { slug: "lattice", name: "Lattice", domain: "lattice.com" },
    ];

    try {
      console.log(`[Greenhouse] Scraping ${greenhouseCompanies.length} companies...`);
      const batchSize = 5;
      
      for (let i = 0; i < greenhouseCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = greenhouseCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const response = await fetch(
                `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`,
                { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(10000) }
              );
              if (!response.ok) return [];
              const data = await response.json();
              const companyJobs: ScrapedJob[] = [];
              for (const job of (data.jobs || []).slice(0, 15)) {
                const text = `${job.title || ""} ${job.content || ""}`.toLowerCase();
                if (searchTerm && !searchTerm.toLowerCase().split(" ").some((kw: string) => text.includes(kw))) continue;
                companyJobs.push({
                  title: job.title || "Unknown Role",
                  companyName: company.name,
                  companyDomain: company.domain,
                  description: this.stripHtml(job.content || "").slice(0, 2000),
                  location: job.location?.name || "Remote",
                  remote: job.location?.name?.toLowerCase().includes("remote"),
                  platform: "Greenhouse",
                  externalId: `greenhouse-${company.slug}-${job.id}`,
                  sourceUrl: job.absolute_url || `https://boards.greenhouse.io/${company.slug}/jobs/${job.id}`,
                  postedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
                });
              }
              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Greenhouse] Found ${result.jobs.length} jobs from ${greenhouseCompanies.length} companies`);
    } catch (error: any) {
      console.error("[Greenhouse] Error:", error.message);
      result.errors.push(`Greenhouse: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  private getGreenhouseDomain(slug: string): string | null {
    const companies: { slug: string; name: string; domain: string }[] = [
      { slug: "airbnb", name: "Airbnb", domain: "airbnb.com" },
      { slug: "stripe", name: "Stripe", domain: "stripe.com" },
      { slug: "coinbase", name: "Coinbase", domain: "coinbase.com" },
      { slug: "figma", name: "Figma", domain: "figma.com" },
      { slug: "notion", name: "Notion", domain: "notion.so" },
      { slug: "discord", name: "Discord", domain: "discord.com" },
      { slug: "snowflakecomputing", name: "Snowflake", domain: "snowflake.com" },
      { slug: "databricks", name: "Databricks", domain: "databricks.com" },
      { slug: "datadoghq", name: "Datadog", domain: "datadoghq.com" },
      { slug: "cloudflare", name: "Cloudflare", domain: "cloudflare.com" },
      { slug: "gitlab", name: "GitLab", domain: "gitlab.com" },
      { slug: "hubspot", name: "HubSpot", domain: "hubspot.com" },
      { slug: "grammarly", name: "Grammarly", domain: "grammarly.com" },
    ];
    const match = companies.find(c => c.slug === slug);
    return match?.domain || null;
  }

  /**
   * Scrape Lever Jobs Board (FREE)
   * Many tech companies use Lever ATS - publicly accessible
   * Key advantage: company domain is known from the slug, so no domain resolution needed
   */
  async scrapeLeverJobs(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Lever", jobsFound: 0 }],
    };

    const leverCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "spotify", name: "Spotify", domain: "spotify.com" },
      { slug: "plaid", name: "Plaid", domain: "plaid.com" },
      { slug: "gopuff", name: "Gopuff", domain: "gopuff.com" },
      { slug: "brevo", name: "Brevo", domain: "brevo.com" },
      { slug: "activecampaign", name: "ActiveCampaign", domain: "activecampaign.com" },
      { slug: "anyscale", name: "Anyscale", domain: "anyscale.com" },
      { slug: "logrocket", name: "LogRocket", domain: "logrocket.com" },
      { slug: "metabase", name: "Metabase", domain: "metabase.com" },
      { slug: "prismic", name: "Prismic", domain: "prismic.io" },
      { slug: "omnisend", name: "Omnisend", domain: "omnisend.com" },
      { slug: "aircall", name: "Aircall", domain: "aircall.io" },
      { slug: "neon", name: "Neon", domain: "neon.tech" },
    ];

    try {
      console.log(`[Lever] Scraping ${leverCompanies.length} companies...`);
      const batchSize = 5;
      
      for (let i = 0; i < leverCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = leverCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const response = await fetch(
                `https://api.lever.co/v0/postings/${company.slug}`,
                { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(10000) }
              );
              if (!response.ok) return [];
              const jobs = await response.json();
              const companyJobs: ScrapedJob[] = [];
              for (const job of (jobs || []).slice(0, 15)) {
                const text = `${job.text || ""} ${job.descriptionPlain || ""}`.toLowerCase();
                if (searchTerm && !searchTerm.toLowerCase().split(" ").some((kw: string) => text.includes(kw))) continue;
                companyJobs.push({
                  title: job.text || "Unknown Role",
                  companyName: company.name,
                  companyDomain: company.domain,
                  description: (job.descriptionPlain || this.stripHtml(job.description || "")).slice(0, 2000),
                  location: job.categories?.location || "Remote",
                  remote: job.workplaceType === "remote" || job.categories?.location?.toLowerCase()?.includes("remote"),
                  platform: "Lever",
                  externalId: `lever-${company.slug}-${job.id}`,
                  sourceUrl: job.hostedUrl || `https://jobs.lever.co/${company.slug}/${job.id}`,
                  postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
                });
              }
              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Lever] Found ${result.jobs.length} jobs from ${leverCompanies.length} companies`);
    } catch (error: any) {
      console.error("[Lever] Error:", error.message);
      result.errors.push(`Lever: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape Freelancer.com via public RSS/search (FREE)
   */
  async scrapeFreelancer(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Freelancer", jobsFound: 0 }],
    };

    try {
      console.log("[Freelancer] Attempting to scrape projects...");
      const query = searchTerm || "web development";
      
      // Freelancer has a public projects endpoint (limited)
      const response = await fetch(`https://www.freelancer.com/api/projects/0.1/projects/active/?job_details=true&limit=20&query=${encodeURIComponent(query)}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        const projects = data.result?.projects || [];

        for (const project of projects.slice(0, limit)) {
          result.jobs.push({
            title: project.title || "Untitled Project",
            description: (project.description || project.preview_description || "").slice(0, 2000),
            companyName: project.owner?.display_name || project.owner?.username || "Private Client",
            location: project.location?.country?.name || "Remote",
            remote: true,
            budgetMin: project.budget?.minimum,
            budgetMax: project.budget?.maximum,
            budgetType: project.type === "hourly" ? "hourly" : "fixed",
            platform: "Freelancer",
            externalId: `freelancer-${project.id}`,
            sourceUrl: `https://www.freelancer.com/projects/${project.seo_url || project.id}`,
            postedAt: project.time_submitted ? new Date(project.time_submitted * 1000) : new Date(),
            skills: project.jobs?.map((j: any) => j.name) || [],
          });
        }

        result.success = result.jobs.length > 0;
        result.platforms[0].jobsFound = result.jobs.length;
        console.log(`[Freelancer] Found ${result.jobs.length} projects`);
      } else {
        throw new Error(`Freelancer API returned ${response.status}`);
      }
    } catch (error: any) {
      console.error("[Freelancer] Error:", error.message);
      result.errors.push(`Freelancer: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape HackerNews "Who's Hiring" thread (FREE - Monthly HN thread)
   */
  async scrapeHackerNews(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "HackerNews", jobsFound: 0 }],
    };

    try {
      console.log("[HackerNews] Scraping Who's Hiring thread...");
      const searchRes = await fetch(
        `https://hn.algolia.com/api/v1/search?query=who+is+hiring&tags=ask_hn&hitsPerPage=1`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!searchRes.ok) {
        throw new Error(`HN search API error: ${searchRes.status}`);
      }

      const searchData = await searchRes.json();
      const latestThread = searchData.hits?.[0];

      if (!latestThread?.objectID) {
        throw new Error("No Who's Hiring thread found");
      }

      console.log(`[HackerNews] Found thread: "${latestThread.title}" (ID: ${latestThread.objectID})`);

      const threadRes = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${latestThread.objectID}.json`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!threadRes.ok) {
        throw new Error(`HN Firebase API error: ${threadRes.status}`);
      }

      const threadData = await threadRes.json();
      const commentIds: number[] = threadData.kids || [];

      const batchSize = 10;
      for (let i = 0; i < Math.min(commentIds.length, limit * 2) && result.jobs.length < limit; i += batchSize) {
        const batch = commentIds.slice(i, i + batchSize);
        const commentResults = await Promise.allSettled(
          batch.map(async (commentId: number) => {
            const res = await fetch(
              `https://hacker-news.firebaseio.com/v0/item/${commentId}.json`,
              { signal: AbortSignal.timeout(10000) }
            );
            if (!res.ok) return null;
            return res.json();
          })
        );

        for (const cr of commentResults) {
          if (cr.status !== "fulfilled" || !cr.value) continue;
          const comment = cr.value;
          if (comment.deleted || comment.dead) continue;
          const text = comment.text || "";
          if (text.length < 50) continue;

          const firstLine = this.stripHtml(text.split('<p>')[0] || text.split('\n')[0] || "");
          const parts = firstLine.split('|').map((p: string) => p.trim());
          const companyName = parts[0] || "Unknown Company";
          const locationPart = parts.find((p: string) => 
            /remote|onsite|hybrid|location/i.test(p) || /[A-Z][a-z]+,\s*[A-Z]{2}/.test(p)
          );

          if (searchTerm) {
            const keywords = searchTerm.toLowerCase().split(" ");
            const searchText = `${firstLine} ${this.stripHtml(text)}`.toLowerCase();
            if (!keywords.some(kw => searchText.includes(kw))) continue;
          }

          result.jobs.push({
            title: firstLine.slice(0, 150) || "HN Job Post",
            description: this.stripHtml(text).slice(0, 2000),
            companyName: companyName.slice(0, 100),
            location: locationPart || (text.toLowerCase().includes("remote") ? "Remote" : "Various"),
            remote: text.toLowerCase().includes("remote"),
            platform: "HackerNews",
            externalId: `hn-${comment.id}`,
            sourceUrl: `https://news.ycombinator.com/item?id=${comment.id}`,
            postedAt: comment.time ? new Date(comment.time * 1000) : new Date(),
          });
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[HackerNews] Found ${result.jobs.length} job posts from ${commentIds.length} comments`);
    } catch (error: any) {
      console.error("[HackerNews] Error:", error.message);
      result.errors.push(`HackerNews: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape StackOverflow Jobs via their RSS feed (FREE)
   */
  async scrapeStackOverflow(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "StackOverflow", jobsFound: 0 }],
    };

    console.log(`[StackOverflow] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape Y Combinator Work at a Startup (FREE - YC Companies)
   */
  async scrapeYCombinator(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "YCombinator", jobsFound: 0 }],
    };

    console.log(`[YCombinator] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape AngelList/Wellfound Startups RSS (FREE)
   */
  async scrapeAngelList(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "AngelList", jobsFound: 0 }],
    };

    console.log(`[AngelList] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape DevITJobs (FREE European Tech Jobs)
   */
  async scrapeDevITJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "DevITJobs", jobsFound: 0 }],
    };

    try {
      console.log("[DevITJobs] Scraping European tech jobs...");
      const response = await fetch(
        `https://devitjobs.uk/api/jobslight`,
        {
          headers: { "Accept": "application/json", "User-Agent": "LeadPilot/1.0 (Job Aggregator)" },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const jobs = Array.isArray(data) ? data : data.jobs || [];

        for (const job of jobs.slice(0, limit)) {
          const jobName = job.name || job.jobUrl?.replace(/-/g, ' ') || "Developer";
          const companyName = job.company || "Tech Company";
          let domain: string | undefined;
          try {
            if (job.companyWebsiteLink && job.companyWebsiteLink.includes('.')) {
              const host = job.companyWebsiteLink.startsWith('http') 
                ? new URL(job.companyWebsiteLink).hostname.replace('www.', '')
                : job.companyWebsiteLink.replace('www.', '');
              if (host !== 'devitjobs.uk' && host !== 'swissdevjobs.ch') domain = host;
            }
          } catch {}
          const loc = job.cityCategory || job.actualCity || job.address || "UK/Remote";
          result.jobs.push({
            title: jobName,
            description: job.techCategory || "",
            companyName,
            companyDomain: domain,
            location: loc,
            remote: job.workplace === "Remote" || loc.toLowerCase().includes("remote"),
            platform: "DevITJobs",
            externalId: `devit-${job._id || Date.now()}-${result.jobs.length}`,
            sourceUrl: `https://devitjobs.uk/jobs/${job.jobUrl}`,
            postedAt: job.activeFrom ? new Date(job.activeFrom) : undefined,
            skills: job.technologies || [],
          });
        }

        result.success = result.jobs.length > 0;
        result.platforms[0].jobsFound = result.jobs.length;
        console.log(`[DevITJobs] Found ${result.jobs.length} jobs`);
      }
    } catch (error: any) {
      console.error("[DevITJobs] Error:", error.message);
      result.errors.push(`DevITJobs: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape Jooble RSS (FREE - Global Job Aggregator)
   */
  async scrapeJooble(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Jooble", jobsFound: 0 }],
    };

    console.log(`[Jooble] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape Guru.com projects (FREE - Freelance)
   */
  async scrapeGuru(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Guru", jobsFound: 0 }],
    };

    try {
      console.log("[Guru] Scraping freelance projects...");
      const response = await fetch(
        `https://www.guru.com/d/jobs/q/${encodeURIComponent(searchTerm || "web development")}/pg/1/`,
        {
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html"
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (response.ok) {
        const text = await response.text();
        // Parse job listings from HTML (basic extraction)
        const jobBlocks = text.match(/<div[^>]*class="[^"]*jobRecord[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];
        
        console.log(`[Guru] Found ${jobBlocks.length} job blocks`);
        result.platforms[0].jobsFound = 0; // Guru requires more complex parsing
      }
    } catch (error: any) {
      console.error("[Guru] Error:", error.message);
      result.errors.push(`Guru: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape PeoplePerHour projects (FREE - Freelance UK)
   */
  async scrapePeoplePerHour(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "PeoplePerHour", jobsFound: 0 }],
    };

    try {
      console.log("[PeoplePerHour] Scraping projects...");
      const response = await fetch(
        `https://www.peopleperhour.com/freelance-jobs?q=${encodeURIComponent(searchTerm || "web development")}`,
        {
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html"
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (response.ok) {
        console.log(`[PeoplePerHour] Page fetched successfully`);
        result.platforms[0].jobsFound = 0; // PPH requires complex parsing
      }
    } catch (error: any) {
      console.error("[PeoplePerHour] Error:", error.message);
      result.errors.push(`PeoplePerHour: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape Behance Jobs (FREE - Creative Jobs)
   */
  async scrapeBehance(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Behance", jobsFound: 0 }],
    };

    try {
      console.log("[Behance] Scraping creative jobs...");
      const response = await fetch(
        `https://www.behance.net/joblist?tracking_source=nav20&field=132&country=US&remote=true`,
        {
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json"
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (response.ok) {
        console.log(`[Behance] Page fetched successfully`);
        result.platforms[0].jobsFound = 0;
      }
    } catch (error: any) {
      console.error("[Behance] Error:", error.message);
      result.errors.push(`Behance: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape FlexJobs RSS (FREE - Remote Jobs)
   */
  async scrapeFlexJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "FlexJobs", jobsFound: 0 }],
    };

    console.log(`[FlexJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape PowerToFly (FREE - Women in Tech / Remote)
   */
  async scrapePowerToFly(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "PowerToFly", jobsFound: 0 }],
    };

    console.log(`[PowerToFly] Platform discontinued or blocked - skipping`);
    return result;
  }

  /**
   * Scrape using Playwright browser automation
   * For sites that block regular HTTP requests
   */
  async scrapeWithPlaywright(platform: string, searchTerm: string, limit: number = 30): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: platform, jobsFound: 0 }],
    };

    console.log(`[Playwright-${platform}] Starting scrape for: "${searchTerm}" (limit: ${limit})`);

    try {
      let scrapeResult: { success: boolean; jobs: any[]; count: number; error?: string };

      switch (platform.toLowerCase()) {
        case "wellfound":
          scrapeResult = await playwrightScraper.scrapeWellfound(searchTerm, limit);
          result.platforms[0].name = "Wellfound";
          break;
        case "toptal":
          scrapeResult = await playwrightScraper.scrapeToptal(searchTerm, limit);
          result.platforms[0].name = "Toptal";
          break;
        case "turing":
          scrapeResult = await playwrightScraper.scrapeTuring(searchTerm, limit);
          result.platforms[0].name = "Turing";
          break;
        case "remoteco":
          scrapeResult = await playwrightScraper.scrapeRemoteCo(searchTerm, limit);
          result.platforms[0].name = "Remote.co";
          break;
        case "jobspresso":
          scrapeResult = await playwrightScraper.scrapeJobspresso(searchTerm, limit);
          result.platforms[0].name = "Jobspresso";
          break;
        case "cryptojobs":
          scrapeResult = await playwrightScraper.scrapeCryptoJobs(searchTerm, limit);
          result.platforms[0].name = "CryptoJobs";
          break;
        case "web3career":
          scrapeResult = await playwrightScraper.scrapeWeb3Career(searchTerm, limit);
          result.platforms[0].name = "Web3Career";
          break;
        case "dice":
          scrapeResult = await playwrightScraper.scrapeDice(searchTerm, limit);
          result.platforms[0].name = "Dice";
          break;
        case "simplyhired":
          scrapeResult = await playwrightScraper.scrapeSimplyHired(searchTerm, limit);
          result.platforms[0].name = "SimplyHired";
          break;
        case "careerjet":
          scrapeResult = await playwrightScraper.scrapeCareerJet(searchTerm, limit);
          result.platforms[0].name = "CareerJet";
          break;
        case "landingjobs":
          scrapeResult = await playwrightScraper.scrapeLandingJobs(searchTerm, limit);
          result.platforms[0].name = "Landing.jobs";
          break;
        case "startupjobs":
          scrapeResult = await playwrightScraper.scrapeStartupJobs(searchTerm, limit);
          result.platforms[0].name = "StartupJobs";
          break;
        case "guru":
          scrapeResult = await playwrightScraper.scrapeGuru(searchTerm, limit);
          result.platforms[0].name = "Guru";
          break;
        case "peopleperhour":
          scrapeResult = await playwrightScraper.scrapePeoplePerHour(searchTerm, limit);
          result.platforms[0].name = "PeoplePerHour";
          break;
        case "behance":
          scrapeResult = await playwrightScraper.scrapeBehance(searchTerm, limit);
          result.platforms[0].name = "Behance";
          break;
        default:
          throw new Error(`Unknown Playwright platform: ${platform}`);
      }

      if (scrapeResult.success) {
        result.jobs = scrapeResult.jobs.map((job: any) => ({
          title: job.title,
          description: job.description || "",
          companyName: job.companyName,
          location: job.location || "Remote",
          remote: job.remote ?? true,
          budgetMin: job.budgetMin,
          budgetMax: job.budgetMax,
          budgetType: job.budgetType,
          platform: job.platform || result.platforms[0].name,
          externalId: job.externalId,
          sourceUrl: job.sourceUrl,
          postedAt: job.postedAt,
        }));
        result.success = true;
        result.platforms[0].jobsFound = result.jobs.length;
        console.log(`[Playwright-${platform}] Successfully scraped ${result.jobs.length} jobs`);
      } else if (scrapeResult.error) {
        console.log(`[Playwright-${platform}] Scrape returned error: ${scrapeResult.error}`);
        result.errors.push(`${result.platforms[0].name}: ${scrapeResult.error}`);
        result.platforms[0].error = scrapeResult.error;
      } else {
        console.log(`[Playwright-${platform}] Scrape returned 0 jobs with no error`);
      }
    } catch (error: any) {
      console.error(`[Playwright-${platform}] Exception:`, error.message);
      result.errors.push(`${platform}: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape Ashby Jobs (FREE)
   * Ashby public posting API for company job boards
   */
  async scrapeAshby(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Ashby", jobsFound: 0 }],
    };

    const ashbyCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "deel", name: "Deel", domain: "deel.com" },
      { slug: "vanta", name: "Vanta", domain: "vanta.com" },
      { slug: "notion", name: "Notion", domain: "notion.so" },
      { slug: "ramp", name: "Ramp", domain: "ramp.com" },
      { slug: "replit", name: "Replit", domain: "replit.com" },
      { slug: "benchling", name: "Benchling", domain: "benchling.com" },
      { slug: "sentry", name: "Sentry", domain: "sentry.io" },
      { slug: "supabase", name: "Supabase", domain: "supabase.com" },
      { slug: "linear", name: "Linear", domain: "linear.app" },
      { slug: "livekit", name: "LiveKit", domain: "livekit.io" },
      { slug: "posthog", name: "PostHog", domain: "posthog.com" },
      { slug: "coder", name: "Coder", domain: "coder.com" },
      { slug: "resend", name: "Resend", domain: "resend.com" },
      { slug: "opensea", name: "OpenSea", domain: "opensea.io" },
      { slug: "raycast", name: "Raycast", domain: "raycast.com" },
      { slug: "clerk", name: "Clerk", domain: "clerk.com" },
      { slug: "stytch", name: "Stytch", domain: "stytch.com" },
      { slug: "drata", name: "Drata", domain: "drata.com" },
      { slug: "mux", name: "Mux", domain: "mux.com" },
      { slug: "sanity", name: "Sanity", domain: "sanity.io" },
      { slug: "neon", name: "Neon", domain: "neon.tech" },
      { slug: "render", name: "Render", domain: "render.com" },
    ];

    try {
      console.log(`[Ashby] Scraping ${ashbyCompanies.length} companies...`);
      const batchSize = 5;

      for (let i = 0; i < ashbyCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = ashbyCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const response = await fetch(
                `https://api.ashbyhq.com/posting-api/job-board/${company.slug}`,
                {
                  headers: { "Accept": "application/json" },
                  signal: AbortSignal.timeout(10000),
                }
              );
              if (!response.ok) return [];
              const data = await response.json();
              const companyJobs: ScrapedJob[] = [];
              for (const job of (data.jobs || []).slice(0, 15)) {
                const text = `${job.title || ""} ${job.descriptionPlain || ""}`.toLowerCase();
                if (searchTerm && !searchTerm.toLowerCase().split(" ").some((kw: string) => text.includes(kw))) continue;
                companyJobs.push({
                  title: job.title || "Unknown Role",
                  companyName: company.name,
                  companyDomain: company.domain,
                  description: this.stripHtml(job.descriptionHtml || job.descriptionPlain || "").slice(0, 2000),
                  location: job.location || job.locationName || "Remote",
                  remote: job.isRemote || job.location?.toLowerCase()?.includes("remote") || false,
                  platform: "Ashby",
                  externalId: `ashby-${company.slug}-${job.id}`,
                  sourceUrl: job.jobUrl || job.applyUrl || `https://jobs.ashbyhq.com/${company.slug}/${job.id}`,
                  postedAt: job.publishedAt ? new Date(job.publishedAt) : new Date(),
                });
              }
              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Ashby] Found ${result.jobs.length} jobs from ${ashbyCompanies.length} companies`);
    } catch (error: any) {
      console.error("[Ashby] Error:", error.message);
      result.errors.push(`Ashby: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape SmartRecruiters Jobs (FREE)
   * SmartRecruiters public posting API for company job boards
   */
  async scrapeSmartRecruiters(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "SmartRecruiters", jobsFound: 0 }],
    };

    const smartRecruitersCompanies: { id: string; name: string; domain: string }[] = [
      { id: "Visa", name: "Visa", domain: "visa.com" },
      { id: "BOSCH", name: "Bosch", domain: "bosch.com" },
      { id: "Adidas", name: "Adidas", domain: "adidas.com" },
      { id: "Siemens", name: "Siemens", domain: "siemens.com" },
      { id: "SmartRecruiters", name: "SmartRecruiters", domain: "smartrecruiters.com" },
      { id: "Sanofi", name: "Sanofi", domain: "sanofi.com" },
      { id: "Equinix", name: "Equinix", domain: "equinix.com" },
      { id: "Publicis", name: "Publicis", domain: "publicisgroupe.com" },
      { id: "Capgemini", name: "Capgemini", domain: "capgemini.com" },
      { id: "DHL", name: "DHL", domain: "dhl.com" },
      { id: "Deloitte", name: "Deloitte", domain: "deloitte.com" },
      { id: "Accenture", name: "Accenture", domain: "accenture.com" },
      { id: "Bayer", name: "Bayer", domain: "bayer.com" },
      { id: "ABInBev", name: "AB InBev", domain: "ab-inbev.com" },
      { id: "Heineken", name: "Heineken", domain: "heineken.com" },
      { id: "PepsiCo", name: "PepsiCo", domain: "pepsico.com" },
      { id: "Nestle", name: "Nestle", domain: "nestle.com" },
      { id: "Unilever", name: "Unilever", domain: "unilever.com" },
      { id: "Ikea", name: "IKEA", domain: "ikea.com" },
      { id: "Zalando", name: "Zalando", domain: "zalando.com" },
      { id: "SAP", name: "SAP", domain: "sap.com" },
      { id: "Ericsson", name: "Ericsson", domain: "ericsson.com" },
      { id: "Spotify", name: "Spotify", domain: "spotify.com" },
      { id: "SKF", name: "SKF", domain: "skf.com" },
      { id: "ABB", name: "ABB", domain: "abb.com" },
      { id: "Allianz", name: "Allianz", domain: "allianz.com" },
      { id: "AstraZeneca", name: "AstraZeneca", domain: "astrazeneca.com" },
      { id: "Roche", name: "Roche", domain: "roche.com" },
      { id: "Novartis", name: "Novartis", domain: "novartis.com" },
    ];

    try {
      console.log(`[SmartRecruiters] Scraping ${smartRecruitersCompanies.length} companies...`);
      const batchSize = 3;

      for (let i = 0; i < smartRecruitersCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = smartRecruitersCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const response = await fetch(
                `https://api.smartrecruiters.com/v1/companies/${company.id}/postings`,
                {
                  headers: { "Accept": "application/json" },
                  signal: AbortSignal.timeout(10000),
                }
              );
              if (!response.ok) return [];
              const data = await response.json();
              const companyJobs: ScrapedJob[] = [];
              for (const job of (data.content || data.results || []).slice(0, 30)) {
                const jobTitle = job.name || job.title || "Unknown Role";
                const location = job.location?.city
                  ? `${job.location.city}${job.location.region ? ", " + job.location.region : ""}${job.location.country ? ", " + job.location.country : ""}`
                  : job.location?.country || "Various";
                companyJobs.push({
                  title: jobTitle,
                  companyName: company.name,
                  companyDomain: company.domain,
                  description: this.stripHtml(job.jobAd?.sections?.jobDescription?.text || job.description || "").slice(0, 2000),
                  location,
                  remote: job.location?.remote || job.remote || false,
                  platform: "SmartRecruiters",
                  externalId: `smartrecruiters-${company.id}-${job.id || job.uuid}`,
                  sourceUrl: job.ref || job.applyUrl || `https://jobs.smartrecruiters.com/${company.id}/${job.id}`,
                  postedAt: job.releasedDate ? new Date(job.releasedDate) : new Date(),
                });
              }
              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[SmartRecruiters] Found ${result.jobs.length} jobs from ${smartRecruitersCompanies.length} companies`);
    } catch (error: any) {
      console.error("[SmartRecruiters] Error:", error.message);
      result.errors.push(`SmartRecruiters: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape BuiltIn Remote Jobs (FREE - HTML parser)
   */
  async scrapeBuiltIn(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "BuiltIn", jobsFound: 0 }],
    };

    console.log(`[BuiltIn] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * Scrape Arc.dev Remote Jobs (FREE - JSON/HTML)
   */
  async scrapeArcDev(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "ArcDev", jobsFound: 0 }],
    };

    console.log(`[ArcDev] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * Scrape ReactJobBoard (FREE - RSS/JSON)
   */
  async scrapeReactJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "ReactJobs", jobsFound: 0 }],
    };

    console.log(`[ReactJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape VueJobs (FREE - RSS/JSON)
   */
  async scrapeVueJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "VueJobs", jobsFound: 0 }],
    };

    console.log(`[VueJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape PythonJobsHQ (FREE - RSS feed)
   */
  async scrapePythonJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "PythonJobs", jobsFound: 0 }],
    };

    console.log(`[PythonJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape GolangProjects (FREE - HTML parser)
   */
  async scrapeGolangProjects(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "GolangProjects", jobsFound: 0 }],
    };

    console.log(`[GolangProjects] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape RubyNow (FREE - RSS feed)
   */
  async scrapeRubyNow(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "RubyNow", jobsFound: 0 }],
    };

    console.log(`[RubyNow] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape Jobgether (FREE - JSON/RSS)
   */
  async scrapeJobgether(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Jobgether", jobsFound: 0 }],
    };

    console.log(`[Jobgether] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * Scrape Pangian Remote Jobs (FREE - HTML parser)
   */
  async scrapePangian(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Pangian", jobsFound: 0 }],
    };

    console.log(`[Pangian] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape DiversifyTech Job Board (FREE - HTML/JSON)
   */
  async scrapeDiversifyTech(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "DiversifyTech", jobsFound: 0 }],
    };

    console.log(`[DiversifyTech] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape FrontEndFront Jobs (FREE - HTML parser)
   */
  async scrapeFrontEndFront(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "FrontEndFront", jobsFound: 0 }],
    };

    console.log(`[FrontEndFront] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape CrunchBoard Jobs (FREE - HTML/RSS)
   */
  async scrapeCrunchBoard(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "CrunchBoard", jobsFound: 0 }],
    };

    console.log(`[CrunchBoard] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape Coroflot Creative Jobs (FREE - RSS)
   */
  async scrapeCoroflot(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Coroflot", jobsFound: 0 }],
    };

    console.log(`[Coroflot] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape AI-Jobs.net (FREE - RSS feed)
   */
  async scrapeAIJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "AIJobs", jobsFound: 0 }],
    };

    console.log(`[AIJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape CryptoJobsList (FREE - JSON API)
   */
  async scrapeCryptoJobsList(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "CryptoJobsList", jobsFound: 0 }],
    };

    try {
      console.log("[CryptoJobsList] Fetching jobs via RSS feed...");
      const response = await fetch("https://api.cryptojobslist.com/jobs.rss", {
        headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`CryptoJobsList RSS error: ${response.status}`);
      }

      const xmlText = await response.text();
      const items: ScrapedJob[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xmlText)) !== null && items.length < limit) {
        const itemXml = match[1];
        const getTag = (tag: string) => {
          const m = itemXml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}>([\\s\\S]*?)</${tag}>`));
          return (m?.[1] || m?.[2] || "").trim();
        };

        const title = getTag("title");
        if (!title) continue;

        const link = getTag("link");
        const creator = getTag("dc:creator");
        const location = getTag("media:location");
        const description = getTag("description").replace(/<[^>]+>/g, "").slice(0, 2000);

        const text = `${title} ${description}`.toLowerCase();
        if (searchTerm && !searchTerm.toLowerCase().split(" ").some((kw: string) => text.includes(kw))) continue;

        items.push({
          title,
          description,
          companyName: creator || "Unknown Company",
          location: location || "Remote",
          remote: true,
          platform: "CryptoJobsList",
          externalId: `cryptojobslist-${link.split("/").pop() || Date.now()}`,
          sourceUrl: link || "https://cryptojobslist.com",
          postedAt: new Date(),
        });
      }

      result.jobs = items;
      result.success = items.length > 0;
      result.platforms[0].jobsFound = items.length;
      console.log(`[CryptoJobsList] Found ${items.length} jobs from RSS feed`);
    } catch (error: any) {
      console.error("[CryptoJobsList] Error:", error.message);
      result.errors.push(`CryptoJobsList: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape BlockchainJobs (FREE - RSS feed)
   */
  async scrapeBlockchainJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "BlockchainJobs", jobsFound: 0 }],
    };

    console.log(`[BlockchainJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape DevOpsJobs (FREE - RSS feed)
   */
  async scrapeDevOpsJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "DevOpsJobs", jobsFound: 0 }],
    };

    console.log(`[DevOpsJobs] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape UXJobsBoard (FREE - HTML/RSS)
   */
  async scrapeUXJobsBoard(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "UXJobsBoard", jobsFound: 0 }],
    };

    console.log(`[UXJobsBoard] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape SwissDevJobs (FREE - JSON API)
   */
  async scrapeSwissDevJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "SwissDevJobs", jobsFound: 0 }],
    };

    try {
      console.log("[SwissDevJobs] Fetching Swiss developer jobs...");
      const response = await fetch("https://swissdevjobs.ch/api/jobslight", {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        const jobs = Array.isArray(data) ? data : data.jobs || data.data || [];

        for (const job of jobs.slice(0, limit)) {
          const jobName = job.name || job.jobUrl?.replace(/-/g, ' ') || "Developer";
          if (!jobName || jobName.length < 3) continue;
          const companyName = job.company || "Swiss Company";
          let domain: string | undefined;
          try {
            if (job.companyWebsiteLink && job.companyWebsiteLink.includes('.')) {
              const host = job.companyWebsiteLink.startsWith('http')
                ? new URL(job.companyWebsiteLink).hostname.replace('www.', '')
                : job.companyWebsiteLink.replace('www.', '');
              if (host !== 'swissdevjobs.ch' && host !== 'devitjobs.uk') domain = host;
            }
          } catch {}
          const loc = job.cityCategory || job.actualCity || "Switzerland";
          result.jobs.push({
            title: jobName,
            description: job.techCategory || "",
            companyName,
            companyDomain: domain,
            location: loc,
            remote: job.workplace === "Remote" || loc.toLowerCase().includes("remote"),
            platform: "SwissDevJobs",
            externalId: `swissdevjobs-${job._id || Date.now()}-${result.jobs.length}`,
            sourceUrl: `https://swissdevjobs.ch/jobs/${job.jobUrl}`,
            postedAt: job.activeFrom ? new Date(job.activeFrom) : undefined,
            skills: job.technologies || [],
          });
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[SwissDevJobs] Fetched ${result.jobs.length} real jobs`);
    } catch (error: any) {
      console.error("[SwissDevJobs] Error:", error.message);
      result.errors.push(`SwissDevJobs: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape BerlinStartupJobs (FREE - RSS feed)
   */
  async scrapeBerlinStartupJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "BerlinStartupJobs", jobsFound: 0 }],
    };

    try {
      console.log("[BerlinStartupJobs] Fetching Berlin startup jobs via RSS...");
      const response = await fetch("https://berlinstartupjobs.com/feed/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LeadPilot/1.0)",
          "Accept": "application/rss+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const xml = await response.text();
        result.jobs = this.parseGenericRSS(xml, "BerlinStartupJobs", searchTerm, limit);
        for (const job of result.jobs) {
          const atMatch = job.title?.match(/^(.+?)\s+at\s+(.+)$/i);
          if (atMatch) {
            job.title = atMatch[1].trim();
            job.companyName = atMatch[2].trim();
          }
          if (!job.location || job.location === "Remote") {
            job.location = "Berlin, Germany";
          }
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[BerlinStartupJobs] Fetched ${result.jobs.length} real jobs`);
    } catch (error: any) {
      console.error("[BerlinStartupJobs] Error:", error.message);
      result.errors.push(`BerlinStartupJobs: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape TokyoDev (FREE - JSON API)
   */
  async scrapeTokyoDev(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "TokyoDev", jobsFound: 0 }],
    };

    console.log(`[TokyoDev] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * Scrape SmashingMagazine Jobs (FREE - RSS/HTML)
   */
  async scrapeSmashingJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "SmashingJobs", jobsFound: 0 }],
    };

    console.log(`[SmashingJobs] Platform discontinued or unavailable - skipping`);
    return result;
  }

  /**
   * Scrape Gun.io (FREE - HTML/JSON)
   */
  async scrapeGunIO(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "GunIO", jobsFound: 0 }],
    };

    console.log(`[GunIO] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape X-Team Remote Jobs (FREE - HTML parser)
   */
  async scrapeXTeam(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "XTeam", jobsFound: 0 }],
    };

    console.log(`[XTeam] Platform discontinued or blocked - skipping`);

    return result;
  }

  /**
   * Scrape BambooHR ATS Jobs (FREE)
   * BambooHR public company job boards - 100% company name + domain
   */
  async scrapeBambooHR(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "BambooHR", jobsFound: 0 }],
    };

    const bamboohrCompanies: { subdomain: string; name: string; domain: string }[] = [
      { subdomain: "samsara", name: "Samsara", domain: "samsara.com" },
      { subdomain: "grammarly", name: "Grammarly", domain: "grammarly.com" },
      { subdomain: "gusto", name: "Gusto", domain: "gusto.com" },
      { subdomain: "zapier", name: "Zapier", domain: "zapier.com" },
      { subdomain: "gitlab", name: "GitLab", domain: "gitlab.com" },
      { subdomain: "figma", name: "Figma", domain: "figma.com" },
      { subdomain: "webflow", name: "Webflow", domain: "webflow.com" },
      { subdomain: "lucid", name: "Lucid", domain: "lucid.co" },
      { subdomain: "pendo", name: "Pendo", domain: "pendo.io" },
      { subdomain: "calendly", name: "Calendly", domain: "calendly.com" },
    ];

    try {
      console.log(`[BambooHR] Scraping ${bamboohrCompanies.length} companies...`);
      const batchSize = 5;

      for (let i = 0; i < bamboohrCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = bamboohrCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const response = await fetch(
                `https://${company.subdomain}.bamboohr.com/careers/list`,
                {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/html",
                  },
                  signal: AbortSignal.timeout(10000),
                }
              );
              if (!response.ok) return [];
              const data = await response.json();
              const companyJobs: ScrapedJob[] = [];
              const jobList = data.result || [];
              for (const job of jobList.slice(0, 30)) {
                const title = job.jobOpeningName || "";
                if (!title || title.length < 3) continue;
                const loc = job.location ? `${job.location.city || ""}${job.location.state ? ", " + job.location.state : ""}`.trim() : "Remote";
                companyJobs.push({
                  title,
                  companyName: company.name,
                  companyDomain: company.domain,
                  description: job.departmentLabel || "",
                  location: loc || "Remote",
                  remote: title.toLowerCase().includes("remote") || loc.toLowerCase().includes("remote"),
                  platform: "BambooHR",
                  externalId: `bamboohr-${company.subdomain}-${job.id}`,
                  sourceUrl: `https://${company.subdomain}.bamboohr.com/careers/${job.id}`,
                });
              }
              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[BambooHR] Found ${result.jobs.length} jobs from ${bamboohrCompanies.length} companies`);
    } catch (error: any) {
      console.error("[BambooHR] Error:", error.message);
      result.errors.push(`BambooHR: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape JazzHR ATS Jobs (FREE)
   * JazzHR public company job boards - 100% company name + domain
   */
  async scrapeJazzHR(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "JazzHR", jobsFound: 0 }],
    };

    const jazzhrCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "datadog", name: "Datadog", domain: "datadoghq.com" },
      { slug: "veracodeinc", name: "Veracode", domain: "veracode.com" },
      { slug: "stackpath", name: "StackPath", domain: "stackpath.com" },
      { slug: "pagerduty", name: "PagerDuty", domain: "pagerduty.com" },
      { slug: "logdna", name: "LogDNA", domain: "logdna.com" },
      { slug: "voxmedia", name: "Vox Media", domain: "voxmedia.com" },
      { slug: "zoominfo", name: "ZoomInfo", domain: "zoominfo.com" },
      { slug: "clickup", name: "ClickUp", domain: "clickup.com" },
      { slug: "snyk", name: "Snyk", domain: "snyk.io" },
      { slug: "harness", name: "Harness", domain: "harness.io" },
      { slug: "axonius", name: "Axonius", domain: "axonius.com" },
      { slug: "lacework", name: "Lacework", domain: "lacework.com" },
      { slug: "fivetran", name: "Fivetran", domain: "fivetran.com" },
      { slug: "dbt-labs", name: "dbt Labs", domain: "getdbt.com" },
      { slug: "cockroachlabs", name: "Cockroach Labs", domain: "cockroachlabs.com" },
      { slug: "benchling", name: "Benchling", domain: "benchling.com" },
      { slug: "retool", name: "Retool", domain: "retool.com" },
      { slug: "cribl", name: "Cribl", domain: "cribl.io" },
      { slug: "nylas", name: "Nylas", domain: "nylas.com" },
      { slug: "lattice", name: "Lattice", domain: "lattice.com" },
    ];

    try {
      console.log(`[JazzHR] Scraping ${jazzhrCompanies.length} companies...`);
      const batchSize = 5;

      for (let i = 0; i < jazzhrCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = jazzhrCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);
              const response = await fetch(
                `https://${company.slug}.applytojob.com/apply`,
                {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                  },
                  signal: controller.signal,
                }
              );
              clearTimeout(timeout);
              if (!response.ok) return [];
              const html = await response.text();
              const companyJobs: ScrapedJob[] = [];
              const jobRegex = /<a[^>]*href=["']([^"']*\/apply\/([^"'/]+))["'][^>]*>[\s\S]*?<\/a>/gi;
              const titleRegex = /<(?:h[1-6]|div|span|a)[^>]*class=["'][^"']*(?:job[_-]?title|position|opening)[^"']*["'][^>]*>([\s\S]*?)<\/(?:h[1-6]|div|span|a)>/gi;
              const locationRegex = /<(?:div|span)[^>]*class=["'][^"']*(?:location|city)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/gi;

              const jobBlocks = html.split(/class=["'][^"']*job[_-]?(?:listing|item|row|card)/i);
              if (jobBlocks.length > 1) {
                for (let j = 1; j < jobBlocks.length && companyJobs.length < 30; j++) {
                  const block = jobBlocks[j];
                  const linkMatch = block.match(/href=["']([^"']*\/apply\/([^"'/]+))["']/i);
                  const titleMatch = block.match(/<(?:a|h[1-6]|div|span)[^>]*>([\s\S]*?)<\/(?:a|h[1-6]|div|span)>/i);
                  const locMatch = block.match(/(?:location|city)[^"']*["'][^>]*>([\s\S]*?)<\//i);

                  const title = titleMatch ? this.stripHtml(titleMatch[1]).trim() : "";
                  if (!title || title.length < 3) continue;

                  if (searchTerm) {
                    const keywords = searchTerm.toLowerCase().split(' ');
                    if (!keywords.some(kw => title.toLowerCase().includes(kw))) continue;
                  }

                  const loc = locMatch ? this.stripHtml(locMatch[1]).trim() : "Remote";
                  const jobId = linkMatch ? linkMatch[2] : `${j}`;

                  companyJobs.push({
                    title,
                    companyName: company.name,
                    companyDomain: company.domain,
                    description: "",
                    location: loc || "Remote",
                    remote: title.toLowerCase().includes("remote") || loc.toLowerCase().includes("remote"),
                    platform: "JazzHR",
                    externalId: `jazzhr-${company.slug}-${jobId}`,
                    sourceUrl: linkMatch ? `https://${company.slug}.applytojob.com${linkMatch[1]}` : `https://${company.slug}.applytojob.com/apply`,
                  });
                }
              }

              if (companyJobs.length === 0) {
                const allTitles = html.match(/<a[^>]*href=["'][^"']*apply[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
                for (const anchor of allTitles.slice(0, 30)) {
                  const hrefMatch = anchor.match(/href=["']([^"']*)["']/);
                  const textContent = this.stripHtml(anchor).trim();
                  if (!textContent || textContent.length < 3 || textContent.length > 200) continue;

                  if (searchTerm) {
                    const keywords = searchTerm.toLowerCase().split(' ');
                    if (!keywords.some(kw => textContent.toLowerCase().includes(kw))) continue;
                  }

                  companyJobs.push({
                    title: textContent,
                    companyName: company.name,
                    companyDomain: company.domain,
                    description: "",
                    location: "Remote",
                    remote: textContent.toLowerCase().includes("remote"),
                    platform: "JazzHR",
                    externalId: `jazzhr-${company.slug}-${companyJobs.length}`,
                    sourceUrl: hrefMatch ? `https://${company.slug}.applytojob.com${hrefMatch[1]}` : `https://${company.slug}.applytojob.com/apply`,
                  });
                }
              }

              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[JazzHR] Found ${result.jobs.length} jobs from ${jazzhrCompanies.length} companies`);
    } catch (error: any) {
      console.error("[JazzHR] Error:", error.message);
      result.errors.push(`JazzHR: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape iCIMS ATS Jobs (FREE)
   * iCIMS public company job boards - 100% company name + domain
   */
  async scrapeICIMS(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "iCIMS", jobsFound: 0 }],
    };

    const icimsCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "uber", name: "Uber", domain: "uber.com" },
      { slug: "target", name: "Target", domain: "target.com" },
      { slug: "boeing", name: "Boeing", domain: "boeing.com" },
      { slug: "adobe", name: "Adobe", domain: "adobe.com" },
      { slug: "dell", name: "Dell Technologies", domain: "dell.com" },
      { slug: "vmware", name: "VMware", domain: "vmware.com" },
      { slug: "nvidia", name: "NVIDIA", domain: "nvidia.com" },
      { slug: "pinterest", name: "Pinterest", domain: "pinterest.com" },
      { slug: "zillow", name: "Zillow", domain: "zillow.com" },
      { slug: "expedia", name: "Expedia", domain: "expedia.com" },
      { slug: "roblox", name: "Roblox", domain: "roblox.com" },
      { slug: "dropbox", name: "Dropbox", domain: "dropbox.com" },
      { slug: "snap", name: "Snap Inc", domain: "snap.com" },
      { slug: "lyft", name: "Lyft", domain: "lyft.com" },
      { slug: "roku", name: "Roku", domain: "roku.com" },
      { slug: "grubhub", name: "Grubhub", domain: "grubhub.com" },
      { slug: "docusign", name: "DocuSign", domain: "docusign.com" },
      { slug: "ringcentral", name: "RingCentral", domain: "ringcentral.com" },
      { slug: "splunk", name: "Splunk", domain: "splunk.com" },
      { slug: "fortinet", name: "Fortinet", domain: "fortinet.com" },
    ];

    try {
      console.log(`[iCIMS] Scraping ${icimsCompanies.length} companies...`);
      const batchSize = 5;

      for (let i = 0; i < icimsCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = icimsCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);
              const keyword = searchTerm ? encodeURIComponent(searchTerm) : "";
              const url = `https://careers-${company.slug}.icims.com/jobs/search?ss=1&searchKeyword=${keyword}&mobile=false&width=1000&height=500&is498=true&in_iframe=1`;
              const response = await fetch(url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "Accept": "text/html,application/xhtml+xml,application/json",
                },
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (!response.ok) return [];
              const html = await response.text();
              const companyJobs: ScrapedJob[] = [];

              const jobBlockRegex = /<div[^>]*class=["'][^"']*(?:iCIMS_JobsTable|row|listing)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
              const linkRegex = /<a[^>]*href=["']([^"']*\/jobs\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
              const locRegex = /<span[^>]*class=["'][^"']*(?:iCIMS_JobHeaderData|location)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;

              let linkMatch;
              while ((linkMatch = linkRegex.exec(html)) !== null && companyJobs.length < 30) {
                const jobUrl = linkMatch[1];
                const jobId = linkMatch[2];
                const title = this.stripHtml(linkMatch[3]).trim();

                if (!title || title.length < 3 || title.length > 300) continue;
                if (title.toLowerCase().includes("search") || title.toLowerCase().includes("sign in")) continue;

                if (searchTerm) {
                  const keywords = searchTerm.toLowerCase().split(' ');
                  if (!keywords.some(kw => title.toLowerCase().includes(kw))) continue;
                }

                const fullUrl = jobUrl.startsWith("http") ? jobUrl : `https://careers-${company.slug}.icims.com${jobUrl}`;

                companyJobs.push({
                  title,
                  companyName: company.name,
                  companyDomain: company.domain,
                  description: "",
                  location: "Multiple Locations",
                  remote: title.toLowerCase().includes("remote"),
                  platform: "iCIMS",
                  externalId: `icims-${company.slug}-${jobId}`,
                  sourceUrl: fullUrl,
                });
              }

              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[iCIMS] Found ${result.jobs.length} jobs from ${icimsCompanies.length} companies`);
    } catch (error: any) {
      console.error("[iCIMS] Error:", error.message);
      result.errors.push(`iCIMS: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape Talent.com Jobs (FREE - HTML scraping)
   * Major global job aggregator with high company name visibility
   */
  async scrapeTalentCom(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Talent.com", jobsFound: 0 }],
    };

    console.log(`[Talent.com] Platform blocked - skipping`);
    return result;
  }

  /**
   * Scrape NoFluffJobs API (FREE - POST API)
   * European tech job board with salary transparency
   */
  async scrapeNoFluffJobs(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "NoFluffJobs", jobsFound: 0 }],
    };

    try {
      console.log("[NoFluffJobs] Fetching jobs from API...");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const criteriaSearch: any = {};
      if (searchTerm) {
        criteriaSearch.requirement = [searchTerm];
      }

      const response = await fetch(
        "https://nofluffjobs.com/api/search/posting?salaryCurrency=USD&salaryPeriod=month&region=world",
        {
          method: "POST",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ page: 1, criteriaSearch }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        result.errors.push(`NoFluffJobs API error: ${response.status}`);
        result.platforms[0].error = `HTTP ${response.status}`;
        return result;
      }

      const data = await response.json();
      const postings = data.postings || [];

      const jobs: ScrapedJob[] = postings.slice(0, limit).map((posting: any) => {
        const companyName = posting.name || "";
        let companyDomain: string | undefined;
        if (companyName) {
          const sanitized = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (sanitized.length > 2) {
            companyDomain = `${sanitized}.com`;
          }
        }

        let budgetMin: number | undefined;
        let budgetMax: number | undefined;
        if (posting.salary) {
          budgetMin = posting.salary.from || undefined;
          budgetMax = posting.salary.to || undefined;
        }

        const locationStr = posting.location?.places?.map((p: any) => p.city || p.country).join(", ") || "Remote";

        return {
          externalId: `nofluffjobs-${posting.url || posting.id || Date.now()}`,
          platform: "NoFluffJobs",
          title: posting.title || "Unknown Position",
          description: posting.category ? `${posting.category}${posting.seniority ? " - " + posting.seniority.join(", ") : ""}` : "",
          companyName: companyName || undefined,
          companyDomain,
          location: locationStr,
          remote: posting.location?.fullyRemote || posting.title?.toLowerCase().includes("remote") || false,
          budgetMin,
          budgetMax,
          budgetType: budgetMin || budgetMax ? "monthly" : undefined,
          skills: posting.tiles?.values || [],
          sourceUrl: `https://nofluffjobs.com/job/${posting.url}`,
          postedAt: posting.posted ? new Date(posting.posted) : undefined,
        };
      });

      result.success = jobs.length > 0;
      result.jobs = jobs;
      result.platforms[0].jobsFound = jobs.length;
      console.log(`[NoFluffJobs] Fetched ${jobs.length} real jobs`);
    } catch (error: any) {
      console.error("[NoFluffJobs] API error:", error.message);
      result.errors.push(`NoFluffJobs error: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Scrape Jobvite ATS Jobs (FREE)
   * Jobvite public company job boards with JSON API
   */
  async scrapeJobvite(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Jobvite", jobsFound: 0 }],
    };

    const jobviteCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "salesforce-heroku", name: "Heroku (Salesforce)", domain: "heroku.com" },
      { slug: "twitch", name: "Twitch", domain: "twitch.tv" },
      { slug: "coursera", name: "Coursera", domain: "coursera.org" },
      { slug: "zendesk", name: "Zendesk", domain: "zendesk.com" },
      { slug: "okta", name: "Okta", domain: "okta.com" },
      { slug: "paloaltonetworks", name: "Palo Alto Networks", domain: "paloaltonetworks.com" },
      { slug: "logitech", name: "Logitech", domain: "logitech.com" },
      { slug: "unity", name: "Unity Technologies", domain: "unity.com" },
      { slug: "elastic", name: "Elastic", domain: "elastic.co" },
      { slug: "nutanix", name: "Nutanix", domain: "nutanix.com" },
      { slug: "procore", name: "Procore", domain: "procore.com" },
      { slug: "qualtrics", name: "Qualtrics", domain: "qualtrics.com" },
      { slug: "rubrik", name: "Rubrik", domain: "rubrik.com" },
      { slug: "tanium", name: "Tanium", domain: "tanium.com" },
      { slug: "netskope", name: "Netskope", domain: "netskope.com" },
    ];

    try {
      console.log(`[Jobvite] Scraping ${jobviteCompanies.length} companies...`);
      const batchSize = 5;

      for (let i = 0; i < jobviteCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = jobviteCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);
              const query = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : "";
              const response = await fetch(
                `https://jobs.jobvite.com/${company.slug}/search.json${query}`,
                {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                  },
                  signal: controller.signal,
                }
              );
              clearTimeout(timeout);
              if (!response.ok) {
                const htmlResponse = await fetch(
                  `https://jobs.jobvite.com/${company.slug}/search${query ? query : ""}`,
                  {
                    headers: {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                      "Accept": "text/html",
                    },
                    signal: AbortSignal.timeout(15000),
                  }
                );
                if (!htmlResponse.ok) return [];
                const html = await htmlResponse.text();
                const companyJobs: ScrapedJob[] = [];
                const linkRegex = /<a[^>]*href=["']([^"']*\/job\/([^"'/]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
                let match;
                while ((match = linkRegex.exec(html)) !== null && companyJobs.length < 30) {
                  const title = this.stripHtml(match[3]).trim();
                  if (!title || title.length < 3 || title.length > 300) continue;

                  companyJobs.push({
                    title,
                    companyName: company.name,
                    companyDomain: company.domain,
                    description: "",
                    location: "Multiple Locations",
                    remote: title.toLowerCase().includes("remote"),
                    platform: "Jobvite",
                    externalId: `jobvite-${company.slug}-${match[2]}`,
                    sourceUrl: match[1].startsWith("http") ? match[1] : `https://jobs.jobvite.com${match[1]}`,
                  });
                }
                return companyJobs;
              }

              const data = await response.json();
              const companyJobs: ScrapedJob[] = [];
              const requisitions = data.requisitions || data.jobs || data.results || [];

              for (const job of (Array.isArray(requisitions) ? requisitions : []).slice(0, 30)) {
                const title = job.title || job.jobTitle || "";
                if (!title || title.length < 3) continue;

                if (searchTerm) {
                  const keywords = searchTerm.toLowerCase().split(' ');
                  const searchText = `${title} ${job.description || ""} ${job.category || ""}`.toLowerCase();
                  if (!keywords.some(kw => searchText.includes(kw))) continue;
                }

                const loc = job.location || job.city || "Multiple Locations";
                const jobId = job.id || job.requisitionId || job.eId || `${companyJobs.length}`;

                companyJobs.push({
                  title,
                  companyName: company.name,
                  companyDomain: company.domain,
                  description: job.briefDescription || job.description || "",
                  location: loc,
                  remote: title.toLowerCase().includes("remote") || loc.toLowerCase().includes("remote"),
                  platform: "Jobvite",
                  externalId: `jobvite-${company.slug}-${jobId}`,
                  sourceUrl: job.detailUrl || job.applyUrl || `https://jobs.jobvite.com/${company.slug}/job/${jobId}`,
                });
              }

              return companyJobs;
            } catch { return []; }
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") result.jobs.push(...r.value);
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Jobvite] Found ${result.jobs.length} jobs from ${jobviteCompanies.length} companies`);
    } catch (error: any) {
      console.error("[Jobvite] Error:", error.message);
      result.errors.push(`Jobvite: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Bayt.com - Middle East job board (HTML scraping)
   * FREE - No API key required
   */
  async scrapeBayt(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Bayt", jobsFound: 0 }],
    };

    try {
      console.log("[Bayt] Fetching jobs from HTML...");
      
      const urlPath = searchTerm 
        ? searchTerm.replace(/\s+/g, '-') + '-'
        : '';
      const url = `https://www.bayt.com/en/international/jobs/${urlPath}jobs/`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Bayt HTML error: ${response.status}`);
      }

      const html = await response.text();
      
      // Extract job listings from job card elements
      const jobCardRegex = /<div[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      // More targeted regex patterns for job data
      const titleRegex = /<h2[^>]*>([^<]+)<\/h2>/i;
      const companyRegex = /<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)<\/span>/i;
      const locationRegex = /<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i;
      const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>/i;

      const jobMatches = html.matchAll(/<a[^>]*href="(https:\/\/www\.bayt\.com\/en\/international\/jobs\/[^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi);
      
      for (const jobMatch of jobMatches) {
        if (count >= limit) break;
        
        const jobUrl = jobMatch[1];
        const jobTitle = this.stripHtml(jobMatch[2]).trim();
        
        if (!jobTitle || jobTitle.length < 3) continue;

        // Filter by search term if provided
        if (searchTerm) {
          const keywords = searchTerm.toLowerCase().split(' ');
          if (!keywords.some(kw => jobTitle.toLowerCase().includes(kw))) {
            continue;
          }
        }

        // Extract company and location from surrounding context
        // Look for patterns in the job listing card
        const jobCardMatch = html.substring(Math.max(0, jobMatch.index - 500), jobMatch.index + 500);
        const companyMatch = jobCardMatch.match(/<span[^>]*>([^<]{2,50}?)<\/span>/i);
        const locationMatch = jobCardMatch.match(/Location[:\s]+([^<]+)</i) || 
                            jobCardMatch.match(/<span[^>]*>([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)<\/span>/);

        const companyName = companyMatch ? this.stripHtml(companyMatch[1]).trim() : "Bayt Listing";
        const location = locationMatch ? this.stripHtml(locationMatch[1]).trim() : "Middle East";

        result.jobs.push({
          title: jobTitle,
          companyName: companyName || undefined,
          location,
          remote: false,
          platform: "Bayt",
          externalId: `bayt-${Buffer.from(jobUrl).toString("base64").slice(0, 20)}`,
          sourceUrl: jobUrl,
        });
        
        count++;
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Bayt] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[Bayt] Error:", error.message);
      result.errors.push(`Bayt: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Relocate.me - Tech relocation jobs (JSON API with RSS fallback)
   * FREE - No API key required
   */
  async scrapeRelocateMe(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "RelocateMe", jobsFound: 0 }],
    };

    try {
      console.log("[RelocateMe] Fetching jobs from API...");
      
      // Try JSON API first
      let apiUrl = "https://relocate.me/api/jobs";
      if (searchTerm) {
        apiUrl += `?search=${encodeURIComponent(searchTerm)}`;
      }

      let response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        try {
          const data = await response.json();
          const jobs = Array.isArray(data) ? data : data.jobs || [];

          for (const job of jobs.slice(0, limit)) {
            result.jobs.push({
              title: job.title || job.job_title || "Unknown Position",
              description: job.description || job.job_description || undefined,
              companyName: job.company || job.company_name || undefined,
              location: job.location || job.city || "Multiple Locations",
              remote: job.remote === true || job.remote === "true",
              platform: "RelocateMe",
              externalId: `relocateme-${job.id || Buffer.from(job.title || "").toString("base64").slice(0, 20)}`,
              sourceUrl: job.url || job.link || `https://relocate.me`,
              budgetMin: job.salary_min || undefined,
              budgetMax: job.salary_max || undefined,
              budgetType: job.salary_min || job.salary_max ? "annual" : undefined,
              postedAt: job.posted_at ? new Date(job.posted_at) : undefined,
            });
          }

          if (result.jobs.length > 0) {
            result.success = true;
            result.platforms[0].jobsFound = result.jobs.length;
            console.log(`[RelocateMe] Found ${result.jobs.length} jobs via JSON API`);
            return result;
          }
        } catch (jsonError) {
          console.log("[RelocateMe] JSON parsing failed, trying RSS feed...");
        }
      }

      // Fallback to RSS feed
      console.log("[RelocateMe] Trying RSS feed...");
      response = await fetch("https://relocate.me/feed", {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/rss+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const xml = await response.text();
        result.jobs = this.parseGenericRSS(xml, "RelocateMe", searchTerm, limit);
        result.success = result.jobs.length > 0;
        result.platforms[0].jobsFound = result.jobs.length;
        console.log(`[RelocateMe] Found ${result.jobs.length} jobs via RSS feed`);
      } else {
        throw new Error(`RelocateMe API error: ${response.status}`);
      }
    } catch (error: any) {
      console.error("[RelocateMe] Error:", error.message);
      result.errors.push(`RelocateMe: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Dice REST API Scraper - Tech jobs from Dice.com
   * FREE - Public search API
   */
  async scrapeDiceAPI(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Dice", jobsFound: 0 }],
    };

    try {
      console.log("[Dice] Fetching jobs from Dice API...");
      const query = searchTerm || "developer";
      const response = await fetch(
        `https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?q=${encodeURIComponent(query)}&countryCode2=US&page=1&pageSize=${limit}`,
        {
          headers: {
            "x-api-key": "1YAt0R9wBg4WfsF9VB2778F5CHLAPMVW3WAZcKd8",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(`Dice API error: ${response.status}`);
      }

      const data = await response.json();
      const diceJobs = data.data || [];

      for (const job of diceJobs.slice(0, limit)) {
        const title = job.title || "Untitled Position";
        const summary = job.summary || "";
        const locationDisplay = job.jobLocation?.displayName || "";
        const isRemote = /remote/i.test(title) || /remote/i.test(locationDisplay);

        let budgetMin: number | undefined;
        let budgetMax: number | undefined;
        const salaryMatch = `${title} ${summary}`.match(/\$?([\d,]+)\s*[-to]+\s*\$?([\d,]+)/i);
        if (salaryMatch) {
          budgetMin = parseInt(salaryMatch[1].replace(/,/g, ''));
          budgetMax = parseInt(salaryMatch[2].replace(/,/g, ''));
        }

        result.jobs.push({
          externalId: `dice-${job.id}`,
          platform: "Dice",
          title,
          description: this.stripHtml(summary),
          companyName: job.companyName || undefined,
          location: locationDisplay || "United States",
          remote: isRemote,
          budgetMin,
          budgetMax,
          budgetType: budgetMin || budgetMax ? "annual" : undefined,
          sourceUrl: job.detailsPageUrl || `https://www.dice.com/job-detail/${job.id}`,
          postedAt: job.postedDate ? new Date(job.postedDate) : undefined,
          skills: this.extractSkillsFromContent(title + ' ' + summary),
        });
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Dice] Fetched ${result.jobs.length} real jobs`);
    } catch (error: any) {
      console.error("[Dice] Error:", error.message);
      result.errors.push(`Dice: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * LaraJobs API Scraper - Laravel/PHP jobs
   * FREE - No API key required
   */
  async scrapeLaraJobs(searchTerm?: string, limit: number = 25): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "LaraJobs", jobsFound: 0 }],
    };

    try {
      console.log("[LaraJobs] Fetching jobs from API...");
      const response = await fetch("https://larajobs.com/api/jobs", {
        headers: {
          "User-Agent": "LeadPilot/1.0 (Job Aggregator)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`LaraJobs API error: ${response.status}`);
      }

      const data = await response.json();
      const laraJobs = Array.isArray(data) ? data : (data.jobs || data.data || []);

      let filteredJobs = laraJobs;
      if (searchTerm) {
        const keywords = searchTerm.toLowerCase().split(' ');
        filteredJobs = laraJobs.filter((job: any) => {
          const searchText = `${job.title || ''} ${job.organization || ''}`.toLowerCase();
          return keywords.some((kw: string) => searchText.includes(kw));
        });
      }

      for (const job of filteredJobs.slice(0, limit)) {
        result.jobs.push({
          externalId: `larajobs-${job.id}`,
          platform: "LaraJobs",
          title: job.title || "Untitled Position",
          companyName: job.organization || undefined,
          location: job.location || "Remote",
          remote: /remote/i.test(job.location || '') || /remote/i.test(job.type || ''),
          sourceUrl: job.url || `https://larajobs.com`,
          skills: this.extractSkillsFromContent(job.title || ''),
        });
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[LaraJobs] Fetched ${result.jobs.length} real jobs`);
    } catch (error: any) {
      console.error("[LaraJobs] Error:", error.message);
      result.errors.push(`LaraJobs: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Recruitee ATS Scraper - Jobs from companies using Recruitee
   * FREE - Public API
   */
  async scrapeRecruitee(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Recruitee", jobsFound: 0 }],
    };

    const recruiteeCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "docplanner", name: "Docplanner", domain: "docplanner.com" },
      { slug: "treatwell", name: "Treatwell", domain: "treatwell.com" },
      { slug: "lunar", name: "Lunar", domain: "lunar.app" },
      { slug: "pleo", name: "Pleo", domain: "pleo.io" },
      { slug: "bookingcom", name: "Booking.com", domain: "booking.com" },
      { slug: "getsafe", name: "Getsafe", domain: "hellogetsafe.com" },
      { slug: "contentful", name: "Contentful", domain: "contentful.com" },
      { slug: "personio", name: "Personio", domain: "personio.de" },
      { slug: "taxfix", name: "Taxfix", domain: "taxfix.de" },
      { slug: "trade-republic", name: "Trade Republic", domain: "traderepublic.com" },
      { slug: "gorillas", name: "Gorillas", domain: "gorillas.io" },
      { slug: "flixbus", name: "FlixBus", domain: "flixbus.com" },
      { slug: "omio", name: "Omio", domain: "omio.com" },
      { slug: "scout24", name: "Scout24", domain: "scout24.com" },
      { slug: "idealo", name: "Idealo", domain: "idealo.de" },
      { slug: "trustpilot", name: "Trustpilot", domain: "trustpilot.com" },
      { slug: "factorial", name: "Factorial", domain: "factorial.co" },
      { slug: "kahoot", name: "Kahoot", domain: "kahoot.com" },
      { slug: "lottie", name: "Lottie", domain: "lottie.org" },
      { slug: "homerun", name: "Homerun", domain: "homerun.co" },
      { slug: "babbel", name: "Babbel", domain: "babbel.com" },
      { slug: "podium", name: "Podium", domain: "podium.com" },
      { slug: "spendesk", name: "Spendesk", domain: "spendesk.com" },
      { slug: "testgorilla", name: "TestGorilla", domain: "testgorilla.com" },
      { slug: "remote", name: "Remote.com", domain: "remote.com" },
      { slug: "multiverse", name: "Multiverse", domain: "multiverse.io" },
      { slug: "snappcar", name: "SnappCar", domain: "snappcar.com" },
      { slug: "travelperkvacancies", name: "TravelPerk", domain: "travelperk.com" },
      { slug: "yousign", name: "Yousign", domain: "yousign.com" },
      { slug: "preply", name: "Preply", domain: "preply.com" },
      { slug: "malt", name: "Malt", domain: "malt.com" },
      { slug: "commercetools", name: "Commercetools", domain: "commercetools.com" },
      { slug: "mollie", name: "Mollie", domain: "mollie.com" },
      { slug: "messagebird", name: "MessageBird", domain: "messagebird.com" },
      { slug: "backmarket", name: "Back Market", domain: "backmarket.com" },
      { slug: "getaround", name: "Getaround", domain: "getaround.com" },
      { slug: "doctolib", name: "Doctolib", domain: "doctolib.fr" },
      { slug: "algolia", name: "Algolia", domain: "algolia.com" },
      { slug: "mirakl", name: "Mirakl", domain: "mirakl.com" },
      { slug: "contentsquare", name: "Contentsquare", domain: "contentsquare.com" },
      { slug: "dataiku", name: "Dataiku", domain: "dataiku.com" },
      { slug: "aircall", name: "Aircall", domain: "aircall.io" },
      { slug: "swile", name: "Swile", domain: "swile.co" },
      { slug: "qonto", name: "Qonto", domain: "qonto.com" },
      { slug: "sennder", name: "Sennder", domain: "sennder.com" },
      { slug: "getir", name: "Getir", domain: "getir.com" },
      { slug: "tier", name: "TIER", domain: "tier.app" },
      { slug: "sumup", name: "SumUp", domain: "sumup.com" },
      { slug: "onfido", name: "Onfido", domain: "onfido.com" },
      { slug: "gympass", name: "Gympass", domain: "gympass.com" },
    ];

    try {
      console.log(`[Recruitee] Scraping ${recruiteeCompanies.length} companies...`);
      const batchSize = 5;

      for (let i = 0; i < recruiteeCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = recruiteeCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const response = await fetch(
                `https://${company.slug}.recruitee.com/api/offers/`,
                {
                  headers: { "Accept": "application/json" },
                  signal: AbortSignal.timeout(10000),
                }
              );
              if (!response.ok) return [];
              const data = await response.json();
              const companyJobs: ScrapedJob[] = [];
              for (const job of (data.offers || []).slice(0, 15)) {
                const text = `${job.title || ""} ${job.department || ""}`.toLowerCase();
                if (searchTerm) {
                  const keywords = searchTerm.toLowerCase().split(' ');
                  if (!keywords.some(kw => text.includes(kw))) continue;
                }
                const location = job.location || job.city || "";
                companyJobs.push({
                  externalId: `recruitee-${company.slug}-${job.id}`,
                  platform: "Recruitee",
                  title: job.title || "Untitled Position",
                  companyName: company.name,
                  companyDomain: company.domain,
                  location: location || "Remote",
                  remote: /remote/i.test(location) || /remote/i.test(job.title || ""),
                  sourceUrl: job.careers_url || `https://${company.slug}.recruitee.com/o/${job.slug || job.id}`,
                  skills: this.extractSkillsFromContent(job.title || ''),
                });
              }
              return companyJobs;
            } catch {
              return [];
            }
          })
        );

        for (const batchResult of batchResults) {
          if (batchResult.status === "fulfilled") {
            result.jobs.push(...batchResult.value);
          }
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Recruitee] Fetched ${result.jobs.length} real jobs from ${recruiteeCompanies.length} companies`);
    } catch (error: any) {
      console.error("[Recruitee] Error:", error.message);
      result.errors.push(`Recruitee: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Workable ATS Scraper - Jobs from companies using Workable
   * FREE - Public API
   */
  async scrapeWorkable(searchTerm?: string, limit: number = 100): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Workable", jobsFound: 0 }],
    };

    const workableCompanies: { slug: string; name: string; domain: string }[] = [
      { slug: "twitch", name: "Twitch", domain: "twitch.tv" },
      { slug: "evernote", name: "Evernote", domain: "evernote.com" },
      { slug: "vinted", name: "Vinted", domain: "vinted.com" },
      { slug: "pipedrive", name: "Pipedrive", domain: "pipedrive.com" },
      { slug: "bolt-2", name: "Bolt", domain: "bolt.eu" },
      { slug: "transfergo", name: "TransferGo", domain: "transfergo.com" },
      { slug: "hostinger", name: "Hostinger", domain: "hostinger.com" },
      { slug: "kilo-health", name: "Kilo Health", domain: "kilo.health" },
      { slug: "nord-security", name: "Nord Security", domain: "nordsecurity.com" },
      { slug: "vero", name: "Vero", domain: "getvero.com" },
      { slug: "toggl", name: "Toggl", domain: "toggl.com" },
      { slug: "taxjar", name: "TaxJar", domain: "taxjar.com" },
      { slug: "deel-2", name: "Deel", domain: "deel.com" },
      { slug: "luno", name: "Luno", domain: "luno.com" },
      { slug: "taxbit", name: "TaxBit", domain: "taxbit.com" },
      { slug: "chainalysis", name: "Chainalysis", domain: "chainalysis.com" },
      { slug: "fireblocks", name: "Fireblocks", domain: "fireblocks.com" },
      { slug: "0x", name: "0x Labs", domain: "0x.org" },
      { slug: "alchemy-5", name: "Alchemy", domain: "alchemy.com" },
      { slug: "figment", name: "Figment", domain: "figment.io" },
      { slug: "blockdaemon", name: "Blockdaemon", domain: "blockdaemon.com" },
      { slug: "consensys", name: "ConsenSys", domain: "consensys.net" },
      { slug: "polygon-technology", name: "Polygon", domain: "polygon.technology" },
      { slug: "immutable", name: "Immutable", domain: "immutable.com" },
      { slug: "animoca-brands", name: "Animoca Brands", domain: "animocabrands.com" },
      { slug: "chiliz", name: "Chiliz", domain: "chiliz.com" },
      { slug: "phantom", name: "Phantom", domain: "phantom.app" },
      { slug: "dapper-labs", name: "Dapper Labs", domain: "dapperlabs.com" },
      { slug: "nansen-2", name: "Nansen", domain: "nansen.ai" },
      { slug: "messari", name: "Messari", domain: "messari.io" },
      { slug: "mural", name: "Mural", domain: "mural.co" },
      { slug: "productboard", name: "Productboard", domain: "productboard.com" },
      { slug: "maze", name: "Maze", domain: "maze.co" },
      { slug: "userlytics", name: "Userlytics", domain: "userlytics.com" },
      { slug: "dovetail-3", name: "Dovetail", domain: "dovetail.com" },
      { slug: "hotjar", name: "Hotjar", domain: "hotjar.com" },
      { slug: "typeform", name: "Typeform", domain: "typeform.com" },
      { slug: "unbounce", name: "Unbounce", domain: "unbounce.com" },
      { slug: "omnisend", name: "Omnisend", domain: "omnisend.com" },
      { slug: "mailerlite", name: "MailerLite", domain: "mailerlite.com" },
      { slug: "sendpulse", name: "SendPulse", domain: "sendpulse.com" },
      { slug: "customer-io", name: "Customer.io", domain: "customer.io" },
      { slug: "close", name: "Close", domain: "close.com" },
      { slug: "copper", name: "Copper", domain: "copper.com" },
      { slug: "freshworks", name: "Freshworks", domain: "freshworks.com" },
      { slug: "outreach", name: "Outreach", domain: "outreach.io" },
      { slug: "salesloft", name: "SalesLoft", domain: "salesloft.com" },
      { slug: "gong-io", name: "Gong", domain: "gong.io" },
      { slug: "chorus-ai", name: "Chorus.ai", domain: "chorus.ai" },
      { slug: "seismic", name: "Seismic", domain: "seismic.com" },
    ];

    try {
      console.log(`[Workable] Scraping ${workableCompanies.length} companies...`);
      const batchSize = 5;

      for (let i = 0; i < workableCompanies.length && result.jobs.length < limit; i += batchSize) {
        const batch = workableCompanies.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (company) => {
            try {
              const response = await fetch(
                `https://apply.workable.com/api/v3/accounts/${company.slug}/jobs`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                  },
                  body: JSON.stringify({ query: "", location: [], department: [], worktype: [] }),
                  signal: AbortSignal.timeout(10000),
                }
              );
              if (!response.ok) return [];
              const data = await response.json();
              const companyJobs: ScrapedJob[] = [];
              for (const job of (data.results || []).slice(0, 15)) {
                const text = `${job.title || ""} ${job.department || ""}`.toLowerCase();
                if (searchTerm) {
                  const keywords = searchTerm.toLowerCase().split(' ');
                  if (!keywords.some(kw => text.includes(kw))) continue;
                }
                const location = job.location ? [job.location.city, job.location.region, job.location.country].filter(Boolean).join(", ") : "";
                const isRemote = job.location?.telecommuting || /remote/i.test(job.title || "");
                companyJobs.push({
                  externalId: `workable-${company.slug}-${job.shortcode || job.id}`,
                  platform: "Workable",
                  title: job.title || "Untitled Position",
                  companyName: company.name,
                  companyDomain: company.domain,
                  location: location || "Remote",
                  remote: isRemote,
                  sourceUrl: job.shortlink || `https://apply.workable.com/${company.slug}/j/${job.shortcode || job.id}/`,
                  postedAt: job.published ? new Date(job.published) : undefined,
                  skills: this.extractSkillsFromContent(job.title || ''),
                });
              }
              return companyJobs;
            } catch {
              return [];
            }
          })
        );

        for (const batchResult of batchResults) {
          if (batchResult.status === "fulfilled") {
            result.jobs.push(...batchResult.value);
          }
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Workable] Fetched ${result.jobs.length} real jobs from ${workableCompanies.length} companies`);
    } catch (error: any) {
      console.error("[Workable] Error:", error.message);
      result.errors.push(`Workable: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * EuroTechJobs HTML Scraper - European tech jobs
   * FREE - No API key required
   */
  async scrapeEuroTechJobs(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "EuroTechJobs", jobsFound: 0 }],
    };

    try {
      console.log("[EuroTechJobs] Fetching European tech jobs...");
      const query = searchTerm || "developer";
      const response = await fetch(
        `https://www.eurotechjobs.com/job_search?search=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html",
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(`EuroTechJobs error: ${response.status}`);
      }

      const html = await response.text();
      const jobLinkRegex = /<a[^>]*href="(\/job\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      const seen = new Set<string>();

      while ((match = jobLinkRegex.exec(html)) !== null && result.jobs.length < limit) {
        const jobPath = match[1];
        const linkContent = this.stripHtml(match[2]).trim();

        if (!linkContent || linkContent.length < 5 || seen.has(jobPath)) continue;
        seen.add(jobPath);

        const surroundingText = html.substring(
          Math.max(0, match.index - 500),
          Math.min(html.length, match.index + match[0].length + 500)
        );

        let companyName: string | undefined;
        const companyMatch = surroundingText.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
          surroundingText.match(/<(?:span|div|p)[^>]*>(?:at|by|@)\s+([^<]+)<\//i);
        if (companyMatch) {
          companyName = this.stripHtml(companyMatch[1]).trim();
        }

        let location: string | undefined;
        const locationMatch = surroundingText.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i);
        if (locationMatch) {
          location = this.stripHtml(locationMatch[1]).trim();
        }

        const isRemote = /remote/i.test(linkContent) || /remote/i.test(location || "");

        result.jobs.push({
          externalId: `eurotechjobs-${jobPath.replace(/[^a-zA-Z0-9]/g, '-')}`,
          platform: "EuroTechJobs",
          title: linkContent,
          companyName,
          location: location || "Europe",
          remote: isRemote,
          sourceUrl: `https://www.eurotechjobs.com${jobPath}`,
          skills: this.extractSkillsFromContent(linkContent),
        });
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[EuroTechJobs] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[EuroTechJobs] Error:", error.message);
      result.errors.push(`EuroTechJobs: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  async scrapeWuzzuf(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Wuzzuf", jobsFound: 0 }],
    };

    try {
      console.log("[Wuzzuf] Fetching jobs from Wuzzuf...");
      const query = searchTerm ? encodeURIComponent(searchTerm) : "developer";
      const response = await fetch(
        `https://wuzzuf.net/search/jobs/?q=${query}&a=hpb&start=0`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
          },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!response.ok) {
        throw new Error(`Wuzzuf HTTP ${response.status}`);
      }

      const html = await response.text();
      
      const jobCardRegex = /href="(\/jobs\/p\/[^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?class="css-ipsyv7"[^>]*>([^<]*)/g;
      let match;
      const seen = new Set<string>();
      
      while ((match = jobCardRegex.exec(html)) !== null && result.jobs.length < limit) {
        const [, url, title, company] = match;
        if (!title || seen.has(url)) continue;
        seen.add(url);
        
        const cleanTitle = this.stripHtml(title).trim();
        const cleanCompany = company ? this.stripHtml(company).replace(/\s*-\s*$/, '').trim() : undefined;
        
        if (searchTerm) {
          const keywords = searchTerm.toLowerCase().split(' ');
          const searchText = `${cleanTitle} ${cleanCompany || ''}`.toLowerCase();
          if (!keywords.some(kw => searchText.includes(kw))) continue;
        }

        result.jobs.push({
          externalId: `wuzzuf-${url.split('/').pop() || Date.now()}`,
          platform: "Wuzzuf",
          title: cleanTitle,
          description: `Job posted on Wuzzuf (MENA region). Company: ${cleanCompany || 'Unknown'}`,
          companyName: cleanCompany || undefined,
          location: "MENA Region",
          remote: /remote/i.test(cleanTitle),
          sourceUrl: `https://wuzzuf.net${url}`,
        });
      }

      if (result.jobs.length === 0) {
        const titleRegex = /class="css-o171kl"[^>]*href="(\/jobs\/p\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        let fallbackMatch;
        while ((fallbackMatch = titleRegex.exec(html)) !== null && result.jobs.length < limit) {
          const [, url2, title2] = fallbackMatch;
          if (!title2) continue;
          const cleanTitle2 = this.stripHtml(title2).trim();
          
          result.jobs.push({
            externalId: `wuzzuf-${url2?.split('/').pop() || Date.now()}-${result.jobs.length}`,
            platform: "Wuzzuf",
            title: cleanTitle2,
            description: `Job posted on Wuzzuf (MENA region)`,
            location: "MENA Region",
            remote: /remote/i.test(cleanTitle2),
            sourceUrl: url2 ? `https://wuzzuf.net${url2}` : undefined,
          });
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Wuzzuf] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[Wuzzuf] Error:", error.message);
      result.errors.push(`Wuzzuf: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  async scrapeWorkInStartups(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "WorkInStartups", jobsFound: 0 }],
    };

    try {
      console.log("[WorkInStartups] Fetching jobs...");
      const query = searchTerm ? encodeURIComponent(searchTerm) : "developer";
      const response = await fetch(
        `https://workinstartups.com/job-board/search?q=${query}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(`WorkInStartups HTTP ${response.status}`);
      }

      const html = await response.text();
      
      const jobRegex = /<a[^>]*href="(\/job-board\/job\/\d+[^"]*)"[^>]*>[\s\S]*?<h\d[^>]*>([^<]+)<\/h\d>[\s\S]*?(?:company[^>]*>([^<]+))?/gi;
      let match;
      
      while ((match = jobRegex.exec(html)) !== null && result.jobs.length < limit) {
        const [, url, title, company] = match;
        if (!title) continue;
        
        const cleanTitle = this.stripHtml(title).trim();
        const cleanCompany = company ? this.stripHtml(company).trim() : undefined;

        result.jobs.push({
          externalId: `workinstartups-${url.split('/').pop() || Date.now()}`,
          platform: "WorkInStartups",
          title: cleanTitle,
          description: `Startup job from WorkInStartups UK. ${cleanCompany ? 'Company: ' + cleanCompany : ''}`,
          companyName: cleanCompany,
          location: "United Kingdom",
          remote: /remote/i.test(cleanTitle),
          sourceUrl: `https://workinstartups.com${url}`,
        });
      }

      if (result.jobs.length === 0) {
        const linkRegex = /href="(\/job-board\/job\/\d+[^"]*)"[^>]*>([^<]+)/gi;
        while ((match = linkRegex.exec(html)) !== null && result.jobs.length < limit) {
          const cleanTitle = this.stripHtml(match[2]).trim();
          if (cleanTitle.length < 5 || /view|apply|more|details/i.test(cleanTitle)) continue;
          
          result.jobs.push({
            externalId: `workinstartups-${match[1].split('/').pop() || Date.now()}-${result.jobs.length}`,
            platform: "WorkInStartups",
            title: cleanTitle,
            description: `Startup job from WorkInStartups UK`,
            location: "United Kingdom",
            remote: /remote/i.test(cleanTitle),
            sourceUrl: `https://workinstartups.com${match[1]}`,
          });
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[WorkInStartups] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[WorkInStartups] Error:", error.message);
      result.errors.push(`WorkInStartups: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  async scrapeNodesk(searchTerm?: string, limit: number = 50): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [{ name: "Nodesk", jobsFound: 0 }],
    };

    try {
      console.log("[Nodesk] Fetching remote jobs...");
      const response = await fetch(
        `https://nodesk.co/remote-jobs/`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(`Nodesk HTTP ${response.status}`);
      }

      const html = await response.text();
      
      const jobRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*class="[^"]*job[^"]*"[^>]*>[\s\S]*?<(?:h\d|span|div)[^>]*>([^<]+)/gi;
      let match;
      
      while ((match = jobRegex.exec(html)) !== null && result.jobs.length < limit) {
        const [, url, title] = match;
        if (!title) continue;
        
        const cleanTitle = this.stripHtml(title).trim();
        if (cleanTitle.length < 5) continue;

        if (searchTerm) {
          const keywords = searchTerm.toLowerCase().split(' ');
          const searchText = cleanTitle.toLowerCase();
          if (!keywords.some(kw => searchText.includes(kw))) continue;
        }

        result.jobs.push({
          externalId: `nodesk-${Date.now()}-${result.jobs.length}`,
          platform: "Nodesk",
          title: cleanTitle,
          description: `Remote job from Nodesk`,
          location: "Remote",
          remote: true,
          sourceUrl: url,
        });
      }

      if (result.jobs.length === 0) {
        const allLinksRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]{10,80})<\/a>/gi;
        while ((match = allLinksRegex.exec(html)) !== null && result.jobs.length < limit) {
          const cleanTitle = this.stripHtml(match[2]).trim();
          if (!/developer|engineer|designer|manager|analyst|specialist|hubspot|marketing/i.test(cleanTitle)) continue;
          if (/nodesk|about|contact|privacy|terms|blog/i.test(cleanTitle)) continue;
          
          if (searchTerm) {
            const keywords = searchTerm.toLowerCase().split(' ');
            if (!keywords.some(kw => cleanTitle.toLowerCase().includes(kw))) continue;
          }

          result.jobs.push({
            externalId: `nodesk-${Date.now()}-${result.jobs.length}`,
            platform: "Nodesk",
            title: cleanTitle,
            description: `Remote job from Nodesk`,
            location: "Remote",
            remote: true,
            sourceUrl: match[1].startsWith('http') ? match[1] : `https://nodesk.co${match[1]}`,
          });
        }
      }

      result.success = result.jobs.length > 0;
      result.platforms[0].jobsFound = result.jobs.length;
      console.log(`[Nodesk] Found ${result.jobs.length} jobs`);
    } catch (error: any) {
      console.error("[Nodesk] Error:", error.message);
      result.errors.push(`Nodesk: ${error.message}`);
      result.platforms[0].error = error.message;
    }

    return result;
  }

  /**
   * Aggregate jobs from 36+ confirmed working sources
   * No mock data - only real job listings
   * Batch 1: Core FREE APIs, Batch 2: Regional & Niche, Batch 3: ATS scrapers, Batch 4: Additional ATS
   */
  async scrapeAll(config: ScrapeConfig): Promise<ScrapeResult> {
    const allResults: ScrapeResult = {
      success: false,
      jobs: [],
      errors: [],
      platforms: [],
    };

    const limit = config.resultsPerPlatform || 50;

    const allScrapers: { id: string; name: string; fn: () => Promise<ScrapeResult>; batch: number }[] = [
      { id: "remoteok", name: "RemoteOK", fn: () => this.scrapeRemoteOK(config.searchTerm, limit), batch: 1 },
      { id: "weworkremotely", name: "WeWorkRemotely", fn: () => this.scrapeWeWorkRemotely(config.searchTerm, limit), batch: 1 },
      { id: "jobicy", name: "Jobicy", fn: () => this.scrapeJobicy(config.searchTerm, 25), batch: 1 },
      { id: "remotive", name: "Remotive", fn: () => this.scrapeRemotive(config.searchTerm, limit), batch: 1 },
      { id: "himalayas", name: "Himalayas", fn: () => this.scrapeHimalayas(config.searchTerm, 50), batch: 1 },
      { id: "arbeitnow", name: "Arbeitnow", fn: () => this.scrapeArbeitnow(config.searchTerm, 50), batch: 1 },
      { id: "themuse", name: "TheMuse", fn: () => this.scrapeTheMuse(config.searchTerm, 50), batch: 1 },
      { id: "workingnomads", name: "WorkingNomads", fn: () => this.scrapeWorkingNomads(config.searchTerm, 50), batch: 1 },
      { id: "remoteok_categories", name: "RemoteOK-Categories", fn: () => this.scrapeRemoteOKCategories(config.searchTerm, 50), batch: 1 },
      { id: "dribbble", name: "Dribbble", fn: () => this.scrapeDribbble(config.searchTerm, 50), batch: 1 },
      { id: "freelancer", name: "Freelancer", fn: () => this.scrapeFreelancer(config.searchTerm, 30), batch: 1 },
      { id: "hackernews", name: "HackerNews", fn: () => this.scrapeHackerNews(config.searchTerm, 50), batch: 1 },
      { id: "devitjobs", name: "DevITJobs", fn: () => this.scrapeDevITJobs(config.searchTerm, 50), batch: 1 },
      { id: "swissdevjobs", name: "SwissDevJobs", fn: () => this.scrapeSwissDevJobs(config.searchTerm, 50), batch: 2 },
      { id: "berlinstartupjobs", name: "BerlinStartupJobs", fn: () => this.scrapeBerlinStartupJobs(config.searchTerm, 50), batch: 2 },
      { id: "justremote", name: "JustRemote", fn: () => this.scrapeJustRemote(config.searchTerm, 50), batch: 2 },
      { id: "cryptojobslist", name: "CryptoJobsList", fn: () => this.scrapeCryptoJobsList(config.searchTerm, 50), batch: 2 },
      { id: "nofluffjobs", name: "NoFluffJobs", fn: () => this.scrapeNoFluffJobs(config.searchTerm, 100), batch: 2 },
      { id: "greenhouse", name: "Greenhouse", fn: () => this.scrapeGreenhouseJobs(config.searchTerm, 100), batch: 3 },
      { id: "lever", name: "Lever", fn: () => this.scrapeLeverJobs(config.searchTerm, 100), batch: 3 },
      { id: "ashby", name: "Ashby", fn: () => this.scrapeAshby(config.searchTerm, 100), batch: 3 },
      { id: "smartrecruiters", name: "SmartRecruiters", fn: () => this.scrapeSmartRecruiters(config.searchTerm, 100), batch: 3 },
      { id: "jobvite", name: "Jobvite", fn: () => this.scrapeJobvite(config.searchTerm, 100), batch: 3 },
      { id: "larajobs", name: "LaraJobs", fn: () => this.scrapeLaraJobs(config.searchTerm, 25), batch: 1 },
      { id: "recruitee", name: "Recruitee", fn: () => this.scrapeRecruitee(config.searchTerm, 100), batch: 4 },
      { id: "bamboohr", name: "BambooHR", fn: () => this.scrapeBambooHR(config.searchTerm, 100), batch: 4 },
      { id: "workable", name: "Workable", fn: () => this.scrapeWorkable(config.searchTerm, 100), batch: 4 },
      { id: "jobspy_indeed", name: "Indeed (JobSpy)", fn: () => this.scrapeWithJobSpy({ searchTerm: config.searchTerm, location: config.location, platforms: ["indeed"], resultsPerPlatform: 100 }), batch: 5 },
      { id: "jobspy_linkedin", name: "LinkedIn (JobSpy)", fn: () => this.scrapeWithJobSpy({ searchTerm: config.searchTerm, location: config.location, platforms: ["linkedin"], resultsPerPlatform: 100 }), batch: 5 },
      { id: "jobspy_glassdoor", name: "Glassdoor (JobSpy)", fn: () => this.scrapeWithJobSpy({ searchTerm: config.searchTerm, location: config.location, platforms: ["glassdoor"], resultsPerPlatform: 50 }), batch: 5 },
    ];

    const selectedPlatforms = config.platforms && config.platforms.length > 0 ? config.platforms : null;
    const isAllPlatforms = selectedPlatforms && (selectedPlatforms.includes("all") || selectedPlatforms.includes("ALL"));
    const scrapers = (selectedPlatforms && !isAllPlatforms)
      ? allScrapers.filter(s => selectedPlatforms.includes(s.id))
      : allScrapers;

    console.log(`[JobScraper] Starting aggregation for: "${config.searchTerm}" from ${scrapers.length} working sources${selectedPlatforms ? ` (filtered from ${allScrapers.length})` : ''}`);

    const collectResults = (batchResults: PromiseSettledResult<ScrapeResult>[], names: string[]) => {
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const name = names[i];
        if (result.status === "fulfilled") {
          allResults.jobs.push(...result.value.jobs);
          allResults.platforms.push(...result.value.platforms);
          allResults.errors.push(...result.value.errors);
        } else {
          allResults.errors.push(`${name} failed: ${result.reason}`);
          allResults.platforms.push({ name, jobsFound: 0, error: result.reason?.message || "Unknown error" });
        }
      }
    };

    const batchNumbers = [...new Set(scrapers.map(s => s.batch))].sort((a, b) => a - b);
    for (const batchNum of batchNumbers) {
      const batchScrapers = scrapers.filter(s => s.batch === batchNum);
      if (batchScrapers.length === 0) continue;
      console.log(`[JobScraper] Batch ${batchNum}: Running ${batchScrapers.map(s => s.name).join(', ')}...`);
      const batchResults = await Promise.allSettled(batchScrapers.map(s => s.fn()));
      collectResults(batchResults, batchScrapers.map(s => s.name));
      console.log(`[JobScraper] Batch ${batchNum} completed.`);
    }

    allResults.success = allResults.jobs.length > 0;

    const successfulPlatforms = allResults.platforms.filter(p => p.jobsFound > 0);
    console.log(`[JobScraper] Total jobs collected: ${allResults.jobs.length} from ${successfulPlatforms.length} successful sources out of ${scrapers.length} attempted`);
    console.log(`[JobScraper] Sources: ${successfulPlatforms.map(p => `${p.name}(${p.jobsFound})`).join(', ')}`);

    if (allResults.jobs.length === 0) {
      allResults.errors.push("No jobs found from any source. Check API availability and search terms.");
    }

    return allResults;
  }

  // Helper methods
  private parseGenericRSS(xml: string, platform: string, searchTerm?: string, limit: number = 50): ScrapedJob[] {
    const jobs: ScrapedJob[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && jobs.length < limit) {
      const itemXml = match[1];

      const title = this.extractXmlTag(itemXml, "title");
      const description = this.extractXmlTag(itemXml, "description");
      const link = this.extractXmlTag(itemXml, "link");
      const pubDate = this.extractXmlTag(itemXml, "pubDate");

      if (!title) continue;

      // Filter by search term if provided
      if (searchTerm) {
        const keywords = searchTerm.toLowerCase().split(' ');
        const searchText = `${title} ${description || ''}`.toLowerCase();
        if (!keywords.some(kw => searchText.includes(kw))) {
          continue;
        }
      }

      const cleanDescription = this.stripHtml(description || '');

      jobs.push({
        externalId: `${platform.toLowerCase()}-${Date.now()}-${jobs.length}`,
        platform,
        title,
        description: cleanDescription.substring(0, 5000),
        location: "Remote",
        remote: true,
        sourceUrl: link,
        postedAt: pubDate ? new Date(pubDate) : undefined,
      });
    }

    return jobs;
  }

  private extractXmlTag(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = xml.match(regex);
    return match ? (match[1] || match[2])?.trim() : undefined;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#8211;/g, '-')
      .replace(/&#8212;/g, '-')
      .replace(/&#8216;/g, "'")
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
      .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractSkillsFromContent(content: string): string[] {
    const skillPatterns = [
      /\b(React|Vue|Angular|Node\.?js|Python|Java|JavaScript|TypeScript|Go|Golang|Ruby|Rails|PHP|Laravel|Swift|Kotlin|Rust|C\+\+|C#|\.NET|SQL|PostgreSQL|MySQL|MongoDB|Redis|Docker|Kubernetes|AWS|Azure|GCP|GraphQL|REST|API)\b/gi,
      /\b(Machine Learning|ML|AI|Data Science|DevOps|SRE|Frontend|Backend|Full.?Stack|Mobile|iOS|Android)\b/gi,
    ];

    const skills = new Set<string>();
    for (const pattern of skillPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((skill) => skills.add(skill));
      }
    }

    return Array.from(skills).slice(0, 10);
  }

  deduplicateJobs(jobs: ScrapedJob[], existingExternalIds: Set<string>): ScrapedJob[] {
    const seenExternalIds = new Set<string>();
    const seenTitleKeys = new Set<string>();
    const seenUrlKeys = new Set<string>();

    return jobs.filter((job) => {
      // Skip jobs without company name or source URL - required for enrichment
      if (!job.companyName && !job.sourceUrl) {
        console.log(`[Dedupe] Skipping job "${job.title}" - missing company name and URL`);
        return false;
      }

      // Check external ID
      if (job.externalId) {
        if (existingExternalIds.has(job.externalId) || seenExternalIds.has(job.externalId)) {
          return false;
        }
        seenExternalIds.add(job.externalId);
      }

      // Check by title + company (cross-platform deduplication)
      const titleKey = `${job.title}-${job.companyName || ""}`.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenTitleKeys.has(titleKey)) {
        return false;
      }
      seenTitleKeys.add(titleKey);

      // Check by source URL (prevents duplicate URLs from different scrapes)
      if (job.sourceUrl) {
        const normalizedUrl = job.sourceUrl.toLowerCase().replace(/\/$/, '');
        if (seenUrlKeys.has(normalizedUrl)) {
          return false;
        }
        seenUrlKeys.add(normalizedUrl);
      }

      return true;
    });
  }

  toInsertJob(scraped: ScrapedJob, userId: number, searchTerm?: string): Omit<InsertJob, "id"> {
    const hasDomain = !!scraped.companyDomain;
    return {
      userId,
      title: (scraped.title || "Untitled").substring(0, 500),
      description: scraped.description,
      companyName: scraped.companyName?.substring(0, 255) || null,
      companyDomain: scraped.companyDomain || null,
      location: scraped.location?.substring(0, 255) || null,
      remote: scraped.remote,
      budgetMin: scraped.budgetMin,
      budgetMax: scraped.budgetMax,
      budgetType: scraped.budgetType,
      platform: scraped.platform,
      externalId: scraped.externalId?.substring(0, 500) || null,
      sourceUrl: scraped.sourceUrl?.substring(0, 2000) || null,
      postedAt: scraped.postedAt,
      searchTerm: searchTerm?.trim().substring(0, 255) || null,
      skills: scraped.skills?.length ? scraped.skills.join(", ") : null,
      isActive: true,
      domainResolved: hasDomain,
      domainConfidence: hasDomain ? 99 : null,
      domainResolutionMethod: hasDomain ? "ats_direct" : null,
      contactFound: false,
      contactVerified: false,
      contacted: false,
    };
  }
}

export const jobScraperService = new JobScraperService();
