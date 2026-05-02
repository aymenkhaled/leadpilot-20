import OpenAI from "openai";

interface ExtractedCompanyInfo {
  companyName: string | null;
  companyDomain: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedIn: string | null;
  contactName: string | null;
  contactTitle: string | null;
  confidence: number;
}

export class AICompanyExtractor {
  private openai: OpenAI | null = null;

  configure(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  isConfigured(): boolean {
    return this.openai !== null;
  }

  async extractFromJobDescription(
    jobTitle: string,
    jobDescription: string,
    platform: string
  ): Promise<ExtractedCompanyInfo> {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
      } else {
        return this.fallbackExtraction(jobDescription);
      }
    }

    try {
      const prompt = `Analyze this job posting and extract company and contact information.

Job Title: ${jobTitle}
Platform: ${platform}
Job Description:
${jobDescription.slice(0, 4000)}

Extract the following information (return null if not found):

1. Company Name - The actual company hiring (not the job board or "Confidential")
2. Company Domain/Website - Look for URLs in the text
3. Contact Email - Any email addresses mentioned
4. Contact Phone - Any phone numbers mentioned  
5. Contact LinkedIn - Any LinkedIn profile URLs
6. Contact Name - Name of recruiter, hiring manager, or poster
7. Contact Title - Title of the contact person

Return a JSON object with these exact keys:
{
  "companyName": "string or null",
  "companyDomain": "string or null (just domain like 'company.com', not full URL)",
  "contactEmail": "string or null",
  "contactPhone": "string or null",
  "contactLinkedIn": "string or null",
  "contactName": "string or null",
  "contactTitle": "string or null",
  "confidence": number (0-100 indicating confidence in the company name)
}

Only return valid JSON, no other text.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        return this.fallbackExtraction(jobDescription);
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackExtraction(jobDescription);
      }

      const parsed = JSON.parse(jsonMatch[0]) as ExtractedCompanyInfo;

      if (parsed.companyDomain) {
        parsed.companyDomain = this.cleanDomain(parsed.companyDomain);
      }

      return {
        companyName: parsed.companyName || null,
        companyDomain: parsed.companyDomain || null,
        contactEmail: parsed.contactEmail || this.extractEmail(jobDescription),
        contactPhone: parsed.contactPhone || this.extractPhone(jobDescription),
        contactLinkedIn: parsed.contactLinkedIn || this.extractLinkedIn(jobDescription),
        contactName: parsed.contactName || null,
        contactTitle: parsed.contactTitle || null,
        confidence: parsed.confidence || 50,
      };
    } catch (error) {
      console.error("AI extraction error:", error);
      return this.fallbackExtraction(jobDescription);
    }
  }

  private fallbackExtraction(text: string): ExtractedCompanyInfo {
    return {
      companyName: null,
      companyDomain: this.extractDomain(text),
      contactEmail: this.extractEmail(text),
      contactPhone: this.extractPhone(text),
      contactLinkedIn: this.extractLinkedIn(text),
      contactName: null,
      contactTitle: null,
      confidence: 30,
    };
  }

  private extractEmail(text: string): string | null {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailRegex);
    if (!matches) return null;

    const validEmails = matches.filter((email) => {
      const lower = email.toLowerCase();
      return (
        !lower.includes("@example.") &&
        !lower.includes("@test.") &&
        !lower.includes("@your") &&
        !lower.includes("noreply") &&
        !lower.includes("no-reply") &&
        !lower.includes("donotreply")
      );
    });

    return validEmails[0] || null;
  }

  private extractPhone(text: string): string | null {
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    const matches = text.match(phoneRegex);
    return matches?.[0] || null;
  }

  private extractLinkedIn(text: string): string | null {
    const linkedInRegex = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi;
    const matches = text.match(linkedInRegex);
    return matches?.[0] || null;
  }

  private extractDomain(text: string): string | null {
    const urlRegex = /https?:\/\/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/gi;
    const matches = text.match(urlRegex);
    if (!matches) return null;

    for (const match of matches) {
      const domain = this.cleanDomain(match);
      if (domain && !this.isJobBoard(domain)) {
        return domain;
      }
    }
    return null;
  }

  private cleanDomain(input: string): string | null {
    if (!input) return null;
    let domain = input
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();

    if (!domain.includes(".")) return null;
    return domain;
  }

  private isJobBoard(domain: string): boolean {
    const jobBoards = [
      "linkedin.com",
      "indeed.com",
      "glassdoor.com",
      "upwork.com",
      "fiverr.com",
      "freelancer.com",
      "monster.com",
      "ziprecruiter.com",
      "weworkremotely.com",
      "remoteok.com",
      "greenhouse.io",
      "lever.co",
      "workable.com",
      "dice.com",
    ];
    return jobBoards.some((jb) => domain.includes(jb));
  }
}

export const aiCompanyExtractor = new AICompanyExtractor();
