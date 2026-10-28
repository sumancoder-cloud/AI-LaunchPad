import { randomBytes } from "node:crypto";
import { getAuth } from "@clerk/express";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
  sum,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAdminSpendBody,
  CreateAdminSpendResponse,
  CreateRegistrationBody,
  CreateRegistrationResponse,
  ExportAdminRegistrationsQueryParams,
  GetAdminConfigResponse,
  GetAdminReferralsQueryParams,
  GetAdminReferralsResponse,
  GetAdminSummaryQueryParams,
  GetAdminSummaryResponse,
  GetReferralSummaryParams,
  GetReferralSummaryResponse,
  ListAdminRegistrationsQueryParams,
  ListAdminRegistrationsResponse,
  ListAdminSpendResponse,
  RecordCampaignEventBody,
  RecordCampaignEventResponse,
  UpdateAdminConfigBody,
  UpdateAdminConfigResponse,
} from "@workspace/api-zod";
import {
  campaignConfigTable,
  campaignEventsTable,
  campaignSpendTable,
  db,
  registrationsTable,
} from "@workspace/db";
import { requireGrowthAdmin } from "../middlewares/requireGrowthAdmin";

const router: IRouter = Router();
const adminRouter: IRouter = Router();

type RegistrationFilters = {
  dateFrom?: string | Date;
  dateTo?: string | Date;
  source?: string;
  college?: string;
  graduationYear?: number;
  search?: string;
};

function calendarDate(value?: string | Date | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function normalizeTag(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

function registrationWhere(filters: RegistrationFilters) {
  const conditions = [];
  const dateFrom = calendarDate(filters.dateFrom);
  const dateTo = calendarDate(filters.dateTo);
  if (dateFrom) {
    conditions.push(
      gte(
        registrationsTable.createdAt,
        new Date(`${dateFrom}T00:00:00.000Z`),
      ),
    );
  }
  if (dateTo) {
    conditions.push(
      lte(
        registrationsTable.createdAt,
        new Date(`${dateTo}T23:59:59.999Z`),
      ),
    );
  }
  if (filters.source) {
    conditions.push(eq(registrationsTable.source, filters.source));
  }
  if (filters.college) {
    conditions.push(eq(registrationsTable.college, filters.college));
  }
  if (filters.graduationYear) {
    conditions.push(
      eq(registrationsTable.graduationYear, filters.graduationYear),
    );
  }
  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(registrationsTable.fullName, pattern),
        ilike(registrationsTable.email, pattern),
        ilike(registrationsTable.college, pattern),
      ),
    );
  }
  return conditions.length ? and(...conditions) : undefined;
}

function eventWhere(filters: RegistrationFilters) {
  const conditions = [];
  const dateFrom = calendarDate(filters.dateFrom);
  const dateTo = calendarDate(filters.dateTo);
  if (dateFrom) {
    conditions.push(
      gte(
        campaignEventsTable.createdAt,
        new Date(`${dateFrom}T00:00:00.000Z`),
      ),
    );
  }
  if (dateTo) {
    conditions.push(
      lte(
        campaignEventsTable.createdAt,
        new Date(`${dateTo}T23:59:59.999Z`),
      ),
    );
  }
  if (filters.source) {
    conditions.push(eq(campaignEventsTable.source, filters.source));
  }
  return conditions.length ? and(...conditions) : undefined;
}

async function getCampaignConfig() {
  await db
    .insert(campaignConfigTable)
    .values({ id: 1 })
    .onConflictDoNothing();
  const [config] = await db
    .select()
    .from(campaignConfigTable)
    .where(eq(campaignConfigTable.id, 1))
    .limit(1);
  if (!config) {
    throw new Error("Campaign settings could not be initialized.");
  }
  return {
    campaignName: config.campaignName,
    target: config.target,
    durationDays: config.durationDays,
    budgetPaise: config.budgetPaise,
    startDate: config.startDate,
  };
}

