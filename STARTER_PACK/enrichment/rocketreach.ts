import axios from "axios";

interface RocketReachContact {
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  confidence: number;
}

interface RocketReachResult {
  success: boolean;
  contacts: RocketReachContact[];
  creditsUsed: number;
  error?: string;
}

export class RocketReachService {
  private apiKey: string | null = null;
  private baseUrl = "https://api.rocketreach.co/v2";

  setApiKey(key: string) {
    this.apiKey = key;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private extractEmail(raw: any): string | null {
    if (!raw) return null;
    if (typeof raw === "string") {
      if (raw.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.email || null;
        } catch {
          return raw.includes("@") ? raw : null;
        }
      }
      return raw.includes("@") ? raw : null;
    }
    if (typeof raw === "object" && raw.email) {
      return raw.email;
    }
    return null;
  }

  async lookupByName(
    firstName: string,
    lastName: string,
    companyDomain: string
  ): Promise<RocketReachResult> {
    if (!this.apiKey) {
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: "RocketReach API key not configured",
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/lookupProfile`, {
        params: {
          name: `${firstName} ${lastName}`,
          current_employer: companyDomain.replace(/\.(com|io|co|org|net)$/, ""),
        },
        headers: {
          "Api-Key": this.apiKey,
        },
        timeout: 15000,
      });

      if (response.data && response.data.emails?.length > 0) {
        const rawEmail = response.data.emails[0];
        const email = this.extractEmail(rawEmail);
        if (email) {
          const contact: RocketReachContact = {
            email,
            firstName: response.data.first_name || firstName,
            lastName: response.data.last_name || lastName,
            title: response.data.current_title,
            phone: response.data.phones?.[0],
            linkedinUrl: response.data.linkedin_url,
            confidence: 85,
          };

          return {
            success: true,
            contacts: [contact],
            creditsUsed: 1,
          };
        }
      }

      return {
        success: false,
        contacts: [],
        creditsUsed: 1,
        error: "No email found",
      };
    } catch (error: any) {
      console.error("RocketReach lookup error:", error.response?.data || error.message);
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async lookupByLinkedIn(linkedinUrl: string): Promise<RocketReachResult> {
    if (!this.apiKey) {
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: "RocketReach API key not configured",
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/lookupProfile`, {
        params: {
          li_url: linkedinUrl,
        },
        headers: {
          "Api-Key": this.apiKey,
        },
        timeout: 15000,
      });

      if (response.data && response.data.emails?.length > 0) {
        const rawEmail = response.data.emails[0];
        const email = this.extractEmail(rawEmail);
        if (email) {
          const contact: RocketReachContact = {
            email,
            firstName: response.data.first_name,
            lastName: response.data.last_name,
            title: response.data.current_title,
            phone: response.data.phones?.[0],
            linkedinUrl,
            confidence: 90,
          };

          return {
            success: true,
            contacts: [contact],
            creditsUsed: 1,
          };
        }
      }

      return {
        success: false,
        contacts: [],
        creditsUsed: 1,
        error: "No email found",
      };
    } catch (error: any) {
      console.error("RocketReach LinkedIn lookup error:", error.response?.data || error.message);
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async searchCompany(
    domain: string,
    titles?: string[]
  ): Promise<RocketReachResult> {
    if (!this.apiKey) {
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: "RocketReach API key not configured",
      };
    }

    try {
      const searchParams: any = {
        current_employer: domain.replace(/\.(com|io|co|org|net)$/, ""),
        page_size: 5,
      };

      if (titles && titles.length > 0) {
        searchParams.current_title = titles;
      }

      const response = await axios.get(`${this.baseUrl}/api/search`, {
        params: searchParams,
        headers: {
          "Api-Key": this.apiKey,
        },
        timeout: 20000,
      });

      const profiles = response.data.profiles || [];
      const contacts: RocketReachContact[] = profiles
        .filter((p: any) => p.emails?.length > 0)
        .map((p: any) => {
          const email = this.extractEmail(p.emails[0]);
          return {
            email: email || "",
            firstName: p.first_name,
            lastName: p.last_name,
            title: p.current_title,
            phone: p.phones?.[0],
            linkedinUrl: p.linkedin_url,
            confidence: 85,
          };
        })
        .filter((c: RocketReachContact) => c.email);

      return {
        success: contacts.length > 0,
        contacts,
        creditsUsed: 1,
      };
    } catch (error: any) {
      console.error("RocketReach search error:", error.response?.data || error.message);
      return {
        success: false,
        contacts: [],
        creditsUsed: 0,
        error: error.response?.data?.message || error.message,
      };
    }
  }
}

export const rocketReachService = new RocketReachService();
