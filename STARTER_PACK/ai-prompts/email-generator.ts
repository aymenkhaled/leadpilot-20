import OpenAI from "openai";

interface CompanyProfile {
  companyName?: string;
  website?: string;
  domain?: string;
  services?: string;
  projects?: string;
  description?: string;
  pitch?: string;
  linkedin?: string;
  portfolioUrl?: string;
  cvUrl?: string;
  cvContent?: string;
  exampleEmails?: string;
  profileTone?: string;
}

interface JobDetails {
  title: string;
  description: string;
  companyName?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: string;
  platform?: string;
  buyingSignals?: Array<{ type: string; label: string; strength: string }>;
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

export class EmailGenerator {
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

  async generateOutreachEmail(
    profile: CompanyProfile,
    job: JobDetails,
    recipientName?: string,
    userApiKey?: string
  ): Promise<GeneratedEmail> {
    if (userApiKey) {
      this.setApiKey(userApiKey);
    } else if (!this.openai) {
      this.initialize();
    }

    if (!this.openai) {
      return this.generateFallbackEmail(profile, job, recipientName);
    }

    try {
      const prompt = this.buildPrompt(profile, job, recipientName);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: this.buildSystemPrompt(profile)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.92,
        max_tokens: 600,
        top_p: 0.95,
        frequency_penalty: 0.4,
        presence_penalty: 0.3,
      });

