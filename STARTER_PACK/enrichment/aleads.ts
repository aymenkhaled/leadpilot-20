import axios, { AxiosRequestConfig } from "axios";

export interface ALeadsContact {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  linkedinUsername?: string;
  documentId?: string;
  companyName?: string;
  domain?: string;
  location?: string;
  industry?: string;
  confidence: number;
  verified: boolean;
  source: "aleads";
  emailFound?: boolean;
  phoneAvailable?: boolean;
}

export interface ALeadsResult {
  success: boolean;
  contacts: ALeadsContact[];
  creditsUsed: number;
  error?: string;
  rawResponse?: any;
}

interface ALeadsVerifyResult {
  success: boolean;
  valid: boolean;
  email: string;
  status?: string;
  creditsUsed: number;
  error?: string;
}

interface ALeadsAdvancedSearchResult {
  success: boolean;
  results: any[];
  totalResults?: number;
  page?: number;
  creditsUsed: number;
  error?: string;
}

interface ALeadsCompanySearchResult {
  success: boolean;
  companies: any[];
  creditsUsed: number;
  error?: string;
}

export class ALeadsService {
  private baseUrl = "https://api.a-leads.co/gateway";
  private maxRetries = 2;
  private totalCreditsUsed = 0;

  private static BLACKLISTED_DOMAINS = [
    "linkedin.com", "in.linkedin.com", "indeed.com", "glassdoor.com",
    "dice.com", "monster.com", "ziprecruiter.com", "careerbuilder.com",
    "facebook.com", "twitter.com", "x.com", "instagram.com",
    "youtube.com", "tiktok.com", "reddit.com", "github.com",
    "google.com", "nan.com", "example.com", "test.com",
    "lensa.com", "randstad.com", "adecco.com", "manpower.com",
    "roberthalf.com", "kellyservices.com",
    "upwork.com", "wellfound.com", "angel.co", "peopleperhour.com",
    "remoteok.com", "remoteok.io", "naukri.com", "lever.co",
    "greenhouse.io", "ashbyhq.com", "smartrecruiters.com", "jobvite.com",
    "recruitee.com", "bamboohr.com", "workable.com", "weworkremotely.com",
    "remotive.com", "himalayas.app", "jobicy.com", "nofluffjobs.com",
    "dribbble.com", "freelancer.com", "fiverr.com", "toptal.com",
    "simplyhired.com", "themuse.com", "builtin.com", "flexjobs.com",
  ];

  static isBlacklistedDomain(domain: string): boolean {
    if (!domain) return true;
    const clean = domain.toLowerCase().replace(/^www\./, "");
    return ALeadsService.BLACKLISTED_DOMAINS.some(b => clean === b || clean.endsWith("." + b));
  }

