-- ===========================================================================
-- AI LaunchPad: The 500-Student Growth Engine
-- PostgreSQL / Supabase Migration Schema with Row Level Security (RLS)
-- ===========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.growth_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    college VARCHAR(180) NOT NULL,
    graduation_year INTEGER NOT NULL CHECK (graduation_year >= 2024 AND graduation_year <= 2035),
    branch VARCHAR(100) NOT NULL,
    communications_consent BOOLEAN NOT NULL DEFAULT false,
    referral_code VARCHAR(32) NOT NULL,
    referrer_registration_id UUID REFERENCES public.growth_registrations(id) ON DELETE SET NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'direct',
    medium VARCHAR(100) NOT NULL DEFAULT '',
    campaign VARCHAR(100) NOT NULL DEFAULT '',
    visitor_id VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique constraints & indexes
CREATE UNIQUE INDEX IF NOT EXISTS growth_registrations_email_unique ON public.growth_registrations (lower(trim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS growth_registrations_referral_code_unique ON public.growth_registrations (referral_code);
CREATE INDEX IF NOT EXISTS growth_registrations_created_at_idx ON public.growth_registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS growth_registrations_source_idx ON public.growth_registrations (source);
CREATE INDEX IF NOT EXISTS growth_registrations_college_idx ON public.growth_registrations (college);
CREATE INDEX IF NOT EXISTS growth_registrations_referrer_idx ON public.growth_registrations (referrer_registration_id);

-- 3. CAMPAIGN EVENTS TABLE (Funnel measurement & visitor deduplication)
CREATE TABLE IF NOT EXISTS public.growth_campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(32) NOT NULL, -- 'landing_view', 'form_start'
    visitor_id VARCHAR(80) NOT NULL,
    page VARCHAR(200) NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'direct',
    medium VARCHAR(100) NOT NULL DEFAULT '',
    campaign VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_campaign_events_visitor_type_unique ON public.growth_campaign_events (visitor_id, event_type);
CREATE INDEX IF NOT EXISTS growth_campaign_events_type_time_idx ON public.growth_campaign_events (event_type, created_at);

-- 4. CAMPAIGN CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.growth_campaign_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    campaign_name VARCHAR(120) NOT NULL DEFAULT 'Build Your First AI Project in 60 Minutes',
    target INTEGER NOT NULL DEFAULT 500,
    duration_days INTEGER NOT NULL DEFAULT 7,
    budget_paise INTEGER NOT NULL DEFAULT 200000, -- ₹2,000 in paise
    start_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT single_config_row CHECK (id = 1)
);

INSERT INTO public.growth_campaign_config (id, campaign_name, target, duration_days, budget_paise, start_date)
VALUES (1, 'Build Your First AI Project in 60 Minutes', 500, 7, 200000, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- 5. CAMPAIGN SPEND LEDGER
CREATE TABLE IF NOT EXISTS public.growth_campaign_spend (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    channel VARCHAR(100) NOT NULL,
    note VARCHAR(300) NOT NULL DEFAULT '',
    spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by TEXT NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS growth_campaign_spend_date_idx ON public.growth_campaign_spend (spent_at DESC);

-- ===========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Least-privilege access: Anonymous public can register and check referral codes,
-- but CANNOT read, export, or list private student records.
-- ===========================================================================

ALTER TABLE public.growth_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_campaign_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_campaign_spend ENABLE ROW LEVEL SECURITY;

-- Anonymous users may insert valid registration records
CREATE POLICY "Allow public registration insert"
    ON public.growth_registrations
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Anonymous users may insert campaign funnel events
CREATE POLICY "Allow public event insert"
    ON public.growth_campaign_events
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Anonymous users may only query referral summary stats (not student PII)
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_code VARCHAR)
RETURNS TABLE (
    valid BOOLEAN,
    successful_registrations BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM public.growth_registrations WHERE referral_code = p_code) AS valid,
        COUNT(r.id) AS successful_registrations
    FROM public.growth_registrations parent
    LEFT JOIN public.growth_registrations r ON r.referrer_registration_id = parent.id
    WHERE parent.referral_code = p_code
    GROUP BY parent.id;
END;
$$;

-- Authenticated operators / service_role have full administrative access
CREATE POLICY "Allow admin full access to registrations"
    ON public.growth_registrations
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' LIKE '%@nxtwave.tech');

CREATE POLICY "Allow admin full access to spend"
    ON public.growth_campaign_spend
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow admin config update"
    ON public.growth_campaign_config
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

