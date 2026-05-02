import axios from "axios";
import { prospeoService } from "./prospeo";
import { rocketReachService } from "./rocketreach";

interface LinkedInProfile {
  name: string;
  title?: string;
  linkedinUrl: string;
  company?: string;
}

interface PersonContactResult {
  success: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  linkedinUrl?: string;
  source: string;
  confidence: number;
  error?: string;
}

export class LinkedInFinder {
  private serperApiKey: string | null = null;

  setApiKey(key: string) {
    this.serperApiKey = key;
  }

  isConfigured(): boolean {
    return !!this.serperApiKey;
  }

  async findLinkedInProfile(
    personName: string,
    companyName?: string,
    jobTitle?: string
  ): Promise<LinkedInProfile | null> {
    if (!this.serperApiKey) return null;

    try {
      let query = `site:linkedin.com/in "${personName}"`;
      if (companyName) query += ` "${companyName}"`;
      if (jobTitle) query += ` ${jobTitle}`;

      const response = await axios.post(
        "https://google.serper.dev/search",
        { q: query, num: 5 },
        {
          headers: { "X-API-KEY": this.serperApiKey },
          timeout: 10000,
        }
      );

      const results = response.data.organic || [];
      
      for (const result of results) {
        const link = result.link || "";
        if (link.includes("linkedin.com/in/")) {
          const title = result.title || "";
          const snippet = result.snippet || "";
          
          const extractedTitle = this.extractTitleFromSnippet(snippet);
          const extractedCompany = this.extractCompanyFromSnippet(snippet);
          
          return {
            name: personName,
            linkedinUrl: link,
            title: extractedTitle || jobTitle,
            company: extractedCompany || companyName,
          };
        }
      }
    } catch (error) {
      console.error("LinkedIn search error:", error);
    }

    return null;
  }

  async findDecisionMakers(
    companyName: string,
    titles: string[] = ["CEO", "CTO", "Founder", "Director", "Hiring Manager"]
  ): Promise<LinkedInProfile[]> {
    if (!this.serperApiKey) return [];

    const profiles: LinkedInProfile[] = [];
    
    try {
      const titleQuery = titles.slice(0, 3).join(" OR ");
      const query = `site:linkedin.com/in "${companyName}" (${titleQuery})`;

      const response = await axios.post(
        "https://google.serper.dev/search",
        { q: query, num: 10 },
        {
          headers: { "X-API-KEY": this.serperApiKey },
          timeout: 15000,
        }
      );

      const results = response.data.organic || [];
      
      for (const result of results) {
        const link = result.link || "";
        if (link.includes("linkedin.com/in/")) {
          const title = result.title || "";
          const snippet = result.snippet || "";
          
          const name = this.extractNameFromTitle(title);
          const extractedTitle = this.extractTitleFromSnippet(snippet);
          
          if (name && this.isDecisionMakerTitle(extractedTitle, titles)) {
            profiles.push({
              name,
              linkedinUrl: link,
              title: extractedTitle,
              company: companyName,
            });
          }
        }
      }
    } catch (error) {
      console.error("Decision maker search error:", error);
    }

    return profiles.slice(0, 5);
  }

  async getEmailFromLinkedIn(linkedinUrl: string): Promise<PersonContactResult> {
    if (prospeoService.isConfigured()) {
      const result = await prospeoService.findEmailByLinkedIn(linkedinUrl);
      if (result.success && result.contacts.length > 0) {
        const contact = result.contacts[0];
        return {
          success: true,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title,
          linkedinUrl,
          source: "prospeo",
          confidence: contact.confidence,
        };
      }
    }

    if (rocketReachService.isConfigured()) {
      const result = await rocketReachService.lookupByLinkedIn(linkedinUrl);
      if (result.success && result.contacts.length > 0) {
        const contact = result.contacts[0];
        return {
          success: true,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title,
          linkedinUrl,
          source: "rocketreach",
          confidence: contact.confidence,
        };
      }
    }

    return {
      success: false,
      source: "none",
      confidence: 0,
      error: "No email enrichment API configured or no email found",
    };
  }

