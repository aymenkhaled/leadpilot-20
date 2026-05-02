import OpenAI from "openai";
import type { Job, Company, Contact, Settings } from "@shared/schema";

interface PitchConfig {
  senderName: string;
  senderCompany: string;
  senderTitle?: string;
  portfolioUrl?: string;
  calendarUrl?: string;
  skills?: string[];
  tone?: "professional" | "friendly" | "casual";
  services?: string;
  projects?: string;
  description?: string;
  pitch?: string;
  cvUrl?: string;
  cvContent?: string;
  linkedinUrl?: string;
  website?: string;
  domain?: string;
  exampleEmails?: string;
  profileTone?: string;
}

interface GeneratedPitch {
  subject: string;
  body: string;
  followUp?: string;
}

export class PitchGenerator {
  private openai: OpenAI | null = null;

  setApiKey(key: string) {
    this.openai = new OpenAI({ apiKey: key });
  }

  isConfigured(): boolean {
    return this.openai !== null;
  }

  buildConfigFromSettings(settings: Settings | null, user: { firstName: string; lastName: string }): PitchConfig {
    if (!settings) {
      return {
        senderName: `${user.firstName} ${user.lastName}`,
        senderCompany: "",
      };
    }

    return {
      senderName: `${user.firstName} ${user.lastName}`,
      senderCompany: settings.profileCompanyName || "",
      senderTitle: "",
      portfolioUrl: settings.profilePortfolioUrl || undefined,
      website: settings.profileWebsite || undefined,
      domain: settings.profileDomain || undefined,
      services: settings.profileServices || undefined,
      projects: settings.profileProjects || undefined,
      description: settings.profileDescription || undefined,
      pitch: settings.profilePitch || undefined,
      cvUrl: settings.profileCvUrl || undefined,
      cvContent: settings.profileCvContent || undefined,
      linkedinUrl: settings.profileLinkedin || undefined,
      exampleEmails: settings.profileExampleEmails || undefined,
      profileTone: settings.profileTone || undefined,
      tone: (settings.profileTone as any) || "professional",
    };
  }

