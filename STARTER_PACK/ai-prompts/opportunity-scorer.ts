import type { Job, Company, Contact } from "@shared/schema";

interface ScoringConfig {
  targetSkills?: string[];
  targetIndustries?: string[];
  minBudget?: number;
  maxBudget?: number;
  preferRemote?: boolean;
  preferredCompanySize?: string[];
}

interface BuyingSignal {
  type: "funding" | "growth" | "tech_migration" | "scaling" | "urgency" | "pain_point" | "leadership_change";
  label: string;
  strength: "strong" | "moderate" | "weak";
}

interface OpportunityScore {
  total: number;
  breakdown: {
    budget: number;
    urgency: number;
    skillMatch: number;
    recency: number;
    companyFit: number;
    enrichmentStatus: number;
    buyingSignals: number;
  };
  signals: string[];
  buyingSignals: BuyingSignal[];
}

export class OpportunityScorer {
  private defaultSkills = [
    "react",
    "node",
    "typescript",
    "javascript",
    "python",
    "aws",
    "api",
    "fullstack",
    "frontend",
    "backend",
  ];

  score(
    job: Job,
    company?: Company | null,
    contacts?: Contact[],
    config?: ScoringConfig
  ): OpportunityScore {
    const skills = config?.targetSkills || this.defaultSkills;
    const breakdown = {
      budget: 0,
      urgency: 0,
      skillMatch: 0,
      recency: 0,
      companyFit: 0,
      enrichmentStatus: 0,
      buyingSignals: 0,
    };
    const signals: string[] = [];
    const buyingSignals: BuyingSignal[] = [];

    const budgetMax = job.budgetMax || 0;
    const budgetMin = job.budgetMin || 0;
    const avgBudget = budgetMax > 0 ? (budgetMin + budgetMax) / 2 : 0;

    if (avgBudget >= 10000) {
      breakdown.budget = 25;
      signals.push("High budget ($10k+)");
    } else if (avgBudget >= 5000) {
      breakdown.budget = 20;
      signals.push("Good budget ($5k+)");
    } else if (avgBudget >= 2000) {
      breakdown.budget = 15;
      signals.push("Moderate budget ($2k+)");
    } else if (avgBudget > 0) {
      breakdown.budget = 10;
    }

    const desc = (job.description || "").toLowerCase();
    const urgencyKeywords = [
      "asap",
      "urgent",
      "immediately",
      "right away",
      "start today",
      "start tomorrow",
      "fast",
      "quick turnaround",
      "rush",
    ];
    const urgencyMatches = urgencyKeywords.filter((k) => desc.includes(k));

    if (urgencyMatches.length >= 2) {
      breakdown.urgency = 20;
      signals.push("High urgency (multiple indicators)");
    } else if (urgencyMatches.length === 1) {
      breakdown.urgency = 15;
      signals.push(`Urgency signal: "${urgencyMatches[0]}"`);
    } else {
      breakdown.urgency = 5;
    }

    const titleAndDesc = `${job.title} ${job.description || ""}`.toLowerCase();
    const matchedSkills = skills.filter((s) => titleAndDesc.includes(s.toLowerCase()));
    const skillMatchRatio = matchedSkills.length / skills.length;

    if (skillMatchRatio >= 0.5) {
      breakdown.skillMatch = 25;
      signals.push(`Strong skill match: ${matchedSkills.slice(0, 3).join(", ")}`);
    } else if (skillMatchRatio >= 0.3) {
      breakdown.skillMatch = 18;
      signals.push(`Good skill match: ${matchedSkills.join(", ")}`);
    } else if (matchedSkills.length >= 1) {
      breakdown.skillMatch = 10;
      signals.push(`Partial skill match: ${matchedSkills.join(", ")}`);
    } else {
      breakdown.skillMatch = 3;
    }

    const postedAt = job.postedAt || job.discoveredAt;
    if (postedAt) {
      const hoursOld = (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60);

      if (hoursOld < 24) {
        breakdown.recency = 15;
        signals.push("Posted within 24 hours");
      } else if (hoursOld < 72) {
        breakdown.recency = 12;
        signals.push("Posted within 3 days");
      } else if (hoursOld < 168) {
        breakdown.recency = 8;
      } else {
        breakdown.recency = 3;
      }
    }

    if (company) {
      const size = company.size || "";
      const preferredSizes = config?.preferredCompanySize || ["11-50", "51-200", "201-500"];

      if (preferredSizes.includes(size)) {
        breakdown.companyFit = 10;
        signals.push(`Good company size: ${size}`);
      } else if (size) {
        breakdown.companyFit = 5;
      }

      if (config?.targetIndustries && company.industry) {
        if (config.targetIndustries.some((i) => company.industry?.toLowerCase().includes(i.toLowerCase()))) {
          breakdown.companyFit += 5;
          signals.push(`Target industry: ${company.industry}`);
        }
      }
    }

    if (job.domainResolved && job.contactFound && job.contactVerified) {
      breakdown.enrichmentStatus = 10;
      signals.push("Fully enriched with verified contact");
    } else if (job.domainResolved && job.contactFound) {
      breakdown.enrichmentStatus = 7;
      signals.push("Has contact (needs verification)");
    } else if (job.domainResolved) {
      breakdown.enrichmentStatus = 4;
      signals.push("Domain resolved");
    } else {
      breakdown.enrichmentStatus = 0;
    }

    if (contacts && contacts.length > 0) {
      const verifiedContacts = contacts.filter((c) => c.emailVerified);
      if (verifiedContacts.length > 0) {
        breakdown.enrichmentStatus = Math.min(breakdown.enrichmentStatus + 3, 15);
        signals.push(`${verifiedContacts.length} verified contact(s)`);
      }
    }

    this.detectBuyingSignals(desc, buyingSignals);
    
    const strongSignals = buyingSignals.filter(s => s.strength === "strong").length;
    const moderateSignals = buyingSignals.filter(s => s.strength === "moderate").length;
    breakdown.buyingSignals = Math.min(15, strongSignals * 5 + moderateSignals * 3 + buyingSignals.length);
    if (buyingSignals.length > 0) {
      signals.push(`${buyingSignals.length} buying signal(s) detected`);
    }

    const total = Math.min(
      100,
      breakdown.budget +
        breakdown.urgency +
        breakdown.skillMatch +
        breakdown.recency +
        breakdown.companyFit +
        breakdown.enrichmentStatus +
        breakdown.buyingSignals
    );

    return { total, breakdown, signals, buyingSignals };
  }

