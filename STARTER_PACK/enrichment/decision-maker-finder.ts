import axios from "axios";
import { websiteScraper } from "./website-scraper";
import { prospeoService } from "./prospeo";
import { rocketReachService } from "./rocketreach";

interface DecisionMaker {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  source: string;
  confidence: number;
  isDecisionMaker: boolean;
  decisionMakerScore: number;
}

interface FinderResult {
  success: boolean;
  contacts: DecisionMaker[];
  creditsUsed: number;
  sources: string[];
}

const DECISION_MAKER_TITLES = [
  { pattern: /\b(ceo|chief executive officer)\b/i, score: 100 },
  { pattern: /\b(founder|co-founder|cofounder)\b/i, score: 98 },
  { pattern: /\b(owner)\b/i, score: 97 },
  { pattern: /\bpresident\b/i, score: 96 },
  { pattern: /\b(managing director)\b/i, score: 95 },
  { pattern: /\b(partner)\b/i, score: 94 },
  { pattern: /\b(cto|chief technology officer)\b/i, score: 92 },
  { pattern: /\b(coo|chief operating officer)\b/i, score: 91 },
  { pattern: /\b(cfo|chief financial officer)\b/i, score: 90 },
  { pattern: /\b(cmo|chief marketing officer)\b/i, score: 90 },
  { pattern: /\b(cro|chief revenue officer)\b/i, score: 90 },
  { pattern: /\b(cpo|chief product officer)\b/i, score: 90 },
  { pattern: /\b(hiring manager)\b/i, score: 88 },
  { pattern: /\b(talent acquisition)\b/i, score: 87 },
  { pattern: /\b(recruiting director)\b/i, score: 86 },
  { pattern: /\b(hr director)\b/i, score: 85 },
  { pattern: /\b(people operations)\b/i, score: 84 },
  { pattern: /\b(hr manager)\b/i, score: 83 },
  { pattern: /\b(head of|head,)\b/i, score: 80 },
  { pattern: /\b(vp|vice president)\b/i, score: 78 },
  { pattern: /\b(director)\b/i, score: 75 },
  { pattern: /\b(business development)\b/i, score: 72 },
  { pattern: /\b(staffing)\b/i, score: 70 },
  { pattern: /\b(procurement)\b/i, score: 68 },
  { pattern: /\b(partnerships)\b/i, score: 65 },
  { pattern: /\b(engineering manager|tech lead|team lead)\b/i, score: 62 },
  { pattern: /\b(manager)\b/i, score: 60 },
  { pattern: /\b(senior|lead)\b/i, score: 40 },
];

const NON_DECISION_MAKER_TITLES = [
  { pattern: /\b(developer|engineer|designer|analyst)\b/i, score: 5 },
  { pattern: /\b(intern|student|assistant|coordinator)\b/i, score: 3 },
  { pattern: /\b(customer support|help desk|support specialist)\b/i, score: 5 },
];

export class DecisionMakerFinder {
  calculateDecisionMakerScore(title?: string): number {
    if (!title) return 10;

    const lowerTitle = title.toLowerCase();
    
    // Check NEGATIVE patterns first - if title matches non-decision-maker pattern
    // AND doesn't also match a decision-maker pattern, give it the low score
    for (const { pattern: negPattern, score: negScore } of NON_DECISION_MAKER_TITLES) {
      if (negPattern.test(lowerTitle)) {
        // Check if it also matches a positive decision-maker pattern
        const matchesPositive = DECISION_MAKER_TITLES.some(({ pattern }) => 
          pattern.test(lowerTitle)
        );
        if (!matchesPositive) {
          return negScore;
        }
      }
    }
    
    // Check positive decision-maker patterns
    for (const { pattern, score } of DECISION_MAKER_TITLES) {
      if (pattern.test(lowerTitle)) {
        return score;
      }
    }

    return 10;
  }

  isDecisionMaker(title?: string): boolean {
    // Score threshold of 60 indicates clear decision-making authority or hiring capability
    return this.calculateDecisionMakerScore(title) >= 60;
  }

