import { domainResolver } from "./domain-resolver";
import { websiteScraper } from "./website-scraper";
import { prospeoService } from "./prospeo";
import { rocketReachService } from "./rocketreach";
import { aleadsService } from "./aleads";
import { smtpVerifier } from "./smtp-verifier";
import { emailValidator } from "./email-validator";
import type { Job, Company, Contact, InsertContact, InsertEnrichmentLog } from "@shared/schema";

interface EnrichmentConfig {
  serperApiKey?: string;
  prospeoApiKey?: string;
  rocketReachApiKey?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
  autoEnrichDomain?: boolean;
  autoEnrichContact?: boolean;
}

interface DomainEnrichmentResult {
  success: boolean;
  domain?: string;
  method?: string;
  confidence?: number;
  log: Partial<InsertEnrichmentLog>;
}

interface ContactEnrichmentResult {
  success: boolean;
  contacts: Partial<InsertContact>[];
  totalCreditsUsed: number;
  logs: Partial<InsertEnrichmentLog>[];
}

export class EnrichmentOrchestrator {
  private config: EnrichmentConfig = {};

  configure(config: EnrichmentConfig) {
    this.config = config;

    if (config.serperApiKey) {
      domainResolver.setApiKey(config.serperApiKey);
    }
    if (config.prospeoApiKey) {
      prospeoService.setApiKey(config.prospeoApiKey);
    }
    if (config.rocketReachApiKey) {
      rocketReachService.setApiKey(config.rocketReachApiKey);
    }
    if (config.gmailUser && config.gmailAppPassword) {
      smtpVerifier.configure({
        gmailUser: config.gmailUser,
        gmailAppPassword: config.gmailAppPassword,
      });
    }
  }

  async enrichJobDomain(
    job: Job,
    userId: number
  ): Promise<DomainEnrichmentResult> {
    const log: Partial<InsertEnrichmentLog> = {
      userId,
      jobId: job.id,
      action: "domain_resolution",
      provider: "multi",
      success: false,
      costCredits: 0,
    };

    try {
      const result = await domainResolver.resolve(
        job.description || "",
        job.companyName
      );

      if (result) {
        log.success = true;
        log.provider = result.method;
        log.responseData = { domain: result.domain, confidence: result.confidence };

        if (result.method === "snippet" || result.method === "company_search") {
          log.costCredits = 1;
        }

        return {
          success: true,
          domain: result.domain!,
          method: result.method,
          confidence: result.confidence,
          log,
        };
      }

      log.errorMessage = "Could not resolve domain";
      return { success: false, log };
    } catch (error: any) {
      log.errorMessage = error.message;
      return { success: false, log };
    }
  }

