import { storage } from "../storage";
import type { ApifyKey } from "@shared/schema";

interface ApifyScrapedJob {
  title: string;
  description?: string;
  companyName?: string;
  companyDomain?: string;
  companyUrl?: string;
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
  seniorityLevel?: string;
  employmentType?: string;
  industry?: string;
  companySize?: string;
  companyRevenue?: string;
  companyWebsite?: string;
  posterLinkedin?: string;
  posterName?: string;
  applicants?: number;
  salary?: string;
  easyApply?: boolean;
  employerType?: string;
}

interface ApifyRunResult {
  success: boolean;
  jobs: ApifyScrapedJob[];
  platform: string;
  keyUsed: string;
  creditsUsed: number;
  error?: string;
}

const APIFY_ACTORS: Record<string, { actorId: string; displayName: string }> = {
  linkedin: {
    actorId: "worldunboxer/rapid-linkedin-scraper",
    displayName: "LinkedIn (Apify)",
  },
  dice: {
    actorId: "worldunboxer/dice-jobs-scraper",
    displayName: "Dice (Apify)",
  },
  monster: {
    actorId: "axlymxp/monster-scraper",
    displayName: "Monster (Apify)",
  },
  glassdoor: {
    actorId: "bebity/glassdoor-jobs-scraper",
    displayName: "Glassdoor (Apify)",
  },
  indeed: {
    actorId: "misceres/indeed-scraper",
    displayName: "Indeed (Apify)",
  },
  naukri: {
    actorId: "muhammetakkurtt/naukri-job-scraper",
    displayName: "Naukri (Apify)",
  },
  wellfound: {
    actorId: "shahidirfan/Wellfound-Jobs-Scraper",
    displayName: "Wellfound (Apify)",
  },
  peopleperhour: {
    actorId: "jupri/pph",
    displayName: "PeoplePerHour (Apify)",
  },
  remoteok: {
    actorId: "shahidirfan/Remoteok-Job-Scraper",
    displayName: "RemoteOK (Apify)",
  },
};

function extractDomainFromUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function parseSalaryRange(salary: string | null | undefined): { min?: number; max?: number; type?: string } {
  if (!salary) return {};
  const cleaned = salary.replace(/[,$]/g, "").toLowerCase();
  const hourlyMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:\/hr|per hour|\/hour|hr)/i);
  if (hourlyMatch) {
    const nums = cleaned.match(/(\d+(?:\.\d+)?)/g);
    if (nums && nums.length >= 2) {
      return { min: Math.round(parseFloat(nums[0])), max: Math.round(parseFloat(nums[1])), type: "hourly" };
    }
    return { min: Math.round(parseFloat(hourlyMatch[1])), type: "hourly" };
  }
  const yearlyMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:\/yr|per year|\/year|yr|annually)/i);
  if (yearlyMatch || cleaned.includes("year")) {
    const nums = cleaned.match(/(\d+(?:\.\d+)?)/g);
    if (nums && nums.length >= 2) {
      const v1 = parseFloat(nums[0]);
      const v2 = parseFloat(nums[1]);
      const min = v1 > 1000 ? v1 : v1 * 1000;
      const max = v2 > 1000 ? v2 : v2 * 1000;
      return { min: Math.round(min), max: Math.round(max), type: "fixed" };
    }
  }
  const monthlyMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:\/mo|per month|\/month|mo)/i);
  if (monthlyMatch) {
    const nums = cleaned.match(/(\d+(?:\.\d+)?)/g);
    if (nums && nums.length >= 2) {
      return { min: Math.round(parseFloat(nums[0])), max: Math.round(parseFloat(nums[1])), type: "monthly" };
    }
  }
  const nums = cleaned.match(/(\d+(?:\.\d+)?)/g);
  if (nums && nums.length >= 2) {
    const v1 = parseFloat(nums[0]);
    const v2 = parseFloat(nums[1]);
    if (v1 > 200 || v2 > 200) {
      return { min: Math.round(v1 > 1000 ? v1 : v1 * 1000), max: Math.round(v2 > 1000 ? v2 : v2 * 1000), type: "fixed" };
    }
    return { min: Math.round(v1), max: Math.round(v2), type: "hourly" };
  }
  return {};
}