  async findPersonEmail(
    personName: string,
    companyName?: string,
    jobTitle?: string
  ): Promise<PersonContactResult> {
    const profile = await this.findLinkedInProfile(personName, companyName, jobTitle);
    
    if (profile) {
      const emailResult = await this.getEmailFromLinkedIn(profile.linkedinUrl);
      if (emailResult.success) {
        return {
          ...emailResult,
          linkedinUrl: profile.linkedinUrl,
        };
      }
    }

    const nameParts = personName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";

    if (companyName && prospeoService.isConfigured()) {
      const domain = this.inferDomainFromCompany(companyName);
      if (domain) {
        const result = await prospeoService.findEmailByDomain(firstName, lastName, domain);
        if (result.success && result.contacts.length > 0) {
          const contact = result.contacts[0];
          return {
            success: true,
            email: contact.email,
            firstName: contact.firstName || firstName,
            lastName: contact.lastName || lastName,
            title: jobTitle,
            source: "prospeo",
            confidence: contact.confidence,
          };
        }
      }
    }

    if (companyName && rocketReachService.isConfigured()) {
      const domain = this.inferDomainFromCompany(companyName);
      if (domain) {
        const result = await rocketReachService.lookupByName(firstName, lastName, domain);
        if (result.success && result.contacts.length > 0) {
          const contact = result.contacts[0];
          return {
            success: true,
            email: contact.email,
            firstName: contact.firstName || firstName,
            lastName: contact.lastName || lastName,
            title: contact.title || jobTitle,
            linkedinUrl: contact.linkedinUrl,
            source: "rocketreach",
            confidence: contact.confidence,
          };
        }
      }
    }

    return {
      success: false,
      source: "none",
      confidence: 0,
      error: "Could not find email for person",
    };
  }

  private extractNameFromTitle(title: string): string | null {
    const match = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (match) return match[1];
    
    const parts = title.split(/\s*[-–|]\s*/);
    if (parts.length > 0) {
      const namePart = parts[0].trim();
      if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(namePart)) {
        return namePart;
      }
    }
    
    return null;
  }

  private extractTitleFromSnippet(snippet: string): string | null {
    const patterns = [
      /\b(CEO|CTO|CFO|COO|CMO|Founder|Co-Founder|Director|VP|Vice President|Manager|Head of|Chief)\b[^.]*?(?:at|@|\||–|-|,)/i,
      /\b(CEO|CTO|CFO|COO|CMO|Founder|Co-Founder|Director|VP|Vice President|Manager|Head of|Chief)[^.]{0,50}/i,
    ];

    for (const pattern of patterns) {
      const match = snippet.match(pattern);
      if (match) {
        return match[0].replace(/\s*(at|@|\||–|-|,).*$/, "").trim();
      }
    }

    return null;
  }

  private extractCompanyFromSnippet(snippet: string): string | null {
    const patterns = [
      /(?:at|@)\s+([A-Z][a-zA-Z0-9\s]+?)(?:\s*[·|•|\||–|-]|$)/,
      /(?:at|@)\s+([A-Z][a-zA-Z0-9\s]{2,30})/,
    ];

    for (const pattern of patterns) {
      const match = snippet.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private isDecisionMakerTitle(title: string | null, targetTitles: string[]): boolean {
    if (!title) return false;
    const lowerTitle = title.toLowerCase();
    return targetTitles.some(t => lowerTitle.includes(t.toLowerCase()));
  }

  private inferDomainFromCompany(companyName: string): string | null {
    const cleaned = companyName
      .toLowerCase()
      .replace(/\s*(inc\.?|llc|ltd|corp\.?|corporation|company|co\.?|gmbh|ag|bv|sa)\s*$/i, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

    if (cleaned.length < 2) return null;
    return `${cleaned}.com`;
  }
}

export const linkedInFinder = new LinkedInFinder();