  async generatePitch(
    job: Job,
    contact: Contact,
    company: Company | null,
    config: PitchConfig
  ): Promise<GeneratedPitch> {
    if (!this.openai) {
      return this.generateFallbackPitch(job, contact, company, config);
    }

    const prompt = this.buildPrompt(job, contact, company, config);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: this.buildSystemPrompt(config),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.92,
        max_tokens: 800,
        top_p: 0.95,
        frequency_penalty: 0.4,
        presence_penalty: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          subject: parsed.subject || this.generateSubject(job),
          body: parsed.body || this.generateFallbackBody(job, contact, company, config),
        };
      }
    } catch (error) {
      console.error("OpenAI pitch generation error:", error);
    }

    return this.generateFallbackPitch(job, contact, company, config);
  }

  private buildSystemPrompt(config: PitchConfig): string {
    const toneGuide = config.profileTone === "casual"
      ? "Write like you're messaging a colleague you respect but haven't met yet. Slightly informal, warm, direct."
      : config.profileTone === "friendly"
        ? "Write like a friendly professional reaching out. Warm but still businesslike."
        : "Write like a seasoned professional sending a considered email. Confident, measured, respectful.";

    let styleGuide = "";
    if (config.exampleEmails) {
      styleGuide = `\n\nIMPORTANT - The sender has provided example emails showing their personal writing style. You MUST match this style closely. Study the vocabulary, sentence length, greeting style, sign-off style, and overall voice from these examples:\n\n---\n${config.exampleEmails}\n---\n\nMirror their writing patterns: if they use contractions, use contractions. If they write short sentences, keep yours short. If they have a particular way of opening or closing, follow that pattern.`;
    }

    return `You write cold outreach emails on behalf of a real person. Your emails must be indistinguishable from a thoughtful human who took 5 minutes to write a personalized note after reading a job post.

RULES FOR HUMAN-SOUNDING EMAILS:
1. Never start with "I hope this email finds you well" or "I came across your posting" or "I noticed that" as the very first words
2. Vary your opening - sometimes start with a question, sometimes a brief observation about their company or role, sometimes jump straight to value
3. Use contractions naturally (I'm, we've, you're, that's, don't)
4. Include 1-2 slightly imperfect elements: a casual aside in parentheses, a dash instead of a comma, starting a sentence with "And" or "But"
5. Keep sentences varied in length - mix short punchy ones with longer flowing ones
6. Never use marketing buzzwords: "synergy", "leverage", "cutting-edge", "state-of-the-art", "game-changer", "innovative solutions", "unlock potential"
7. Reference ONE specific detail from their job post that shows you actually read it - a technology, a challenge mentioned, a team structure detail
8. The email should feel like it could only have been written for THIS specific job, not templated
9. Keep the body under 120 words - brevity signals confidence and respect for their time
10. End with a single, specific, low-pressure ask - never multiple CTAs
11. Never use bullet points or numbered lists in the email body
12. Sign off simply - just the name, maybe company. No elaborate signatures in the email body itself.
13. Subject lines should be short (under 7 words), specific, and NOT salesy. They should look like a subject a real person would write.

${toneGuide}
${styleGuide}

Output format: JSON with "subject" and "body" keys. Use \\n for line breaks in the body.`;
  }

  private buildPrompt(
    job: Job,
    contact: Contact,
    company: Company | null,
    config: PitchConfig
  ): string {
    const contactName = contact.firstName || contact.fullName?.split(" ")[0] || "there";
    const jobDesc = (job.description || "").substring(0, 2000);
    const companyName = company?.name || job.companyName || "the company";

    let senderProfile = `SENDER PROFILE:\n- Name: ${config.senderName}`;

    if (config.senderCompany) {
      senderProfile += `\n- Company: ${config.senderCompany}`;
    }
    if (config.domain) {
      senderProfile += `\n- Domain: ${config.domain}`;
    }
    if (config.website) {
      senderProfile += `\n- Website: ${config.website}`;
    }
    if (config.services) {
      senderProfile += `\n- Services offered: ${config.services}`;
    }
    if (config.projects) {
      senderProfile += `\n- Notable projects/portfolio highlights: ${config.projects}`;
    }
    if (config.pitch) {
      senderProfile += `\n- Value proposition: ${config.pitch}`;
    }
    if (config.description) {
      senderProfile += `\n- About: ${config.description}`;
    }
    if (config.cvContent) {
      senderProfile += `\n- Resume/CV summary: ${config.cvContent.substring(0, 1000)}`;
    }
    if (config.linkedinUrl) {
      senderProfile += `\n- LinkedIn: ${config.linkedinUrl}`;
    }
    if (config.portfolioUrl) {
      senderProfile += `\n- Portfolio: ${config.portfolioUrl}`;
    }
    if (config.cvUrl) {
      senderProfile += `\n- CV/Resume link: ${config.cvUrl}`;
    }
    if (config.skills && config.skills.length > 0) {
      senderProfile += `\n- Technical skills: ${config.skills.join(", ")}`;
    }

    let companyContext = "";
    if (company) {
      companyContext = `\nCOMPANY CONTEXT:`;
      if (company.industry) companyContext += `\n- Industry: ${company.industry}`;
      if (company.size) companyContext += `\n- Company size: ${company.size}`;
      if (company.location) companyContext += `\n- Location: ${company.location}`;
      if (company.description) companyContext += `\n- About: ${company.description.substring(0, 500)}`;
    }

    let budgetContext = "";
    if (job.budgetMin || job.budgetMax) {
      budgetContext = `\n- Budget: ${job.budgetMin && job.budgetMax ? `$${job.budgetMin}-$${job.budgetMax}` : job.budgetMin ? `From $${job.budgetMin}` : `Up to $${job.budgetMax}`}`;
      if (job.budgetType) budgetContext += ` (${job.budgetType})`;
    }
    if (job.budgetIndicator && job.budgetIndicator !== "unknown") {
      budgetContext += `\n- Budget level: ${job.budgetIndicator}`;
    }

    let classificationContext = "";
    if (job.jobType) {
      classificationContext = `\n- Job type: ${job.jobType}`;
      if (job.recruiterVsTeamMember && job.recruiterVsTeamMember !== "unknown") {
        classificationContext += `\n- Hiring type: ${job.recruiterVsTeamMember === "recruiter" ? "Recruiting/staffing" : "Direct team hire"}`;
      }
    }

    return `Write a cold outreach email for this opportunity. The email must feel genuinely personal and human.

JOB DETAILS:
- Title: ${job.title}
- Company: ${companyName}
- Platform: ${job.platform}
- Location: ${job.location || "Not specified"}
- Remote: ${job.remote ? "Yes" : "Not specified"}${budgetContext}${classificationContext}
- Job description:
"""
${jobDesc}
"""
${companyContext}

RECIPIENT:
- Name: ${contactName}
- Title: ${contact.title || "Decision Maker"}
- Company: ${companyName}

${senderProfile}

IMPORTANT: Pick ONE specific thing from the job description that the sender can genuinely help with based on their profile. Don't try to address everything. The email should feel like a quick, thoughtful note - not a sales pitch.

Return as JSON: {"subject": "...", "body": "..."}`;
  }

  private generateFallbackPitch(
    job: Job,
    contact: Contact,
    company: Company | null,
    config: PitchConfig
  ): GeneratedPitch {
    return {
      subject: this.generateSubject(job),
      body: this.generateFallbackBody(job, contact, company, config),
    };
  }

  private generateSubject(job: Job): string {
    const subjects = [
      `Re: ${job.title}`,
      `Quick question about ${job.title}`,
      `${job.title} - quick thought`,
      `About your ${job.title} role`,
      `Saw your ${job.title} post`,
    ];
    return subjects[Math.floor(Math.random() * subjects.length)];
  }

  private generateFallbackBody(
    job: Job,
    contact: Contact,
    company: Company | null,
    config: PitchConfig
  ): string {
    const contactName = contact.firstName || "there";
    const companyName = company?.name || job.companyName || "your team";

    const openers = [
      `Hi ${contactName},\n\nSaw ${companyName}'s posting for a ${job.title} and wanted to reach out directly.`,
      `Hey ${contactName},\n\nYour ${job.title} role caught my eye - seems like an interesting challenge.`,
      `Hi ${contactName},\n\nI came across the ${job.title} position at ${companyName} and thought I'd drop a quick note.`,
    ];

    const opener = openers[Math.floor(Math.random() * openers.length)];

    let valueAdd = "";
    if (config.services) {
      valueAdd = ` We specialize in ${config.services.split(",")[0].trim().toLowerCase()}, which seems directly relevant to what you're looking for.`;
    } else if (config.pitch) {
      valueAdd = ` ${config.pitch.split(".")[0]}.`;
    } else if (config.skills && config.skills.length > 0) {
      valueAdd = ` I've been working with ${config.skills.slice(0, 2).join(" and ")} for several years now.`;
    } else {
      valueAdd = ` I've done similar work before and think I could help out.`;
    }

    let signOff = `${config.senderName}`;
    if (config.senderCompany) signOff += `\n${config.senderCompany}`;
    if (config.portfolioUrl) signOff += `\n${config.portfolioUrl}`;
    else if (config.website) signOff += `\n${config.website}`;
    else if (config.linkedinUrl) signOff += `\n${config.linkedinUrl}`;

    return `${opener}${valueAdd}

Would you have 15 minutes this week to chat about it? Happy to share some relevant work samples beforehand if that's useful.

${signOff}`;
  }

  async generateFollowUp(
    originalPitch: GeneratedPitch,
    daysSinceSent: number
  ): Promise<GeneratedPitch> {
    if (!this.openai) {
      const followUps = [
        `Hi,\n\nJust bumping this up in case it got buried. Still interested in chatting if the timing works.\n\nThanks`,
        `Hey - wanted to circle back on this. Totally understand if the timing isn't right, but figured I'd check.\n\nBest`,
        `Hi there,\n\nFollowing up on my note from ${daysSinceSent === 1 ? "yesterday" : `a few days ago`}. Let me know if you'd like to connect.\n\nCheers`,
      ];
      return {
        subject: `Re: ${originalPitch.subject}`,
        body: followUps[Math.floor(Math.random() * followUps.length)],
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Write a brief, natural follow-up email. Rules:
- Under 40 words
- Don't repeat the original pitch
- Sound human, not robotic
- Vary between: checking in, offering something new, referencing a relevant update
- No guilt-tripping or pressure
- Use contractions naturally
Output JSON with subject and body.`,
          },
          {
            role: "user",
            content: `Original subject: "${originalPitch.subject}"
Days since sent: ${daysSinceSent}

Write a follow-up. Return JSON: {"subject": "...", "body": "..."}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error("Follow-up generation error:", error);
    }

    return {
      subject: `Re: ${originalPitch.subject}`,
      body: "Just following up - let me know if you'd like to chat!",
    };
  }
}

export const pitchGenerator = new PitchGenerator();