  async enrichCompanyContacts(
    company: Company,
    userId: number,
    targetTitles?: string[]
  ): Promise<ContactEnrichmentResult> {
    const contacts: Partial<InsertContact>[] = [];
    const logs: Partial<InsertEnrichmentLog>[] = [];
    let totalCreditsUsed = 0;

    if (!company.domain) {
      return {
        success: false,
        contacts: [],
        totalCreditsUsed: 0,
        logs: [
          {
            userId,
            companyId: company.id,
            action: "contact_enrichment",
            provider: "none",
            success: false,
            errorMessage: "Company has no domain",
          },
        ],
      };
    }

    try {
      let scrapedPeople: { firstName?: string; lastName?: string; name?: string; title?: string; email?: string; linkedinUrl?: string }[] = [];

      if (aleadsService.isConfigured()) {
        try {
          console.log(`[Enrichment] Step 1: A-Leads advanced-search for ${company.domain}...`);
          const aleadsResult = await aleadsService.enrichFromDomain(company.domain, targetTitles, company.name);
          totalCreditsUsed += aleadsResult.creditsUsed;

          for (const ac of aleadsResult.contacts) {
            const isDuplicate = contacts.find(c => c.email === ac.email && ac.email);
            if (isDuplicate) continue;

            if ((ac.email && !this.isGenericEmail(ac.email)) || ac.linkedinUrl || ac.phone) {
              contacts.push({
                userId,
                companyId: company.id,
                firstName: ac.firstName,
                lastName: ac.lastName,
                fullName: ac.fullName,
                title: ac.title,
                email: ac.email || undefined,
                phone: ac.phone || undefined,
                linkedinUrl: ac.linkedinUrl || undefined,
                source: "aleads",
                emailConfidence: ac.email ? (ac.verified ? 99 : (ac.confidence || 90)) : undefined,
                emailVerified: ac.email ? ac.verified : undefined,
                emailVerificationMethod: ac.email ? "aleads" : undefined,
              });
            }
          }

          const aleadsFound = contacts.filter(c => c.source === "aleads").length;
          logs.push({
            userId,
            companyId: company.id,
            action: "contact_enrichment",
            provider: "aleads",
            success: aleadsFound > 0,
            responseData: {
              contactsFound: aleadsFound,
              withEmail: aleadsResult.contacts.filter(c => c.email).length,
              withPhone: aleadsResult.contacts.filter(c => c.phone).length,
              withLinkedIn: aleadsResult.contacts.filter(c => c.linkedinUrl).length,
            },
            costCredits: aleadsResult.creditsUsed,
          });
        } catch (err: any) {
          console.log(`[Enrichment] A-Leads failed for ${company.domain}: ${err.message}`);
          logs.push({
            userId,
            companyId: company.id,
            action: "contact_enrichment",
            provider: "aleads",
            success: false,
            errorMessage: err.message,
            costCredits: 0,
          });
        }
      }

      if (contacts.filter(c => c.email).length < 2) {
        try {
          console.log(`[Enrichment] Step 2: Website scraping for ${company.domain}...`);
          const scrapedContacts = await websiteScraper.scrapeContacts(company.domain);
          scrapedPeople = scrapedContacts;

          for (const scraped of scrapedContacts) {
            if (scraped.email && !this.isGenericEmail(scraped.email)) {
              const isDuplicate = contacts.find(c => c.email === scraped.email);
              if (isDuplicate) continue;

              contacts.push({
                userId,
                companyId: company.id,
                firstName: scraped.firstName,
                lastName: scraped.lastName,
                fullName: scraped.name,
                title: scraped.title,
                email: scraped.email,
                linkedinUrl: scraped.linkedinUrl,
                source: "website",
                emailConfidence: this.isPersonalEmail(scraped.email) ? 85 : 70,
              });
            }
          }

          logs.push({
            userId,
            companyId: company.id,
            action: "contact_enrichment",
            provider: "website",
            success: scrapedContacts.length > 0,
            responseData: { contactsFound: scrapedContacts.length },
            costCredits: 0,
          });
        } catch (err: any) {
          console.log(`[Enrichment] Website scraping failed for ${company.domain}: ${err.message}`);
          logs.push({
            userId,
            companyId: company.id,
            action: "contact_enrichment",
            provider: "website",
            success: false,
            errorMessage: err.message,
            costCredits: 0,
          });
        }
      }

      if (aleadsService.isConfigured() && contacts.filter(c => c.email).length === 0 && scrapedPeople.length > 0) {
        const linkedinPeople = scrapedPeople.filter(sp => sp.linkedinUrl);
        for (const person of linkedinPeople.slice(0, 3)) {
          const personalResult = await aleadsService.findPersonalEmail(person.linkedinUrl!);
          totalCreditsUsed += personalResult.creditsUsed;
          for (const pc of personalResult.contacts) {
            if (pc.email && !this.isGenericEmail(pc.email) && !contacts.find(c => c.email === pc.email)) {
              contacts.push({
                userId,
                companyId: company.id,
                firstName: pc.firstName || person.firstName,
                lastName: pc.lastName || person.lastName,
                fullName: pc.fullName || person.name,
                title: pc.title || person.title,
                email: pc.email,
                phone: pc.phone,
                linkedinUrl: pc.linkedinUrl || person.linkedinUrl,
                source: "aleads",
                emailConfidence: pc.verified ? 99 : (pc.confidence || 85),
                emailVerified: pc.verified,
                emailVerificationMethod: "aleads",
              });
            }
          }
        }

        if (contacts.filter(c => c.email).length === 0) {
          console.log(`[Enrichment] Step 2b: Using A-Leads find-email-by-name for ${scrapedPeople.length} scraped people at ${company.domain}...`);
          const namedPeople = scrapedPeople.filter(sp => {
            if (sp.firstName && sp.lastName) return true;
            if (sp.name) {
              const parts = sp.name.trim().split(/\s+/);
              return parts.length >= 2;
            }
            return false;
          });

          for (const person of namedPeople.slice(0, 5)) {
            let firstName = person.firstName || "";
            let lastName = person.lastName || "";
            if (!firstName && person.name) {
              const parts = person.name.trim().split(/\s+/);
              firstName = parts[0];
              lastName = parts.slice(1).join(" ");
            }
            if (!firstName || !lastName) continue;

            try {
              const emailResult = await aleadsService.findEmailByName(firstName, lastName, company.domain);
              totalCreditsUsed += 1;
              if (emailResult.email) {
                const emailDomain = emailResult.email.split("@")[1]?.toLowerCase();
                const targetDomain = company.domain.toLowerCase().replace(/^www\./, "");
                if (emailDomain === targetDomain || emailDomain?.replace(/\.[^.]+$/, "") === targetDomain.replace(/\.[^.]+$/, "")) {
                  console.log(`[Enrichment] find-email-by-name found: ${firstName} ${lastName} -> ${emailResult.email}`);
                  contacts.push({
                    userId,
                    companyId: company.id,
                    firstName,
                    lastName,
                    fullName: person.name || `${firstName} ${lastName}`,
                    title: person.title,
                    email: emailResult.email,
                    linkedinUrl: person.linkedinUrl,
                    source: "aleads",
                    emailConfidence: emailResult.quality === "good" ? 95 : 80,
                    emailVerified: emailResult.quality === "good",
                    emailVerificationMethod: "aleads_name",
                  });
                }
              }
            } catch {}
          }
        }
      }

      if (contacts.filter(c => c.email).length < 2 && prospeoService.isConfigured()) {
        console.log(`[Enrichment] Step 3: Prospeo fallback for ${company.domain}...`);
        const namesToLookup: { firstName: string; lastName: string }[] = [];

        const allPeople = [...scrapedPeople, ...contacts.filter(c => c.firstName && c.lastName).map(c => ({ firstName: c.firstName, lastName: c.lastName, name: c.fullName }))];
        for (const sp of allPeople) {
          if (sp.firstName && sp.lastName) {
            if (!namesToLookup.find(n => n.firstName.toLowerCase() === sp.firstName!.toLowerCase() && n.lastName.toLowerCase() === sp.lastName!.toLowerCase())) {
              namesToLookup.push({ firstName: sp.firstName, lastName: sp.lastName });
            }
          } else if ((sp as any).name) {
            const parts = ((sp as any).name as string).trim().split(/\s+/);
            if (parts.length >= 2) {
              namesToLookup.push({ firstName: parts[0], lastName: parts.slice(1).join(" ") });
            }
          }
        }

        if (namesToLookup.length === 0 && company.name) {
          const companyParts = company.name.trim().split(/\s+/);
          if (companyParts.length === 2 && companyParts[0].length > 1 && companyParts[1].length > 1) {
            namesToLookup.push({ firstName: companyParts[0], lastName: companyParts[1] });
          }
        }

        if (namesToLookup.length === 0) {
          const linkedinUrls = [...scrapedPeople, ...contacts]
            .filter(sp => (sp as any).linkedinUrl)
            .map(sp => (sp as any).linkedinUrl as string)
            .slice(0, 2);
          
          for (const url of linkedinUrls) {
            const liResult = await prospeoService.findEmailByLinkedIn(url);
            totalCreditsUsed += liResult.creditsUsed;
            for (const pc of liResult.contacts) {
              if (pc.email && !this.isGenericEmail(pc.email) && !contacts.find(c => c.email === pc.email)) {
                contacts.push({
                  userId,
                  companyId: company.id,
                  firstName: pc.firstName,
                  lastName: pc.lastName,
                  fullName: pc.firstName && pc.lastName ? `${pc.firstName} ${pc.lastName}` : undefined,
                  title: pc.title,
                  email: pc.email,
                  source: "prospeo",
                  emailConfidence: pc.verified ? 99 : 85,
                  emailVerified: pc.verified,
                  emailVerificationMethod: "prospeo",
                });
              }
            }
          }
        }

        let prospeoFound = 0;
        for (const person of namesToLookup.slice(0, 3)) {
          if (contacts.find(c => c.firstName?.toLowerCase() === person.firstName.toLowerCase() && c.lastName?.toLowerCase() === person.lastName.toLowerCase() && c.email)) {
            continue;
          }

          const prospeoResult = await prospeoService.findEmailByDomain(
            person.firstName,
            person.lastName,
            company.domain
          );
          totalCreditsUsed += prospeoResult.creditsUsed;

          for (const pc of prospeoResult.contacts) {
            if (pc.email && !this.isGenericEmail(pc.email) && !contacts.find((c) => c.email === pc.email)) {
              prospeoFound++;
              contacts.push({
                userId,
                companyId: company.id,
                firstName: pc.firstName,
                lastName: pc.lastName,
                fullName: pc.firstName && pc.lastName ? `${pc.firstName} ${pc.lastName}` : undefined,
                title: pc.title,
                email: pc.email,
                source: "prospeo",
                emailConfidence: pc.verified ? 99 : (this.isPersonalEmail(pc.email) ? Math.max(pc.confidence, 85) : pc.confidence),
                emailVerified: pc.verified,
                emailVerificationMethod: "prospeo",
              });
            }
          }
        }

        if (prospeoFound === 0 && contacts.length < 3) {
          try {
            const domainResult = await prospeoService.domainSearch(company.domain, 5);
            totalCreditsUsed += domainResult.creditsUsed;
            for (const pc of domainResult.contacts) {
              if (pc.email && !this.isGenericEmail(pc.email) && !contacts.find((c) => c.email === pc.email)) {
                prospeoFound++;
                contacts.push({
                  userId,
                  companyId: company.id,
                  firstName: pc.firstName,
                  lastName: pc.lastName,
                  fullName: pc.firstName && pc.lastName ? `${pc.firstName} ${pc.lastName}` : undefined,
                  title: pc.title,
                  email: pc.email,
                  source: "prospeo",
                  emailConfidence: pc.verified ? 99 : pc.confidence,
                  emailVerified: pc.verified,
                  emailVerificationMethod: "prospeo",
                });
              }
            }
          } catch {
          }
        }

        logs.push({
          userId,
          companyId: company.id,
          action: "contact_enrichment",
          provider: "prospeo",
          success: prospeoFound > 0,
          responseData: { contactsFound: prospeoFound, namesSearched: namesToLookup.length },
          costCredits: totalCreditsUsed,
        });
      }

      if (contacts.filter(c => c.email).length < 2 && rocketReachService.isConfigured()) {
        console.log(`[Enrichment] Step 4: RocketReach fallback for ${company.domain}...`);
        const rrResult = await rocketReachService.searchCompany(
          company.domain,
          targetTitles || ["CEO", "CTO", "Founder", "Director"]
        );
        totalCreditsUsed += rrResult.creditsUsed;

        for (const rc of rrResult.contacts) {
          if (rc.email && !this.isGenericEmail(rc.email) && !contacts.find((c) => c.email === rc.email)) {
            contacts.push({
              userId,
              companyId: company.id,
              firstName: rc.firstName,
              lastName: rc.lastName,
              fullName: rc.firstName && rc.lastName ? `${rc.firstName} ${rc.lastName}` : undefined,
              title: rc.title,
              email: rc.email,
              phone: rc.phone,
              linkedinUrl: rc.linkedinUrl,
              source: "rocketreach",
              emailConfidence: this.isPersonalEmail(rc.email) ? Math.max(rc.confidence, 85) : rc.confidence,
            });
          }
        }

        logs.push({
          userId,
          companyId: company.id,
          action: "contact_enrichment",
          provider: "rocketreach",
          success: rrResult.success,
          responseData: { contactsFound: rrResult.contacts.length },
          errorMessage: rrResult.error,
          costCredits: rrResult.creditsUsed,
        });
      }

      const emailsToVerify = contacts
        .filter((c) => c.email && !c.emailVerified)
        .map((c) => c.email as string)
        .slice(0, 10);

      if (emailsToVerify.length > 0) {
        const verificationResults = await smtpVerifier.batchVerify(emailsToVerify, 3);

        for (const vr of verificationResults) {
          const contact = contacts.find((c) => c.email === vr.email);
          if (contact) {
            contact.emailVerified = vr.valid;
            contact.emailVerificationMethod = vr.smtpCheck === "pass" ? "smtp" : "mx_check";
            if (vr.valid && (contact.emailConfidence || 0) < 90) {
              contact.emailConfidence = 90;
            }
          }
        }

        logs.push({
          userId,
          companyId: company.id,
          action: "verification",
          provider: "smtp",
          success: true,
          responseData: {
            verified: verificationResults.filter((v) => v.valid).length,
            total: emailsToVerify.length,
          },
          costCredits: 0,
        });
      }

      return {
        success: contacts.length > 0,
        contacts,
        totalCreditsUsed,
        logs,
      };
    } catch (error: any) {
      logs.push({
        userId,
        companyId: company.id,
        action: "contact_enrichment",
        provider: "orchestrator",
        success: false,
        errorMessage: error.message,
        costCredits: totalCreditsUsed,
      });

      return {
        success: false,
        contacts,
        totalCreditsUsed,
        logs,
      };
    }
  }