function parseRelativeDate(text: string | null | undefined): Date | undefined {
  if (!text) return undefined;
  const now = new Date();
  const lower = text.toLowerCase().trim();
  const hoursMatch = lower.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    now.setHours(now.getHours() - parseInt(hoursMatch[1]));
    return now;
  }
  const daysMatch = lower.match(/(\d+)\s*day/);
  if (daysMatch) {
    now.setDate(now.getDate() - parseInt(daysMatch[1]));
    return now;
  }
  const weeksMatch = lower.match(/(\d+)\s*week/);
  if (weeksMatch) {
    now.setDate(now.getDate() - parseInt(weeksMatch[1]) * 7);
    return now;
  }
  const monthsMatch = lower.match(/(\d+)\s*month/);
  if (monthsMatch) {
    now.setMonth(now.getMonth() - parseInt(monthsMatch[1]));
    return now;
  }
  try {
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}
  return undefined;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const JOB_PLATFORM_DOMAINS = [
  "linkedin.com", "glassdoor.com", "indeed.com", "dice.com", "monster.com",
  "facebook.com", "twitter.com", "instagram.com", "youtube.com", "tiktok.com",
  "upwork.com", "wellfound.com", "angel.co", "peopleperhour.com",
  "remoteok.com", "remoteok.io", "naukri.com", "lever.co", "greenhouse.io",
  "ashbyhq.com", "smartrecruiters.com", "jobvite.com", "recruitee.com",
  "bamboohr.com", "workable.com", "breezy.hr", "jazzhr.com",
  "weworkremotely.com", "remotive.com", "himalayas.app", "jobicy.com",
  "nofluffjobs.com", "dribbble.com", "freelancer.com", "fiverr.com",
  "toptal.com", "guru.com", "flexjobs.com",
  "careerbuilder.com", "simplyhired.com", "themuse.com", "builtin.com",
  "stackoverflow.com", "github.com", "google.com", "reddit.com",
];

function isJobPlatformUrl(url: string | undefined): boolean {
  if (!url) return false;
  const domain = extractDomainFromUrl(url);
  if (!domain) return false;
  return JOB_PLATFORM_DOMAINS.some(s => domain.includes(s));
}

function isSocialUrl(url: string | undefined): boolean {
  return isJobPlatformUrl(url);
}

const FAKE_COMPANY_NAMES = [
  "upwork client", "pph client", "freelancer client", "fiverr client",
  "unknown client", "anonymous client", "private client", "confidential",
  "unknown", "anonymous", "private", "n/a", "na", "none", "undisclosed",
  "not available", "client", "hiring", "company", "startup",
];

function isFakeCompanyName(name: string | undefined): boolean {
  if (!name || name.trim().length < 3) return true;
  const lower = name.toLowerCase().trim();
  return FAKE_COMPANY_NAMES.includes(lower);
}

function mapLinkedInJob(raw: any): ApifyScrapedJob | null {
  if (!raw.job_title && !raw.title) return null;
  const title = raw.job_title || raw.title || "";
  const description = stripHtml(raw.job_description_raw_html || raw.job_description || "");
  const salary = parseSalaryRange(raw.salary_range || raw.salary);
  return {
    title,
    description,
    companyName: raw.company_name,
    companyUrl: raw.company_url,
    companyDomain: undefined,
    location: raw.location,
    remote: raw.location?.toLowerCase().includes("remote") || false,
    budgetMin: salary.min,
    budgetMax: salary.max,
    budgetType: salary.type,
    platform: "LinkedIn (Apify)",
    externalId: raw.job_id ? `linkedin_apify_${raw.job_id}` : undefined,
    sourceUrl: raw.job_url,
    postedAt: parseRelativeDate(raw.time_posted),
    seniorityLevel: raw.seniority_level,
    employmentType: raw.employment_type,
    industry: Array.isArray(raw.industries) ? raw.industries.join(", ") : raw.industries,
    applicants: typeof raw.num_applicants === "number" ? raw.num_applicants
      : (typeof raw.num_applicants === "string" ? parseInt((raw.num_applicants.match(/\d+/) || [])[0] || "") || undefined : undefined),
    salary: raw.salary_range,
    easyApply: raw.easy_apply,
    posterLinkedin: raw.job_poster_linkedin_profile_url,
  };
}

