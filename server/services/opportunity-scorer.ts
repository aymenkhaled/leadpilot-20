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
}

export class OpportunityScorer {
  score(job: any, company?: any, contacts?: any[]): OpportunityScore {
    const breakdown = { budget: 0, urgency: 0, skillMatch: 0, recency: 0, companyFit: 0, enrichmentStatus: 0, buyingSignals: 0 };
    const signals: string[] = [];

    // Budget scoring
    const budgetMax = job.budgetMax || 0;
    const budgetMin = job.budgetMin || 0;
    const avgBudget = budgetMax > 0 ? (budgetMin + budgetMax) / 2 : 0;
    if (avgBudget >= 10000) { breakdown.budget = 25; signals.push("High budget ($10k+)"); }
    else if (avgBudget >= 5000) { breakdown.budget = 20; signals.push("Good budget ($5k+)"); }
    else if (avgBudget >= 2000) { breakdown.budget = 15; signals.push("Moderate budget ($2k+)"); }
    else if (avgBudget > 0) breakdown.budget = 10;

    // Urgency
    const desc = (job.description || "").toLowerCase();
    const urgencyKeywords = ["asap", "urgent", "immediately", "right away", "start today", "quick turnaround"];
    const urgencyMatches = urgencyKeywords.filter(k => desc.includes(k));
    if (urgencyMatches.length >= 2) { breakdown.urgency = 20; signals.push("High urgency"); }
    else if (urgencyMatches.length === 1) { breakdown.urgency = 15; signals.push(`Urgency: "${urgencyMatches[0]}"`); }
    else breakdown.urgency = 5;

    // Recency
    const postedAt = job.postedAt || job.discoveredAt;
    if (postedAt) {
      const hoursOld = (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60);
      if (hoursOld < 24) { breakdown.recency = 15; signals.push("Posted within 24 hours"); }
      else if (hoursOld < 72) { breakdown.recency = 12; signals.push("Posted within 3 days"); }
      else if (hoursOld < 168) breakdown.recency = 8;
      else breakdown.recency = 3;
    }

    // Enrichment status
    if (job.domainResolved && job.contactFound && job.contactVerified) {
      breakdown.enrichmentStatus = 10; signals.push("Fully enriched");
    } else if (job.domainResolved && job.contactFound) {
      breakdown.enrichmentStatus = 7; signals.push("Contact found");
    } else if (job.domainResolved) {
      breakdown.enrichmentStatus = 4; signals.push("Domain resolved");
    }

    // Buying signals
    const buyingSignalPatterns = [
      { re: /series\s+[a-e]|raised.*\$|funding/i, label: "Funding activity" },
      { re: /migrat|re-architect|greenfield|from scratch/i, label: "Tech migration" },
      { re: /scaling|growing team|expanding/i, label: "Growth phase" },
      { re: /new\s+(cto|ceo|vp|head of)/i, label: "New leadership" },
    ];
    for (const { re, label } of buyingSignalPatterns) {
      if (re.test(desc)) { breakdown.buyingSignals += 5; signals.push(label); }
    }
    breakdown.buyingSignals = Math.min(15, breakdown.buyingSignals);

    const total = Math.min(100,
      breakdown.budget + breakdown.urgency + breakdown.skillMatch +
      breakdown.recency + breakdown.companyFit + breakdown.enrichmentStatus + breakdown.buyingSignals
    );

    return { total, breakdown, signals };
  }
}

export const opportunityScorer = new OpportunityScorer();
