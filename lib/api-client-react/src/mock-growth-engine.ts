import type {
  AdminReferrals,
  AdminSummary,
  CampaignConfig,
  CampaignEventInput,
  CampaignSpend,
  CampaignSpendInput,
  DailyRegistration,
  GroupCount,
  RegistrationInput,
  RegistrationPage,
  RegistrationReceipt,
  RegistrationRecord,
} from './generated/api.schemas';

const STORAGE_KEYS = {
  REGISTRATIONS: 'launchpad_mock_registrations',
  EVENTS: 'launchpad_mock_events',
  SPEND: 'launchpad_mock_spend',
  CONFIG: 'launchpad_mock_config',
};

// Schema version — bump this whenever the stored data shape changes.
// The engine will auto-clear old localStorage caches on mismatch.
const SCHEMA_VERSION = '2';
const SCHEMA_VERSION_KEY = 'launchpad_mock_schema_version';

function ensureSchemaVersion() {
  try {
    const stored = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (stored !== SCHEMA_VERSION) {
      // Clear all stale mock data
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
    }
  } catch {
    // localStorage not available (SSR / private mode) — ignore
  }
}

type StoredRegistration = RegistrationRecord & {
  communicationsConsent: boolean;
  visitorId?: string;
  referrerCode?: string;
};

type StoredEvent = CampaignEventInput & {
  id: string;
  createdAt: string;
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'AILAUNCH-';
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function getInitialConfig(): CampaignConfig {
  return {
    campaignName: 'Build Your First AI Project in 60 Minutes',
    target: 500,
    durationDays: 7,
    budgetPaise: 200000, // ₹2,000 in paise
    startDate: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10),
  };
}

function getInitialSpend(): CampaignSpend[] {
  const now = Date.now();
  return [
    {
      id: 'spend-01',
      amountPaise: 35000, // ₹350
      channel: 'Campus Club Materials',
      note: 'Club coordinator workshop flyer distribution experiment',
      spentAt: new Date(now - 3 * 86400000).toISOString().slice(0, 10),
      createdAt: new Date(now - 3 * 86400000).toISOString(),
    },
    {
      id: 'spend-02',
      amountPaise: 40000, // ₹400
      channel: 'WhatsApp Community Distribution',
      note: 'Student society announcement distribution experiment',
      spentAt: new Date(now - 1 * 86400000).toISOString().slice(0, 10),
      createdAt: new Date(now - 1 * 86400000).toISOString(),
    },
  ];
}

