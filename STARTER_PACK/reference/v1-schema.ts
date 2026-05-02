import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// USERS TABLE - Authentication
// ============================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  companies: many(companies),
  contacts: many(contacts),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================
// COMPANIES TABLE - Secondary entity (enrichment layer)
// ============================================
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  website: varchar("website", { length: 500 }),
  industry: varchar("industry", { length: 100 }),
  size: varchar("size", { length: 50 }), // '1-10', '11-50', '51-200', '201-500', '500+'
  location: varchar("location", { length: 255 }),
  description: text("description"),
  phone: varchar("phone", { length: 50 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  source: varchar("source", { length: 50 }), // 'job_enrichment', 'manual', 'google_maps'
  totalJobsPosted: integer("total_jobs_posted").default(0),
  lastJobPostedAt: timestamp("last_job_posted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  user: one(users, {
    fields: [companies.userId],
    references: [users.id],
  }),
  jobs: many(jobs),
  contacts: many(contacts),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ============================================
// JOBS TABLE - Primary entity (what we're looking for)
// ============================================
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  
  // Job basics
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  budgetType: varchar("budget_type", { length: 20 }), // 'hourly', 'fixed', 'monthly'
  
  // Source tracking
  platform: varchar("platform", { length: 50 }).notNull(), // 'upwork', 'linkedin', 'indeed', etc.
  externalId: varchar("external_id", { length: 500 }),
  sourceUrl: varchar("source_url", { length: 2000 }),
  postedAt: timestamp("posted_at"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  
  // Company info (from job post, may be enriched later)
  companyName: varchar("company_name", { length: 255 }),
  companyDomain: varchar("company_domain", { length: 255 }),
  location: varchar("location", { length: 255 }),
  remote: boolean("remote").default(false),
  
  // Enrichment status
  domainResolved: boolean("domain_resolved").default(false),
  domainConfidence: integer("domain_confidence"),
  domainResolutionMethod: varchar("domain_resolution_method", { length: 50 }),
  contactFound: boolean("contact_found").default(false),
  contactVerified: boolean("contact_verified").default(false),
  
  // Outreach tracking
  contacted: boolean("contacted").default(false),
  contactedAt: timestamp("contacted_at"),
  responseReceived: boolean("response_received").default(false),
  outcome: varchar("outcome", { length: 50 }), // 'interested', 'not_interested', 'no_response', 'won'
  
  // Quality scoring
  opportunityScore: integer("opportunity_score"), // 0-100
  
  // Job Classification (GPT-4o-mini powered)
  jobType: varchar("job_type", { length: 30 }), // CONTRACT, RECRUITING, INTERNAL, COFOUNDER, CONSULTING, PARTNERSHIP
  classificationConfidence: integer("classification_confidence"), // 0-100
  classificationReasoning: text("classification_reasoning"),
  goodForAgency: boolean("good_for_agency"),
  recruiterVsTeamMember: varchar("recruiter_vs_team_member", { length: 30 }), // 'recruiter', 'team_member', 'unknown'
  extractedBudget: varchar("extracted_budget", { length: 100 }),
  extractedTimeline: varchar("extracted_timeline", { length: 100 }),
  budgetIndicator: varchar("budget_indicator", { length: 50 }), // 'high', 'medium', 'low', 'unknown'
  estimatedBudgetMin: integer("estimated_budget_min"),
  estimatedBudgetMax: integer("estimated_budget_max"),
  classified: boolean("classified").default(false),
  classifiedAt: timestamp("classified_at"),

  searchTerm: varchar("search_term", { length: 255 }),
  skills: text("skills"),

  // Platform-specific metadata (from Apify scrapers)
  employmentType: varchar("employment_type", { length: 100 }),
  seniorityLevel: varchar("seniority_level", { length: 100 }),
  industry: varchar("industry", { length: 255 }),
  applicants: integer("applicants"),
  posterLinkedin: varchar("poster_linkedin", { length: 500 }),
  posterName: varchar("poster_name", { length: 255 }),
  easyApply: boolean("easy_apply"),
  employerType: varchar("employer_type", { length: 50 }),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const jobsRelations = relations(jobs, ({ one }) => ({
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
}));

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  discoveredAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// ============================================
// CONTACTS TABLE - Decision makers (the GOLD)
// ============================================
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  
  // Person info
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  fullName: varchar("full_name", { length: 255 }),
  title: varchar("title", { length: 255 }),
  department: varchar("department", { length: 100 }),
  
  // Contact details
  email: varchar("email", { length: 255 }),
  emailConfidence: integer("email_confidence"), // 0-100
  emailVerified: boolean("email_verified").default(false),
  emailVerificationMethod: varchar("email_verification_method", { length: 50 }), // 'smtp', 'prospeo', 'pattern'
  emailLastVerified: timestamp("email_last_verified"),
  
  phone: varchar("phone", { length: 50 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  
  // Enrichment tracking
  source: varchar("source", { length: 50 }), // 'prospeo', 'website', 'rocketreach', 'manual'
  enrichedAt: timestamp("enriched_at"),
  
  // Outreach tracking
  lastContacted: timestamp("last_contacted"),
  timesContacted: integer("times_contacted").default(0),
  responded: boolean("responded").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// ============================================
// ENRICHMENT_LOGS TABLE - Debug and optimize
// ============================================
export const enrichmentLogs = pgTable("enrichment_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id),
  companyId: integer("company_id").references(() => companies.id),
  contactId: integer("contact_id").references(() => contacts.id),
  
  action: varchar("action", { length: 50 }).notNull(), // 'domain_resolution', 'contact_enrichment', 'verification'
  provider: varchar("provider", { length: 50 }).notNull(), // 'serper', 'prospeo', 'website', 'smtp'
  
  success: boolean("success").notNull(),
  responseData: jsonb("response_data"),
  errorMessage: text("error_message"),
  
  costCredits: integer("cost_credits"), // Track API usage
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enrichmentLogsRelations = relations(enrichmentLogs, ({ one }) => ({
  user: one(users, {
    fields: [enrichmentLogs.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [enrichmentLogs.jobId],
    references: [jobs.id],
  }),
  company: one(companies, {
    fields: [enrichmentLogs.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [enrichmentLogs.contactId],
    references: [contacts.id],
  }),
}));

export const insertEnrichmentLogSchema = createInsertSchema(enrichmentLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertEnrichmentLog = z.infer<typeof insertEnrichmentLogSchema>;
export type EnrichmentLog = typeof enrichmentLogs.$inferSelect;

// ============================================
// OUTREACH TABLE - Track your pitches
// ============================================
export const outreach = pgTable("outreach", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id),
  contactId: integer("contact_id").references(() => contacts.id),
  companyId: integer("company_id").references(() => companies.id),
  
  // Message details
  subject: varchar("subject", { length: 255 }),
  messageBody: text("message_body"),
  
  // Tracking
  sentVia: varchar("sent_via", { length: 50 }), // 'email', 'linkedin', 'platform'
  sentAt: timestamp("sent_at"),
  opened: boolean("opened").default(false),
  clicked: boolean("clicked").default(false),
  replied: boolean("replied").default(false),
  
  // Outcome
  outcome: varchar("outcome", { length: 50 }),
  outcomeNotes: text("outcome_notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const outreachRelations = relations(outreach, ({ one }) => ({
  user: one(users, {
    fields: [outreach.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [outreach.jobId],
    references: [jobs.id],
  }),
  contact: one(contacts, {
    fields: [outreach.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [outreach.companyId],
    references: [companies.id],
  }),
}));

export const insertOutreachSchema = createInsertSchema(outreach).omit({
  id: true,
  createdAt: true,
});

export type InsertOutreach = z.infer<typeof insertOutreachSchema>;
export type Outreach = typeof outreach.$inferSelect;

// ============================================
// SETTINGS TABLE - User preferences and API keys
// ============================================
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // API Keys (encrypted in production)
  serperApiKey: varchar("serper_api_key", { length: 255 }),
  prospeoApiKey: varchar("prospeo_api_key", { length: 255 }),
  rocketReachApiKey: varchar("rocketreach_api_key", { length: 255 }),
  openaiApiKey: varchar("openai_api_key", { length: 255 }),
  
  // Company/User Profile for Email Personalization
  profileCompanyName: varchar("profile_company_name", { length: 255 }),
  profileDomain: varchar("profile_domain", { length: 255 }),
  profileWebsite: varchar("profile_website", { length: 500 }),
  profileServices: text("profile_services"), // What services you offer
  profileProjects: text("profile_projects"), // Notable projects/portfolio
  profileDescription: text("profile_description"), // About your company
  profilePitch: text("profile_pitch"), // Your value proposition / elevator pitch
  profileCvUrl: varchar("profile_cv_url", { length: 500 }),
  profileCvContent: text("profile_cv_content"),
  profileLinkedin: varchar("profile_linkedin", { length: 500 }),
  profilePortfolioUrl: varchar("profile_portfolio_url", { length: 500 }),
  profileExampleEmails: text("profile_example_emails"),
  profileTone: varchar("profile_tone", { length: 30 }),
  
  // Job Quality Filtering Preferences
  minHourlyRate: integer("min_hourly_rate").default(30), // Min $/hr for hourly jobs
  minProjectBudget: integer("min_project_budget").default(1000), // Min $ for fixed jobs
  qualityFilterEnabled: boolean("quality_filter_enabled").default(false),
  
  // Enrichment preferences
  autoEnrichDomain: boolean("auto_enrich_domain").default(true),
  autoEnrichContact: boolean("auto_enrich_contact").default(false),
  
  // Notification settings
  emailNotifications: boolean("email_notifications").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
  }),
}));

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// ============================================
// APIFY_KEYS TABLE - Multiple API key management
// ============================================
export const apifyKeys = pgTable("apify_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  apiKey: varchar("api_key", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  totalCreditsUsed: integer("total_credits_used").default(0),
  lastUsedAt: timestamp("last_used_at"),
  lastError: text("last_error"),
  failedAt: timestamp("failed_at"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apifyKeysRelations = relations(apifyKeys, ({ one }) => ({
  user: one(users, {
    fields: [apifyKeys.userId],
    references: [users.id],
  }),
}));

export const insertApifyKeySchema = createInsertSchema(apifyKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApifyKey = z.infer<typeof insertApifyKeySchema>;
export type ApifyKey = typeof apifyKeys.$inferSelect;

// ============================================
// LOCAL_LEADS TABLE - Persistent business database
// ============================================
export const localLeads = pgTable("local_leads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  businessName: varchar("business_name", { length: 500 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  website: varchar("website", { length: 500 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  postalCode: varchar("postal_code", { length: 20 }),
  categories: text("categories"),
  industry: varchar("industry", { length: 100 }),
  size: varchar("size", { length: 50 }),
  revenue: varchar("revenue", { length: 100 }),
  rating: integer("rating"),
  reviewsCount: integer("reviews_count"),
  placeId: varchar("place_id", { length: 255 }),
  googleMapsUrl: varchar("google_maps_url", { length: 500 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  source: varchar("source", { length: 50 }).notNull(),
  searchQuery: varchar("search_query", { length: 255 }),
  contactEnriched: boolean("contact_enriched").default(false),
  companyId: integer("company_id").references(() => companies.id),
  hiringRoles: text("hiring_roles"),
  jobCount: integer("job_count").default(0),
  jobsEnriched: boolean("jobs_enriched").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const localLeadsRelations = relations(localLeads, ({ one }) => ({
  user: one(users, {
    fields: [localLeads.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [localLeads.companyId],
    references: [companies.id],
  }),
}));

export const insertLocalLeadSchema = createInsertSchema(localLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLocalLead = z.infer<typeof insertLocalLeadSchema>;
export type LocalLead = typeof localLeads.$inferSelect;
