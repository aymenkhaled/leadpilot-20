import { db } from "../db.js";
import { workspaceApiKeys, contacts, companies, waterfallConfigs, workspaces } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { decryptApiKey } from "../crypto.js";

interface EnrichContact {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  emailVerified?: boolean;
  emailConfidence?: number;
  title?: string;
  linkedinUrl?: string;
  enrichmentProvider?: string;
}

interface EnrichResult {
  contacts: EnrichContact[];
  provider: string;
  creditsUsed: number;
  isByok: boolean;
}

const DEFAULT_WATERFALL = ["aleads", "prospeo", "apollo", "hunter"];

export class EnrichmentOrchestrator {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  async enrich(domain: string, companyName: string, jobId?: string): Promise<EnrichResult> {
    // Get workspace waterfall config
    const waterfallConfig = await db.query.waterfallConfigs.findFirst({
      where: and(eq(waterfallConfigs.workspaceId, this.workspaceId), eq(waterfallConfigs.isDefault, true)),
    });

    const steps: string[] = waterfallConfig
      ? (waterfallConfig.steps as any[]).map(s => s.provider)
      : DEFAULT_WATERFALL;

    for (const provider of steps) {
      const result = await this.tryProvider(provider, domain, companyName);
      if (result && result.contacts.length > 0) {
        // Check if we have a verified email — stop waterfall if yes
        const hasVerified = result.contacts.some(c => c.emailVerified);
        if (hasVerified || result.contacts.length >= 1) {
          // Save contacts
          await this.saveContacts(result.contacts, domain, jobId, provider);
          return result;
        }
      }
    }

    return { contacts: [], provider: "none", creditsUsed: 0, isByok: false };
  }

  private async tryProvider(provider: string, domain: string, companyName: string): Promise<EnrichResult | null> {
    const apiKey = await db.query.workspaceApiKeys.findFirst({
      where: and(
        eq(workspaceApiKeys.workspaceId, this.workspaceId),
        eq(workspaceApiKeys.provider, provider),
        eq(workspaceApiKeys.isActive, true),
      ),
    });

    if (!apiKey) return null;

    const decryptedKey = decryptApiKey(apiKey.keyEncrypted, apiKey.keyIv, apiKey.keyTag);

    try {
      switch (provider) {
        case "aleads":
          return await this.enrichWithALeads(decryptedKey, domain);
        case "prospeo":
          return await this.enrichWithProspeo(decryptedKey, domain);
        case "apollo":
          return await this.enrichWithApollo(decryptedKey, domain);
        case "hunter":
          return await this.enrichWithHunter(decryptedKey, domain);
        default:
          return null;
      }
    } catch (e) {
      console.warn(`Enrichment provider ${provider} failed:`, e);
      return null;
    }
  }

  private async enrichWithALeads(apiKey: string, domain: string): Promise<EnrichResult> {
    const axios = (await import("axios")).default;
    try {
      // A-Leads: domain-only search, never filter by job_title, fetch ≥10 contacts
      const response = await axios.post(
        "https://api.a-leads.co/gateway",
        { domain, limit: 10 },
        {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          timeout: 20000,
        }
      );

      const people = response.data?.people || response.data?.contacts || response.data?.data || [];
      const contacts: EnrichContact[] = people.slice(0, 10).map((p: any) => ({
        firstName: p.first_name || p.firstName,
        lastName: p.last_name || p.lastName,
        fullName: p.full_name || p.fullName || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        email: p.email,
        emailVerified: p.email_verified || p.emailVerified || false,
        emailConfidence: p.email_confidence || p.confidence || 80,
        title: p.title || p.job_title,
        linkedinUrl: p.linkedin_url || p.linkedin,
        enrichmentProvider: "aleads",
      })).filter((c: EnrichContact) => c.email || c.fullName);

      return { contacts, provider: "aleads", creditsUsed: contacts.length * 0.1, isByok: true };
    } catch (e: any) {
      console.warn("A-Leads enrichment failed:", e.message);
      return { contacts: [], provider: "aleads", creditsUsed: 0, isByok: true };
    }
  }