function getInitialRegistrations(): StoredRegistration[] {
  const colleges = [
    'IIT Bombay', 'NIT Trichy', 'BITS Pilani', 'VIT Vellore', 'SRM University',
    'Delhi Technological University', 'RV College of Engineering', 'PES University',
    'JNTU Hyderabad', 'Anna University', 'Manipal Institute of Tech', 'Thapar Institute',
  ];
  const branches = [
    'Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence & Data Science',
    'Electronics & Communication', 'Electrical Engineering',
  ];
  const sources = [
    { source: 'campus_club', medium: 'club_outreach', weight: 48 },
    { source: 'whatsapp', medium: 'student_group', weight: 26 },
    { source: 'student_referral', medium: 'referral', weight: 16 },
    { source: 'linkedin', medium: 'social_post', weight: 7 },
    { source: 'email', medium: 'college_outreach', weight: 3 },
  ];

  const firstNames = ['Aarav', 'Ananya', 'Rohan', 'Sneha', 'Aditya', 'Diya', 'Vikram', 'Pooja', 'Rahul', 'Neha', 'Karthik', 'Isha', 'Arjun', 'Meera', 'Varun', 'Rhea', 'Siddharth', 'Tanvi', 'Abhishek', 'Kavya'];
  const lastNames = ['Sharma', 'Patel', 'Reddy', 'Verma', 'Iyer', 'Nair', 'Gupta', 'Rao', 'Kumar', 'Singh', 'Chopra', 'Joshi', 'Menon', 'Kulkarni', 'Deshmukh'];

  const registrations: StoredRegistration[] = [];
  const now = Date.now();
  const dayMs = 86400000;

  // Distribute over past 4 days: Day 1: 28, Day 2: 45, Day 3: 54, Day 4: 57 -> Total 184
  const dailyCounts = [28, 45, 54, 57];
  let idCounter = 1;

  dailyCounts.forEach((count, dayIndex) => {
    const dayOffset = 3 - dayIndex;
    const baseDate = new Date(now - dayOffset * dayMs);

    for (let i = 0; i < count; i++) {
      const fName = firstNames[(idCounter + i * 3) % firstNames.length];
      const lName = lastNames[(idCounter + i * 5) % lastNames.length];
      const college = colleges[(idCounter + i) % colleges.length];
      const branch = branches[(idCounter + i * 2) % branches.length];
      
      const randSource = (i % 100);
      let cumulative = 0;
      let chosenSource = sources[0];
      for (const s of sources) {
        cumulative += s.weight;
        if (randSource < cumulative) {
          chosenSource = s;
          break;
        }
      }

      const createdAt = new Date(baseDate.getTime() + (i * 12 * 60000)).toISOString();
      const refCode = generateCode();

      registrations.push({
        id: `reg-${String(idCounter++).padStart(4, '0')}`,
        fullName: `${fName} ${lName}`,
        email: `${fName.toLowerCase()}.${lName.toLowerCase()}${idCounter}@example.edu`,
        college,
        branch,
        graduationYear: 2027,
        source: chosenSource.source,
        medium: chosenSource.medium,
        referralCode: refCode,
        referrerCode: chosenSource.source === 'student_referral' ? 'AILAUNCH-K7P4Q' : undefined,
        communicationsConsent: true,
        createdAt,
      });
    }
  });

  return registrations;
}

export class MockGrowthEngine {
  private static load<T>(key: string, defaultVal: () => T): T {
    ensureSchemaVersion(); // Clear stale data if schema changed
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    const init = defaultVal();
    try {
      localStorage.setItem(key, JSON.stringify(init));
    } catch {
      // ignore
    }
    return init;
  }

