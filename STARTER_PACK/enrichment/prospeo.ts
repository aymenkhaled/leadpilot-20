import axios from "axios";

interface ProspeoContact {
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  confidence: number;
  verified: boolean;
}

interface ProspeoEnrichResult {
  success: boolean;
  contacts: ProspeoContact[];
  creditsUsed: number;
  error?: string;
}

export class ProspeoService {
  private apiKey: string | null = null;
  private baseUrl = "https://api.prospeo.io";

  setApiKey(key: string) {
    this.apiKey = key;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async findEmailByDomain(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<ProspeoEnrichResult> {
    if (!this.apiKey) {
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: "Prospeo API key not configured",
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/enrich-person`,
        {
          data: {
            first_name: firstName,
            last_name: lastName,
            company_website: domain,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-KEY": this.apiKey,
          },
          timeout: 15000,
        }
      );

      const person = response.data?.person || response.data?.response;
      const emailData = person?.email;

      if (emailData?.email && emailData?.revealed) {
        return {
          success: true,
          contacts: [
            {
              email: emailData.email,
              firstName: person.first_name || firstName,
              lastName: person.last_name || lastName,
              title: person.current_job_title || undefined,
              confidence: emailData.status === "VERIFIED" ? 99 : 85,
              verified: emailData.status === "VERIFIED",
            },
          ],
          creditsUsed: response.data?.free_enrichment ? 0 : 1,
        };
      }

      return {
        success: false,
        contacts: [],
        creditsUsed: response.data?.free_enrichment ? 0 : 1,
        error: response.data?.error_code || "No email found or email not revealed",
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("Prospeo API error:", errorData || error.message);
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: errorData?.message || errorData?.error_code || error.message,
      };
    }
  }

  async findEmailByLinkedIn(linkedinUrl: string): Promise<ProspeoEnrichResult> {
    if (!this.apiKey) {
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: "Prospeo API key not configured",
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/enrich-person`,
        {
          data: {
            url: linkedinUrl,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-KEY": this.apiKey,
          },
          timeout: 15000,
        }
      );

      const person = response.data?.person || response.data?.response;
      const emailData = person?.email;

      if (emailData?.email && emailData?.revealed) {
        return {
          success: true,
          contacts: [
            {
              email: emailData.email,
              firstName: person.first_name,
              lastName: person.last_name,
              title: person.current_job_title,
              confidence: emailData.status === "VERIFIED" ? 99 : 85,
              verified: emailData.status === "VERIFIED",
            },
          ],
          creditsUsed: response.data?.free_enrichment ? 0 : 1,
        };
      }

      return {
        success: false,
        contacts: [],
        creditsUsed: response.data?.free_enrichment ? 0 : 1,
        error: response.data?.error_code || "No email found or email not revealed",
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("Prospeo LinkedIn error:", errorData || error.message);
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: errorData?.message || errorData?.error_code || error.message,
      };
    }
  }

  async domainSearch(
    domain: string,
    limit: number = 5
  ): Promise<ProspeoEnrichResult> {
    if (!this.apiKey) {
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: "Prospeo API key not configured",
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/domain-search`,
        {
          data: {
            company: domain,
            limit,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-KEY": this.apiKey,
          },
          timeout: 20000,
        }
      );

      const result = response.data?.response || response.data;
      const emails = result?.email_list || result?.emails || [];
      const contacts: ProspeoContact[] = emails.map((e: any) => ({
        email: e.email?.email || e.email,
        firstName: e.first_name,
        lastName: e.last_name,
        title: e.title || e.position,
        confidence: e.email?.score || e.score || 90,
        verified: e.email?.verified === true || e.verified === true,
      }));

      return {
        success: contacts.length > 0,
        contacts,
        creditsUsed: 1,
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData?.message === "INVALID_API_KEY") {
        console.error("Prospeo domain-search not available on current plan, falling back to enrich-person");
        return {
          success: false,
          contacts: [],
          creditsUsed: 0,
          error: "domain-search endpoint not available on free plan",
        };
      }
      console.error("Prospeo domain search error:", errorData || error.message);
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: errorData?.message || errorData?.error_code || error.message,
      };
    }
  }
}

export const prospeoService = new ProspeoService();
