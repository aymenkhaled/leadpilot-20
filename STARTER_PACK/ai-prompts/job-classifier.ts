import OpenAI from "openai";

type JobType = "CONTRACT" | "RECRUITING" | "INTERNAL" | "COFOUNDER" | "CONSULTING" | "PARTNERSHIP";
type BudgetIndicator = "high" | "medium" | "low" | "unknown";
type RecruiterVsTeamMember = "recruiter" | "team_member" | "unknown";

interface ClassificationResult {
  job_type: JobType;
  confidence: number;
  reasoning: string;
  budget_range: string;
  timeline: string;
  good_for_agency: boolean;
  recruiter_vs_team_member: RecruiterVsTeamMember;
  budget_indicator: BudgetIndicator;
  estimated_budget_min: number;
  estimated_budget_max: number;
}

interface BatchJobInput {
  id: number;
  title: string;
  description: string;
}

const TECH_BUDGET_TIERS: Record<BudgetIndicator, string[]> = {
  high: [
    "hubspot", "salesforce", "sap", "oracle", "workday", "servicenow",
    "dynamics 365", "netsuite", "marketo", "pardot", "eloqua",
    "azure", "aws", "gcp", "kubernetes", "terraform",
    "blockchain", "solidity", "web3", "machine learning", "ai/ml",
    "data engineering", "snowflake", "databricks",
  ],
  medium: [
    "react", "node", "nodejs", "python", "typescript", "angular", "vue",
    "django", "flask", "fastapi", "next.js", "nextjs", "nuxt",
    "ruby on rails", "rails", "golang", "go lang", "rust",
    "java", "spring boot", "kotlin", "swift", "flutter", "react native",
    "docker", "devops", "ci/cd", "graphql", "postgresql", "mongodb",
    "redis", "elasticsearch", "microservices",
  ],
  low: [
    "wordpress", "html", "css", "html/css", "html5", "css3",
    "wix", "squarespace", "shopify theme", "webflow",
    "php", "jquery", "bootstrap", "tailwind",
    "data entry", "virtual assistant", "basic website",
  ],
  unknown: [],
};

const SENIORITY_MULTIPLIERS: Record<string, number> = {
  "architect": 1.5,
  "principal": 1.5,
  "staff": 1.4,
  "lead": 1.3,
  "senior": 1.2,
  "sr.": 1.2,
  "mid-level": 1.0,
  "mid": 1.0,
  "junior": 0.7,
  "jr.": 0.7,
  "intern": 0.4,
  "entry": 0.6,
};