function mapDiceJob(raw: any): ApifyScrapedJob | null {
  const title = raw.title || raw.jobTitle || raw.name || "";
  if (!title) return null;
  const description = stripHtml(raw.summary || raw.description || raw.jobDescription || "");
  const salary = parseSalaryRange(raw.salary || raw.compensationSummary || raw.payRange);

  let location: string | undefined;
  if (typeof raw.jobLocation === "string") {
    location = raw.jobLocation;
  } else if (raw.jobLocation?.city) {
    location = `${raw.jobLocation.city}, ${raw.jobLocation.state || ""}`.trim();
  } else if (typeof raw.location === "string") {
    location = raw.location;
  } else if (raw.formattedLocation) {
    location = raw.formattedLocation;
  }

  const rawDetailsUrl = raw.details_page_url || raw.detailsPageUrl;
  const detailsUrl = rawDetailsUrl
    ? (rawDetailsUrl.startsWith("http") ? rawDetailsUrl : `https://www.dice.com${rawDetailsUrl}`)
    : (raw.url || raw.jobUrl || raw.detailUrl || (raw.guid ? `https://www.dice.com/job-detail/${raw.guid}` : (raw.id ? `https://www.dice.com/job-detail/${raw.id}` : undefined)));

  const rawCompanyUrl = raw.company_page_url || raw.companyPageUrl;
  const companyPageUrl = rawCompanyUrl
    ? (rawCompanyUrl.startsWith("http") ? rawCompanyUrl : `https://www.dice.com${rawCompanyUrl}`)
    : undefined;

  const jobId = raw.job_id || raw.jobId;
  const isRemote = raw.is_remote || raw.isRemote || false;
  const wfha = raw.work_from_home_availability || raw.workFromHomeAvailability;
  const postedDate = raw.posted_date || raw.postDate || raw.postedDate;
  const modifiedDate = raw.modified_date || raw.modifiedDate;
  const empType = raw.employment_type || raw.employmentType || raw.jobType;
  const emplerType = raw.employer_type || raw.employerType;
  const easyApplyVal = raw.easy_apply ?? raw.easyApply;

  return {
    title,
    description,
    companyName: raw.companyName || raw.company || raw.employerName,
    companyUrl: companyPageUrl,
    location,
    remote: isRemote || wfha === "Remote" || raw.remote === true || location?.toLowerCase().includes("remote") || false,
    budgetMin: salary.min,
    budgetMax: salary.max,
    budgetType: salary.type,
    platform: "Dice (Apify)",
    externalId: jobId ? `dice_apify_${jobId}` : (raw.id ? `dice_apify_${raw.id}` : undefined),
    sourceUrl: detailsUrl,
    postedAt: postedDate ? new Date(postedDate) : (modifiedDate ? new Date(modifiedDate) : (raw.dateCreated ? new Date(raw.dateCreated) : undefined)),
    employmentType: empType,
    employerType: emplerType,
    salary: raw.salary || raw.compensationSummary,
    easyApply: easyApplyVal,
  };
}

function mapMonsterJob(raw: any): ApifyScrapedJob | null {
  const posting = raw.jobPosting || raw;
  const title = posting.title || raw.title || raw.jobTitle || "";
  if (!title) return null;
  const description = stripHtml(posting.description || raw.description || raw.jobDescription || "");
  const companyName = posting.hiringOrganization?.name || raw.companyName || raw.company;
  let location: string | undefined;
  if (posting.jobLocation?.[0]?.address) {
    const addr = posting.jobLocation[0].address;
    location = `${addr.addressLocality || ""}, ${addr.addressRegion || ""}`.trim().replace(/^,\s*/, "");
  } else if (typeof raw.location === "string") {
    location = raw.location;
  } else if (raw.formattedLocation) {
    location = raw.formattedLocation;
  }
  const salary = parseSalaryRange(
    posting.baseSalary?.value
      ? `${posting.baseSalary.value.minValue || ""}-${posting.baseSalary.value.maxValue || ""} ${posting.baseSalary.value.unitText || ""}` 
      : (raw.salary || raw.compensation || undefined)
  );
  const companyWebsite = posting.hiringOrganization?.sameAs || raw.companyUrl || raw.companyWebsite;
  return {
    title,
    description,
    companyName,
    companyDomain: !isSocialUrl(companyWebsite) ? extractDomainFromUrl(companyWebsite) : undefined,
    location,
    remote: location?.toLowerCase().includes("remote") || raw.isRemote || false,
    budgetMin: salary.min,
    budgetMax: salary.max,
    budgetType: salary.type,
    platform: "Monster (Apify)",
    externalId: raw.jobId ? `monster_apify_${raw.jobId}` : (posting.identifier?.value ? `monster_apify_${posting.identifier.value}` : (raw.id ? `monster_apify_${raw.id}` : undefined)),
    sourceUrl: posting.url || raw.url || raw.jobUrl || (raw.jobId ? `https://www.monster.com/job-openings/${raw.jobId}` : (posting.identifier?.value ? `https://www.monster.com/job-openings/${posting.identifier.value}` : undefined)),
    postedAt: raw.formattedDate ? new Date(raw.formattedDate) : (posting.datePosted ? new Date(posting.datePosted) : (raw.postedDate ? new Date(raw.postedDate) : undefined)),
    employmentType: raw.jobType || posting.employmentType,
  };
}