      const content = response.choices[0]?.message?.content || "";
      return this.parseEmailResponse(content, profile, job);

    } catch (error: any) {
      console.error("[EmailGenerator] OpenAI error:", error.message);
      return this.generateFallbackEmail(profile, job, recipientName);
    }
  }

  private buildSystemPrompt(profile: CompanyProfile): string {
    const toneGuide = profile.profileTone === "casual"
      ? "Write like you're messaging a colleague you respect but haven't met. Slightly informal, warm, direct."
      : profile.profileTone === "friendly"
        ? "Write like a friendly professional. Warm but businesslike."
        : "Write like a seasoned professional. Confident, measured, respectful.";

    let styleGuide = "";
    if (profile.exampleEmails) {
      styleGuide = `\n\nCRITICAL - STYLE MATCHING: The sender provided example emails showing their personal writing style. You MUST closely match this style - vocabulary, sentence length, greeting style, sign-off, and overall voice:\n\n---\n${profile.exampleEmails}\n---\n\nMirror their patterns exactly: contractions, sentence structure, opening/closing style.`;
    }

    return `You write cold outreach emails on behalf of a real person. Your emails must be indistinguishable from a thoughtful human who spent 5 minutes writing a personalized note after reading a job post.

RULES FOR HUMAN-SOUNDING EMAILS:
1. Never start with "I hope this email finds you well" or "I came across your posting"
2. Vary openings - question, observation about their company, or jump straight to value
3. Use contractions naturally (I'm, we've, you're, don't)
4. Include 1-2 natural imperfections: casual aside in parentheses, dash instead of comma, start with "And" or "But"
5. Mix sentence lengths - short punchy ones with longer flowing ones
6. Never use: "synergy", "leverage", "cutting-edge", "state-of-the-art", "game-changer", "innovative solutions"
7. Reference ONE specific detail from their job post
8. Keep body under 120 words
9. Single low-pressure CTA at the end
10. No bullet points or numbered lists in the body
11. Simple sign-off - just name, maybe company
12. Subject lines: under 7 words, specific, not salesy

${toneGuide}
${styleGuide}

Format your response exactly as:
SUBJECT: [subject line]
BODY:
[email body]`;
  }

  private buildPrompt(profile: CompanyProfile, job: JobDetails, recipientName?: string): string {
    let prompt = `Write a personalized cold outreach email based on the following EVIDENCE:\n\n`;

    prompt += `=== ABOUT ME/MY COMPANY ===\n`;
    if (profile.companyName) prompt += `Company: ${profile.companyName}\n`;
    if (profile.services) prompt += `What we do: ${profile.services}\n`;
    if (profile.description) prompt += `Our story: ${profile.description.substring(0, 300)}\n`;
    if (profile.pitch) prompt += `Our edge: ${profile.pitch}\n`;
    if (profile.projects) prompt += `Relevant past work: ${profile.projects.substring(0, 300)}\n`;
    if (profile.website) prompt += `Website: ${profile.website}\n`;
    if (profile.portfolioUrl) prompt += `Portfolio: ${profile.portfolioUrl}\n`;
    if (profile.cvUrl) prompt += `CV/Resume: ${profile.cvUrl}\n`;
    if (profile.linkedin) prompt += `LinkedIn: ${profile.linkedin}\n`;
    if (profile.cvContent) prompt += `Key qualifications from CV: ${profile.cvContent.substring(0, 400)}\n`;

    prompt += `\n=== THEIR JOB POSTING ===\n`;
    prompt += `Role: ${job.title}\n`;
    if (job.companyName) prompt += `Company: ${job.companyName}\n`;
    if (job.budgetMin || job.budgetMax) {
      prompt += `Budget: $${job.budgetMin || 0} - $${job.budgetMax || 'negotiable'}`;
      if (job.budgetType) prompt += ` (${job.budgetType})`;
      prompt += `\n`;
    }
    if (job.platform) prompt += `Found on: ${job.platform}\n`;
    
    const descExcerpt = job.description.substring(0, 600);
    prompt += `Description: ${descExcerpt}\n`;

    if (job.buyingSignals && job.buyingSignals.length > 0) {
      prompt += `\n=== BUYING SIGNALS DETECTED ===\n`;
      for (const signal of job.buyingSignals) {
        prompt += `- [${signal.strength.toUpperCase()}] ${signal.label}\n`;
      }
      prompt += `(Use at most ONE of these naturally in the email to show you understand their current situation)\n`;
    }

    if (recipientName) {
      prompt += `\nRecipient: ${recipientName} (use their first name)\n`;
    }

    prompt += `\nGenerate a subject line and email body. Remember: be human, be brief, be specific.`;

    return prompt;
  }

  private parseEmailResponse(content: string, profile: CompanyProfile, job: JobDetails): GeneratedEmail {
    const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|BODY:)/i);
    const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

    let subject = subjectMatch?.[1]?.trim() || `Re: ${job.title}`;
    let body = bodyMatch?.[1]?.trim() || content;

    subject = subject.replace(/^["']|["']$/g, "");
    body = body.replace(/^["']|["']$/g, "");

    return { subject, body };
  }

  private generateFallbackEmail(profile: CompanyProfile, job: JobDetails, recipientName?: string): GeneratedEmail {
    const firstName = recipientName?.split(" ")[0];
    const greeting = firstName ? `Hi ${firstName},` : "Hi,";
    const companyName = profile.companyName || "our team";
    const theirCompany = job.companyName || "your team";

    const mainService = this.extractMainService(profile.services);
    const subject = `${mainService} help for ${theirCompany}`;

    let body = `${greeting}\n\n`;
    body += `Noticed ${theirCompany} is hiring for ${job.title.toLowerCase()}. `;
    
    if (profile.pitch) {
      body += `${profile.pitch} `;
    } else {
      body += `At ${companyName}, we've been doing this kind of work for a while. `;
    }

    if (profile.projects) {
      const firstProject = profile.projects.split(",")[0]?.trim();
      if (firstProject) {
        body += `\n\nRecently, we ${firstProject.substring(0, 120)}.`;
      }
    }

    body += `\n\nWould a quick chat make sense? Happy to share relevant examples of our work.`;

    if (profile.portfolioUrl || profile.website) {
      body += `\n\nMore about us: ${profile.portfolioUrl || profile.website}`;
    }

    body += `\n\nBest,\n${profile.companyName || 'The Team'}`;

    return { subject, body: body.trim() };
  }

  private extractMainService(services?: string): string {
    if (!services) return "Development";
    
    const keywords = ["web", "mobile", "software", "design", "development", "marketing", "consulting", "data", "cloud", "ai"];
    const lower = services.toLowerCase();
    
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return kw.charAt(0).toUpperCase() + kw.slice(1);
      }
    }
    
    return services.split(",")[0]?.trim()?.substring(0, 30) || "Development";
  }

  async generateBatchEmails(
    profile: CompanyProfile,
    jobs: JobDetails[],
    batchSize: number = 5
  ): Promise<Map<number, GeneratedEmail>> {
    const results = new Map<number, GeneratedEmail>();
    
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (job, idx) => {
          const email = await this.generateOutreachEmail(profile, job);
          return { index: i + idx, email };
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.set(result.value.index, result.value.email);
        }
      }
    }

    return results;
  }
}

export const emailGenerator = new EmailGenerator();
