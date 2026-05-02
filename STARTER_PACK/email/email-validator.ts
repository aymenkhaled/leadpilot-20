import dns from "dns";
import { promisify } from "util";

const dnsResolveMx = promisify(dns.resolveMx);

const GENERIC_PREFIXES = [
  "info", "contact", "hello", "hi", "support", "help", "admin",
  "office", "sales", "billing", "team", "mail", "email",
  "webmaster", "postmaster", "hostmaster", "abuse",
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "marketing", "pr", "press", "media", "hr", "jobs", "careers",
  "feedback", "enquiries", "inquiries", "general",
  "service", "services", "customerservice",
];

const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "10minutemail.com", "trashmail.com", "yopmail.com", "sharklasers.com",
  "grr.la", "guerrillamailblock.com", "maildrop.cc",
];

export class EmailValidator {
  private mxCache: Map<string, { valid: boolean; timestamp: number }> = new Map();
  private MX_CACHE_TTL = 1000 * 60 * 30;

  isValidFormat(email: string): boolean {
    if (!email || typeof email !== "string") return false;
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!pattern.test(email)) return false;
    if (email.length > 254) return false;
    const [local, domain] = email.split("@");
    if (local.length > 64) return false;
    if (domain.length > 253) return false;
    if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
    const tld = domain.split(".").pop()?.toLowerCase() || "";
    const invalidTlds = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "tiff", "css", "js", "html", "xml", "json", "pdf", "doc", "zip", "exe", "dll", "woff", "woff2", "ttf", "eot", "mp3", "mp4", "avi", "mov"];
    if (invalidTlds.includes(tld)) return false;
    const domainParts = domain.split(".");
    if (domainParts.length < 2) return false;
    if (domainParts.some(p => p.length === 0)) return false;
    if (/^\d+[a-z]$/.test(domainParts[0])) return false;
    return true;
  }

  isGenericEmail(email: string): boolean {
    if (!email) return false;
    const local = email.split("@")[0].toLowerCase();
    return GENERIC_PREFIXES.includes(local);
  }

  isPersonalEmail(email: string): boolean {
    if (!email) return false;
    if (!this.isValidFormat(email)) return false;
    if (this.isGenericEmail(email)) return false;
    const local = email.split("@")[0].toLowerCase();
    if (/^[a-z]+[.-][a-z]+$/i.test(local)) return true;
    if (/^[a-z]{2,}$/i.test(local) && local.length > 2) return true;
    return !GENERIC_PREFIXES.includes(local);
  }

  isDisposableEmail(email: string): boolean {
    if (!email) return false;
    const domain = email.split("@")[1]?.toLowerCase();
    return DISPOSABLE_DOMAINS.includes(domain);
  }

  async hasMxRecord(domain: string): Promise<boolean> {
    const cached = this.mxCache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.MX_CACHE_TTL) {
      return cached.valid;
    }

    try {
      const records = await dnsResolveMx(domain);
      const valid = records && records.length > 0;
      this.mxCache.set(domain, { valid, timestamp: Date.now() });
      return valid;
    } catch {
      this.mxCache.set(domain, { valid: false, timestamp: Date.now() });
      return false;
    }
  }

  async validateEmail(email: string): Promise<{ valid: boolean; reason?: string; isPersonal: boolean }> {
    if (!this.isValidFormat(email)) {
      return { valid: false, reason: "invalid_format", isPersonal: false };
    }

    if (this.isDisposableEmail(email)) {
      return { valid: false, reason: "disposable_domain", isPersonal: false };
    }

    const domain = email.split("@")[1];
    const hasMx = await this.hasMxRecord(domain);
    if (!hasMx) {
      return { valid: false, reason: "no_mx_record", isPersonal: false };
    }

    const isPersonal = this.isPersonalEmail(email);
    const isGeneric = this.isGenericEmail(email);

    return {
      valid: true,
      reason: isGeneric ? "generic_address" : undefined,
      isPersonal,
    };
  }
}

export const emailValidator = new EmailValidator();