function mapGlassdoorJob(raw: any): ApifyScrapedJob | null {
  const title = raw.job_title || "";
  if (!title) return null;
  const description = stripHtml(raw.job_description || "");
  const salary = parseSalaryRange(
    raw.job_salary?.salaryType
      ? `${raw.job_salary.minAmount || ""}-${raw.job_salary.maxAmount || ""} ${raw.job_salary.salaryType || ""}`.trim()
      : undefined
  );
  const locCity = raw.job_location?.city || "";
  const locState = raw.job_location?.state || raw.job_location?.country || "";
  const locFallback = raw.job_location?.unknown || "";
  const location = locCity && locState
    ? `${locCity}, ${locState}`.trim()
    : locFallback || locCity || locState || undefined;
  return {
    title,
    description,
    companyName: raw.company_name,
    companyDomain: !isSocialUrl(raw.company_website) ? extractDomainFromUrl(raw.company_website) : undefined,
    companyWebsite: !isSocialUrl(raw.company_website) ? raw.company_website : undefined,
    companyUrl: raw.company_url
      ? (raw.company_url.startsWith("http") ? raw.company_url : `https://glassdoor.com${raw.company_url}`)
      : undefined,
    location,
    remote: location?.toLowerCase().includes("remote") || false,
    budgetMin: salary.min,
    budgetMax: salary.max,
    budgetType: salary.type,
    platform: "Glassdoor (Apify)",
    externalId: raw.job_url ? `glassdoor_apify_${raw.job_url.split("jobListingId=")[1] || raw.job_url.slice(-20)}` : undefined,
    sourceUrl: raw.job_url,
    postedAt: raw.job_posted_date ? new Date(raw.job_posted_date) : undefined,
    industry: raw.job_industry,
    companySize: raw.company_sizes_str,
    companyRevenue: raw.company_revenue,
    posterLinkedin: raw.job_poster_linkedin_profile_url,
    posterName: raw.job_poster_first_name && raw.job_poster_last_name
      ? `${raw.job_poster_first_name} ${raw.job_poster_last_name}`.trim()
      : (raw.job_poster_first_name || raw.job_poster_last_name || undefined),
  };
}

function mapIndeedJob(raw: any): ApifyScrapedJob | null {
  const title = raw.positionName || "";
  if (!title) return null;
  const description = raw.description || "";
  const salary = parseSalaryRange(raw.salary);
  const companyInfo = raw.companyInfo || {};
  const companyUrl = companyInfo.companyUrl;
  const isRealWebsite = companyUrl && !isSocialUrl(companyUrl) && !companyUrl.startsWith("/");
  return {
    title,
    description,
    companyName: raw.company,
    companyDomain: isRealWebsite ? extractDomainFromUrl(companyUrl) : undefined,
    companyWebsite: isRealWebsite ? companyUrl : undefined,
    location: raw.location,
    remote: raw.location?.toLowerCase().includes("remote") || false,
    budgetMin: salary.min,
    budgetMax: salary.max,
    budgetType: salary.type,
    platform: "Indeed (Apify)",
    externalId: raw.url ? `indeed_apify_${raw.url.split("jk=")[1] || raw.url.slice(-20)}` : undefined,
    sourceUrl: raw.url ? `https://www.indeed.com${raw.url.startsWith("/") ? "" : "/"}${raw.url}` : undefined,
    postedAt: raw.postingDateParsed ? new Date(raw.postingDateParsed) : undefined,
    employmentType: Array.isArray(raw.jobType) ? raw.jobType.join(", ") : raw.jobType,
    industry: companyInfo.industry,
  };
}