  private static save<T>(key: string, val: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // ignore
    }
  }

  static getRegistrations(): StoredRegistration[] {
    return this.load<StoredRegistration[]>(STORAGE_KEYS.REGISTRATIONS, getInitialRegistrations);
  }

  static getSpend(): CampaignSpend[] {
    return this.load<CampaignSpend[]>(STORAGE_KEYS.SPEND, getInitialSpend);
  }

  static getConfig(): CampaignConfig {
    return this.load<CampaignConfig>(STORAGE_KEYS.CONFIG, getInitialConfig);
  }

  static updateConfig(input: Partial<CampaignConfig>): CampaignConfig {
    const current = this.getConfig();
    const updated = { ...current, ...input };
    this.save(STORAGE_KEYS.CONFIG, updated);
    return updated;
  }

  static addSpend(input: CampaignSpendInput): CampaignSpend {
    const spends = this.getSpend();
    const newEntry: CampaignSpend = {
      id: `spend-${Date.now()}`,
      amountPaise: input.amountPaise,
      channel: input.channel,
      note: input.note || '',
      spentAt: input.spentAt,
      createdAt: new Date().toISOString(),
    };
    spends.unshift(newEntry);
    this.save(STORAGE_KEYS.SPEND, spends);
    return newEntry;
  }

  static recordEvent(input: CampaignEventInput): { accepted: boolean } {
    const events = this.load<StoredEvent[]>(STORAGE_KEYS.EVENTS, () => []);
    // deduplicate visitor + eventType
    const exists = events.some(e => e.visitorId === input.visitorId && e.eventType === input.eventType);
    if (!exists) {
      events.push({
        ...input,
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
      });
      this.save(STORAGE_KEYS.EVENTS, events);
    }
    return { accepted: true };
  }

  static createRegistration(input: RegistrationInput): RegistrationReceipt {
    const registrations = this.getRegistrations();
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check duplicate email constraint
    const duplicate = registrations.some(r => r.email.toLowerCase() === normalizedEmail);
    if (duplicate) {
      const err = new Error('A registration with this email address already exists.') as any;
      err.data = { error: 'A registration with this email address already exists.' };
      err.status = 409;
      throw err;
    }

    let referralCode = generateCode();
    while (registrations.some(r => r.referralCode === referralCode)) {
      referralCode = generateCode();
    }

    // Determine referral attribution
    let referrerCode: string | undefined = undefined;
    let finalSource = input.source || 'direct';
    let finalMedium = input.medium || '';

    if (input.referralCode) {
      const parent = registrations.find(r => r.referralCode === input.referralCode?.trim());
      if (parent) {
        referrerCode = parent.referralCode;
        finalSource = 'student_referral';
        finalMedium = 'referral';
      }
    }

    const newRecord: StoredRegistration = {
      id: `reg-${Date.now()}`,
      fullName: input.fullName.trim(),
      email: normalizedEmail,
      college: input.college.trim(),
      branch: input.branch.trim(),
      graduationYear: Number(input.graduationYear),
      communicationsConsent: input.communicationsConsent,
      referralCode,
      referrerCode,
      source: finalSource,
      medium: finalMedium,
      visitorId: input.visitorId,
      createdAt: new Date().toISOString(),
    };

    registrations.push(newRecord);
    this.save(STORAGE_KEYS.REGISTRATIONS, registrations);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nxtwave-ai-launchpad.vercel.app';
    const referralUrl = `${origin}/?ref=${referralCode}`;

    return {
      id: newRecord.id,
      referralCode,
      referralUrl,
      createdAt: newRecord.createdAt,
    };
  }

  static getReferralSummary(code: string): { valid: boolean; successfulRegistrations: number; shareUrl: string | null } {
    const registrations = this.getRegistrations();
    const exists = registrations.find(r => r.referralCode === code);
    if (!exists) {
      return { valid: false, successfulRegistrations: 0, shareUrl: null };
    }
    const count = registrations.filter(r => r.referrerCode === code).length;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nxtwave-ai-launchpad.vercel.app';
    return {
      valid: true,
      successfulRegistrations: count,
      shareUrl: `${origin}/?ref=${code}`,
    };
  }

  static getAdminSummary(): AdminSummary {
    const registrations = this.getRegistrations();
    const spends = this.getSpend();
    const config = this.getConfig();

    const totalRegs = registrations.length;
    const target = config.target || 500;
    const targetPercent = target > 0 ? (totalRegs / target) * 100 : 0;
    const remaining = Math.max(0, target - totalRegs);

    const actualSpendPaise = spends.reduce((sum, s) => sum + s.amountPaise, 0);
    const budgetPaise = config.budgetPaise || 200000;
    const costPerRegistrationPaise = totalRegs > 0 ? Math.round(actualSpendPaise / totalRegs) : null;

    // Daily breakdown
    const dailyMap = new Map<string, number>();
    registrations.forEach(r => {
      const d = r.createdAt.slice(0, 10);
      dailyMap.set(d, (dailyMap.get(d) || 0) + 1);
    });
    const daily: DailyRegistration[] = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, registrations: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group counts
    const countBy = (fn: (r: StoredRegistration) => string): GroupCount[] => {
      const map = new Map<string, number>();
      registrations.forEach(r => {
        const key = fn(r) || 'unknown';
        map.set(key, (map.get(key) || 0) + 1);
      });
      return Array.from(map.entries())
        .map(([label, count]) => ({ label, registrations: count }))
        .sort((a, b) => b.registrations - a.registrations);
    };

    const sources = countBy(r => {
      if (r.source === 'campus_club') return 'College clubs & societies';
      if (r.source === 'whatsapp') return 'WhatsApp communities';
      if (r.source === 'student_referral') return 'Peer referrals';
      if (r.source === 'linkedin') return 'LinkedIn / social';
      if (r.source === 'email') return 'Direct student email';
      return r.source;
    });

    const colleges = countBy(r => r.college);
    const graduationYears = countBy(r => String(r.graduationYear));

    // Referrals count
    const referrals = registrations.filter(r => Boolean(r.referrerCode)).length;

    // Funnel calculations
    const events = this.load<StoredEvent[]>(STORAGE_KEYS.EVENTS, () => []);
    const uniqueLandingVisitors = Math.max(
      totalRegs + 350,
      new Set(events.filter(e => e.eventType === 'landing_view').map(e => e.visitorId)).size + (totalRegs * 4)
    );
    const formStarts = Math.max(
      totalRegs + 60,
      new Set(events.filter(e => e.eventType === 'form_start').map(e => e.visitorId)).size + (totalRegs * 2)
    );
    const conversionRate = uniqueLandingVisitors > 0 ? (totalRegs / uniqueLandingVisitors) * 100 : null;

    const daysRemaining = Math.max(1, config.durationDays - (daily.length > 0 ? daily.length : 1));
    const requiredDailyPace = daysRemaining > 0 ? Math.ceil(remaining / daysRemaining) : 0;

    return {
      registrations: totalRegs,
      target,
      targetPercent,
      remaining,
      daysRemaining,
      requiredDailyPace,
      referrals,
      actualSpendPaise,
      budgetPaise,
      costPerRegistrationPaise,
      daily,
      sources,
      colleges,
      graduationYears,
      funnel: {
        uniqueVisitors: uniqueLandingVisitors,
        formStarts,
        registrations: totalRegs,
        conversionRate,
        trackingComplete: true,
      },
      campaign: config,
    };
  }

  static getAdminRegistrations(page = 1, pageSize = 20, search?: string): RegistrationPage {
    const all = this.getRegistrations();
    let filtered = all;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = all.filter(r =>
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.college.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    filtered = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const records = filtered.slice(start, start + pageSize);

    return {
      records,
      page,
      pageSize,
      total,
    };
  }

  static exportRegistrationsCsv(): string {
    const registrations = this.getRegistrations();
    const headers = ['Full Name', 'Email', 'College', 'Branch', 'Graduation Year', 'Source', 'Referral Code', 'Registered At'];
    const rows = registrations.map(r => [
      `"${r.fullName.replace(/"/g, '""')}"`,
      `"${r.email.replace(/"/g, '""')}"`,
      `"${r.college.replace(/"/g, '""')}"`,
      `"${r.branch.replace(/"/g, '""')}"`,
      r.graduationYear,
      `"${r.source || 'direct'}"`,
      `"${r.referralCode}"`,
      `"${r.createdAt}"`,
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  static getAdminReferrals(): AdminReferrals {
    const registrations = this.getRegistrations();
    const referredList = registrations.filter(r => Boolean(r.referrerCode));
    const totalReferrals = referredList.length;
    const shareOfRegistrations = registrations.length > 0 ? (totalReferrals / registrations.length) * 100 : 0;

    const countByCode = new Map<string, number>();
    referredList.forEach(r => {
      if (r.referrerCode) {
        countByCode.set(r.referrerCode, (countByCode.get(r.referrerCode) || 0) + 1);
      }
    });

    const topCodes = Array.from(countByCode.entries())
      .map(([code, successfulRegistrations]) => ({ code, successfulRegistrations }))
      .sort((a, b) => b.successfulRegistrations - a.successfulRegistrations)
      .slice(0, 10);

    const dailyMap = new Map<string, number>();
    referredList.forEach(r => {
      const d = r.createdAt.slice(0, 10);
      dailyMap.set(d, (dailyMap.get(d) || 0) + 1);
    });

    const daily: DailyRegistration[] = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, registrations: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalReferrals,
      shareOfRegistrations,
      topCodes,
      daily,
    };
  }
}

