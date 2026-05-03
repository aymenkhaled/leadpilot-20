interface PitchConfig {
  senderName: string;
  senderCompany: string;
  senderTitle?: string;
  portfolioUrl?: string;
  calendarUrl?: string;
  skills?: string[];
  tone?: string;
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
}

export class PitchGenerator {
  private openai: any = null;

  setApiKey(key: string) {
    this.openai = { apiKey: key };
  }

  isConfigured(): boolean {
    return !!this.openai;
  }

  async generatePitch(job: any, contact: any, company: any, config: PitchConfig): Promise<GeneratedPitch> {
    if (!this.openai) {
      return this.generateFallbackPitch(job, contact, company, config);
    }

    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: this.openai.apiKey });

      const contactName = contact.firstName || contact.fullName?.split(" ")[0] || "there";
      const companyName = company?.name || job.companyName || "the company";
      const jobDesc = (job.description || "").substring(0, 2000);

      let senderProfile = `Sender: ${config.senderName}`;
      if (config.senderCompany) senderProfile += `, ${config.senderCompany}`;
      if (config.services) senderProfile += `\nServices: ${config.services}`;
      if (config.pitch) senderProfile += `\nValue prop: ${config.pitch}`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You write cold outreach emails. Rules: Under 120 words, no buzzwords, sound human, reference ONE specific thing from the job post. No bullet points. Short subject (under 7 words). Output JSON with "subject" and "body" keys. Use \\n for line breaks.`,
          },
          {
            role: "user",
            content: `Job: ${job.title} at ${companyName}\nRecipient: ${contactName} (${contact.title || "Decision Maker"})\n${senderProfile}\nJob excerpt: ${jobDesc.substring(0, 500)}\n\nWrite the cold email. Return JSON: {"subject": "...", "body": "..."}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 600,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          subject: parsed.subject || this.generateSubject(job),
          body: parsed.body || this.generateFallbackBody(job, contact, company, config),
        };
      }
    } catch (e) {
      console.error("OpenAI pitch generation error:", e);
    }

    return this.generateFallbackPitch(job, contact, company, config);
  }

  private generateFallbackPitch(job: any, contact: any, company: any, config: PitchConfig): GeneratedPitch {
    return {
      subject: this.generateSubject(job),
      body: this.generateFallbackBody(job, contact, company, config),
    };
  }

  private generateSubject(job: any): string {
    const subjects = [
      `Re: ${job.title}`,
      `Quick question about ${job.title}`,
      `${job.title} — quick thought`,
      `About your ${job.title} role`,
    ];
    return subjects[Math.floor(Math.random() * subjects.length)];
  }

  private generateFallbackBody(job: any, contact: any, company: any, config: PitchConfig): string {
    const contactName = contact.firstName || "there";
    const companyName = company?.name || job.companyName || "your team";
    const opener = `Hi ${contactName},\n\nSaw ${companyName}'s posting for a ${job.title} and wanted to reach out directly.`;
    let valueAdd = "";
    if (config.services) valueAdd = ` We specialize in ${config.services.split(",")[0].trim().toLowerCase()}.`;
    else if (config.pitch) valueAdd = ` ${config.pitch.split(".")[0]}.`;
    else valueAdd = ` I've done similar work and think I could help.`;

    const signOff = `${config.senderName}${config.senderCompany ? "\n" + config.senderCompany : ""}`;
    return `${opener}${valueAdd}\n\nWould you have 15 minutes this week to chat?\n\n${signOff}`;
  }

  async generateFollowUp(originalPitch: GeneratedPitch, daysSinceSent: number, config?: Partial<PitchConfig>): Promise<GeneratedPitch> {
    if (this.openai) {
      try {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: this.openai.apiKey });
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You write short, friendly follow-up cold emails. Under 60 words. No buzzwords. Sound human. Output JSON with "subject" and "body" keys.`,
            },
            {
              role: "user",
              content: `Original subject: "${originalPitch.subject}"\nDays since sent: ${daysSinceSent}\nWrite a brief, non-pushy follow-up. Return JSON: {"subject": "Re: ...", "body": "..."}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.85,
          max_tokens: 300,
        });
        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.subject && parsed.body) return parsed;
        }
      } catch (e) {
        console.warn("Follow-up generation failed, using fallback:", e);
      }
    }

    const bumps = [
      "Just bumping this up in case it got buried.",
      `Following up on my note from ${daysSinceSent} days ago.`,
      "Wanted to make sure this didn't slip through.",
    ];
    const bump = bumps[Math.floor(Math.random() * bumps.length)];
    return {
      subject: `Re: ${originalPitch.subject}`,
      body: `${bump} Still happy to chat if the timing works.\n\nThanks${config?.senderName ? `,\n${config.senderName}` : ""}`,
    };
  }
}

export const pitchGenerator = new PitchGenerator();