  private detectBuyingSignals(desc: string, signals: BuyingSignal[]): void {
    const fundingPatterns = [
      /(?:raised|secured|closed)\s+\$[\d.]+\s*(?:m|million|b|billion)/i,
      /series\s+[a-e]\s+(?:funding|round)/i,
      /seed\s+(?:round|funding|stage)/i,
      /(?:recently\s+)?funded/i,
      /(?:venture|vc)\s+backed/i,
      /ipo\s+(?:prep|ready|planning)/i,
    ];
    for (const p of fundingPatterns) {
      if (p.test(desc)) {
        signals.push({ type: "funding", label: "Recent funding/investment activity", strength: "strong" });
        break;
      }
    }

    const growthPatterns = [
      { re: /(?:rapidly|fast|hyper)\s*(?:-?\s*)?grow(?:ing|th)/i, label: "Rapid growth phase", strength: "strong" as const },
      { re: /(?:expanding|scaling)\s+(?:team|operations|globally|internationally)/i, label: "Team/operations expansion", strength: "strong" as const },
      { re: /(?:doubl|tripl)(?:ed?|ing)\s+(?:in size|our team|revenue|headcount)/i, label: "Significant scaling", strength: "strong" as const },
      { re: /(?:new|opening)\s+(?:office|hq|headquarters|location)/i, label: "New office/location", strength: "moderate" as const },
      { re: /growing\s+(?:team|company|startup)/i, label: "Growing team", strength: "moderate" as const },
    ];
    for (const { re, label, strength } of growthPatterns) {
      if (re.test(desc)) {
        signals.push({ type: "growth", label, strength });
        break;
      }
    }

    const techPatterns = [
      { re: /migrat(?:ing|ion|e)\s+(?:to|from|our)/i, label: "Technology migration underway", strength: "strong" as const },
      { re: /re(?:-|\s)?(?:architect|build|write|platform|design)(?:ing|ure)/i, label: "System re-architecture", strength: "strong" as const },
      { re: /(?:moderniz|transform|overhaul|revamp)(?:ing|ation|e)/i, label: "Tech modernization", strength: "moderate" as const },
      { re: /(?:greenfield|ground\s*up|from\s+scratch|brand\s+new)\s+(?:project|product|platform|system)/i, label: "Greenfield project", strength: "strong" as const },
      { re: /(?:legacy|monolith)\s+(?:system|code|application|platform)/i, label: "Legacy system replacement", strength: "moderate" as const },
      { re: /microservice/i, label: "Microservices adoption", strength: "weak" as const },
    ];
    for (const { re, label, strength } of techPatterns) {
      if (re.test(desc)) {
        signals.push({ type: "tech_migration", label, strength });
        break;
      }
    }

    const scalingPatterns = [
      { re: /(?:millions?\s+of\s+(?:users|customers|transactions))/i, label: "High-scale system", strength: "strong" as const },
      { re: /(?:high\s+(?:volume|traffic|throughput|availability|performance))/i, label: "High-performance requirements", strength: "moderate" as const },
      { re: /(?:scaling|scale)\s+(?:challenges?|issues?|problems?|our|the)/i, label: "Scaling challenges", strength: "strong" as const },
      { re: /enterprise[\s-](?:grade|level|scale)/i, label: "Enterprise-scale needs", strength: "moderate" as const },
    ];
    for (const { re, label, strength } of scalingPatterns) {
      if (re.test(desc)) {
        signals.push({ type: "scaling", label, strength });
        break;
      }
    }

    const urgencyPatterns = [
      { re: /(?:critical|mission[\s-]critical|time[\s-]sensitive|deadline[\s-]driven)/i, label: "Critical timeline", strength: "strong" as const },
      { re: /(?:immediately|asap|right\s+away|start\s+(?:today|tomorrow|next\s+week|immediately))/i, label: "Immediate start needed", strength: "strong" as const },
      { re: /(?:behind\s+schedule|falling\s+behind|catching\s+up|backlog)/i, label: "Project behind schedule", strength: "strong" as const },
      { re: /(?:quick\s+turnaround|fast[\s-]paced|tight\s+deadline)/i, label: "Fast turnaround needed", strength: "moderate" as const },
    ];
    for (const { re, label, strength } of urgencyPatterns) {
      if (re.test(desc)) {
        signals.push({ type: "urgency", label, strength });
        break;
      }
    }

    const painPointPatterns = [
      { re: /(?:struggling|challenged|difficulty|pain\s+point|bottleneck)/i, label: "Identified pain points", strength: "strong" as const },
      { re: /(?:technical\s+debt|code\s+quality|reliability\s+issue|downtime|outage)/i, label: "Technical debt/reliability issues", strength: "strong" as const },
      { re: /(?:compliance|regulatory|gdpr|hipaa|sox|pci)/i, label: "Compliance requirements", strength: "moderate" as const },
      { re: /(?:security\s+(?:audit|breach|incident|concern|review))/i, label: "Security concerns", strength: "strong" as const },
    ];
    for (const { re, label, strength } of painPointPatterns) {
      if (re.test(desc)) {
        signals.push({ type: "pain_point", label, strength });
        break;
      }
    }

    const leadershipPatterns = [
      { re: /(?:new\s+(?:cto|ceo|vp|head|director|chief))/i, label: "New leadership hire", strength: "strong" as const },
      { re: /(?:first\s+(?:engineering|developer|technical|product)\s+hire)/i, label: "First technical hire", strength: "strong" as const },
      { re: /(?:building\s+(?:the|our|a)\s+(?:engineering|dev|product|tech)\s+team\s+from)/i, label: "Building team from scratch", strength: "strong" as const },
    ];
    for (const { re, label, strength } of leadershipPatterns) {
      if (re.test(desc)) {
        signals.push({ type: "leadership_change", label, strength });
        break;
      }
    }
  }

  rankJobs(
    jobs: Array<{ job: Job; company?: Company | null; contacts?: Contact[] }>,
    config?: ScoringConfig
  ): Array<{ job: Job; company?: Company | null; contacts?: Contact[]; score: OpportunityScore }> {
    return jobs
      .map((item) => ({
        ...item,
        score: this.score(item.job, item.company, item.contacts, config),
      }))
      .sort((a, b) => b.score.total - a.score.total);
  }

  getTopOpportunities(
    jobs: Array<{ job: Job; company?: Company | null; contacts?: Contact[] }>,
    limit: number = 10,
    config?: ScoringConfig
  ) {
    return this.rankJobs(jobs, config).slice(0, limit);
  }
}

export const opportunityScorer = new OpportunityScorer();