function daysRemaining(startDate: string | null, durationDays: number) {
  if (!startDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + durationDays - 1);
  const endDate = end.toISOString().slice(0, 10);
  if (today < startDate) return durationDays;
  if (today > endDate) return 0;
  const todayAtUtc = new Date(`${today}T00:00:00.000Z`);
  return Math.floor((end.getTime() - todayAtUtc.getTime()) / 86_400_000) + 1;
}

function cleanCsvCell(value: string | number): string {
  let normalized = String(value);
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replaceAll('"', '""')}"`;
}

router.post("/registrations", async (req, res): Promise<void> => {
  const parsed = CreateRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the required registration fields." });
    return;
  }

  const input = parsed.data;
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const college = input.college.trim().replace(/\s+/g, " ");
  const branch = input.branch.trim().replace(/\s+/g, " ");
  if (!fullName || !college || !branch) {
    res.status(400).json({ error: "Name, college, and branch are required." });
    return;
  }

  const [existing] = await db
    .select({ id: registrationsTable.id })
    .from(registrationsTable)
    .where(eq(registrationsTable.email, email))
    .limit(1);
  if (existing) {
    res.status(409).json({
      error: "This email is already registered for the workshop.",
    });
    return;
  }

  const suppliedReferralCode = input.referralCode?.trim().toUpperCase();
  let referrer: { id: string; email: string } | undefined;
  if (suppliedReferralCode) {
    const [candidate] = await db
      .select({
        id: registrationsTable.id,
        email: registrationsTable.email,
      })
      .from(registrationsTable)
      .where(eq(registrationsTable.referralCode, suppliedReferralCode))
      .limit(1);
    if (candidate && candidate.email !== email) referrer = candidate;
  }

  const source = referrer
    ? "student_referral"
    : normalizeTag(input.source) || "direct";
  const medium = referrer ? "referral" : normalizeTag(input.medium);
  const campaign = normalizeTag(input.campaign);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const referralCode = `AIL-${randomBytes(8).toString("hex").toUpperCase()}`;
    try {
      const [registration] = await db
        .insert(registrationsTable)
        .values({
          fullName,
          email,
          college,
          graduationYear: input.graduationYear,
          branch,
          communicationsConsent: input.communicationsConsent,
          referralCode,
          referrerRegistrationId: referrer?.id ?? null,
          source,
          medium,
          campaign,
          visitorId: input.visitorId?.slice(0, 80) ?? null,
        })
        .returning();

      const response = CreateRegistrationResponse.parse({
        id: registration.id,
        referralCode: registration.referralCode,
        referralUrl: `/?ref=${encodeURIComponent(registration.referralCode)}`,
        createdAt: registration.createdAt,
      });
      res.status(201).json(response);
      return;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === "23505") {
        if (pgError.constraint?.includes("referral_code")) continue;
        res.status(409).json({
          error: "This email is already registered for the workshop.",
        });
        return;
      }
      throw error;
    }
  }

  res.status(503).json({ error: "Please try registering again." });
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = RecordCampaignEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid campaign event." });
    return;
  }

  const event = parsed.data;
  await db
    .insert(campaignEventsTable)
    .values({
      eventType: event.eventType,
      visitorId: event.visitorId,
      page: event.page,
      source: normalizeTag(event.source) || "direct",
      medium: normalizeTag(event.medium),
      campaign: normalizeTag(event.campaign),
    })
    .onConflictDoNothing();

  res
    .status(202)
    .json(RecordCampaignEventResponse.parse({ accepted: true }));
});

router.get("/referrals/:code/summary", async (req, res): Promise<void> => {
  const parsed = GetReferralSummaryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(200).json(
      GetReferralSummaryResponse.parse({
        valid: false,
        successfulRegistrations: 0,
        shareUrl: null,
      }),
    );
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();
  const [referrer] = await db
    .select({ id: registrationsTable.id })
    .from(registrationsTable)
    .where(eq(registrationsTable.referralCode, code))
    .limit(1);

  if (!referrer) {
    res.json(
      GetReferralSummaryResponse.parse({
        valid: false,
        successfulRegistrations: 0,
        shareUrl: null,
      }),
    );
    return;
  }

  const [result] = await db
    .select({ successfulRegistrations: count() })
    .from(registrationsTable)
    .where(eq(registrationsTable.referrerRegistrationId, referrer.id));
  res.json(
    GetReferralSummaryResponse.parse({
      valid: true,
      successfulRegistrations: Number(result?.successfulRegistrations ?? 0),
      shareUrl: `/?ref=${encodeURIComponent(code)}`,
    }),
  );
});