  async findByDomain(
    domain: string,
    companyName?: string,
    targetTitles?: string[]
  ): Promise<FinderResult> {
    const allContacts: DecisionMaker[] = [];
    const sources: string[] = [];
    let creditsUsed = 0;

    console.log(`[DecisionMaker] Finding decision makers for ${domain}`);

    // Step 1: Website scraping (FREE) - discover people names, LinkedIn URLs, and emails
    let scrapedPeople: { firstName?: string; lastName?: string; name?: string; title?: string; email?: string; linkedinUrl?: string }[] = [];
    try {
      const websiteContacts = await websiteScraper.scrapeContacts(domain);
      scrapedPeople = websiteContacts;
      for (const wc of websiteContacts) {
        if (wc.email || wc.name) {
          const score = this.calculateDecisionMakerScore(wc.title);
          allContacts.push({
            firstName: wc.firstName,
            lastName: wc.lastName,
            fullName: wc.name,
            title: wc.title,
            email: wc.email,
            linkedinUrl: wc.linkedinUrl,
            source: "website",
            confidence: wc.email ? 70 : 30,
            isDecisionMaker: score >= 60,
            decisionMakerScore: score,
          });
        }
      }
      if (websiteContacts.length > 0) {
        sources.push("website");
        console.log(`[DecisionMaker] Website: found ${websiteContacts.length} contacts`);
      }
    } catch (error: any) {
      console.log(`[DecisionMaker] Website scraping failed: ${error.message}`);
    }

    // Step 2: Prospeo enrich-person (uses discovered names + domain)
    if (prospeoService.isConfigured()) {
      const namesToLookup: { firstName: string; lastName: string }[] = [];

      for (const sp of scrapedPeople) {
        if (sp.firstName && sp.lastName) {
          namesToLookup.push({ firstName: sp.firstName, lastName: sp.lastName });
        } else if (sp.name) {
          const parts = sp.name.trim().split(/\s+/);
          if (parts.length >= 2) {
            namesToLookup.push({ firstName: parts[0], lastName: parts.slice(1).join(" ") });
          }
        }
      }

      // Also try company name as person for freelancers/solopreneurs
      if (namesToLookup.length === 0 && companyName) {
        const parts = companyName.trim().split(/\s+/);
        if (parts.length === 2 && parts[0].length > 1 && parts[1].length > 1) {
          namesToLookup.push({ firstName: parts[0], lastName: parts[1] });
        }
      }

      // If still no names, try LinkedIn URLs from scraping via Prospeo LinkedIn lookup
      if (namesToLookup.length === 0) {
        const linkedinUrls = scrapedPeople
          .filter(sp => sp.linkedinUrl)
          .map(sp => sp.linkedinUrl!)
          .slice(0, 2);
        
        for (const url of linkedinUrls) {
          const liResult = await prospeoService.findEmailByLinkedIn(url);
          creditsUsed += liResult.creditsUsed;
          for (const pc of liResult.contacts) {
            if (pc.email && !allContacts.find(c => c.email === pc.email)) {
              const score = this.calculateDecisionMakerScore(pc.title);
              allContacts.push({
                firstName: pc.firstName,
                lastName: pc.lastName,
                fullName: pc.firstName && pc.lastName ? `${pc.firstName} ${pc.lastName}` : undefined,
                title: pc.title,
                email: pc.email,
                source: "prospeo",
                confidence: pc.confidence,
                isDecisionMaker: score >= 60,
                decisionMakerScore: score,
              });
            }
          }
        }
      }

      for (const person of namesToLookup.slice(0, 3)) {
        if (allContacts.find(c => c.email && c.firstName?.toLowerCase() === person.firstName.toLowerCase() && c.lastName?.toLowerCase() === person.lastName.toLowerCase())) {
          continue;
        }
        const prospeoResult = await prospeoService.findEmailByDomain(person.firstName, person.lastName, domain);
        creditsUsed += prospeoResult.creditsUsed;
        for (const pc of prospeoResult.contacts) {
          if (pc.email && !allContacts.find(c => c.email === pc.email)) {
            const score = this.calculateDecisionMakerScore(pc.title);
            allContacts.push({
              firstName: pc.firstName,
              lastName: pc.lastName,
              fullName: pc.firstName && pc.lastName ? `${pc.firstName} ${pc.lastName}` : undefined,
              title: pc.title,
              email: pc.email,
              source: "prospeo",
              confidence: pc.confidence,
              isDecisionMaker: score >= 60,
              decisionMakerScore: score,
            });
          }
        }
      }
      if (allContacts.some(c => c.source === "prospeo")) {
        sources.push("prospeo");
        console.log(`[DecisionMaker] Prospeo: found ${allContacts.filter(c => c.source === "prospeo").length} contacts`);
      }
    }

    // Step 3: RocketReach as fallback (if still need decision makers)
    if (rocketReachService.isConfigured() && allContacts.filter(c => c.isDecisionMaker && c.email).length < 2) {
      const titles = targetTitles || ["CEO", "CTO", "Founder", "Owner", "President", "Managing Director", "Director", "Hiring Manager", "VP Engineering"];
      const rrResult = await rocketReachService.searchCompany(domain, titles);
      creditsUsed += rrResult.creditsUsed;

      for (const rc of rrResult.contacts) {
        if (!allContacts.find(c => c.email === rc.email)) {
          const score = this.calculateDecisionMakerScore(rc.title);
          allContacts.push({
            firstName: rc.firstName,
            lastName: rc.lastName,
            fullName: rc.firstName && rc.lastName ? `${rc.firstName} ${rc.lastName}` : undefined,
            title: rc.title,
            email: rc.email,
            phone: rc.phone,
            linkedinUrl: rc.linkedinUrl,
            source: "rocketreach",
            confidence: rc.confidence,
            isDecisionMaker: score >= 60,
            decisionMakerScore: score,
          });
        }
      }
      if (rrResult.contacts.length > 0) {
        sources.push("rocketreach");
        console.log(`[DecisionMaker] RocketReach: found ${rrResult.contacts.length} contacts`);
      }
    }

    // Sort by decision maker score (highest first), then by confidence
    allContacts.sort((a, b) => {
      if (b.decisionMakerScore !== a.decisionMakerScore) {
        return b.decisionMakerScore - a.decisionMakerScore;
      }
      return b.confidence - a.confidence;
    });

    // Filter to only those with emails
    const withEmails = allContacts.filter(c => c.email);
    
    console.log(`[DecisionMaker] Total: ${withEmails.length} contacts with emails, ${withEmails.filter(c => c.isDecisionMaker).length} decision makers`);

    return {
      success: withEmails.length > 0,
      contacts: withEmails,
      creditsUsed,
      sources,
    };
  }

