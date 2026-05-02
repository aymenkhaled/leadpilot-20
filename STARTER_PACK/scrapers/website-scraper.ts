import axios from "axios";
import * as cheerio from "cheerio";
import { emailValidator } from "./email-validator";

interface ScrapedContact {
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  source: "website";
}

interface ScrapedCompanyInfo {
  description?: string;
  phone?: string;
  address?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
}

export class WebsiteScraper {
  private userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  async scrapeContacts(domain: string): Promise<ScrapedContact[]> {
    const contacts: ScrapedContact[] = [];
    const pagesToCheck = [
      `https://${domain}/about`,
      `https://${domain}/about-us`,
      `https://${domain}/team`,
      `https://${domain}/our-team`,
      `https://${domain}/leadership`,
      `https://${domain}/contact`,
      `https://${domain}/company`,
    ];

    for (const pageUrl of pagesToCheck) {
      try {
        const pageContacts = await this.scrapeContactsFromPage(pageUrl);
        contacts.push(...pageContacts);

        if (contacts.length >= 5) break;
      } catch {
      }
    }

    const deduplicated = this.deduplicateContacts(contacts);

    const validated: ScrapedContact[] = [];
    for (const contact of deduplicated) {
      if (contact.email) {
        const result = await emailValidator.validateEmail(contact.email);
        if (result.valid) {
          validated.push(contact);
        } else {
          console.log(`[WebsiteScraper] Filtered invalid email: ${contact.email} (${result.reason})`);
          if (contact.name) {
            validated.push({ ...contact, email: undefined });
          }
        }
      } else if (contact.name) {
        validated.push(contact);
      }
    }

    return validated;
  }

  async scrapeContactsFromPage(url: string): Promise<ScrapedContact[]> {
    const contacts: ScrapedContact[] = [];

    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": this.userAgent },
        timeout: 10000,
        maxRedirects: 3,
      });

      const $ = cheerio.load(response.data);

      const emails = this.extractEmails($.html());
      for (const email of emails) {
        contacts.push({
          email,
          source: "website",
        });
      }

      const teamCards = $(
        ".team-member, .member, .person, .employee, .leader, .executive, [class*='team'], [class*='member']"
      );

      teamCards.each((_index: number, el: cheerio.Element) => {
        const $el = $(el);
        const name =
          $el.find("h2, h3, h4, .name, [class*='name']").first().text().trim() ||
          $el.find("strong, b").first().text().trim();

        const title = $el
          .find(".title, .position, .role, [class*='title'], [class*='position']")
          .first()
          .text()
          .trim();

        const email = this.extractEmails($el.html() || "")[0];
        const linkedinUrl = $el.find('a[href*="linkedin.com"]').attr("href");

        if (name || email) {
          const parsed = this.parseName(name);
          contacts.push({
            name,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            title,
            email,
            linkedinUrl,
            source: "website",
          });
        }
      });
    } catch {
    }

    return contacts;
  }

  async scrapeCompanyInfo(domain: string): Promise<ScrapedCompanyInfo> {
    const info: ScrapedCompanyInfo = {};

    try {
      const response = await axios.get(`https://${domain}`, {
        headers: { "User-Agent": this.userAgent },
        timeout: 10000,
        maxRedirects: 3,
      });

      const $ = cheerio.load(response.data);

      const metaDescription = $('meta[name="description"]').attr("content");
      if (metaDescription) {
        info.description = metaDescription.substring(0, 500);
      }

      const phones = this.extractPhones($.html());
      if (phones.length > 0) {
        info.phone = phones[0];
      }

      info.socialLinks = {
        linkedin: $('a[href*="linkedin.com/company"]').attr("href"),
        twitter: $('a[href*="twitter.com"]').attr("href"),
        facebook: $('a[href*="facebook.com"]').attr("href"),
      };
    } catch {
    }

    return info;
  }

  private extractEmails(html: string): string[] {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = html.match(emailPattern) || [];

    return matches
      .filter((email) => {
        const lower = email.toLowerCase();
        return (
          !lower.includes("example") &&
          !lower.includes("test") &&
          !lower.includes("noreply") &&
          !lower.includes("no-reply") &&
          !lower.endsWith(".png") &&
          !lower.endsWith(".jpg") &&
          !lower.endsWith(".gif")
        );
      })
      .slice(0, 10);
  }

  private extractPhones(html: string): string[] {
    const phonePattern =
      /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const matches = html.match(phonePattern) || [];
    return Array.from(new Set(matches)).slice(0, 3);
  }

  private parseName(name: string): { firstName?: string; lastName?: string } {
    if (!name) return {};

    const parts = name
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);

    if (parts.length === 0) return {};
    if (parts.length === 1) return { firstName: parts[0] };

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }

  private deduplicateContacts(contacts: ScrapedContact[]): ScrapedContact[] {
    const seen = new Set<string>();
    return contacts.filter((c) => {
      const key = (c.email || c.name || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const websiteScraper = new WebsiteScraper();
