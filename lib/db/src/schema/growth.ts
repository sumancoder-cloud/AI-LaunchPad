import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const registrationsTable = pgTable(
  "growth_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    college: varchar("college", { length: 180 }).notNull(),
    graduationYear: integer("graduation_year").notNull(),
    branch: varchar("branch", { length: 100 }).notNull(),
    communicationsConsent: boolean("communications_consent").notNull(),
    referralCode: varchar("referral_code", { length: 32 }).notNull(),
    referrerRegistrationId: uuid("referrer_registration_id").references(
      (): AnyPgColumn => registrationsTable.id,
    ),
    source: varchar("source", { length: 100 }).notNull().default("direct"),
    medium: varchar("medium", { length: 100 }).notNull().default(""),
    campaign: varchar("campaign", { length: 100 }).notNull().default(""),
    visitorId: varchar("visitor_id", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_registrations_email_unique").on(table.email),
    uniqueIndex("growth_registrations_referral_code_unique").on(
      table.referralCode,
    ),
    index("growth_registrations_created_at_idx").on(table.createdAt),
    index("growth_registrations_source_idx").on(table.source),
    index("growth_registrations_college_idx").on(table.college),
    index("growth_registrations_year_idx").on(table.graduationYear),
    index("growth_registrations_referrer_idx").on(
      table.referrerRegistrationId,
    ),
  ],
);

export const campaignEventsTable = pgTable(
  "growth_campaign_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    visitorId: varchar("visitor_id", { length: 80 }).notNull(),
    page: varchar("page", { length: 200 }).notNull(),
    source: varchar("source", { length: 100 }).notNull().default("direct"),
    medium: varchar("medium", { length: 100 }).notNull().default(""),
    campaign: varchar("campaign", { length: 100 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_campaign_events_visitor_type_unique").on(
      table.visitorId,
      table.eventType,
    ),
    index("growth_campaign_events_type_time_idx").on(
      table.eventType,
      table.createdAt,
    ),
    index("growth_campaign_events_visitor_idx").on(table.visitorId),
  ],
);

export const campaignConfigTable = pgTable("growth_campaign_config", {
  id: integer("id").primaryKey().default(1),
  campaignName: varchar("campaign_name", { length: 120 })
    .notNull()
    .default("Build Your First AI Project in 60 Minutes"),
  target: integer("target").notNull().default(500),
  durationDays: integer("duration_days").notNull().default(7),
  budgetPaise: integer("budget_paise").notNull().default(200000),
  startDate: date("start_date", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaignSpendTable = pgTable(
  "growth_campaign_spend",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    amountPaise: integer("amount_paise").notNull(),
    channel: varchar("channel", { length: 100 }).notNull(),
    note: varchar("note", { length: 300 }).notNull().default(""),
    spentAt: date("spent_at", { mode: "string" }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("growth_campaign_spend_date_idx").on(table.spentAt)],
);

export type GrowthRegistration = typeof registrationsTable.$inferSelect;
export type GrowthCampaignEvent = typeof campaignEventsTable.$inferSelect;
export type GrowthCampaignConfig = typeof campaignConfigTable.$inferSelect;
export type GrowthCampaignSpend = typeof campaignSpendTable.$inferSelect;