  async findByLinkedIn(linkedinUrl: string): Promise<DecisionMaker | null> {
    if (prospeoService.isConfigured()) {
      const result = await prospeoService.findEmailByLinkedIn(linkedinUrl);
      if (result.success && result.contacts.length > 0) {
        const contact = result.contacts[0];
        const score = this.calculateDecisionMakerScore(contact.title);
        return {
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : undefined,
          title: contact.title,
          email: contact.email,
          linkedinUrl,
          source: "prospeo_linkedin",
          confidence: contact.confidence,
          isDecisionMaker: score >= 60,
          decisionMakerScore: score,
        };
      }
    }
    return null;
  }

  getBestContact(contacts: DecisionMaker[]): DecisionMaker | null {
    if (contacts.length === 0) return null;

    // Priority 1: Decision makers with email (score >= 60)
    const decisionMakers = contacts.filter(c => c.decisionMakerScore >= 60 && c.email);
    if (decisionMakers.length > 0) {
      const selected = decisionMakers[0];
      console.log(`[DecisionMaker] Selected best contact: "${selected.fullName || selected.firstName} ${selected.lastName}" (${selected.title}) from ${selected.source} - Score: ${selected.decisionMakerScore} (decision maker priority)`);
      return selected;
    }

    // Priority 2: Any contact with email and score >= 40
    const midScore = contacts.filter(c => c.decisionMakerScore >= 40 && c.email);
    if (midScore.length > 0) {
      const selected = midScore[0];
      console.log(`[DecisionMaker] Selected best contact: "${selected.fullName || selected.firstName} ${selected.lastName}" (${selected.title}) from ${selected.source} - Score: ${selected.decisionMakerScore} (moderate score priority)`);
      return selected;
    }

    // Priority 3: Any contact with email (last resort)
    const withEmail = contacts.filter(c => c.email);
    if (withEmail.length > 0) {
      const selected = withEmail[0];
      console.log(`[DecisionMaker] Selected best contact: "${selected.fullName || selected.firstName} ${selected.lastName}" (${selected.title}) from ${selected.source} - Score: ${selected.decisionMakerScore} (last resort - any contact with email)`);
      return selected;
    }

    return null;
  }
}

export const decisionMakerFinder = new DecisionMakerFinder();