const BASE_HOURLY_RATES: Record<BudgetIndicator, { min: number; max: number }> = {
  high: { min: 100, max: 200 },
  medium: { min: 50, max: 100 },
  low: { min: 20, max: 50 },
  unknown: { min: 30, max: 80 },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function estimateBudgetFromKeywords(
  title: string,
  description: string
): {
  budget_indicator: BudgetIndicator;
  estimated_budget_min: number;
  estimated_budget_max: number;
  budget_range: string;
} {
  const combined = `${title} ${description}`.toLowerCase();

  let detectedTier: BudgetIndicator = "unknown";
  for (const tier of ["high", "medium", "low"] as BudgetIndicator[]) {
    const keywords = TECH_BUDGET_TIERS[tier];
    if (keywords.some((kw) => combined.includes(kw))) {
      detectedTier = tier;
      break;
    }
  }

  const baseRate = BASE_HOURLY_RATES[detectedTier];
  let multiplier = 1.0;

  const titleLower = title.toLowerCase();
  for (const [keyword, mult] of Object.entries(SENIORITY_MULTIPLIERS)) {
    if (titleLower.includes(keyword)) {
      multiplier = mult;
      break;
    }
  }

  const minRate = Math.round(baseRate.min * multiplier);
  const maxRate = Math.round(baseRate.max * multiplier);

  const estimatedMin = minRate * 160;
  const estimatedMax = maxRate * 160;

  return {
    budget_indicator: detectedTier,
    estimated_budget_min: estimatedMin,
    estimated_budget_max: estimatedMax,
    budget_range: `$${minRate}-$${maxRate}/hr (~$${(estimatedMin / 1000).toFixed(0)}k-$${(estimatedMax / 1000).toFixed(0)}k/month)`,
  };
}

export class JobClassifierService {
  private openai: OpenAI | null = null;
  private currentApiKey: string | null = null;

  setApiKey(apiKey: string) {
    if (apiKey && apiKey !== this.currentApiKey) {
      this.openai = new OpenAI({ apiKey });
      this.currentApiKey = apiKey;
    }
  }

  initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== this.currentApiKey) {
      this.openai = new OpenAI({ apiKey });
      this.currentApiKey = apiKey;
    }
  }

  isConfigured(): boolean {
    return !!this.openai || !!process.env.OPENAI_API_KEY;
  }

  async classifyJob(
    title: string,
    description: string,
    userApiKey?: string
  ): Promise<ClassificationResult> {
    if (userApiKey) {
      this.setApiKey(userApiKey);
    } else if (!this.openai) {
      this.initialize();
    }

    if (!this.openai) {
      return this.classifyWithFallback(title, description);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a job posting classifier for a digital agency. Analyze the job posting and classify it into one of these categories:

1. CONTRACT - Client looking to hire a contractor/freelancer/agency for a specific project or ongoing work. Keywords: "contractor", "freelancer", "agency", "project-based", "budget", "deliverables", "milestone"
2. RECRUITING - Company hiring a full-time/part-time employee through a recruiter or staffing agency. Keywords: "staffing", "placement", "recruiting", "headhunter", "permanent position", "benefits", "salary"
3. INTERNAL - Company hiring directly for an internal position (not relevant for agencies). Keywords: "join our team", "full-time employee", "benefits package", "company culture", "onboarding"
4. COFOUNDER - Looking for a technical co-founder or partner with equity. Keywords: "co-founder", "equity", "partner", "startup", "founding team", "sweat equity"
5. CONSULTING - Looking for expert advice, strategy, or consulting (not hands-on development). Keywords: "consulting", "advisory", "strategy", "assessment", "audit", "recommendations"
6. PARTNERSHIP - Looking for a long-term partnership, white-label, or reseller arrangement. Keywords: "partnership", "white-label", "reseller", "long-term", "ongoing relationship", "retainer"

Also extract:
- confidence: 0-100 how confident you are in the classification
- reasoning: brief explanation of why you chose this category
- budget_range: any mentioned budget or estimated range (e.g., "$5,000-$10,000")
- timeline: any mentioned timeline or deadline
- good_for_agency: true if this is a good opportunity for a digital agency (CONTRACT, CONSULTING, PARTNERSHIP are usually good)
- recruiter_vs_team_member: 'recruiter' if the poster is a recruiter/staffing agency, 'team_member' if they're from the hiring company, 'unknown' if unclear
- budget_indicator: 'high', 'medium', 'low', or 'unknown' based on the technologies and complexity involved
- estimated_budget_min: estimated minimum budget in USD (project total, not hourly)
- estimated_budget_max: estimated maximum budget in USD (project total, not hourly)

Technology budget indicators:
- HIGH: HubSpot, Salesforce, SAP, Oracle, Workday, ServiceNow, enterprise integrations, blockchain, ML/AI
- MEDIUM: React, Node.js, Python, TypeScript, mobile apps, cloud infrastructure
- LOW: WordPress, basic HTML/CSS, Wix, Squarespace, data entry

Respond ONLY with valid JSON matching this exact structure:
{
  "job_type": "CONTRACT",
  "confidence": 95,
  "reasoning": "...",
  "budget_range": "$5,000-$10,000",
  "timeline": "2-3 weeks",
  "good_for_agency": true,
  "recruiter_vs_team_member": "team_member",
  "budget_indicator": "high",
  "estimated_budget_min": 5000,
  "estimated_budget_max": 10000
}`,
          },
          {
            role: "user",
            content: `Classify this job posting:\n\nTitle: ${title}\n\nDescription: ${(description || "").substring(0, 2000)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.classifyWithFallback(title, description);
      }

      const parsed = JSON.parse(content) as ClassificationResult;

      const validTypes: JobType[] = ["CONTRACT", "RECRUITING", "INTERNAL", "COFOUNDER", "CONSULTING", "PARTNERSHIP"];
      if (!validTypes.includes(parsed.job_type)) {
        parsed.job_type = "CONTRACT";
      }

      parsed.confidence = Math.max(0, Math.min(100, parsed.confidence || 50));

      const validIndicators: BudgetIndicator[] = ["high", "medium", "low", "unknown"];
      if (!validIndicators.includes(parsed.budget_indicator)) {
        parsed.budget_indicator = "unknown";
      }

      const validRvT: RecruiterVsTeamMember[] = ["recruiter", "team_member", "unknown"];
      if (!validRvT.includes(parsed.recruiter_vs_team_member)) {
        parsed.recruiter_vs_team_member = "unknown";
      }

      if (!parsed.estimated_budget_min || !parsed.estimated_budget_max) {
        const fallback = estimateBudgetFromKeywords(title, description);
        parsed.estimated_budget_min = parsed.estimated_budget_min || fallback.estimated_budget_min;
        parsed.estimated_budget_max = parsed.estimated_budget_max || fallback.estimated_budget_max;
        if (!parsed.budget_range || parsed.budget_range === "unknown") {
          parsed.budget_range = fallback.budget_range;
        }
        if (parsed.budget_indicator === "unknown") {
          parsed.budget_indicator = fallback.budget_indicator;
        }
      }

      return parsed;
    } catch (error: any) {
      console.error("[JobClassifier] OpenAI error:", error.message);
      return this.classifyWithFallback(title, description);
    }
  }

  async classifyJobsBatch(
    jobs: BatchJobInput[],
    userApiKey?: string
  ): Promise<Map<number, ClassificationResult>> {
    const results = new Map<number, ClassificationResult>();
    const batchSize = 10;

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (job) => {
          const result = await this.classifyJob(job.title, job.description || "", userApiKey);
          return { id: job.id, result };
        })
      );

      for (const outcome of batchResults) {
        if (outcome.status === "fulfilled") {
          results.set(outcome.value.id, outcome.value.result);
        } else {
          console.error("[JobClassifier] Batch item failed:", outcome.reason);
        }
      }

      if (i + batchSize < jobs.length) {
        await delay(500);
      }
    }

    return results;
  }

  private classifyWithFallback(title: string, description: string): ClassificationResult {
    const combined = `${title} ${description}`.toLowerCase();

    let job_type: JobType = "CONTRACT";
    let confidence = 40;
    let reasoning = "Fallback keyword-based classification";
    let good_for_agency = true;
    let recruiter_vs_team_member: RecruiterVsTeamMember = "unknown";

    if (
      combined.includes("co-founder") ||
      combined.includes("cofounder") ||
      combined.includes("equity") ||
      combined.includes("founding team") ||
      combined.includes("sweat equity")
    ) {
      job_type = "COFOUNDER";
      confidence = 70;
      reasoning = "Contains co-founder/equity keywords";
      good_for_agency = false;
    } else if (
      combined.includes("recruiter") ||
      combined.includes("staffing") ||
      combined.includes("placement") ||
      combined.includes("headhunter") ||
      combined.includes("talent acquisition")
    ) {
      job_type = "RECRUITING";
      confidence = 65;
      reasoning = "Contains recruiting/staffing keywords";
      good_for_agency = false;
      recruiter_vs_team_member = "recruiter";
    } else if (
      combined.includes("join our team") ||
      combined.includes("full-time employee") ||
      combined.includes("benefits package") ||
      combined.includes("company culture") ||
      combined.includes("annual salary") ||
      combined.includes("permanent position")
    ) {
      job_type = "INTERNAL";
      confidence = 60;
      reasoning = "Contains internal hiring keywords";
      good_for_agency = false;
      recruiter_vs_team_member = "team_member";
    } else if (
      combined.includes("consulting") ||
      combined.includes("advisory") ||
      combined.includes("strategy session") ||
      combined.includes("assessment") ||
      combined.includes("audit")
    ) {
      job_type = "CONSULTING";
      confidence = 55;
      reasoning = "Contains consulting/advisory keywords";
      good_for_agency = true;
    } else if (
      combined.includes("partnership") ||
      combined.includes("white-label") ||
      combined.includes("white label") ||
      combined.includes("reseller") ||
      combined.includes("retainer")
    ) {
      job_type = "PARTNERSHIP";
      confidence = 55;
      reasoning = "Contains partnership/white-label keywords";
      good_for_agency = true;
    } else if (
      combined.includes("contractor") ||
      combined.includes("freelancer") ||
      combined.includes("project-based") ||
      combined.includes("deliverables") ||
      combined.includes("milestone") ||
      combined.includes("fixed price") ||
      combined.includes("budget")
    ) {
      job_type = "CONTRACT";
      confidence = 65;
      reasoning = "Contains contract/freelance keywords";
      good_for_agency = true;
    }

    const budgetEstimate = estimateBudgetFromKeywords(title, description);

    let timeline = "unknown";
    const timelinePatterns = [
      /(\d+[-–]\d+\s*(?:weeks?|months?|days?))/i,
      /(asap|immediately|urgent)/i,
      /(within\s+\d+\s+(?:weeks?|months?|days?))/i,
    ];
    for (const pattern of timelinePatterns) {
      const match = combined.match(pattern);
      if (match) {
        timeline = match[1];
        break;
      }
    }

    const budgetPatterns = [
      /\$[\d,]+\s*[-–]\s*\$[\d,]+/,
      /\$[\d,]+\s*(?:per|\/)\s*(?:hour|hr|month|project)/i,
      /budget[:\s]+\$[\d,]+/i,
    ];
    let budget_range = budgetEstimate.budget_range;
    for (const pattern of budgetPatterns) {
      const match = combined.match(pattern);
      if (match) {
        budget_range = match[0];
        break;
      }
    }

    return {
      job_type,
      confidence,
      reasoning,
      budget_range,
      timeline,
      good_for_agency,
      recruiter_vs_team_member,
      budget_indicator: budgetEstimate.budget_indicator,
      estimated_budget_min: budgetEstimate.estimated_budget_min,
      estimated_budget_max: budgetEstimate.estimated_budget_max,
    };
  }
}

export const jobClassifier = new JobClassifierService();