  private get apiKey(): string | null {
    return process.env.Leads_API_Key || null;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      "accept": "application/json",
      "x-api-key": this.apiKey!,
    };
  }

  private async makeRequest(
    method: "POST" | "GET",
    endpoint: string,
    data?: any,
    retryCount = 0
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("A-Leads API key not configured");
    }

    const url = `${this.baseUrl}${endpoint}`;
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: this.getHeaders(),
      timeout: 45000,
      ...(data && { data }),
    };

    console.log(`[A-Leads] ${method} ${url}`, data ? JSON.stringify(data).substring(0, 200) : "");

    try {
      const response = await axios(config);
      console.log(`[A-Leads] Response ${response.status} from ${endpoint}:`, JSON.stringify(response.data).substring(0, 300));
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

      const errorMsg = typeof errorData === "string"
        ? errorData.substring(0, 200)
        : JSON.stringify(errorData || error.message).substring(0, 200);
      console.error(`[A-Leads] Error ${status || "NETWORK"} from ${endpoint}:`, errorMsg);

      const canRetry = retryCount < this.maxRetries && (!status || status >= 500 || status === 429);
      const shouldRetry = canRetry && !isTimeout;

      if (shouldRetry) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[A-Leads] Retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }

      if (isTimeout) {
        console.log(`[A-Leads] Timeout on ${endpoint} - skipping retries to avoid blocking pipeline`);
      }

      throw new Error(
        errorData?.message?.description ||
          errorData?.message ||
          errorData?.error ||
          errorData?.detail ||
          (typeof errorData === "string" ? errorData.substring(0, 100) : null) ||
          error.message
      );
    }
  }

  private domainsMatch(domain1: string, domain2: string): boolean {
    const clean1 = domain1.toLowerCase().replace(/^www\./, "");
    const clean2 = domain2.toLowerCase().replace(/^www\./, "");
    if (clean1 === clean2) return true;
    const base1 = clean1.split(".").slice(0, -1).join(".");
    const base2 = clean2.split(".").slice(0, -1).join(".");
    if (base1 === base2 && base1.length >= 3) return true;
    return false;
  }

  private rawResultMatchesTarget(raw: any, targetDomain: string, targetCompanyName?: string): boolean {
    const rawDomain = (raw.company_domain || raw.primary_domain || raw.domain || "").toLowerCase().replace(/^www\./, "");
    const rawCompany = (raw.company_name || raw.organization_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanTarget = targetDomain.toLowerCase().replace(/^www\./, "");

    if (rawDomain && rawDomain.length > 2) {
      if (this.domainsMatch(rawDomain, cleanTarget)) return true;
    }

    if (targetCompanyName && rawCompany) {
      const cleanCompanyName = targetCompanyName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (rawCompany.includes(cleanCompanyName) || cleanCompanyName.includes(rawCompany)) {
        if (rawCompany.length >= 3 && cleanCompanyName.length >= 3) return true;
      }
    }

    if (!rawDomain && !rawCompany) return true;

    return false;
  }

  private contactMatchesTargetDomain(contact: ALeadsContact, targetDomain: string, targetCompanyName?: string): boolean {
    const cleanTarget = targetDomain.toLowerCase().replace(/^www\./, "");

    if (contact.email) {
      const emailDomain = contact.email.split("@")[1]?.toLowerCase();
      if (emailDomain) {
        if (this.domainsMatch(emailDomain, cleanTarget)) return true;
      }
      return false;
    }

    if (contact.domain) {
      if (this.domainsMatch(contact.domain, cleanTarget)) return true;
    }

    if (targetCompanyName && contact.companyName) {
      const rName = contact.companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const qName = targetCompanyName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if ((rName.includes(qName) || qName.includes(rName)) && rName.length >= 3 && qName.length >= 3) return true;
    }

    if (!contact.email && !contact.domain && !contact.companyName) return true;

    return false;
  }

  private contactMatchesTargetCompany(contact: ALeadsContact, companyName: string, companyDomain?: string): boolean {
    if (companyDomain && contact.email) {
      const emailDomain = contact.email.split("@")[1]?.toLowerCase();
      const cleanDomain = companyDomain.toLowerCase().replace(/^www\./, "");
      if (emailDomain && !this.domainsMatch(emailDomain, cleanDomain)) {
        return false;
      }
    }

    if (contact.companyName && companyName) {
      const rName = contact.companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const qName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (rName.includes(qName) || qName.includes(rName)) return true;
    }

    if (companyDomain && contact.domain) {
      if (this.domainsMatch(contact.domain, companyDomain)) return true;
    }

    if (!contact.email && !contact.domain && !contact.companyName) return true;

    return false;
  }

  private parseAdvancedSearchContact(raw: any): ALeadsContact {
    if (!raw) {
      return { confidence: 0, verified: false, source: "aleads" };
    }

    return {
      firstName: raw.member_name_first || undefined,
      lastName: raw.member_name_last || undefined,
      fullName: raw.member_full_name || (raw.member_name_first && raw.member_name_last ? `${raw.member_name_first} ${raw.member_name_last}` : undefined),
      title: raw.job_title || undefined,
      email: undefined,
      phone: undefined,
      linkedinUrl: raw.member_linkedin_url || undefined,
      linkedinUsername: raw.member_linkedin_username || undefined,
      documentId: raw.document_id || undefined,
      companyName: raw.company_name || raw.organization_name || undefined,
      domain: raw.company_domain || raw.primary_domain || raw.domain || undefined,
      location: raw.member_location_raw_address || raw.hq_location || undefined,
      industry: raw.industry || undefined,
      confidence: raw._score ? Math.min(Math.round(raw._score / 25), 100) : 75,
      verified: false,
      source: "aleads",
      emailFound: raw.email_found === true,
      phoneAvailable: raw.phone_number_available === true,
    };
  }

  async advancedSearch(
    filters: Record<string, any>,
    page = 1,
    searchType: "new" | "saved" | "total" = "new"
  ): Promise<ALeadsAdvancedSearchResult> {
    if (!this.isConfigured()) {
      return { success: false, results: [], creditsUsed: 0, error: "A-Leads API key not configured" };
    }

    try {
      const body = {
        advanced_filters: filters,
        current_page: page,
        search_type: searchType,
      };
      const response = await this.makeRequest("POST", "/v1/search/advanced-search", body);
      this.totalCreditsUsed += 1;

      const results = response?.data || [];
      const totalResults = response?.meta_data?.total_count || undefined;

      return {
        success: Array.isArray(results) && results.length > 0,
        results: Array.isArray(results) ? results : [],
        totalResults,
        page,
        creditsUsed: 1,
      };
    } catch (error: any) {
      return { success: false, results: [], creditsUsed: 0, error: error.message };
    }
  }

  async findEmailByDocumentId(documentId: string): Promise<{ email: string | null; quality: string | null; firstName?: string; lastName?: string }> {
    try {
      const response = await this.makeRequest("POST", "/v1/search/find-email", {
        data: { document_id: documentId },
      });
      this.totalCreditsUsed += 0;

      const data = response?.data;
      return {
        email: data?.email || null,
        quality: data?.quality || null,
        firstName: data?.first_name || undefined,
        lastName: data?.last_name || undefined,
      };
    } catch (error: any) {
      console.error(`[A-Leads] find-email by document_id failed: ${error.message}`);
      return { email: null, quality: null };
    }
  }

  async findEmailByName(firstName: string, lastName: string, website: string): Promise<{ email: string | null; quality: string | null }> {
    try {
      const response = await this.makeRequest("POST", "/v1/search/find-email", {
        data: { first_name: firstName, last_name: lastName, website },
      });
      this.totalCreditsUsed += 1;

      const data = response?.data;
      return {
        email: data?.email || null,
        quality: data?.quality || null,
      };
    } catch (error: any) {
      console.error(`[A-Leads] find-email by name failed: ${error.message}`);
      return { email: null, quality: null };
    }
  }

  async findPhoneByLinkedIn(linkedinUsername: string): Promise<{ phone: string | null }> {
    try {
      const cleanUsername = linkedinUsername
        .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "")
        .replace(/\/$/, "");

      const response = await this.makeRequest("POST", "/v1/search/find-phone", {
        data: { linkedin_username: cleanUsername },
      });
      this.totalCreditsUsed += 1;

      const phone = response?.data?.response?.phone_number || response?.data?.phone_number || response?.data?.phone || null;
      return { phone };
    } catch (error: any) {
      console.error(`[A-Leads] find-phone failed: ${error.message}`);
      return { phone: null };
    }
  }

  async findPersonalEmail(linkedinUsername: string): Promise<ALeadsResult> {
    if (!this.isConfigured()) {
      return { success: false, contacts: [], creditsUsed: 0, error: "A-Leads API key not configured" };
    }

    try {
      const cleanUsername = linkedinUsername
        .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "")
        .replace(/\/$/, "");

      const response = await this.makeRequest("POST", "/v1/search/find-email/personal", {
        data: { linkedin_username: cleanUsername },
      });
      this.totalCreditsUsed += 1;

      const data = response?.data;
      if (data?.email) {
        return {
          success: true,
          contacts: [{
            firstName: data.first_name,
            lastName: data.last_name,
            email: data.email,
            confidence: 85,
            verified: false,
            source: "aleads",
          }],
          creditsUsed: 1,
          rawResponse: response,
        };
      }

      return { success: false, contacts: [], creditsUsed: 1, rawResponse: response };
    } catch (error: any) {
      return { success: false, contacts: [], creditsUsed: 0, error: error.message };
    }
  }

  async verifyEmail(email: string): Promise<ALeadsVerifyResult> {
    if (!this.isConfigured()) {
      return { success: false, valid: false, email, creditsUsed: 0, error: "A-Leads API key not configured" };
    }

    try {
      const response = await this.makeRequest("POST", "/v1/search/verify-email", {
        data: { email },
      });
      this.totalCreditsUsed += 1;

      const data = response?.data;
      const valid =
        data?.result === "valid" ||
        data?.result === "ok" ||
        data?.valid === true ||
        data?.is_valid === true ||
        false;

      return {
        success: true,
        valid,
        email,
        status: data?.result || data?.status || (valid ? "valid" : "invalid"),
        creditsUsed: 1,
      };
    } catch (error: any) {
      return { success: false, valid: false, email, creditsUsed: 0, error: error.message };
    }
  }

  private async resolveContactDetails(contact: ALeadsContact, domain: string): Promise<{ contact: ALeadsContact; credits: number }> {
    let credits = 0;

    const emailPromise = (async () => {
      if (contact.documentId) {
        try {
          const emailResult = await this.findEmailByDocumentId(contact.documentId);
          if (emailResult.email) {
            return { email: emailResult.email, quality: emailResult.quality, method: "document_id" as const };
          }
        } catch {}
      }
      if (contact.firstName && contact.lastName && domain) {
        try {
          credits += 1;
          const emailResult = await this.findEmailByName(contact.firstName, contact.lastName, domain);
          if (emailResult.email) {
            return { email: emailResult.email, quality: emailResult.quality, method: "name" as const };
          }
        } catch {}
      }
      return null;
    })();

    const phonePromise = (async () => {
      if (contact.linkedinUsername) {
        try {
          credits += 1;
          const phoneResult = await this.findPhoneByLinkedIn(contact.linkedinUsername);
          if (phoneResult.phone) return phoneResult.phone;
        } catch {}
      }
      return null;
    })();

    const [emailData, phone] = await Promise.all([emailPromise, phonePromise]);

    if (emailData) {
      contact.email = emailData.email;
      contact.verified = emailData.quality === "good";
      if (emailData.method === "document_id") {
        contact.confidence = emailData.quality === "good" ? 95 : 80;
      } else {
        contact.confidence = emailData.quality === "good" ? 90 : 75;
      }
    }

    if (phone) {
      contact.phone = phone;
    }

    return { contact, credits };
  }

  private rawResultMatchesDomain(raw: any, targetDomain: string): boolean {
    const rawDomain = (raw.company_domain || raw.primary_domain || raw.domain || "").toLowerCase().replace(/^www\./, "");
    const cleanTarget = targetDomain.toLowerCase().replace(/^www\./, "");
    if (!rawDomain || rawDomain.length < 3) return false;
    return this.domainsMatch(rawDomain, cleanTarget);
  }

  private rawResultMatchesCompanyName(raw: any, targetCompanyName: string): boolean {
    const rawCompany = (raw.company_name || raw.organization_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanTarget = targetCompanyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!rawCompany || rawCompany.length < 3 || !cleanTarget || cleanTarget.length < 3) return false;
    return rawCompany.includes(cleanTarget) || cleanTarget.includes(rawCompany);
  }

  private emailMatchesDomain(email: string | undefined, targetDomain: string): boolean {
    if (!email) return true;
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!emailDomain) return true;
    const cleanTarget = targetDomain.toLowerCase().replace(/^www\./, "");
    return this.domainsMatch(emailDomain, cleanTarget);
  }

  private filterRawResultsByCompany(results: any[], targetDomain: string, targetCompanyName?: string): any[] {
    const matched: any[] = [];
    const noInfo: any[] = [];

    for (const raw of results) {
      const rawDomain = (raw.company_domain || raw.primary_domain || raw.domain || "").toLowerCase().replace(/^www\./, "");
      const rawCompany = (raw.company_name || raw.organization_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      const hasDomainInfo = rawDomain && rawDomain.length >= 3;
      const hasCompanyInfo = rawCompany && rawCompany.length >= 3;

      if (hasDomainInfo) {
        if (this.rawResultMatchesDomain(raw, targetDomain)) {
          matched.push(raw);
          continue;
        }
        const name = raw.member_full_name || `${raw.member_name_first || ''} ${raw.member_name_last || ''}`.trim();
        console.log(`[A-Leads] PRE-FILTER: Rejecting "${name}" - domain "${rawDomain}" doesn't match target "${targetDomain}"`);
        continue;
      }

      if (hasCompanyInfo && targetCompanyName) {
        if (this.rawResultMatchesCompanyName(raw, targetCompanyName)) {
          matched.push(raw);
          continue;
        }
        const name = raw.member_full_name || `${raw.member_name_first || ''} ${raw.member_name_last || ''}`.trim();
        console.log(`[A-Leads] PRE-FILTER: Rejecting "${name}" - company "${rawCompany}" doesn't match target "${targetCompanyName}"`);
        continue;
      }

      noInfo.push(raw);
    }

    if (matched.length > 0) return matched;
    return noInfo;
  }

  async enrichFromDomain(domain: string, targetTitles?: string[], companyName?: string): Promise<ALeadsResult> {
    if (!this.isConfigured()) {
      return { success: false, contacts: [], creditsUsed: 0, error: "A-Leads API key not configured" };
    }

    if (ALeadsService.isBlacklistedDomain(domain)) {
      console.log(`[A-Leads] SKIPPING blacklisted domain: ${domain}`);
      return { success: false, contacts: [], creditsUsed: 0, error: `Blacklisted domain: ${domain}` };
    }

    console.log(`[A-Leads] Starting domain enrichment for: ${domain}`);
    const allContacts: ALeadsContact[] = [];
    let totalCredits = 0;
    const seenDocIds = new Set<string>();

    const decisionMakerTitles = targetTitles || [
      "CEO", "CTO", "Founder", "Co-Founder",
      "VP Engineering", "VP Technology", "VP Marketing",
      "Head of Engineering", "Head of Technology",
      "Director of Engineering", "Director of Technology",
      "Chief Technology Officer", "Chief Executive Officer",
      "Managing Director", "Owner", "President",
      "Manager", "Lead", "Principal",
    ];

    const cleanDomain = domain.toLowerCase().replace(/^www\./, "");

    const primaryFilters: Record<string, any> = {
      domain: [cleanDomain],
    };

    console.log(`[A-Leads] Search 1: domain=${cleanDomain} only (search_type=new)`);
    const searchResult = await this.advancedSearch(primaryFilters, 1, "new");
    totalCredits += searchResult.creditsUsed;

    if (searchResult.success && searchResult.results.length > 0) {
      const domainMatched = this.filterRawResultsByCompany(searchResult.results, cleanDomain, companyName);
      const candidateResults = domainMatched.length > 0 ? domainMatched : searchResult.results;
      console.log(`[A-Leads] Pre-filter: ${searchResult.results.length} raw → ${domainMatched.length} domain-matched, using ${candidateResults === domainMatched ? 'matched' : 'all as candidates'}`);

      const parsedContacts = candidateResults.slice(0, 10).map(result => {
        const contact = this.parseAdvancedSearchContact(result);
        if (contact.documentId) seenDocIds.add(contact.documentId);
        return contact;
      });

      const resolvedResults = await Promise.all(
        parsedContacts.map(contact => this.resolveContactDetails(contact, cleanDomain))
      );

      for (const resolved of resolvedResults) {
        totalCredits += resolved.credits;
        if (resolved.contact.email) {
          const emailDomain = resolved.contact.email.split("@")[1]?.toLowerCase();
          if (emailDomain && this.domainsMatch(emailDomain, cleanDomain)) {
            allContacts.push(resolved.contact);
            console.log(`[A-Leads] ACCEPTED: "${resolved.contact.fullName || resolved.contact.firstName}" (${resolved.contact.title}) - ${resolved.contact.email} ✓`);
          } else {
            console.log(`[A-Leads] REJECTED: "${resolved.contact.fullName || resolved.contact.firstName}" - email "${resolved.contact.email}" doesn't match "${cleanDomain}"`);
          }
        }
      }
    }

    if (allContacts.length === 0 && companyName) {
      console.log(`[A-Leads] Search 2: company_name="${companyName}" fallback`);
      const companyFilters: Record<string, any> = {
        company_name: [companyName],
      };
      const companySearch = await this.advancedSearch(companyFilters, 1, "new");
      totalCredits += companySearch.creditsUsed;

      if (companySearch.success) {
        const nameMatched = companySearch.results.filter((r: any) => {
          const rName = (r.company_name || r.organization_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const tName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
          return rName.includes(tName) || tName.includes(rName);
        });
        const candidateResults2 = nameMatched.length > 0 ? nameMatched : companySearch.results;
        console.log(`[A-Leads] Company name filter: ${companySearch.results.length} raw → ${nameMatched.length} name-matched, using ${candidateResults2 === nameMatched ? 'matched' : 'all as candidates'}`);

        const companyContacts = candidateResults2
          .filter(result => !(result.document_id && seenDocIds.has(result.document_id)))
          .slice(0, 10)
          .map(result => {
            const contact = this.parseAdvancedSearchContact(result);
            if (contact.documentId) seenDocIds.add(contact.documentId);
            return contact;
          });

        const resolvedCompany = await Promise.all(
          companyContacts.map(contact => this.resolveContactDetails(contact, cleanDomain))
        );

        for (const resolved of resolvedCompany) {
          totalCredits += resolved.credits;
          if (resolved.contact.email) {
            const emailDomain = resolved.contact.email.split("@")[1]?.toLowerCase();
            if (emailDomain && this.domainsMatch(emailDomain, cleanDomain)) {
              allContacts.push(resolved.contact);
              console.log(`[A-Leads] ACCEPTED: "${resolved.contact.fullName || resolved.contact.firstName}" (${resolved.contact.title}) - ${resolved.contact.email} ✓`);
            } else {
              console.log(`[A-Leads] REJECTED: "${resolved.contact.fullName || resolved.contact.firstName}" - email "${resolved.contact.email}" doesn't match "${cleanDomain}"`);
            }
          }
        }
      }
    }

    console.log(
      `[A-Leads] Domain enrichment complete for ${domain}: ${allContacts.length} contacts (${allContacts.filter(c => c.email).length} with email, ${allContacts.filter(c => c.phone).length} with phone, ${allContacts.filter(c => c.linkedinUrl).length} with LinkedIn), ${totalCredits} credits used`
    );

    return {
      success: allContacts.length > 0,
      contacts: allContacts,
      creditsUsed: totalCredits,
    };
  }

  async enrichFromCompany(
    companyName: string,
    companyDomain?: string
  ): Promise<ALeadsResult> {
    if (!this.isConfigured()) {
      return { success: false, contacts: [], creditsUsed: 0, error: "A-Leads API key not configured" };
    }

    console.log(
      `[A-Leads] Starting company NAME enrichment for: ${companyName}${companyDomain ? ` (domain: ${companyDomain})` : ""}`
    );

    const allContacts: ALeadsContact[] = [];
    let totalCredits = 0;

    const searchResult = await this.advancedSearch({
      company_name: [companyName],
      job_title: ["CEO", "CTO", "Founder", "Co-Founder", "Owner", "President", "Managing Director", "Director", "Hiring Manager", "VP Engineering"],
    }, 1, "new");
    totalCredits += searchResult.creditsUsed;

    if (searchResult.success) {
      const nameMatches = searchResult.results.filter((r: any) => {
        const rName = (r.company_name || "").toLowerCase();
        const qName = companyName.toLowerCase();
        return rName.includes(qName) || qName.includes(rName) ||
          rName.replace(/[^a-z0-9]/g, "").includes(qName.replace(/[^a-z0-9]/g, ""));
      });

      const resultsToUse = nameMatches.length > 0 ? nameMatches : searchResult.results;

      const parsedContacts = resultsToUse.slice(0, 3).map(result => {
        const contact = this.parseAdvancedSearchContact(result);
        const contactDomain = contact.domain || companyDomain || "";
        return { contact, contactDomain };
      });

      const resolvedResults = await Promise.all(
        parsedContacts.map(({ contact, contactDomain }) => this.resolveContactDetails(contact, contactDomain))
      );

      for (const resolved of resolvedResults) {
        totalCredits += resolved.credits;
        const c = resolved.contact;
        if (c.email || c.linkedinUrl || c.phone) {
          if (this.contactMatchesTargetCompany(c, companyName, companyDomain)) {
            allContacts.push(c);
          } else {
            console.log(`[A-Leads] FILTERED OUT wrong-company contact: ${c.fullName || c.firstName} (email: ${c.email}, company: ${c.companyName}) - target: ${companyName}`);
          }
        }
      }
    }

    console.log(
      `[A-Leads] Company NAME enrichment complete for ${companyName}: ${allContacts.length} contacts (${allContacts.filter(c => c.email).length} with email), ${totalCredits} credits used`
    );

    return {
      success: allContacts.length > 0,
      contacts: allContacts,
      creditsUsed: totalCredits,
    };
  }

  async companySearchByJobTitle(
    jobTitle: string | string[],
    options?: {
      job_posting_location?: string[];
      job_posting_type?: string[];
      job_posting_seniority?: string[];
      job_posting_start_date?: string;
      job_posting_end_date?: string;
      batch_size?: number;
    }
  ): Promise<ALeadsCompanySearchResult> {
    if (!this.isConfigured()) {
      return { success: false, companies: [], creditsUsed: 0, error: "A-Leads API key not configured" };
    }

    try {
      const titles = Array.isArray(jobTitle) ? jobTitle : [jobTitle];
      const advanced_filters: any = {
        job_title: titles,
      };
      if (options?.job_posting_location) advanced_filters.location = options.job_posting_location;

      console.log(`[A-Leads] Company search via advanced-search: ${JSON.stringify(advanced_filters)}`);

      const allResults: any[] = [];
      const maxPages = 3;

      for (let page = 1; page <= maxPages; page++) {
        const response = await this.makeRequest("POST", "/v1/search/advanced-search", {
          advanced_filters,
          current_page: page,
          search_type: "new",
        });
        this.totalCreditsUsed += 1;

        const results = response?.data || [];
        if (!Array.isArray(results) || results.length === 0) break;

        allResults.push(...results);
        const totalCount = response?.meta_data?.total_count || 0;
        if (allResults.length >= totalCount) break;
      }

      console.log(`[A-Leads] Found ${allResults.length} people, grouping by company...`);

      const companyMap = new Map<string, any>();
      for (const person of allResults) {
        const companyName = person.company_name || person.organization_name || "";
        const domain = person.company_domain || person.primary_domain || "";
        if (!companyName && !domain) continue;

        const key = (domain || companyName).toLowerCase();
        if (!companyMap.has(key)) {
          companyMap.set(key, {
            name: companyName,
            company_name: companyName,
            domain: domain,
            company_domain: domain,
            industry: person.industry || person.company_industry || "",
            location: person.location || person.company_location || "",
            description: "",
            people: [],
          });
        }
        companyMap.get(key).people.push({
          name: person.member_full_name,
          title: person.job_title,
          linkedin: person.member_linkedin_url,
          linkedinUsername: person.member_linkedin_username,
          documentId: person.document_id,
          location: person.member_location_raw_address,
        });
      }

      const companies = Array.from(companyMap.values());
      console.log(`[A-Leads] Grouped into ${companies.length} unique companies`);

      return {
        success: companies.length > 0,
        companies,
        creditsUsed: Math.min(maxPages, Math.ceil(allResults.length / 26) + 1),
      };
    } catch (error: any) {
      console.error(`[A-Leads] Company search failed: ${error.message}`);
      return { success: false, companies: [], creditsUsed: 0, error: error.message };
    }
  }

  async findContactsForCompanyDomain(
    domain: string,
    targetTitles?: string[],
    companyName?: string
  ): Promise<ALeadsResult> {
    return this.enrichFromDomain(domain, targetTitles, companyName);
  }

  async enrichByPersonName(
    personName: string,
    location?: string,
    jobTitle?: string
  ): Promise<ALeadsResult & { resolvedCompany?: { name: string; domain: string } }> {
    if (!this.isConfigured()) {
      return { success: false, contacts: [], creditsUsed: 0, error: "A-Leads API key not configured" };
    }

    const nameParts = personName.trim().split(/\s+/);
    if (nameParts.length < 1 || personName.trim().length < 3) {
      return { success: false, contacts: [], creditsUsed: 0, error: "Person name too short" };
    }

    console.log(`[A-Leads] Person-based enrichment: name="${personName}", location="${location || "any"}", jobContext="${jobTitle || "none"}"`);

    const allContacts: ALeadsContact[] = [];
    let totalCredits = 0;
    let resolvedCompany: { name: string; domain: string } | undefined;

    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

    const filters: Record<string, any> = {};
    if (firstName) filters.member_name_first = [firstName];
    if (lastName) filters.member_name_last = [lastName];
    if (location) {
      const cleanLocation = location.replace(/,\s*Remote$/i, "").trim();
      if (cleanLocation && cleanLocation.length > 2) {
        filters.location = [cleanLocation];
      }
    }

    console.log(`[A-Leads] Person search filters: ${JSON.stringify(filters)}`);
    const searchResult = await this.advancedSearch(filters, 1, "new");
    totalCredits += searchResult.creditsUsed;

    if (searchResult.success && searchResult.results.length > 0) {
      const bestMatch = searchResult.results[0];
      const matchedCompanyName = bestMatch.company_name || bestMatch.organization_name;
      const matchedDomain = bestMatch.company_domain || bestMatch.primary_domain || bestMatch.domain;

      if (matchedCompanyName && matchedDomain && !ALeadsService.isBlacklistedDomain(matchedDomain)) {
        resolvedCompany = { name: matchedCompanyName, domain: matchedDomain };
        console.log(`[A-Leads] Person "${personName}" resolved to company: ${matchedCompanyName} (${matchedDomain})`);
      }

      const parsedContacts = searchResult.results.slice(0, 3).map(result => {
        return this.parseAdvancedSearchContact(result);
      });

      const resolvedResults = await Promise.all(
        parsedContacts.map(contact => this.resolveContactDetails(contact, matchedDomain || ""))
      );

      for (const resolved of resolvedResults) {
        totalCredits += resolved.credits;
        if (resolved.contact.email || resolved.contact.linkedinUrl || resolved.contact.phone) {
          allContacts.push(resolved.contact);
        }
      }
    }

    if (allContacts.length === 0 && firstName && lastName) {
      console.log(`[A-Leads] Person search 2: broader search without location filter`);
      const broaderFilters: Record<string, any> = {
        member_name_first: [firstName],
        member_name_last: [lastName],
      };
      const broadSearch = await this.advancedSearch(broaderFilters, 1, "new");
      totalCredits += broadSearch.creditsUsed;

      if (broadSearch.success && broadSearch.results.length > 0) {
        const bestMatch = broadSearch.results[0];
        const matchedCompanyName = bestMatch.company_name || bestMatch.organization_name;
        const matchedDomain = bestMatch.company_domain || bestMatch.primary_domain || bestMatch.domain;

        if (!resolvedCompany && matchedCompanyName && matchedDomain && !ALeadsService.isBlacklistedDomain(matchedDomain)) {
          resolvedCompany = { name: matchedCompanyName, domain: matchedDomain };
        }

        const parsedContacts = broadSearch.results.slice(0, 2).map(result => {
          return this.parseAdvancedSearchContact(result);
        });

        const resolvedBroad = await Promise.all(
          parsedContacts.map(contact => this.resolveContactDetails(contact, matchedDomain || ""))
        );

        for (const resolved of resolvedBroad) {
          totalCredits += resolved.credits;
          if (resolved.contact.email || resolved.contact.linkedinUrl || resolved.contact.phone) {
            allContacts.push(resolved.contact);
          }
        }
      }
    }

    console.log(
      `[A-Leads] Person enrichment complete for "${personName}": ${allContacts.length} contacts (${allContacts.filter(c => c.email).length} with email), company=${resolvedCompany?.name || "none"}, ${totalCredits} credits used`
    );

    return {
      success: allContacts.length > 0,
      contacts: allContacts,
      creditsUsed: totalCredits,
      resolvedCompany,
    };
  }

  getTotalCreditsUsed(): number {
    return this.totalCreditsUsed;
  }

  resetCreditCounter(): void {
    this.totalCreditsUsed = 0;
  }
}

export const aleadsService = new ALeadsService();
