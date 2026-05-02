import axios from "axios";
import * as cheerio from "cheerio";

interface ExtractedProfile {
  companyName?: string;
  description?: string;
  services?: string;
  projects?: string;
  domain?: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
}

export class ProfileExtractor {
  private userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  async extractFromWebsite(websiteUrl: string): Promise<ExtractedProfile> {
    const result: ExtractedProfile = {};
    
    try {
      let url = websiteUrl.trim();
      if (!url.startsWith("http")) {
        url = "https://" + url;
      }
      
      const domain = new URL(url).hostname.replace("www.", "");
      result.domain = domain;

      const response = await axios.get(url, {
        headers: { "User-Agent": this.userAgent },
        timeout: 15000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);

      result.companyName = this.extractCompanyName($, domain);
      result.description = this.extractDescription($);
      result.services = this.extractServices($);
      result.linkedinUrl = this.extractLinkedIn($);
      result.email = this.extractEmail($.html());
      result.phone = this.extractPhone($.html());

      const aboutPageContent = await this.fetchAboutPage(url);
      if (aboutPageContent) {
        const $about = cheerio.load(aboutPageContent);
        if (!result.description) {
          result.description = this.extractDescription($about);
        }
        if (!result.services) {
          result.services = this.extractServices($about);
        }
      }

    } catch (error: any) {
      console.error("[ProfileExtractor] Error:", error.message);
    }

    return result;
  }

  private extractCompanyName($: cheerio.CheerioAPI, domain: string): string {
    const ogSiteName = $('meta[property="og:site_name"]').attr("content");
    if (ogSiteName) return ogSiteName.trim();

    const title = $("title").text().trim();
    if (title) {
      const cleanTitle = title.split("|")[0].split("-")[0].split("–")[0].trim();
      if (cleanTitle.length > 2 && cleanTitle.length < 50) {
        return cleanTitle;
      }
    }

    const brandName = domain.split(".")[0];
    return brandName.charAt(0).toUpperCase() + brandName.slice(1);
  }

  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    const metaDesc = $('meta[name="description"]').attr("content") ||
                    $('meta[property="og:description"]').attr("content");
    
    if (metaDesc && metaDesc.length > 50) {
      return metaDesc.trim();
    }

    const heroText = $("h1").first().text().trim();
    const subHeroText = $("h1 + p, .hero p, .banner p, header p").first().text().trim();
    
    if (heroText && subHeroText) {
      return `${heroText}. ${subHeroText}`.substring(0, 500);
    }

    const aboutText = $('[class*="about"] p, #about p, .about p')
      .slice(0, 3)
      .map((_, el) => $(el).text().trim())
      .get()
      .join(" ");
    
    if (aboutText.length > 50) {
      return aboutText.substring(0, 500);
    }

    return undefined;
  }

  private extractServices($: cheerio.CheerioAPI): string | undefined {
    const serviceKeywords = ["service", "solution", "offer", "expertise", "specialize", "we do", "what we do"];
    
    let servicesText = "";
    
    $("h2, h3").each((_, el) => {
      const heading = $(el).text().toLowerCase();
      if (serviceKeywords.some(kw => heading.includes(kw))) {
        const siblings = $(el).nextUntil("h2, h3").filter("p, ul, li");
        servicesText += siblings.map((_, s) => $(s).text().trim()).get().join(", ");
      }
    });

    if (servicesText.length > 20) {
      return servicesText.substring(0, 1000);
    }

    const listItems = $('[class*="service"] li, [class*="solution"] li, [class*="offer"] li')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(t => t.length > 5 && t.length < 100);
    
    if (listItems.length > 0) {
      return listItems.join(", ").substring(0, 1000);
    }

    return undefined;
  }

  private extractLinkedIn($: cheerio.CheerioAPI): string | undefined {
    const linkedInLink = $('a[href*="linkedin.com/company"], a[href*="linkedin.com/in/"]').first().attr("href");
    return linkedInLink || undefined;
  }

  private extractEmail(html: string): string | undefined {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailPattern) || [];
    
    const businessEmails = emails.filter(e => 
      !e.includes("@example") && 
      !e.includes("@test") &&
      !e.includes("@sentry") &&
      !e.includes("@wix") &&
      !e.includes("png") &&
      !e.includes("jpg")
    );

    const preferred = businessEmails.find(e => 
      e.includes("info@") || 
      e.includes("contact@") || 
      e.includes("hello@") ||
      e.includes("team@")
    );

    return preferred || businessEmails[0] || undefined;
  }

  private extractPhone(html: string): string | undefined {
    const phonePatterns = [
      /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    ];

    for (const pattern of phonePatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }

    return undefined;
  }

  private async fetchAboutPage(baseUrl: string): Promise<string | null> {
    const aboutPaths = ["/about", "/about-us", "/company", "/who-we-are"];
    
    for (const path of aboutPaths) {
      try {
        const url = new URL(path, baseUrl).toString();
        const response = await axios.get(url, {
          headers: { "User-Agent": this.userAgent },
          timeout: 10000,
          maxRedirects: 3,
        });
        return response.data;
      } catch {
        continue;
      }
    }
    
    return null;
  }

  async extractFromCV(cvText: string): Promise<ExtractedProfile> {
    const result: ExtractedProfile = {};

    const emailMatch = cvText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      result.email = emailMatch[0];
    }

    const linkedinMatch = cvText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    if (linkedinMatch) {
      result.linkedinUrl = "https://" + linkedinMatch[0];
    }

    const nameMatch = cvText.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)/m);
    if (nameMatch) {
      result.companyName = `${nameMatch[1]} ${nameMatch[2]}`;
    }

    const skillPatterns = [
      /skills?[:\s]+([^.]+)/i,
      /expertise[:\s]+([^.]+)/i,
      /technologies[:\s]+([^.]+)/i,
    ];

    for (const pattern of skillPatterns) {
      const match = cvText.match(pattern);
      if (match) {
        result.services = match[1].trim().substring(0, 500);
        break;
      }
    }

    return result;
  }
}

export const profileExtractor = new ProfileExtractor();