function mapNaukriJob(raw: any): ApifyScrapedJob | null {
  const title = raw.title || "";
  if (!title) return null;
  const description = stripHtml(raw.jobDescription || "");

  let salaryLabel: string | undefined;
  let locationLabel: string | undefined;
  let experienceLabel: string | undefined;

  if (Array.isArray(raw.placeholders)) {
    for (const p of raw.placeholders) {
      if (p.type === "salary" && p.label && p.label !== "Not disclosed") salaryLabel = p.label;
      if (p.type === "location") locationLabel = p.label;
      if (p.type === "experience") experienceLabel = p.label;
    }
  }

  const salaryStr = salaryLabel || (raw.salary && raw.salary !== "Not disclosed" ? raw.salary : undefined);
  const salary = parseSalaryRange(salaryStr);
  const location = locationLabel || raw.location;

  const jdURL = raw.jdURL
    ? (raw.jdURL.startsWith("http") ? raw.jdURL : `https://www.naukri.com${raw.jdURL}`)
    : undefined;

  let postedAt: Date | undefined;
  if (raw.createdDate) {
    if (typeof raw.createdDate === "number") {
      postedAt = new Date(raw.createdDate);
    } else if (typeof raw.createdDate === "string") {
      postedAt = new Date(raw.createdDate);
    }
  }

  return {
    title,
    description,
    companyName: raw.companyName,
    location,
    remote: location?.toLowerCase().includes("remote") || false,
    budgetMin: salary.min || (raw.salaryDetail?.minimumSalary > 0 ? raw.salaryDetail.minimumSalary : undefined),
    budgetMax: salary.max || (raw.salaryDetail?.maximumSalary > 0 ? raw.salaryDetail.maximumSalary : undefined),
    budgetType: salary.type,
    platform: "Naukri (Apify)",
    externalId: raw.jobId ? `naukri_apify_${raw.jobId}` : undefined,
    sourceUrl: jdURL,
    postedAt,
    skills: raw.tagsAndSkills ? raw.tagsAndSkills.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
    employmentType: experienceLabel || raw.experienceText || raw.experience || undefined,
  };
}

function mapWellfoundJob(raw: any): ApifyScrapedJob | null {
  const title = raw.title || "";
  if (!title) return null;
  const description = raw.description_text || stripHtml(raw.description_html || "");
  const salary = parseSalaryRange(raw.salary);
  const companyName = raw.company || raw.companyName || raw.company_name;

  const companyWebsite = raw.companyUrl || raw.company_url || raw.companyWebsite;
  const websiteDomain = companyWebsite ? extractDomainFromUrl(companyWebsite) : undefined;
  const isRealCompanyWebsite = companyWebsite && websiteDomain && !isJobPlatformUrl(companyWebsite);

  let postedAt: Date | undefined;
  if (raw.postedDate) {
    try {
      postedAt = new Date(raw.postedDate);
      if (isNaN(postedAt.getTime())) postedAt = undefined;
    } catch { postedAt = undefined; }
  }

  return {
    title,
    description,
    companyName: isFakeCompanyName(companyName) ? undefined : companyName,
    companyDomain: isRealCompanyWebsite ? websiteDomain : undefined,
    companyWebsite: isRealCompanyWebsite ? companyWebsite : undefined,
    companyUrl: raw.applyUrl || raw.apply_url,
    location: raw.location,
    remote: raw.remote === true || raw.remoteConfig === "ONLY" || raw.location?.toLowerCase().includes("remote") || false,
    budgetMin: salary.min,
    budgetMax: salary.max,
    budgetType: salary.type,
    platform: "Wellfound (Apify)",
    externalId: raw.id ? `wellfound_apify_${raw.id}` : undefined,
    sourceUrl: raw.applyUrl || raw.apply_url,
    postedAt,
    employmentType: raw.jobType || raw.job_type,
    companySize: raw.companySize || raw.company_size,
    salary: raw.salary,
  };
}


function mapPeoplePerHourJob(raw: any): ApifyScrapedJob | null {
  const title = raw.title || "";
  if (!title) return null;
  const description = raw.proj_desc || raw.description || "";
  const budget = raw.budget ? Number(raw.budget) : undefined;
  const client = raw.client || {};
  const clientName = client.public_name || client.fname || undefined;
  const clientCity = client.city || "";
  const clientCountry = client.country || "";
  const location = [clientCity, clientCountry].filter(Boolean).join(", ") || "Remote";
  const sourceUrl = raw.url || "";
  const category = raw.category?.cate_name || "";
  return {
    title,
    description,
    companyName: undefined,
    posterName: isFakeCompanyName(clientName) ? undefined : clientName,
    location,
    remote: raw.location_type === "remote" || raw.location_type === "worldwide" || true,
    budgetMin: budget,
    budgetMax: budget,
    budgetType: raw.type === "hourly" ? "hourly" : "fixed",
    platform: "PeoplePerHour (Apify)",
    externalId: raw.id ? `pph_apify_${raw.id}` : (raw.proj_id ? `pph_apify_${raw.proj_id}` : undefined),
    sourceUrl,
    postedAt: raw.posted_dt ? new Date(raw.posted_dt) : undefined,
    industry: category || undefined,
    employmentType: "Freelance",
  };
}