  async verifyEmail(email: string): Promise<{
    valid: boolean;
    method: string;
    reason?: string;
  }> {
    const result = await smtpVerifier.verify(email);
    return {
      valid: result.valid,
      method: result.smtpCheck === "pass" ? "smtp" : "mx_check",
      reason: result.reason,
    };
  }

  private isGenericEmail(email: string): boolean {
    const genericPrefixes = [
      "support", "info", "contact", "hello", "help", "sales", "admin",
      "mail", "office", "team", "enquiries", "inquiries", "feedback",
      "service", "customerservice", "customer-service", "noreply", "no-reply",
      "marketing", "press", "media", "jobs", "careers", "hr", "billing",
      "accounts", "general", "enquiry", "inquiry", "request", "webmaster"
    ];
    
    const localPart = email.split("@")[0].toLowerCase();
    return genericPrefixes.some(prefix => localPart === prefix || localPart.startsWith(prefix + "."));
  }

  private isPersonalEmail(email: string): boolean {
    const localPart = email.split("@")[0].toLowerCase();
    
    if (this.isGenericEmail(email)) return false;
    
    const personalPatterns = [
      /^[a-z]+\.[a-z]+$/,
      /^[a-z]+_[a-z]+$/,
      /^[a-z]{2,}$/,
      /^[a-z]+[0-9]*$/,
    ];
    
    return personalPatterns.some(pattern => pattern.test(localPart));
  }
}

export const enrichmentOrchestrator = new EnrichmentOrchestrator();
