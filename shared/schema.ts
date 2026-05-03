import {
  pgTable, text, integer, boolean, timestamp, uuid, jsonb, decimal, varchar, index, unique
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── WORKSPACES ────────────────────────────────────────────────────────────────
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"), // free | pro | agency | scale
  credits: decimal("credits", { precision: 10, scale: 2 }).notNull().default("50"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: text("subscription_status").default("inactive"),
  autoAgentDailyLimit: integer("auto_agent_daily_limit").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── USERS ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  currentWorkspaceId: uuid("current_workspace_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── WORKSPACE MEMBERS ─────────────────────────────────────────────────────────
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | admin | member
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.workspaceId, t.userId)]);

// ─── WORKSPACE API KEYS (BYOK encrypted) ──────────────────────────────────────
export const workspaceApiKeys = pgTable("workspace_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // openai | anthropic | aleads | prospeo | apollo | hunter | rocketreach | apify | serper | stripe | smartlead | instantly | postmark
  keyEncrypted: text("key_encrypted").notNull(), // AES-256-GCM encrypted
  keyIv: text("key_iv").notNull(),
  keyTag: text("key_tag").notNull(),
  isByok: boolean("is_byok").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestResult: text("last_test_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.workspaceId, t.provider)]);

// ─── WATERFALL CONFIGS ─────────────────────────────────────────────────────────
export const waterfallConfigs = pgTable("waterfall_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  steps: jsonb("steps").notNull().default([]), // [{provider, minConfidence, stopOnFound, useBYOK}]
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── JOBS ──────────────────────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  platform: text("platform").notNull(), // linkedin | indeed | upwork | freelancer | etc.
  title: text("title").notNull(),
  description: text("description"),
  companyName: text("company_name"),
  companyDomain: text("company_domain"),
  companyId: uuid("company_id"),
  location: text("location"),
  remote: boolean("remote").default(false),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  budgetType: text("budget_type"), // hourly | fixed | monthly | annual
  budgetIndicator: text("budget_indicator"), // low | medium | high | unknown
  sourceUrl: text("source_url"),
  postedAt: timestamp("posted_at"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  skills: jsonb("skills").default([]),
  seniorityLevel: text("seniority_level"),
  employmentType: text("employment_type"),
  industry: text("industry"),
  companySize: text("company_size"),
  posterName: text("poster_name"),
  posterLinkedin: text("poster_linkedin"),
  applicants: integer("applicants"),
  // Classification
  jobType: text("job_type"), // contract | fulltime | freelance | internship | parttime
  recruiterVsTeamMember: text("recruiter_vs_team_member"), // recruiter | team_member | unknown
  classifiedAt: timestamp("classified_at"),
  classificationScore: integer("classification_score"),
  opportunityScore: integer("opportunity_score"),
  // Enrichment status
  domainResolved: boolean("domain_resolved").default(false),
  contactFound: boolean("contact_found").default(false),
  contactVerified: boolean("contact_verified").default(false),
  enrichedAt: timestamp("enriched_at"),
  // Status
  status: text("status").notNull().default("new"), // new | classified | enriched | pitched | replied | won | lost | skipped
  isAnonymous: boolean("is_anonymous").default(false),
  isDuplicate: boolean("is_duplicate").default(false),
  archivedAt: timestamp("archived_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("jobs_workspace_idx").on(t.workspaceId),
  index("jobs_status_idx").on(t.workspaceId, t.status),
  index("jobs_platform_idx").on(t.workspaceId, t.platform),
]);

// ─── COMPANIES ─────────────────────────────────────────────────────────────────
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  industry: text("industry"),
  size: text("size"),
  location: text("location"),
  description: text("description"),
  logoUrl: text("logo_url"),
  fundingStage: text("funding_stage"),
  fundingTotal: text("funding_total"),
  foundedYear: integer("founded_year"),
  techStack: jsonb("tech_stack").default([]),
  tags: jsonb("tags").default([]),
  enrichedAt: timestamp("enriched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("companies_workspace_idx").on(t.workspaceId),
  index("companies_domain_idx").on(t.workspaceId, t.domain),
]);

// ─── CONTACTS ─────────────────────────────────────────────────────────────────
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"),
  email: text("email"),
  emailVerified: boolean("email_verified").default(false),
  emailConfidence: integer("email_confidence").default(0),
  title: text("title"),
  linkedinUrl: text("linkedin_url"),
  phone: text("phone"),
  location: text("location"),
  isChampion: boolean("is_champion").default(false),
  enrichmentProvider: text("enrichment_provider"),
  enrichedAt: timestamp("enriched_at"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("contacts_workspace_idx").on(t.workspaceId),
  index("contacts_email_idx").on(t.workspaceId, t.email),
]);

// ─── INTENT SIGNALS ────────────────────────────────────────────────────────────
export const intentSignals = pgTable("intent_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  type: text("type").notNull(), // funding | hiring_spike | job_change | tech_install | leadership_change
  title: text("title").notNull(),
  description: text("description"),
  strength: text("strength").notNull().default("moderate"), // weak | moderate | strong
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  metadata: jsonb("metadata").default({}),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  actedOnAt: timestamp("acted_on_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("signals_workspace_idx").on(t.workspaceId)]);

// ─── AGENT RUNS ────────────────────────────────────────────────────────────────
export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // pending | running | completed | failed | paused | cancelled
  approvalMode: text("approval_mode").notNull().default("draft"), // autonomous | approve_before_send | draft
  steps: jsonb("steps").notNull().default([]), // [{step, status, result, timestamp, tokensUsed}]
  totalTokensUsed: integer("total_tokens_used").default(0),
  creditsUsed: decimal("credits_used", { precision: 6, scale: 2 }).default("0"),
  result: jsonb("result"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("agent_runs_workspace_idx").on(t.workspaceId)]);

// ─── OUTREACH ──────────────────────────────────────────────────────────────────
export const outreach = pgTable("outreach", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"), // draft | scheduled | sent | opened | replied | bounced | unsubscribed
  sendingProvider: text("sending_provider"), // postmark | smartlead | instantly
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  repliedAt: timestamp("replied_at"),
  replyContent: text("reply_content"),
  replyClassification: text("reply_classification"), // positive | negative | neutral | out_of_office
  toEmail: text("to_email"),
  followUpCount: integer("follow_up_count").default(0),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("outreach_workspace_idx").on(t.workspaceId)]);

// ─── USAGE LOG ─────────────────────────────────────────────────────────────────
export const usageLog = pgTable("usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // enrich | scrape | classify | agent_run | email_send
  provider: text("provider"),
  creditsUsed: decimal("credits_used", { precision: 6, scale: 2 }).notNull().default("0"),
  isByok: boolean("is_byok").default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── WORKSPACE SETTINGS ────────────────────────────────────────────────────────
export const workspaceSettings = pgTable("workspace_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().unique().references(() => workspaces.id, { onDelete: "cascade" }),
  // Profile
  profileCompanyName: text("profile_company_name"),
  profileDescription: text("profile_description"),
  profileWebsite: text("profile_website"),
  profileDomain: text("profile_domain"),
  profilePortfolioUrl: text("profile_portfolio_url"),
  profileLinkedin: text("profile_linkedin"),
  profileCalendarUrl: text("profile_calendar_url"),
  profileCvUrl: text("profile_cv_url"),
  profileCvContent: text("profile_cv_content"),
  profileServices: text("profile_services"),
  profileProjects: text("profile_projects"),
  profilePitch: text("profile_pitch"),
  profileTone: text("profile_tone").default("professional"),
  profileExampleEmails: text("profile_example_emails"),
  profileSkills: jsonb("profile_skills").default([]),
  // Sending
  sendingProvider: text("sending_provider").default("postmark"),
  smartleadCampaignId: text("smartlead_campaign_id"),
  instantlyCampaignId: text("instantly_campaign_id"),
  // Notifications
  notifyNewSignals: boolean("notify_new_signals").default(true),
  notifyEnrichComplete: boolean("notify_enriched").default(true),
  notifyReply: boolean("notify_reply").default(true),
  notifyEmail: text("notify_email"),
  // Sender identity
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  replyToEmail: text("reply_to_email"),
  emailSignature: text("email_signature"),
  // Sending limits
  maxEmailsPerDay: integer("max_emails_per_day").default(50),
  minSendDelaySec: integer("min_send_delay_sec").default(60),
  // SMTP
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  // Extra notifications
  notifyAgentComplete: boolean("notify_agent_complete").default(true),
  notifyLowCredits: boolean("notify_low_credits").default(true),
  // Scraping defaults
  defaultScrapeKeyword: text("default_scrape_keyword"),
  defaultScrapeLocation: text("default_scrape_location"),
  autoClassify: boolean("auto_classify").default(false),
  autoEnrich: boolean("auto_enrich").default(false),
  autoAgent: boolean("auto_agent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── AUDIT LOG ─────────────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resource: text("resource"),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata").default({}),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── WEBHOOKS ──────────────────────────────────────────────────────────────────
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: jsonb("events").notNull().default([]), // contact.enriched | signal.detected | outreach.replied | agent.completed
  secret: text("secret").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastFiredAt: timestamp("last_fired_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── SCRAPE RUNS ──────────────────────────────────────────────────────────────
export const scrapeRuns = pgTable("scrape_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  keyword: text("keyword"),
  location: text("location"),
  status: text("status").notNull().default("running"), // running | completed | failed
  jobsFound: integer("jobs_found").default(0),
  jobsNew: integer("jobs_new").default(0),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ─── RELATIONS ─────────────────────────────────────────────────────────────────
export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  jobs: many(jobs),
  companies: many(companies),
  contacts: many(contacts),
  settings: one(workspaceSettings),
  apiKeys: many(workspaceApiKeys),
  signals: many(intentSignals),
  outreach: many(outreach),
  agentRuns: many(agentRuns),
  usageLog: many(usageLog),
  webhooks: many(webhooks),
}));

export const usersRelations = relations(users, ({ many }) => ({
  workspaceMembers: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [jobs.workspaceId], references: [workspaces.id] }),
  company: one(companies, { fields: [jobs.companyId], references: [companies.id] }),
  contacts: many(contacts),
  signals: many(intentSignals),
  outreach: many(outreach),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [companies.workspaceId], references: [workspaces.id] }),
  contacts: many(contacts),
  signals: many(intentSignals),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [contacts.workspaceId], references: [workspaces.id] }),
  company: one(companies, { fields: [contacts.companyId], references: [companies.id] }),
  job: one(jobs, { fields: [contacts.jobId], references: [jobs.id] }),
  outreach: many(outreach),
}));

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceApiKey = typeof workspaceApiKeys.$inferSelect;
export type WaterfallConfig = typeof waterfallConfigs.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;
export type IntentSignal = typeof intentSignals.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type Outreach = typeof outreach.$inferSelect;
export type UsageLog = typeof usageLog.$inferSelect;
export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type ScrapeRun = typeof scrapeRuns.$inferSelect;