function mapRemoteOKJob(raw: any): ApifyScrapedJob | null {
  const title = raw.position || raw.title || "";
  if (!title) return null;
  const description = raw.description_text || raw.description_html || "";
  const companyName = raw.company || "";
  const tags = raw.tags || [];
  return {
    title,
    description,
    companyName,
    location: raw.location || "Remote",
    remote: true,
    budgetMin: raw.salary_min && raw.salary_min > 0 ? raw.salary_min : undefined,
    budgetMax: raw.salary_max && raw.salary_max > 0 ? raw.salary_max : undefined,
    budgetType: raw.salary_min || raw.salary_max ? "annual" : undefined,
    platform: "RemoteOK (Apify)",
    externalId: raw.id ? `remoteok_apify_${raw.id}` : (raw.slug ? `remoteok_apify_${raw.slug}` : undefined),
    sourceUrl: raw.slug ? `https://remoteok.com/remote-jobs/${raw.slug}` : undefined,
    postedAt: raw.epoch ? new Date(raw.epoch * 1000) : (raw.date ? new Date(raw.date) : undefined),
    skills: tags.length > 0 ? tags : undefined,
    employmentType: "Remote",
  };
}

const PLATFORM_MAPPERS: Record<string, (raw: any) => ApifyScrapedJob | null> = {
  linkedin: mapLinkedInJob,
  dice: mapDiceJob,
  monster: mapMonsterJob,
  glassdoor: mapGlassdoorJob,
  indeed: mapIndeedJob,
  naukri: mapNaukriJob,
  wellfound: mapWellfoundJob,
  peopleperhour: mapPeoplePerHourJob,
  remoteok: mapRemoteOKJob,
};

function buildActorInput(platform: string, searchTerm: string, location?: string, maxResults?: number): any {
  const limit = maxResults || 100;
  switch (platform) {
    case "linkedin":
      return {
        jobTitles: [searchTerm],
        locations: location ? [location] : ["United States"],
        maxItems: limit,
      };
    case "dice":
      return {
        keyword: searchTerm,
        location: location || "",
        numberOfJobs: limit,
      };
    case "monster":
      return {
        query: searchTerm,
        location: location || "United States",
        maxItems: limit,
      };
    case "glassdoor":
      return {
        baseUrl: "https://www.glassdoor.com",
        keyword: searchTerm,
        maxItems: limit,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ["RESIDENTIAL"],
        },
        includeNoSalaryJob: false,
        remoteWorkType: false,
        minSalary: 0,
        jobType: "all",
        radius: "18",
        industryType: "ALL",
        domainType: "ALL",
        employerSizes: "ALL",
        applicationType: "ALL",
        seniorityType: "all",
        minRating: "0",
      };
    case "naukri":
      return {
        keyword: searchTerm,
        maxJobs: Math.max(limit, 50),
      };
    case "indeed":
      return {
        position: searchTerm,
        country: "US",
        location: location || "",
        maxItems: limit,
      };
    case "wellfound":
      return {
        keyword: searchTerm,
      };
    case "peopleperhour":
      return {
        keyword: searchTerm,
        maxItems: limit,
      };
    case "remoteok":
      return {
        keyword: searchTerm,
      };
    default:
      return { query: searchTerm, maxItems: limit };
  }
}

class ApifyService {
  private baseUrl = "https://api.apify.com/v2";