adminRouter.use(requireGrowthAdmin);

adminRouter.get("/admin/summary", async (req, res): Promise<void> => {
  const parsed = GetAdminSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid analytics filters." });
    return;
  }
  const filters = parsed.data;
  const where = registrationWhere(filters);
  const trackedWhere = eventWhere(filters);
  const config = await getCampaignConfig();

  const [
    registrationCountResult,
    referralCountResult,
    spendResult,
    dailyRows,
    sourceRows,
    collegeRows,
    yearRows,
    visitorRows,
    formRows,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(registrationsTable)
      .where(where),
    db
      .select({ total: count() })
      .from(registrationsTable)
      .where(
        and(where, isNotNull(registrationsTable.referrerRegistrationId)),
      ),
    db
      .select({ total: sum(campaignSpendTable.amountPaise) })
      .from(campaignSpendTable),
    db
      .select({
        date: sql<string>`to_char(${registrationsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        registrations: count(),
      })
      .from(registrationsTable)
      .where(where)
      .groupBy(
        sql`to_char(${registrationsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      )
      .orderBy(
        asc(
          sql`to_char(${registrationsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        ),
      ),
    db
      .select({ label: registrationsTable.source, registrations: count() })
      .from(registrationsTable)
      .where(where)
      .groupBy(registrationsTable.source)
      .orderBy(desc(count())),
    db
      .select({ label: registrationsTable.college, registrations: count() })
      .from(registrationsTable)
      .where(where)
      .groupBy(registrationsTable.college)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({
        label: sql<string>`${registrationsTable.graduationYear}::text`,
        registrations: count(),
      })
      .from(registrationsTable)
      .where(where)
      .groupBy(registrationsTable.graduationYear)
      .orderBy(asc(registrationsTable.graduationYear)),
    db
      .select({ total: countDistinct(campaignEventsTable.visitorId) })
      .from(campaignEventsTable)
      .where(
        and(
          trackedWhere,
          eq(campaignEventsTable.eventType, "landing_view"),
        ),
      ),
    db
      .select({ total: countDistinct(campaignEventsTable.visitorId) })
      .from(campaignEventsTable)
      .where(
        and(trackedWhere, eq(campaignEventsTable.eventType, "form_start")),
      ),
  ]);

  const registrations = Number(registrationCountResult[0]?.total ?? 0);
  const target = config.target;
  const remaining = Math.max(0, target - registrations);
  const remainingDays = daysRemaining(config.startDate, config.durationDays);
  const visitors = Number(visitorRows[0]?.total ?? 0);
  const formStarts = Number(formRows[0]?.total ?? 0);
  const actualSpendPaise = Number(spendResult[0]?.total ?? 0);
  const response = GetAdminSummaryResponse.parse({
    registrations,
    target,
    targetPercent: target > 0 ? Number(((registrations / target) * 100).toFixed(1)) : 0,
    remaining,
    daysRemaining: remainingDays,
    requiredDailyPace:
      remainingDays && remainingDays > 0
        ? Math.ceil(remaining / remainingDays)
        : null,
    referrals: Number(referralCountResult[0]?.total ?? 0),
    actualSpendPaise,
    budgetPaise: config.budgetPaise,
    costPerRegistrationPaise:
      registrations > 0
        ? Math.round(actualSpendPaise / registrations)
        : null,
    daily: dailyRows.map((row) => ({
      date: new Date(`${row.date}T00:00:00.000Z`),
      registrations: Number(row.registrations),
    })),
    sources: sourceRows.map((row) => ({
      label: row.label,
      registrations: Number(row.registrations),
    })),
    colleges: collegeRows.map((row) => ({
      label: row.label,
      registrations: Number(row.registrations),
    })),
    graduationYears: yearRows.map((row) => ({
      label: row.label,
      registrations: Number(row.registrations),
    })),
    funnel: {
      uniqueVisitors: visitors,
      formStarts,
      registrations,
      conversionRate:
        visitors > 0
          ? Number(((registrations / visitors) * 100).toFixed(1))
          : null,
      trackingComplete: visitors > 0,
    },
    campaign: config,
  });
  res.json(response);
});

adminRouter.get("/admin/registrations", async (req, res): Promise<void> => {
  const parsed = ListAdminRegistrationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration filters." });
    return;
  }
  const { page = 1, pageSize = 25, ...filters } = parsed.data;
  const where = registrationWhere(filters);
  const [records, totalResult] = await Promise.all([
    db
      .select()
      .from(registrationsTable)
      .where(where)
      .orderBy(desc(registrationsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(registrationsTable).where(where),
  ]);
  res.json(
    ListAdminRegistrationsResponse.parse({
      records: records.map((record) => ({
        id: record.id,
        fullName: record.fullName,
        email: record.email,
        college: record.college,
        graduationYear: record.graduationYear,
        branch: record.branch,
        source: record.source,
        medium: record.medium,
        referralCode: record.referralCode,
        createdAt: record.createdAt,
      })),
      page,
      pageSize,
      total: Number(totalResult[0]?.total ?? 0),
    }),
  );
});

adminRouter.get(
  "/admin/registrations/export",
  async (req, res): Promise<void> => {
    const parsed = ExportAdminRegistrationsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid export filters." });
      return;
    }
    const where = registrationWhere(parsed.data);
    const records = await db
      .select({
        college: registrationsTable.college,
        graduationYear: registrationsTable.graduationYear,
        branch: registrationsTable.branch,
        source: registrationsTable.source,
        medium: registrationsTable.medium,
        createdAt: registrationsTable.createdAt,
      })
      .from(registrationsTable)
      .where(where)
      .orderBy(desc(registrationsTable.createdAt))
      .limit(10000);
    const rows = [
      ["College", "Graduation year", "Branch", "Source", "Medium", "Registered at"],
      ...records.map((record) => [
        record.college,
        record.graduationYear,
        record.branch,
        record.source,
        record.medium,
        record.createdAt.toISOString(),
      ]),
    ];
    const csv = rows.map((row) => row.map(cleanCsvCell).join(",")).join("\r\n");
    res
      .status(200)
      .type("text/csv")
      .attachment("ai-launchpad-registrations.csv")
      .send(csv);
  },
);

adminRouter.get("/admin/referrals", async (req, res): Promise<void> => {
  const parsed = GetAdminReferralsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid referral filters." });
    return;
  }
  const filters = parsed.data;
  const where = registrationWhere(filters);
  const referralConditions = [
    where,
    isNotNull(registrationsTable.referrerRegistrationId),
  ];
  if (filters.dateFrom) {
    referralConditions.push(
      gte(
        registrationsTable.createdAt,
        new Date(`${filters.dateFrom}T00:00:00.000Z`),
      ),
    );
  }
  if (filters.dateTo) {
    referralConditions.push(
      lte(
        registrationsTable.createdAt,
        new Date(`${filters.dateTo}T23:59:59.999Z`),
      ),
    );
  }
  const referralWhere = and(...referralConditions);
  const [totalResult, allRegistrationsResult, grouped, dailyRows] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(registrationsTable)
        .where(referralWhere),
      db.select({ total: count() }).from(registrationsTable),
      db
        .select({
          referrerId: registrationsTable.referrerRegistrationId,
          successfulRegistrations: count(),
        })
        .from(registrationsTable)
        .where(referralWhere)
        .groupBy(registrationsTable.referrerRegistrationId)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({
          date: sql<string>`to_char(${registrationsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          registrations: count(),
        })
        .from(registrationsTable)
        .where(referralWhere)
        .groupBy(
          sql`to_char(${registrationsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        )
        .orderBy(
          asc(
            sql`to_char(${registrationsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          ),
        ),
    ]);
  const referrerIds = grouped.flatMap((entry) =>
    entry.referrerId ? [entry.referrerId] : [],
  );
  const referrerRecords = referrerIds.length
    ? await db
        .select({
          id: registrationsTable.id,
          code: registrationsTable.referralCode,
        })
        .from(registrationsTable)
        .where(inArray(registrationsTable.id, referrerIds))
    : [];
  const codesById = new Map(
    referrerRecords.map((record) => [record.id, record.code]),
  );
  const totalReferrals = Number(totalResult[0]?.total ?? 0);
  const allRegistrations = Number(allRegistrationsResult[0]?.total ?? 0);
  res.json(
    GetAdminReferralsResponse.parse({
      totalReferrals,
      shareOfRegistrations:
        allRegistrations > 0
          ? Number(((totalReferrals / allRegistrations) * 100).toFixed(1))
          : 0,
      topCodes: grouped.flatMap((entry) => {
        if (!entry.referrerId) return [];
        return [
          {
            code: codesById.get(entry.referrerId) ?? "",
            successfulRegistrations: Number(entry.successfulRegistrations),
          },
        ];
      }),
      daily: dailyRows.map((row) => ({
        date: new Date(`${row.date}T00:00:00.000Z`),
        registrations: Number(row.registrations),
      })),
    }),
  );
});

adminRouter.get("/admin/spend", async (_req, res): Promise<void> => {
  const records = await db
    .select({
      id: campaignSpendTable.id,
      amountPaise: campaignSpendTable.amountPaise,
      channel: campaignSpendTable.channel,
      note: campaignSpendTable.note,
      spentAt: campaignSpendTable.spentAt,
      createdAt: campaignSpendTable.createdAt,
    })
    .from(campaignSpendTable)
    .orderBy(desc(campaignSpendTable.spentAt), desc(campaignSpendTable.createdAt));
  res.json(ListAdminSpendResponse.parse(records));
});

adminRouter.post("/admin/spend", async (req, res): Promise<void> => {
  const parsed = CreateAdminSpendBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid amount, channel, and date." });
    return;
  }
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  const [record] = await db
    .insert(campaignSpendTable)
    .values({
      ...parsed.data,
      note: parsed.data.note?.trim() ?? "",
      channel: parsed.data.channel.trim(),
      spentAt: calendarDate(parsed.data.spentAt) ?? "",
      createdBy: userId,
    })
    .returning({
      id: campaignSpendTable.id,
      amountPaise: campaignSpendTable.amountPaise,
      channel: campaignSpendTable.channel,
      note: campaignSpendTable.note,
      spentAt: campaignSpendTable.spentAt,
      createdAt: campaignSpendTable.createdAt,
    });
  res.status(201).json(CreateAdminSpendResponse.parse(record));
});

adminRouter.get("/admin/config", async (_req, res): Promise<void> => {
  const config = await getCampaignConfig();
  res.json(GetAdminConfigResponse.parse(config));
});

adminRouter.put("/admin/config", async (req, res): Promise<void> => {
  const parsed = UpdateAdminConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the campaign settings." });
    return;
  }
  const configInput = {
    ...parsed.data,
    startDate: calendarDate(parsed.data.startDate),
  };
  const [config] = await db
    .insert(campaignConfigTable)
    .values({ id: 1, ...configInput, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: campaignConfigTable.id,
      set: { ...configInput, updatedAt: new Date() },
    })
    .returning();
  res.json(
    UpdateAdminConfigResponse.parse({
      campaignName: config.campaignName,
      target: config.target,
      durationDays: config.durationDays,
      budgetPaise: config.budgetPaise,
      startDate: config.startDate,
    }),
  );
});

router.use(adminRouter);

export default router;
