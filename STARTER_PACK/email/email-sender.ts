import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface EmailConfig {
  gmailUser: string;
  gmailAppPassword: string;
  senderName?: string;
}

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  trackingId?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailStats {
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  replied: number;
}

export class EmailSender {
  private transporter: Transporter | null = null;
  private senderEmail: string = "";
  private senderName: string = "";
  private isConfigured: boolean = false;

  configure(config: EmailConfig) {
    this.senderEmail = config.gmailUser;
    this.senderName = config.senderName || config.gmailUser.split("@")[0];

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.gmailUser,
        pass: config.gmailAppPassword,
      },
    });

    this.isConfigured = true;
    console.log(`[EmailSender] Configured for ${config.gmailUser}`);
  }

  isReady(): boolean {
    return this.isConfigured && this.transporter !== null;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      console.log("[EmailSender] Connection verified successfully");
      return true;
    } catch (error: any) {
      console.error("[EmailSender] Connection verification failed:", error.message);
      return false;
    }
  }

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    if (!this.transporter || !this.isConfigured) {
      return {
        success: false,
        error: "Email sender not configured. Please add Gmail credentials.",
      };
    }

    try {
      // Format the body with proper HTML
      const htmlBody = this.formatEmailHtml(message.body, message.trackingId);
      const textBody = message.body.replace(/<[^>]*>/g, "");

      const mailOptions = {
        from: `"${this.senderName}" <${this.senderEmail}>`,
        to: message.to,
        subject: message.subject,
        text: textBody,
        html: htmlBody,
        replyTo: message.replyTo || this.senderEmail,
        headers: message.trackingId
          ? { "X-Tracking-ID": message.trackingId }
          : undefined,
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`[EmailSender] Sent to ${message.to}: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error(`[EmailSender] Failed to send to ${message.to}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendBulk(
    messages: EmailMessage[],
    delayMs: number = 2000
  ): Promise<{ results: SendResult[]; stats: EmailStats }> {
    const results: SendResult[] = [];
    const stats: EmailStats = {
      sent: 0,
      failed: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
    };

    for (let i = 0; i < messages.length; i++) {
      const result = await this.sendEmail(messages[i]);
      results.push(result);

      if (result.success) {
        stats.sent++;
      } else {
        stats.failed++;
      }

      // Add delay between emails to avoid rate limiting
      if (i < messages.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    console.log(`[EmailSender] Bulk send complete: ${stats.sent} sent, ${stats.failed} failed`);

    return { results, stats };
  }

  private formatEmailHtml(body: string, trackingId?: string): string {
    // Convert newlines to <br> and wrap in basic HTML
    const formattedBody = body
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    p { margin: 0 0 1em 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <p>${formattedBody}</p>
</body>
</html>`;

    // Add invisible tracking pixel if tracking ID provided
    if (trackingId) {
      // This would point to your tracking endpoint
      const trackingPixel = `<img src="${process.env.REPLIT_DEV_DOMAIN || "https://your-app.replit.app"}/api/track/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
      html = html.replace("</body>", `${trackingPixel}</body>`);
    }

    return html;
  }

  generateTrackingId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Create a tracked link
  createTrackedLink(originalUrl: string, trackingId: string): string {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || "https://your-app.replit.app";
    const encoded = encodeURIComponent(originalUrl);
    return `${baseUrl}/api/track/click/${trackingId}?url=${encoded}`;
  }
}

export const emailSender = new EmailSender();