  async runScraperWithKey(
    userId: number,
    platform: string,
    searchTerm: string,
    apifyKey: ApifyKey,
    options?: { location?: string; maxResults?: number }
  ): Promise<ApifyRunResult> {
    const actor = APIFY_ACTORS[platform];
    if (!actor) {
      return { success: false, jobs: [], platform, keyUsed: apifyKey.label, creditsUsed: 0, error: `Unknown platform: ${platform}` };
    }

    const input = buildActorInput(platform, searchTerm, options?.location, options?.maxResults);

    try {
      console.log(`[Apify] Running ${actor.displayName} actor for "${searchTerm}" with key "${apifyKey.label}"...`);
      console.log(`[Apify] ${actor.displayName} input: ${JSON.stringify(input)}`);

      const encodedActorId = actor.actorId.replace(/\//g, "~");
      const url = `${this.baseUrl}/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyKey.apiKey}&format=json`;
      console.log(`[Apify] Request URL: ${this.baseUrl}/acts/${encodedActorId}/run-sync-get-dataset-items`);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(300000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[Apify] ${actor.displayName} HTTP ${response.status}: ${errorText.substring(0, 500)}`);

        if (response.status === 401) {
          await storage.updateApifyKey(apifyKey.id, userId, {
            status: "expired",
            lastError: `API key unauthorized (401). Key may be invalid or revoked.`,
            failedAt: new Date(),
          });
          return {
            success: false,
            jobs: [],
            platform: actor.displayName,
            keyUsed: apifyKey.label,
            creditsUsed: 0,
            error: `API key "${apifyKey.label}" is invalid or revoked (401). Please replace it.`,
          };
        }

        const errorDetail = `${actor.displayName} returned HTTP ${response.status}. This is a temporary actor error, not a key issue.`;
        await storage.updateApifyKey(apifyKey.id, userId, {
          lastError: `${actor.displayName}: HTTP ${response.status} (${errorText.substring(0, 100)})`,
        });

        return {
          success: false,
          jobs: [],
          platform: actor.displayName,
          keyUsed: apifyKey.label,
          creditsUsed: 0,
          error: errorDetail,
        };
      }

      const responseBody = await response.json();
      let rawItems: any[] = Array.isArray(responseBody) ? responseBody : [];
      
      if (!Array.isArray(responseBody)) {
        console.log(`[Apify] Response is not an array, type: ${typeof responseBody}`);
        if (responseBody && typeof responseBody === "object") {
          console.log(`[Apify] Response keys: ${Object.keys(responseBody).join(", ")}`);
          if (Array.isArray(responseBody.items)) rawItems = responseBody.items;
          else if (Array.isArray(responseBody.data)) rawItems = responseBody.data;
          else if (Array.isArray(responseBody.results)) rawItems = responseBody.results;
          else if (Array.isArray(responseBody.jobs)) rawItems = responseBody.jobs;
          else if (Array.isArray(responseBody.dataset)) rawItems = responseBody.dataset;
        }
      }

      console.log(`[Apify] ${actor.displayName}: Received ${rawItems.length} raw items from API`);
      if (rawItems.length > 0) {
        const sample = rawItems[0];
        console.log(`[Apify] ${actor.displayName} sample item keys: ${Object.keys(sample).join(", ")}`);
        console.log(`[Apify] ${actor.displayName} sample item (first 500 chars): ${JSON.stringify(sample).substring(0, 500)}`);
      } else {
        console.log(`[Apify] ${actor.displayName}: 0 raw items. Full response (first 1000 chars): ${JSON.stringify(responseBody).substring(0, 1000)}`);
      }

      const mapper = PLATFORM_MAPPERS[platform];
      const jobs: ApifyScrapedJob[] = [];
      let mapFailures = 0;

      for (const item of rawItems) {
        try {
          const mapped = mapper(item);
          if (mapped) {
            jobs.push(mapped);
          } else {
            mapFailures++;
          }
        } catch (err: any) {
          mapFailures++;
          console.error(`[Apify] Failed to map ${platform} item:`, err.message);
        }
      }

      if (mapFailures > 0) {
        console.log(`[Apify] ${actor.displayName}: ${mapFailures} items failed mapping (returned null or threw)`);
      }

      const estimatedCredits = Math.ceil(rawItems.length * 0.005 * 100) / 100;
      await storage.updateApifyKey(apifyKey.id, userId, {
        lastUsedAt: new Date(),
        totalCreditsUsed: (apifyKey.totalCreditsUsed || 0) + Math.ceil(estimatedCredits * 100),
        lastError: null,
      });

      console.log(`[Apify] ${actor.displayName}: Got ${rawItems.length} raw items, mapped ${jobs.length} jobs`);

      return {
        success: true,
        jobs,
        platform: actor.displayName,
        keyUsed: apifyKey.label,
        creditsUsed: estimatedCredits,
      };
    } catch (err: any) {
      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
      const errorMsg = isTimeout ? `${actor.displayName}: Request timed out (5 min limit). Try fewer results.` : `${actor.displayName}: ${err.message}`;

      await storage.updateApifyKey(apifyKey.id, userId, {
        lastError: errorMsg,
      });

      return {
        success: false,
        jobs: [],
        platform: actor.displayName,
        keyUsed: apifyKey.label,
        creditsUsed: 0,
        error: errorMsg,
      };
    }
  }

  async runScraper(
    userId: number,
    platform: string,
    searchTerm: string,
    options?: { location?: string; maxResults?: number; keyId?: number }
  ): Promise<ApifyRunResult> {
    const actor = APIFY_ACTORS[platform];
    if (!actor) {
      return { success: false, jobs: [], platform, keyUsed: "", creditsUsed: 0, error: `Unknown platform: ${platform}` };
    }

    const apifyKey = await this.getValidKey(userId, options?.keyId);
    if (!apifyKey) {
      return { success: false, jobs: [], platform, keyUsed: "", creditsUsed: 0, error: "No active Apify API key found. Add one in Settings." };
    }

    return this.runScraperWithKey(userId, platform, searchTerm, apifyKey, options);
  }

  private async getValidKey(userId: number, keyId?: number): Promise<ApifyKey | undefined> {
    let apifyKey: ApifyKey | undefined;
    if (keyId) {
      apifyKey = await storage.getApifyKey(keyId, userId);
    }
    if (!apifyKey) {
      apifyKey = await storage.getActiveApifyKey(userId);
    }

    if (!apifyKey) {
      const allKeys = await storage.getApifyKeys(userId);
      const expiredKeys = allKeys.filter(k => k.status === "expired");
      for (const expiredKey of expiredKeys) {
        console.log(`[Apify] Checking if expired key "${expiredKey.label}" is still valid...`);
        const health = await this.checkKeyHealth(expiredKey.apiKey);
        if (health.valid) {
          console.log(`[Apify] Key "${expiredKey.label}" is actually still valid! Reactivating...`);
          await storage.updateApifyKey(expiredKey.id, userId, {
            status: "active",
            lastError: null,
          });
          return { ...expiredKey, status: "active" };
        }
      }
    }

    return apifyKey;
  }

  async runMultiPlatform(
    userId: number,
    platforms: string[],
    searchTerm: string,
    options?: { location?: string; maxResults?: number }
  ): Promise<{ results: ApifyRunResult[]; totalJobs: number }> {
    const results: ApifyRunResult[] = [];
    let totalJobs = 0;

    const apifyKey = await this.getValidKey(userId);
    if (!apifyKey) {
      for (const platform of platforms) {
        const actor = APIFY_ACTORS[platform];
        results.push({
          success: false,
          jobs: [],
          platform: actor?.displayName || platform,
          keyUsed: "",
          creditsUsed: 0,
          error: "No active Apify API key found. Add one in Settings.",
        });
      }
      return { results, totalJobs: 0 };
    }

    for (const platform of platforms) {
      console.log(`[Apify] === Starting ${platform} scrape ===`);
      const result = await this.runScraperWithKey(userId, platform, searchTerm, apifyKey, options);
      results.push(result);
      totalJobs += result.jobs.length;

      if (result.error?.includes("401") || result.error?.includes("invalid or revoked")) {
        console.log(`[Apify] Key "${apifyKey.label}" is truly expired/invalid (401). Stopping remaining platforms.`);
        for (const remaining of platforms.slice(platforms.indexOf(platform) + 1)) {
          const rActor = APIFY_ACTORS[remaining];
          results.push({
            success: false,
            jobs: [],
            platform: rActor?.displayName || remaining,
            keyUsed: apifyKey.label,
            creditsUsed: 0,
            error: `Skipped: API key "${apifyKey.label}" is invalid (401 on ${platform}).`,
          });
        }
        break;
      }

      if (!result.success) {
        console.log(`[Apify] ${platform} failed but key is still valid. Continuing with next platform...`);
      }
    }

    return { results, totalJobs };
  }

  getAvailablePlatforms(): { id: string; name: string; actorId: string }[] {
    return Object.entries(APIFY_ACTORS).map(([id, config]) => ({
      id,
      name: config.displayName,
      actorId: config.actorId,
    }));
  }

  async checkKeyHealth(apiKey: string): Promise<{ valid: boolean; credits?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me?token=${apiKey}`);
      if (!response.ok) {
        return { valid: false, error: `HTTP ${response.status}` };
      }
      const data = await response.json();
      const plan = data.data?.plan;
      return {
        valid: true,
        credits: plan?.remainingUsageCreditsUsd ? Math.round(plan.remainingUsageCreditsUsd * 100) / 100 : undefined,
      };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }
}

export const apifyService = new ApifyService();