  private async enrichWithProspeo(apiKey: string, domain: string): Promise<EnrichResult> {
    const axios = (await import("axios")).default;
    try {
      const response = await axios.post(
        "https://api.prospeo.io/domain-search",
        { data: { company: domain, limit: 10 } },
        {
          headers: { "Content-Type": "application/json", "X-KEY": apiKey },
          timeout: 20000,
        }
      );

      const result = response.data?.response || response.data;
      const emails = result?.email_list || result?.emails || [];
      const contacts: EnrichContact[] = emails.map((e: any) => ({
        firstName: e.first_name,
        lastName: e.last_name,
        fullName: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
        email: e.email?.email || e.email,
        emailVerified: e.email?.verified === true || e.verified === true,
        emailConfidence: e.email?.score || e.score || 90,
        title: e.title || e.position,
        enrichmentProvider: "prospeo",
      })).filter((c: EnrichContact) => c.email);

      return { contacts, provider: "prospeo", creditsUsed: 1, isByok: true };
    } catch (e: any) {
      console.warn("Prospeo enrichment failed:", e.message);
      return { contacts: [], provider: "prospeo", creditsUsed: 0, isByok: true };
    }
  }

  private async enrichWithApollo(apiKey: string, domain: string): Promise<EnrichResult> {
    const axios = (await import("axios")).default;
    try {
      const response = await axios.post(
        "https://api.apollo.io/v1/mixed_people/search",
        {
          api_key: apiKey,
          q_organization_domains: [domain],
          page: 1,
          per_page: 10,
          person_titles: ["CEO", "CTO", "VP", "Director", "Head", "Manager"],
        },
        { timeout: 15000 }
      );

      const people = response.data?.people || [];
      const contacts: EnrichContact[] = people.map((p: any) => ({
        firstName: p.first_name,
        lastName: p.last_name,
        fullName: p.name,
        email: p.email,
        emailVerified: p.email_status === "verified",
        emailConfidence: p.email_status === "verified" ? 99 : 70,
        title: p.title,
        linkedinUrl: p.linkedin_url,
        enrichmentProvider: "apollo",
      })).filter((c: EnrichContact) => c.email);

      return { contacts, provider: "apollo", creditsUsed: 1, isByok: true };
    } catch (e: any) {
      console.warn("Apollo enrichment failed:", e.message);
      return { contacts: [], provider: "apollo", creditsUsed: 0, isByok: true };
    }
  }

  private async enrichWithHunter(apiKey: string, domain: string): Promise<EnrichResult> {
    const axios = (await import("axios")).default;
    try {
      const response = await axios.get(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=10`,
        { timeout: 15000 }
      );

      const emails = response.data?.data?.emails || [];
      const contacts: EnrichContact[] = emails.map((e: any) => ({
        firstName: e.first_name,
        lastName: e.last_name,
        fullName: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
        email: e.value,
        emailVerified: e.verification?.status === "valid",
        emailConfidence: e.confidence || 80,
        title: e.position,
        linkedinUrl: e.linkedin,
        enrichmentProvider: "hunter",
      })).filter((c: EnrichContact) => c.email);

      return { contacts, provider: "hunter", creditsUsed: 1, isByok: true };
    } catch (e: any) {
      console.warn("Hunter enrichment failed:", e.message);
      return { contacts: [], provider: "hunter", creditsUsed: 0, isByok: true };
    }
  }

  private async saveContacts(enrichContacts: EnrichContact[], domain: string, jobId: string | undefined, provider: string) {
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.workspaceId, this.workspaceId), eq(companies.domain, domain)),
    });

    for (const contact of enrichContacts) {
      try {
        await db.insert(contacts).values({
          workspaceId: this.workspaceId,
          companyId: company?.id,
          jobId: jobId || null,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.fullName || `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
          email: contact.email,
          emailVerified: contact.emailVerified || false,
          emailConfidence: contact.emailConfidence || 0,
          title: contact.title,
          linkedinUrl: contact.linkedinUrl,
          enrichmentProvider: provider,
          enrichedAt: new Date(),
        });
      } catch (e: any) {
        if (!e.message?.includes("duplicate")) {
          console.warn("Failed to save contact:", e.message);
        }
      }
    }
  }
}
