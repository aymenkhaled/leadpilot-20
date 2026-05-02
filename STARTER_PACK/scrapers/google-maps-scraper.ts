import axios from "axios";
import { storage } from "../storage";

interface GoogleMapsResult {
  title: string;
  address: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  email?: string;
  categories: string[];
  totalScore?: number;
  reviewsCount?: number;
  city?: string;
  state?: string;
  postalCode?: string;
  location?: { lat: number; lng: number };
  placeId?: string;
  url?: string;
}

interface SearchParams {
  searchQuery: string;
  location: string;
  maxResults?: number;
  userId?: number;
}

export class GoogleMapsScraper {
  private actorId = "nwua9Gu5YrADL7ZDj";

  private async getApiKey(userId?: number): Promise<{ key: string; keyId?: number } | null> {
    if (userId) {
      const dbKey = await storage.getActiveApifyKey(userId);
      if (dbKey) {
        return { key: dbKey.apiKey, keyId: dbKey.id };
      }
    }
    const envKey = process.env.APIFY_API_KEY;
    if (envKey) {
      return { key: envKey };
    }
    return null;
  }

  private async markKeyExhausted(keyId: number, userId: number) {
    try {
      await storage.updateApifyKey(keyId, userId, { status: "exhausted" } as any);
      console.log(`[GoogleMapsScraper] Marked key ${keyId} as exhausted, will try next key`);
    } catch (e) {
      console.error(`[GoogleMapsScraper] Failed to mark key ${keyId} as exhausted:`, e);
    }
  }

  async isConfigured(userId?: number): Promise<boolean> {
    const keyInfo = await this.getApiKey(userId);
    return !!keyInfo;
  }

  async searchBusinesses(params: SearchParams): Promise<{
    success: boolean;
    results: GoogleMapsResult[];
    error?: string;
    cost?: number;
  }> {
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const keyInfo = await this.getApiKey(params.userId);

      if (!keyInfo) {
        return {
          success: false,
          results: [],
          error: attempt > 0
            ? "All Apify API keys exhausted. Please add more keys in Settings > Apify Keys."
            : "No Apify API key available. Add keys in Settings > Apify Keys or set APIFY_API_KEY secret.",
        };
      }

      try {
        const result = await this.runScrape(keyInfo.key, params);
        return result;
      } catch (error: any) {
        const is402 = error?.response?.status === 402 || error?.message?.includes("402");
        if (is402 && keyInfo.keyId && params.userId) {
          await this.markKeyExhausted(keyInfo.keyId, params.userId);
          console.log(`[GoogleMapsScraper] Key ${keyInfo.keyId} got 402, rotating to next key (attempt ${attempt + 1}/${maxRetries})`);
          continue;
        }
        console.error("[GoogleMapsScraper] Error:", error.message);
        return { success: false, results: [], error: error.message };
      }
    }

    return { success: false, results: [], error: "All Apify keys exhausted after retries. Add more keys in Settings > Apify Keys." };
  }

  private async runScrape(apiKey: string, params: SearchParams): Promise<{
    success: boolean;
    results: GoogleMapsResult[];
    error?: string;
  }> {
    const input = {
      searchStringsArray: [params.searchQuery],
      locationQuery: params.location,
      maxCrawledPlacesPerSearch: params.maxResults || 20,
      language: "en",
      searchMatching: "all",
      skipClosedPlaces: false,
      scrapePlaceDetailPage: false,
      scrapeContacts: false,
      maxReviews: 0,
      maxImages: 0,
    };

    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${this.actorId}/runs?token=${apiKey}`,
      input,
      { headers: { "Content-Type": "application/json" }, timeout: 30000 }
    );

    const runId = runResponse.data.data.id;
    const datasetId = runResponse.data.data.defaultDatasetId;

    let status = "RUNNING";
    let attempts = 0;
    const maxAttempts = 40;

    while (status !== "SUCCEEDED" && status !== "FAILED" && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 3000));

      const statusResponse = await axios.get(
        `https://api.apify.com/v2/acts/${this.actorId}/runs/${runId}?token=${apiKey}`
      );
      status = statusResponse.data.data.status;
      attempts++;
    }

    if (status !== "SUCCEEDED") {
      return { success: false, results: [], error: `Scraping ${status === "FAILED" ? "failed" : "timed out"}` };
    }

    const itemsResponse = await axios.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`
    );

    const results: GoogleMapsResult[] = itemsResponse.data.map((item: any) => ({
      title: item.title,
      address: item.address,
      phone: item.phone,
      phoneUnformatted: item.phoneUnformatted,
      website: item.website,
      categories: item.categories || [],
      totalScore: item.totalScore,
      reviewsCount: item.reviewsCount,
      city: item.city,
      state: item.state,
      postalCode: item.postalCode,
      location: item.location,
      placeId: item.placeId,
      url: item.url,
    }));

    return { success: true, results };
  }

  extractEmailFromWebsite(html: string): string | undefined {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailPattern) || [];

    const businessEmails = emails.filter(e =>
      !e.includes("@example") &&
      !e.includes("@test") &&
      !e.includes("@sentry") &&
      !e.includes("png") &&
      !e.includes("jpg") &&
      !e.includes("wix") &&
      !e.includes("wordpress")
    );

    const preferred = businessEmails.find(e =>
      e.includes("info@") ||
      e.includes("contact@") ||
      e.includes("hello@") ||
      e.includes("sales@") ||
      e.includes("team@")
    );

    return preferred || businessEmails[0] || undefined;
  }
}

export const googleMapsScraper = new GoogleMapsScraper();
