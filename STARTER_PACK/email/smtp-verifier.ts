import dns from "dns";
import { promisify } from "util";
import net from "net";
import nodemailer from "nodemailer";

const resolveMx = promisify(dns.resolveMx);

interface VerificationResult {
  email: string;
  valid: boolean;
  mxFound: boolean;
  smtpCheck: "pass" | "fail" | "unknown" | "skipped";
  reason?: string;
}

interface SmtpConfig {
  gmailUser?: string;
  gmailAppPassword?: string;
}

export class SmtpVerifier {
  private timeout = 10000;
  private config: SmtpConfig = {};
  
  configure(config: SmtpConfig) {
    this.config = config;
    if (config.gmailUser && config.gmailAppPassword) {
      console.log("[SMTP] Gmail credentials configured for verification");
    }
  }
  
  isGmailConfigured(): boolean {
    return !!(this.config.gmailUser && this.config.gmailAppPassword);
  }

  async verify(email: string): Promise<VerificationResult> {
    const result: VerificationResult = {
      email,
      valid: false,
      mxFound: false,
      smtpCheck: "skipped",
    };

    if (!this.isValidFormat(email)) {
      result.reason = "Invalid email format";
      return result;
    }

    const domain = email.split("@")[1];

    try {
      const mxRecords = await resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        result.reason = "No MX records found";
        return result;
      }

      result.mxFound = true;

      const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
      const mxHost = sortedMx[0].exchange;

      try {
        const smtpResult = await this.checkSmtp(mxHost, email);
        result.smtpCheck = smtpResult.valid ? "pass" : "fail";
        result.valid = smtpResult.valid;
        result.reason = smtpResult.reason;
      } catch (smtpError) {
        result.smtpCheck = "unknown";
        result.valid = result.mxFound;
        result.reason = "SMTP check inconclusive, MX exists";
      }
    } catch (dnsError: any) {
      result.reason = `DNS error: ${dnsError.message}`;
    }

    return result;
  }

  private isValidFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private checkSmtp(
    mxHost: string,
    email: string
  ): Promise<{ valid: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let step = 0;
      let buffer = "";

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(this.timeout);

      socket.on("timeout", () => {
        cleanup();
        resolve({ valid: false, reason: "Connection timeout" });
      });

      socket.on("error", () => {
        cleanup();
        resolve({ valid: false, reason: "Connection error" });
      });

      socket.on("data", (data) => {
        buffer += data.toString();

        if (!buffer.includes("\r\n")) return;

        const lines = buffer.split("\r\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const code = parseInt(line.substring(0, 3), 10);

          switch (step) {
            case 0:
              if (code === 220) {
                step = 1;
                socket.write("EHLO verify.local\r\n");
              } else {
                cleanup();
                resolve({ valid: false, reason: "Server rejected connection" });
              }
              break;

            case 1:
              if (code === 250) {
                step = 2;
                socket.write("MAIL FROM:<test@verify.local>\r\n");
              }
              break;

            case 2:
              if (code === 250) {
                step = 3;
                socket.write(`RCPT TO:<${email}>\r\n`);
              } else {
                cleanup();
                resolve({ valid: false, reason: "MAIL FROM rejected" });
              }
              break;

            case 3:
              socket.write("QUIT\r\n");
              cleanup();

              if (code === 250 || code === 251) {
                resolve({ valid: true });
              } else if (code === 550 || code === 551 || code === 552 || code === 553) {
                resolve({ valid: false, reason: "Recipient rejected" });
              } else if (code >= 400 && code < 500) {
                resolve({ valid: true, reason: "Temporary rejection (likely valid)" });
              } else {
                resolve({ valid: false, reason: `Unknown response: ${code}` });
              }
              break;
          }
        }
      });

      socket.connect(25, mxHost, () => {
      });
    });
  }

  async batchVerify(
    emails: string[],
    concurrency: number = 3
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((e) => this.verify(e)));
      results.push(...batchResults);

      if (i + concurrency < emails.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return results;
  }
}

export const smtpVerifier = new SmtpVerifier();
