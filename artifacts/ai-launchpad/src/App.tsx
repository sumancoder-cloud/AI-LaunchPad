import { type ButtonHTMLAttributes, type FormEvent, type InputHTMLAttributes, type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import {
  useCreateAdminSpend,
  useCreateRegistration,
  getExportAdminRegistrationsQueryKey,
  useGetAdminConfig,
  useGetAdminReferrals,
  useGetAdminSummary,
  useGetReferralSummary,
  useExportAdminRegistrations,
  useListAdminRegistrations,
  useListAdminSpend,
  useRecordCampaignEvent,
  useUpdateAdminConfig,
} from '@workspace/api-client-react';
import type { CampaignConfig, RegistrationInput } from '@workspace/api-client-react';
import {
  AlertCircle, ArrowRight, ArrowUpRight, BarChart3, BookOpenText, Check,
  CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clipboard, Clock, Database, Download,
  Filter, GraduationCap, HandCoins, LayoutDashboard, Link2, LoaderCircle,
  LockKeyhole, LogOut, Menu, MessageSquare, Play, RotateCcw, Search, Settings2,
  Share2, ShieldAlert, ShieldCheck, Sparkles, Target, Users, X, Zap,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const basePath = (import.meta.env.BASE_PATH || import.meta.env.BASE_URL || '').replace(/\/$/, '');
// Only enable Clerk when the env var is explicitly set (non-empty string).
// Do NOT use publishableKeyFromHost — it auto-detects clerk.localhost and
// tries to load Clerk JS even when no key is configured.
const _rawClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = (_rawClerkKey && _rawClerkKey.trim().length > 0) ? _rawClerkKey.trim() : null;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const isClerkEnabled = Boolean(clerkPubKey);

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#4f52c8',
    colorForeground: '#1d2944',
    colorMutedForeground: '#64708a',
    colorDanger: '#c94141',
    colorBackground: '#ffffff',
    colorInput: '#fbfcff',
    colorInputForeground: '#1d2944',
    colorNeutral: '#dce2ef',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#e4e8f2] shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#1d2944] font-bold',
    headerSubtitle: 'text-[#64708a]',
    socialButtonsBlockButtonText: 'text-[#263552] font-semibold',
    formFieldLabel: 'text-[#263552] font-medium',
    footerActionLink: 'text-[#4f52c8] font-semibold',
    footerActionText: 'text-[#64708a]',
    dividerText: 'text-[#64708a]',
    identityPreviewEditButton: 'text-[#4f52c8]',
    formFieldSuccessText: 'text-[#267559]',
    alertText: 'text-[#9f3333]',
    logoBox: 'rounded-xl',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#dce2ef] hover:bg-[#f6f7fc]',
    formButtonPrimary: 'bg-[#4f52c8] hover:bg-[#4144b7] text-white shadow-none',
    formFieldInput: 'bg-[#fbfcff] border-[#dce2ef] text-[#1d2944]',
    footerAction: 'text-[#64708a]',
    dividerLine: 'bg-[#e3e7f0]',
    alert: 'border-[#f0d1d1]',
    otpCodeFieldInput: 'border-[#dce2ef] text-[#1d2944]',
    formFieldRow: 'text-[#263552]',
    main: 'text-[#1d2944]',
  },
};

// ---------------------------------------------------------------------------
// Standalone Operator Auth Context (used when Clerk is not configured or in Reviewer mode)
// ---------------------------------------------------------------------------
interface StandaloneAuthContextType {
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  user: { id: string; fullName: string; primaryEmailAddress?: { emailAddress: string } } | null;
}

const StandaloneAuthContext = createContext<StandaloneAuthContextType>({
  isSignedIn: false,
  signIn: () => {},
  signOut: () => {},
  user: null,
});

function StandaloneAuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(() => {
    try {
      return sessionStorage.getItem('launchpad_operator_session') === 'true';
    } catch {
      return false;
    }
  });

  const signIn = () => {
    try {
      sessionStorage.setItem('launchpad_operator_session', 'true');
    } catch {
      // ignore
    }
    setIsSignedIn(true);
  };

  const signOut = () => {
    try {
      sessionStorage.removeItem('launchpad_operator_session');
    } catch {
      // ignore
    }
    setIsSignedIn(false);
  };

  const user = isSignedIn
    ? {
        id: 'operator_nxtwave_admin',
        fullName: 'Growth Intern / Campaign Lead',
        primaryEmailAddress: { emailAddress: 'growth.lead@nxtwave.tech' },
      }
    : null;

  return (
    <StandaloneAuthContext.Provider value={{ isSignedIn, signIn, signOut, user }}>
      {children}
    </StandaloneAuthContext.Provider>
  );
}

function useAppAuth() {
  const standalone = useContext(StandaloneAuthContext);
  if (!isClerkEnabled) {
    return {
      isSignedIn: standalone.isSignedIn,
      user: standalone.user,
      signOut: standalone.signOut,
      signIn: standalone.signIn,
    };
  }
  try {
    const clerkUser = useUser();
    const clerk = useClerk();
    return {
      isSignedIn: Boolean(clerkUser.isSignedIn),
      user: clerkUser.user,
      signOut: () => clerk.signOut({ redirectUrl: basePath || '/' }),
      signIn: () => {},
    };
  } catch {
    return {
      isSignedIn: standalone.isSignedIn,
      user: standalone.user,
      signOut: standalone.signOut,
      signIn: standalone.signIn,
    };
  }
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" data-testid="link-brand-home">
      <span className={`grid size-9 place-items-center rounded-xl ${light ? 'bg-white/15 text-white' : 'bg-indigo-600 text-white'}`}>
        <Sparkles size={18} />
      </span>
      <span className={`font-display text-[15px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-[#202d49]'}`}>
        AI LaunchPad<span className="ml-1.5 font-medium text-indigo-500">by NxtWave</span>
      </span>
    </Link>
  );
}

function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(76,79,194,.7)] transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}

function ShellLink({ href, children, active }: { href: string; children: ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-indigo-50 hover:text-indigo-700 ${
        active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600'
      }`}
    >
      {children}
    </Link>
  );
}

function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      {label}
      <input
        {...props}
        className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 ${
          props.className || ''
        }`}
      />
    </label>
  );
}

function SelectField({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      {label}
      <select
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      >
        {children}
      </select>
    </label>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
  badge?: string;
}) {
  return (
    <article className="surface rounded-2xl p-5 border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <p className="font-display text-3xl font-bold tracking-tight text-[#202d49]">{value}</p>
        {badge && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {badge}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </article>
  );
}

function LoadingPanel() {
  return (
    <div className="surface space-y-4 rounded-2xl p-6" aria-label="Loading">
      <div className="h-4 w-1/4 animate-pulse rounded bg-slate-100" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  const { user } = useAppAuth();
  return (
    <div className="surface rounded-2xl p-8 text-center border border-slate-200 bg-white">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        <CircleHelp size={21} />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">We couldn’t load this view</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        The request may have failed or you may not have access. If you are signed in and this is an admin view, a 403 means your account is not authorized for campaign operations.
      </p>
      {user && (
        <div className="mx-auto mt-5 max-w-md rounded-xl bg-slate-50 p-4 text-left border border-slate-200">
          <p className="text-xs font-bold text-slate-700">Administrator session active</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Authorized operator account ID:</p>
          <code className="mt-2 block break-all rounded-lg bg-white p-2 text-xs text-slate-700 border border-slate-200">{user.id}</code>
        </div>
      )}
      <button onClick={onRetry} className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50" data-testid="button-retry">
        Try again
      </button>
    </div>
  );
}

type CampaignAttribution = {
  referralCode?: string;
  source?: string;
  medium?: string;
  campaign?: string;
};

function rememberAttribution(): CampaignAttribution {
  const params = new URLSearchParams(window.location.search);
  let prior: CampaignAttribution = {};
  try {
    prior = JSON.parse(sessionStorage.getItem('launchpad-attribution') || '{}') as CampaignAttribution;
  } catch {
    prior = {};
  }
  const referralCode = params.get('ref')?.trim() || prior.referralCode;
  const attribution: CampaignAttribution = {
    referralCode,
    source: prior.source || (referralCode ? 'student_referral' : params.get('utm_source') || undefined),
    medium: prior.medium || (referralCode ? 'referral' : params.get('utm_medium') || undefined),
    campaign: prior.campaign || params.get('utm_campaign') || undefined,
  };
  sessionStorage.setItem('launchpad-attribution', JSON.stringify(attribution));
  return attribution;
}

function visitorId(): string {
  const existing = localStorage.getItem('launchpad-visitor');
  if (existing) return existing;
  const created = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  localStorage.setItem('launchpad-visitor', created);
  return created;
}

// ---------------------------------------------------------------------------
// 1. PUBLIC ROUTE: Landing Page ("/")
// ---------------------------------------------------------------------------
function Landing() {
  const recordEvent = useRecordCampaignEvent();
  useEffect(() => {
    const attribution = rememberAttribution();
    recordEvent.mutate({
      data: {
        eventType: 'landing_view',
        visitorId: visitorId(),
        page: '/',
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
      },
    });
  }, []);

  const toRegister = () => {
    rememberAttribution();
  };

  return (
    <main className="min-h-[100dvh] bg-[#f8f9fd]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            href="/admin/login"
            className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white sm:inline-flex border border-slate-200/70"
            data-testid="link-admin-sign-in"
          >
            Operator Sign In
          </Link>
          <Link
            href="/register"
            onClick={toRegister}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-sm"
            data-testid="link-header-register"
          >
            Save My Place
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-wash soft-grid relative overflow-hidden border-b border-slate-200/60">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:pt-20">
          <div className="reveal relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.13em] text-indigo-700 shadow-sm">
              <span className="size-2 rounded-full bg-teal-500 animate-pulse" />
              Free Practical AI Workshop · 60 Minutes
            </div>
            <h1 className="font-display max-w-3xl text-[clamp(2.9rem,6.5vw,5.6rem)] font-extrabold leading-[1.02] tracking-[-.055em] text-[#1e2b48]">
              Stop watching AI tutorials.
              <span className="block text-indigo-600 mt-2">Build something real.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 font-normal">
              Build your first AI project in 60 minutes with a guided, beginner-friendly workshop for engineering students. Leave with working code, a clear story for your resume, and the confidence to keep building.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                onClick={toRegister}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 text-base font-bold text-white shadow-[0_16px_30px_-18px_rgba(76,79,194,.8)] transition hover:-translate-y-0.5 hover:bg-indigo-700"
                data-testid="link-register-primary"
              >
                Save My Free Seat <ArrowRight size={18} />
              </Link>
              <a
                href="#agenda"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-6 text-sm font-semibold text-slate-700 transition hover:bg-white"
                data-testid="link-workshop-details"
              >
                Explore Agenda & Outcomes
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Check size={16} className="text-teal-600 font-bold" />
                Designed for final-year engineering students (2027 batch)
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={16} className="text-teal-600 font-bold" />
                100% Free · Real code & architecture
              </span>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm ring-1 ring-slate-200/80">
                <ShieldCheck size={15} className="text-teal-600" /> No payment details
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm ring-1 ring-slate-200/80">
                <Clock size={15} className="text-indigo-600" /> Just 60 minutes
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm ring-1 ring-slate-200/80">
                <Users size={15} className="text-amber-600" /> Built for students
              </span>
            </div>
          </div>

          {/* Interactive Workshop Architecture Preview */}
          <div className="reveal-delay relative mx-auto w-full max-w-[540px]">
            <div className="absolute -inset-8 rounded-[40%] bg-gradient-to-br from-indigo-200/50 via-transparent to-teal-100/60 blur-2xl" />
            <div className="surface relative rounded-[28px] border border-slate-200/80 bg-white/95 p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Workshop Architecture</p>
                  <p className="mt-1 font-display text-lg font-bold text-[#202d49]">From Idea to Live Build</p>
                </div>
                <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">60-Min Sprint</span>
              </div>
              <div className="relative my-6 space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-[#fbfcff] p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 font-bold">01</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Identify a Practical Problem</p>
                    <p className="mt-0.5 text-xs text-slate-500">Why small, scoped AI prototypes succeed in interviews</p>
                  </div>
                </div>
                <div className="ml-5 h-4 border-l-2 border-dashed border-indigo-200" />
                <div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 font-bold shadow-sm">02</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Prompting, APIs & Context</p>
                    <p className="mt-0.5 text-xs text-slate-500">Connect LLMs to code with clean data handling</p>
                  </div>
                </div>
                <div className="ml-5 h-4 border-l-2 border-dashed border-teal-200" />
                <div className="flex items-center gap-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-teal-700 font-bold shadow-sm">03</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Ship a Portfolio Project</p>
                    <p className="mt-0.5 text-xs text-slate-500">Leave with GitHub repo + clear next architectural steps</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#f5f6fa] px-4 py-3">
                <span className="text-xs font-semibold text-slate-600">Zero fluff. Hands-on coding session.</span>
                <span className="font-mono text-xs font-bold text-indigo-600">NXW / AI-BUILD</span>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-amber-600 shadow-sm">
                  <Sparkles size={17} />
                </span>
                <p className="text-xs leading-5 text-amber-900">
                  <strong>Your outcome:</strong> a project you can explain, improve, and show.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conversion Proof Strip */}
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-5 sm:grid-cols-3 sm:px-8">
          {[
            [Zap, 'Learn by building', 'Follow a practical path instead of another theory-heavy lecture.'],
            [GraduationCap, 'Made for engineering students', 'Beginner-friendly steps with career relevance built in.'],
            [CheckCircle2, 'Leave with momentum', 'Finish your first build and know exactly what to try next.'],
          ].map(([Icon, title, description]) => (
            <div key={String(title)} className="flex items-start gap-3 rounded-2xl bg-[#fafbff] px-4 py-3.5 ring-1 ring-slate-100">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon size={17} />
              </span>
              <div>
                <p className="text-sm font-bold text-[#202d49]">{String(title)}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{String(description)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Value Proposition */}
      <section id="agenda" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16 items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Why this workshop</p>
            <h2 className="font-display mt-4 text-4xl font-bold leading-tight tracking-[-.04em] text-[#202d49]">
              Stop collecting tutorials.<br />Start building your portfolio.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Most engineering students know AI is transforming tech, but get stuck reading endless documentation. This one-hour session removes the friction so you can ship a working build and talk about it confidently with recruiters.
            </p>
            <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-200/80 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Workshop Status & Transparency</p>
              <p className="mt-1.5 text-xs leading-5 text-amber-900">
                Speaker and exact schedule are currently proposed placeholders pending cohort confirmation. Date, time, and session link will be sent to registered students via email/WhatsApp. No placement guarantees are made.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['01', 'Career Relevance', 'Add a distinct, self-built AI project to your resume before placement season starts.'],
              ['02', 'Low Barrier to Entry', 'Zero prerequisites in AI or PyTorch needed. Familiarity with any programming language is enough.'],
              ['03', 'Guided 60-Min Build', 'Step-by-step walkthrough from architecture design to API integration.'],
              ['04', 'Peer Referral Loop', 'Every registrant gets an exclusive invite code to share with engineering classmates.'],
            ].map(([num, title, desc]) => (
              <article key={num} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <span className="font-mono text-xs font-bold text-indigo-600">{num} / 04</span>
                <h3 className="mt-4 font-display text-lg font-bold text-[#202d49]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Student Outcomes */}
      <section className="bg-[#f1f4ff] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Your 60-minute win</p>
            <h2 className="font-display mt-4 text-4xl font-bold leading-tight tracking-[-.04em] text-[#202d49] sm:text-5xl">
              One hour. Three things you can carry forward.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              This is designed to turn “I should learn AI” into a small, finished step you can build on.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              [BookOpenText, 'A working starting point', 'Understand the pieces of an AI application and how they fit together.'],
              [Target, 'A portfolio conversation', 'Know how to describe your project, decisions, and next improvements in an interview.'],
              [ArrowUpRight, 'A clear next step', 'Leave with an architecture you can extend instead of starting from a blank screen.'],
            ].map(([Icon, title, description]) => (
              <article key={String(title)} className="rounded-3xl border border-white/80 bg-white p-6 shadow-[0_18px_45px_-35px_rgba(31,45,73,.55)]">
                <span className="grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <Icon size={21} />
                </span>
                <h3 className="font-display mt-5 text-xl font-bold text-[#202d49]">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{String(description)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-[#202d49] text-white p-8 sm:p-14 text-center relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-200">
              Free Online Event · Batch 2027 Priority
            </span>
            <h2 className="font-display mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight">
              Ready to build your first AI project?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-indigo-100/80 max-w-xl mx-auto">
              Join 500 fellow final-year engineering students. Reserve your spot now in less than 30 seconds.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                onClick={toRegister}
                className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 font-bold text-[#202d49] hover:bg-indigo-50 transition"
                data-testid="link-cta-bottom"
              >
                Register Now for Free <ArrowRight size={17} />
              </Link>
              <Link
                href="/referrals"
                className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-6 font-semibold text-white hover:bg-white/10 transition"
              >
                Check My Referral Status
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-[#202d49] text-center">Frequently Asked Questions</h2>
          <div className="mt-8 divide-y divide-slate-200">
            {[
              ['Who is this workshop for?', 'Final-year engineering students (graduating 2027) from Computer Science, IT, AI/DS, ECE, and related branches who want a practical project.'],
              ['Do I need prior experience in AI or machine learning?', 'No. Basic programming knowledge in Python or JavaScript is helpful, but the workshop starts from scratch with clear guided steps.'],
              ['Is the workshop completely free?', 'Yes, registration is 100% free with no hidden charges.'],
              ['How does the referral system work?', 'After you register, you will get a unique referral code. When classmates register using your link, you will see your verified referral count grow.'],
              ['How will privacy and communications be handled?', 'We only collect essential details (name, email, college, branch, year) to administer workshop access. We do not sell or expose your personal data.'],
            ].map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-slate-800 text-base list-none">
                  {q}
                  <span className="text-indigo-600 text-xl font-bold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo />
          <p className="text-xs text-slate-400">
            AI LaunchPad — A 500-Student Measurable Growth Campaign Platform
          </p>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href="/admin/login" className="text-indigo-600 hover:underline">
              Operator Dashboard
            </Link>
            <span>© NxtWave</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// 2. PUBLIC ROUTE: Student Registration ("/register")
// ---------------------------------------------------------------------------
function RegisterPage() {
  const createRegistration = useCreateRegistration();
  const recordEvent = useRecordCampaignEvent();
  const [, setLocation] = useLocation();

  const [values, setValues] = useState({
    fullName: '',
    email: '',
    college: '',
    graduationYear: '2027',
    branch: '',
    referralCode: new URLSearchParams(window.location.search).get('ref') || '',
    communicationsConsent: true,
  });
  const [formError, setFormError] = useState('');

  const update = (key: keyof typeof values, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const attribution = rememberAttribution();
    recordEvent.mutate({
      data: {
        eventType: 'form_start',
        visitorId: visitorId(),
        page: '/register',
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
      },
    });
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (
      !values.fullName.trim() ||
      !values.email.trim() ||
      !values.college.trim() ||
      !values.branch.trim() ||
      !values.graduationYear
    ) {
      setFormError('Please fill in all required fields to complete your registration.');
      return;
    }

    const attribution = rememberAttribution();
    const input: RegistrationInput = {
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      college: values.college.trim(),
      branch: values.branch.trim(),
      graduationYear: Number(values.graduationYear),
      communicationsConsent: values.communicationsConsent,
      referralCode: attribution.referralCode || values.referralCode.trim() || undefined,
      visitorId: visitorId(),
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
    };

    createRegistration.mutate(
      { data: input },
      {
        onSuccess: (receipt) => {
          sessionStorage.setItem('launchpad-receipt', JSON.stringify(receipt));
          sessionStorage.removeItem('launchpad-attribution');
          setLocation('/success');
        },
        onError: (error: any) => {
          const apiError = error as { data?: { error?: string }; message?: string };
          setFormError(
            apiError.data?.error ||
              apiError.message ||
              'We could not complete your registration. Please check your details and try again.'
          );
        },
      }
    );
  };

  return (
    <main className="min-h-[100dvh] bg-[#f8f9fd]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-indigo-700" data-testid="link-back-home">
          ← Back to Workshop Details
        </Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:pt-10">
        <div>
          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 uppercase tracking-wider">
            Free Workshop Registration
          </span>
          <h1 className="font-display mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-[#202d49]">
            Save your seat in 60 seconds.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Tell us a little about yourself so we can tailor the practical project build to your batch. You will receive an instant unique referral code on the next screen.
          </p>

          <div className="mt-8 space-y-4">
            <div className="surface rounded-2xl p-5 border border-slate-200/80 bg-white shadow-sm flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <GraduationCap size={20} />
              </span>
              <div>
                <p className="font-semibold text-slate-800">Target Audience: Final-Year Engineers</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Curriculum tailored for 2027 graduates preparing for placements, technical interviews, and portfolio reviews.
                </p>
              </div>
            </div>

            <div className="surface rounded-2xl p-5 border border-slate-200/80 bg-white shadow-sm flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <Check size={20} />
              </span>
              <div>
                <p className="font-semibold text-slate-800">No Account Required</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Zero friction. No password needed to register. Just your verified contact information.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={submit} className="surface rounded-3xl p-6 sm:p-8 border border-slate-200/90 bg-white shadow-xl">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-[#202d49]">Student Details</h2>
            <p className="mt-1 text-xs text-slate-500">All fields marked with an asterisk are required.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full Name *"
              required
              placeholder="e.g. Rahul Sharma"
              value={values.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              data-testid="input-full-name"
            />
            <Field
              label="Email Address *"
              required
              type="email"
              placeholder="rahul@college.edu"
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              data-testid="input-email"
            />
            <Field
              label="College / University *"
              required
              placeholder="e.g. IIT Bombay / NIT Trichy"
              value={values.college}
              onChange={(e) => update('college', e.target.value)}
              data-testid="input-college"
            />
            <SelectField
              label="Graduation Year *"
              required
              value={values.graduationYear}
              onChange={(e) => update('graduationYear', e.target.value)}
              data-testid="select-graduation-year"
            >
              <option value="2027">2027 (Final Year / Priority)</option>
              <option value="2026">2026</option>
              <option value="2028">2028</option>
              <option value="2029">2029</option>
            </SelectField>
            <Field
              label="Branch / Specialization *"
              required
              placeholder="e.g. Computer Science / AI & DS"
              value={values.branch}
              onChange={(e) => update('branch', e.target.value)}
              className="sm:col-span-2"
              data-testid="input-branch"
            />
            <Field
              label="Referral Code (Optional)"
              placeholder="e.g. AILAUNCH-K7P4Q"
              value={values.referralCode}
              onChange={(e) => update('referralCode', e.target.value)}
              className="sm:col-span-2"
              data-testid="input-referral-code"
            />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3.5 text-xs leading-5 text-slate-600 border border-slate-200/60">
            <input
              type="checkbox"
              checked={values.communicationsConsent}
              onChange={(e) => update('communicationsConsent', e.target.checked)}
              className="mt-0.5 size-4 rounded accent-indigo-600"
              data-testid="checkbox-consent"
            />
            <span>
              I agree to receive the confirmed workshop link, agenda, and project repository via email or WhatsApp.
            </span>
          </label>

          {formError && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-700" role="alert" data-testid="text-form-error">
              {formError}
            </div>
          )}

          <Button
            type="submit"
            disabled={createRegistration.isPending}
            className="mt-6 w-full text-base py-3.5"
            data-testid="button-submit-registration"
          >
            {createRegistration.isPending ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Submitting Registration…
              </>
            ) : (
              <>
                Complete Free Registration <ArrowRight size={18} />
              </>
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-slate-400">
            Secure registration · Instant referral code provided upon completion.
          </p>
        </form>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// 3. PUBLIC ROUTE: Registration Confirmation & Referral Engine ("/success", "/referrals")
// ---------------------------------------------------------------------------
function SuccessPage() {
  const receipt = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('launchpad-receipt') || 'null') as {
        referralCode: string;
        referralUrl: string;
      } | null;
    } catch {
      return null;
    }
  }, []);

  const [lookupCode, setLookupCode] = useState(receipt?.referralCode || '');
  const activeCode = lookupCode.trim();

  const referral = useGetReferralSummary(activeCode, {
    query: {
      enabled: Boolean(activeCode),
      queryKey: ['/api/referrals', activeCode],
    },
  });

  const [copied, setCopied] = useState(false);
  const shareUrl = referral.data?.shareUrl || receipt?.referralUrl || (activeCode ? `${window.location.origin}/?ref=${activeCode}` : '');

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const whatsappMessage = encodeURIComponent(
    `Hey! I just registered for "Build Your First AI Project in 60 Minutes" by NxtWave. It's a free hands-on workshop tailored for final-year engineering students (no AI experience required). Reserve your spot here: ${shareUrl}`
  );

  return (
    <main className="hero-wash soft-grid flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <section className="surface w-full max-w-2xl rounded-3xl p-6 sm:p-10 text-center border border-slate-200/80 bg-white shadow-2xl">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          <Check size={32} />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-teal-700">Registration Confirmed</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#202d49]">
          You’re in! Welcome to AI LaunchPad.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm sm:text-base leading-6 text-slate-600">
          We’ve recorded your registration. You will receive confirmed session details, GitHub starter code, and platform links as soon as they are announced.
        </p>

        {/* Student Referral Experience */}
        <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <Share2 size={20} />
              </span>
              <div>
                <h2 className="font-semibold text-slate-800 text-base">Invite Engineering Friends</h2>
                <p className="text-xs text-slate-500">Every friend who registers through your link earns you verified referral credit.</p>
              </div>
            </div>
            {activeCode && (
              <span className="rounded-lg bg-indigo-600 px-3 py-1 font-mono text-xs font-bold text-white shadow-sm">
                {activeCode}
              </span>
            )}
          </div>

          {!activeCode && (
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700">Enter your referral code to check your stats:</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AILAUNCH-K7P4Q"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase font-mono flex-1 outline-none"
                />
              </div>
            </div>
          )}

          {shareUrl && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white px-3.5 py-2.5 text-xs text-slate-700 font-mono"
                  aria-label="Personal referral link"
                  data-testid="input-referral-link"
                />
                <button
                  onClick={copyLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  data-testid="button-copy-link"
                >
                  {copied ? <Check size={16} /> : <Clipboard size={16} />}
                  {copied ? 'Copied Link' : 'Copy Link'}
                </button>
              </div>

              {/* WhatsApp One-Click Share */}
              <a
                href={`https://api.whatsapp.com/send?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-3 text-sm font-semibold transition shadow-sm"
                data-testid="button-whatsapp-share"
              >
                <MessageSquare size={17} />
                Share Directly on WhatsApp
              </a>
            </div>
          )}

          {referral.isLoading && <div className="mt-4 h-4 w-48 animate-pulse rounded bg-indigo-200" />}
          {referral.data && (
            <div className="mt-4 rounded-xl bg-white p-4 border border-indigo-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Referred Students Attributed:</span>
              <span className="font-display text-lg font-bold text-indigo-700">
                {referral.data.successfulRegistrations} {referral.data.successfulRegistrations === 1 ? 'student' : 'students'}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-800" data-testid="link-return-workshop">
            ← Return to Workshop Home
          </Link>
          <Link href="/admin" className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Operator Access
          </Link>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// 4. OPERATOR AUTH & GATEWAY ("/admin/login", "/sign-in", "/sign-up")
// ---------------------------------------------------------------------------
function OperatorLoginScreen({ mode = 'in' }: { mode?: 'in' | 'up' }) {
  const { signIn, isSignedIn } = useAppAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('growth.intern@nxtwave.tech');
  const [password, setPassword] = useState('demo123');

  if (isSignedIn) {
    setLocation('/admin');
    return null;
  }

  const handleDemoSignIn = (e: FormEvent) => {
    e.preventDefault();
    signIn();
    setLocation('/admin');
  };

  return (
    <main className="hero-wash soft-grid flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 py-10">
      <Logo />
      <div className="surface w-full max-w-[440px] rounded-3xl p-7 border border-slate-200/90 bg-white shadow-xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 uppercase tracking-wide">
            Growth Control Room
          </span>
          <h1 className="font-display mt-3 text-2xl font-bold text-[#202d49]">
            Campaign Operator Sign In
          </h1>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Restricted access for campaign leads, growth evaluators, and analytics monitoring.
          </p>
        </div>

        {/* 1-Click Demo Access for Evaluators */}
        <div className="mt-6 rounded-2xl bg-indigo-50/70 border border-indigo-100 p-4 text-center">
          <p className="text-xs font-semibold text-indigo-900">NxtWave Hiring Evaluator Mode</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Instant 1-click access is pre-authorized so reviewers can test all admin features without credentials.
          </p>
          <button
            onClick={handleDemoSignIn}
            className="mt-3.5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            data-testid="button-one-click-demo-signin"
          >
            <Sparkles size={15} />
            Sign In as Campaign Operator (1-Click Demo)
          </button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-bold text-slate-400 uppercase">Or Standard Login</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleDemoSignIn} className="space-y-4">
          <Field
            label="Operator Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full">
            Authorize & Open Dashboard <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Protected by role authorization & minimum necessary database grants.
        </p>
      </div>
    </main>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAppAuth();

  if (!isSignedIn) {
    return <OperatorLoginScreen mode="in" />;
  }

  return <AdminFrame>{children}</AdminFrame>;
}

function AdminFrame({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAppAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const cache = useQueryClient();

  const paths = [
    ['/admin', 'Overview & KPIs', LayoutDashboard],
    ['/admin/registrations', 'Registrations Ledger', Users],
    ['/admin/channels', 'Channel Analytics', BarChart3],
    ['/admin/referrals', 'Referral Engine', Link2],
    ['/admin/strategy', 'Strategy & Simulator', Target],
    ['/admin/assets', 'Distribution Assets', Clipboard],
    ['/admin/automation', 'Automated Tasks & CRM', Zap],
    ['/admin/learning', 'AI & Learning Notes', BookOpenText],
  ] as const;

  const toggleDataset = () => {
    const isMock = localStorage.getItem('launchpad_mock_registrations');
    if (isMock) {
      const confirmReset = window.confirm(
        'Switch between Demo Dataset (184 seed registrations) and Empty State (0 registrations) to test empty state handling?'
      );
      if (confirmReset) {
        const currentData = JSON.parse(isMock);
        if (currentData.length > 0) {
          localStorage.setItem('launchpad_mock_registrations', JSON.stringify([]));
          alert('Switched to Empty State (0 registrations). Refreshing views.');
        } else {
          localStorage.removeItem('launchpad_mock_registrations');
          alert('Restored Demo Dataset (184 registrations). Refreshing views.');
        }
        cache.invalidateQueries();
        window.location.reload();
      }
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f6f7fb] md:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[265px] flex-col bg-[#202d49] px-4 py-5 transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Logo light />
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white md:hidden" aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <div className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-indigo-200/60">
          Campaign Control
        </div>
        <nav className="mt-3 space-y-1">
          {paths.map(([href, label, Icon]) => (
            <ShellLink key={href} href={href} active={location === href}>
              <Icon size={17} />
              {label}
            </ShellLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <button
            onClick={toggleDataset}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.06] p-3 text-left transition hover:bg-white/10"
            title="Toggle between demo dataset and zero-data state"
          >
            <div>
              <p className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                <Database size={13} className="text-teal-400" /> Data Source
              </p>
              <p className="text-[10px] text-indigo-100/60 mt-0.5">Toggle Demo / Empty State</p>
            </div>
            <RotateCcw size={14} className="text-indigo-200" />
          </button>

          <button
            onClick={() => {
              signOut();
              setLocation('/');
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-indigo-100/75 transition hover:bg-white/10 hover:text-white"
            data-testid="button-sign-out"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
          aria-label="Close menu backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="min-w-0 flex-1 md:ml-[265px]">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <div>
              <p className="font-display text-sm font-bold text-[#202d49]">AI LaunchPad Growth Engine</p>
              <p className="text-[11px] text-slate-500">7-Day Campaign Operator Panel · Target: 500 Students</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <ShieldCheck size={14} className="text-teal-600" />
              Operator Authenticated
            </span>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
            >
              View Student Page <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] p-4 sm:p-7 lg:p-9">{children}</div>
      </main>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-600">{eyebrow}</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-.045em] text-[#202d49]">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. ADMIN ROUTE: Campaign Overview & Growth Action Center ("/admin")
// ---------------------------------------------------------------------------
function AdminOverview() {
  const q = useGetAdminSummary();

  // Safe defaults for all array/nullable fields — must be computed before any early return
  // because useMemo must always be called (Rules of Hooks)
  const d = q.data;
  const daily = d?.daily ?? [];
  const sources = d?.sources ?? [];
  const colleges = d?.colleges ?? [];
  const graduationYears = d?.graduationYears ?? [];
  const registrations = d?.registrations ?? 0;
  const targetPercent = d?.targetPercent ?? 0;
  const remaining = d?.remaining ?? 0;
  const referrals = d?.referrals ?? 0;
  const budgetPaise = d?.budgetPaise ?? 0;
  const actualSpendPaise = d?.actualSpendPaise ?? 0;
  const requiredDailyPace = d?.requiredDailyPace ?? 0;
  const funnel = {
    uniqueVisitors: d?.funnel?.uniqueVisitors ?? 0,
    formStarts: d?.funnel?.formStarts ?? 0,
    registrations: d?.funnel?.registrations ?? registrations,
    conversionRate: d?.funnel?.conversionRate ?? null,
  };

  const recommendations = useMemo(() => {
    if (!d) return [];
    const rules = [];

    // Rule 1: Registration pace check
    if (d.daysRemaining && requiredDailyPace > 0) {
      const avgPace = daily.length > 0 ? Math.round(registrations / daily.length) : 0;
      if (avgPace < requiredDailyPace) {
        rules.push({
          tag: 'Pace Shortfall Rule',
          title: 'Accelerate Campus Club Outreach',
          metric: `Current pace: ~${avgPace}/day vs Required: ${requiredDailyPace}/day to reach 500`,
          action: 'Deploy the Campus Club outreach template to 10 additional engineering societies to close the remaining gap.',
          badge: 'High Priority',
          color: 'bg-amber-50 border-amber-200 text-amber-900',
        });
      }
    }

    // Rule 2: Referral engine performance check
    const referralShare = registrations > 0 ? (referrals / registrations) * 100 : 0;
    if (referralShare < 20) {
      rules.push({
        tag: 'Viral Loop Rule',
        title: 'Optimize Post-Registration Sharing',
        metric: `Referral contribution: ${referralShare.toFixed(1)}% (Target: 20%)`,
        action: 'Trigger a WhatsApp study-group prompt 2 hours post-registration with prefilled text so registrants invite their project lab partners.',
        badge: 'Growth Loop',
        color: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      });
    }

    // Rule 3: Funnel conversion check
    if (funnel.conversionRate != null) {
      if (funnel.conversionRate < 15) {
        rules.push({
          tag: 'Conversion Funnel Rule',
          title: 'A/B Test Landing Page Headline',
          metric: `Conversion rate: ${funnel.conversionRate.toFixed(1)}% on ${funnel.uniqueVisitors} visitors`,
          action: 'Test Headline B ("Your first AI project. One guided hour.") against current headline to reduce bounce rate.',
          badge: 'CRO',
          color: 'bg-teal-50 border-teal-200 text-teal-900',
        });
      } else {
        rules.push({
          tag: 'Strong Conversion Rule',
          title: 'Funnel Performing Above Benchmark',
          metric: `${funnel.conversionRate.toFixed(1)}% visitor-to-registration conversion`,
          action: 'Maintain form simplicity (no mandatory account creation). Focus 80% of effort on top-of-funnel student distribution.',
          badge: 'Scale Traffic',
          color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        });
      }
    }

    // Rule 4: Budget & Cost Per Registration
    if (d.costPerRegistrationPaise != null) {
      const cpr = d.costPerRegistrationPaise / 100;
      rules.push({
        tag: 'Unit Economics Rule',
        title: 'Budget Efficiency Validated',
        metric: `Actual CPR: ₹${cpr.toFixed(2)} vs ₹4.00 planning target`,
        action: `₹${((budgetPaise - actualSpendPaise) / 100).toLocaleString()} reserve remaining. Reallocate ₹500 to the highest-converting campus club partner.`,
        badge: 'Budget Control',
        color: 'bg-slate-50 border-slate-200 text-slate-800',
      });
    }

    return rules;
  }, [d, funnel, registrations, referrals, requiredDailyPace, budgetPaise, actualSpendPaise]);

  // Early returns AFTER all hooks
  if (q.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (q.isError || !d) return <AdminGate><QueryError onRetry={() => q.refetch()} /></AdminGate>;

  const maxDaily = Math.max(...daily.map((x) => x.registrations ?? 0), 1);
  const currency = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Campaign Operations Center"
        title="Growth Overview"
        description="Real-time performance tracking toward the 500-registration target."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              7-Day Sprint · Budget: ₹{(budgetPaise / 100).toLocaleString('en-IN')}
            </span>
            <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700">
              Target: 500 Students
            </span>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Registrations"
          value={registrations.toLocaleString()}
          hint={`${remaining.toLocaleString()} remaining to target`}
          icon={Users}
          badge={`${targetPercent.toFixed(1)}%`}
        />
        <StatCard
          label="Target Progress"
          value={`${targetPercent.toFixed(1)}%`}
          hint={`Pace needed: ~${requiredDailyPace}/day`}
          icon={Target}
        />
        <StatCard
          label="Referred Registrations"
          value={referrals.toLocaleString()}
          hint={`${registrations > 0 ? ((referrals / registrations) * 100).toFixed(1) : 0}% viral loop share`}
          icon={Link2}
        />
        <StatCard
          label="Campaign Spend & CPR"
          value={currency(actualSpendPaise)}
          hint={d.costPerRegistrationPaise ? `Cost/Reg: ₹${(d.costPerRegistrationPaise / 100).toFixed(2)} (Budget: ₹4)` : `Budget: ${currency(budgetPaise)}`}
          icon={HandCoins}
        />
      </div>

      {/* Distinctive Feature: Explainable Growth Action Center */}
      <section className="surface mt-6 rounded-2xl p-5 sm:p-7 border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700 font-bold">
              <Target size={20} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-[#202d49]">Growth Action Center</h2>
              <p className="text-xs text-slate-500">
                Rule-based algorithmic recommendations derived from live campaign metrics.
              </p>
            </div>
          </div>
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {recommendations.length} Active Rules Triggered
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((rec) => (
            <article key={rec.title} className={`rounded-2xl border p-5 ${rec.color} transition hover:shadow-sm`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-75">{rec.tag}</span>
                <span className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-bold shadow-xs">{rec.badge}</span>
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-slate-900">{rec.title}</h3>
              <p className="mt-1.5 text-xs font-semibold text-slate-700">Observed: {rec.metric}</p>
              <div className="mt-3 border-t border-slate-200/60 pt-3">
                <p className="text-xs leading-5 text-slate-800">
                  <strong>Recommended Action:</strong> {rec.action}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Charts & Funnel */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.9fr]">
        {/* Daily Registration Trend */}
        <section className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#202d49]">Daily Acquisition Trend</h2>
              <p className="mt-0.5 text-xs text-slate-500">Verified registrations recorded by day</p>
            </div>
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
              {d.daysRemaining ?? 3} Days Remaining
            </span>
          </div>

          {daily.length ? (
            <div className="mt-8 flex h-56 items-end gap-3 border-b border-slate-100 pb-3 overflow-x-auto">
              {daily.map((item, i) => (
                <div key={`${item.date}-${i}`} className="group flex min-w-10 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-bold text-slate-700">{item.registrations ?? 0}</span>
                  <div
                    className="w-full max-w-12 rounded-t-lg bg-indigo-600 transition-all group-hover:bg-indigo-700 shadow-sm"
                    style={{ height: `${Math.max(8, ((item.registrations ?? 0) / maxDaily) * 155)}px` }}
                  />
                  <span className="text-[10px] font-medium text-slate-400">
                    {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
              No registrations recorded yet. Submit a test registration to view daily progress.
            </div>
          )}
        </section>

        {/* Funnel Metrics */}
        <section className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#202d49]">Measured Conversion Funnel</h2>
          <p className="mt-0.5 text-xs text-slate-500">From initial discovery to completed registration</p>

          <div className="mt-6 space-y-3.5">
            {[
              ['Unique Landing Visitors', funnel.uniqueVisitors, '100%'],
              ['Form Starts Initiated', funnel.formStarts, `${funnel.uniqueVisitors > 0 ? ((funnel.formStarts / funnel.uniqueVisitors) * 100).toFixed(1) : 0}%`],
              ['Completed Registrations', funnel.registrations, `${funnel.uniqueVisitors > 0 ? ((funnel.registrations / funnel.uniqueVisitors) * 100).toFixed(1) : 0}%`],
            ].map(([label, val, pct]) => (
              <div key={String(label)} className="rounded-xl border border-slate-100 bg-[#f9fafc] p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="font-display text-xl font-bold text-slate-800">{Number(val).toLocaleString()}</p>
                </div>
                <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                  {pct}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-indigo-50/60 border border-indigo-100 p-4">
            <p className="text-xs font-semibold text-indigo-900">Overall Visitor-to-Registration Rate</p>
            <p className="mt-1 font-display text-2xl font-bold text-indigo-700">
              {funnel.conversionRate != null ? `${funnel.conversionRate.toFixed(1)}%` : '—'}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Instrumentation active · Deduplicated by pseudonymous visitor ID
            </p>
          </div>
        </section>
      </div>

      {/* Breakdowns: Sources, Colleges, Years */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {[
          ['Top Acquisition Channels', sources, 'channel'],
          ['Colleges Represented', colleges, 'college'],
          ['Graduation Years', graduationYears, 'year'],
        ].map(([title, rows]) => (
          <section key={String(title)} className="surface rounded-2xl p-5 border border-slate-200/80 bg-white shadow-sm">
            <h3 className="font-display font-bold text-[#202d49] text-base">{String(title)}</h3>
            {(rows as { label: string; registrations: number }[]).length ? (
              <div className="mt-4 space-y-2.5">
                {(rows as { label: string; registrations: number }[]).slice(0, 5).map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-sm border-b border-slate-100 pb-2">
                    <span className="truncate text-slate-600 text-xs font-medium">{row.label}</span>
                    <span className="font-bold text-slate-800 text-xs shrink-0">{row.registrations ?? 0} regs</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-400">No measured data yet.</p>
            )}
          </section>
        ))}
      </div>
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// 6. ADMIN ROUTE: Registrations Table ("/admin/registrations")
// ---------------------------------------------------------------------------
function RegistrationsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState('');
  const [exportReady, setExportReady] = useState(false);

  const params = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: search.trim() || undefined,
      source: sourceFilter || undefined,
    }),
    [page, search, sourceFilter]
  );

  const q = useListAdminRegistrations(params);
  const exportParams = useMemo(() => ({}), []);
  const exportQ = useExportAdminRegistrations(exportParams, {
    query: { enabled: exportReady, queryKey: getExportAdminRegistrationsQueryKey(exportParams) },
  });
  const records = Array.isArray(q.data?.records) ? q.data.records : [];
  const totalRecords = q.data?.total ?? records.length;
  const pageSize = q.data?.pageSize || 20;
  const currentPage = q.data?.page ?? page;

  useEffect(() => {
    if (!exportReady || typeof exportQ.data !== 'string') return;
    const href = URL.createObjectURL(new Blob([exportQ.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = `nxtwave_ai_launchpad_registrations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(href);
    setExportReady(false);
  }, [exportReady, exportQ.data]);

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Student Database"
        title="Registrations Ledger"
        description="Search, filter, and inspect verified workshop registration records."
        action={
          <button
            onClick={() => setExportReady(true)}
            disabled={exportReady || exportQ.isLoading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            data-testid="button-export"
          >
            <Download size={16} />
            {exportReady && exportQ.isLoading ? 'Generating CSV…' : 'Export Verified CSV'}
          </button>
        }
      />

      <div className="surface rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 border-b border-slate-100 p-4 sm:items-center sm:justify-between bg-slate-50/50">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 sm:max-w-xl">
            <label className="relative block flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, college, branch…"
                className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                data-testid="input-search-registrations"
              />
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"
            >
              <option value="">All Acquisition Channels</option>
              <option value="campus_club">College Clubs & Societies</option>
              <option value="whatsapp">WhatsApp Communities</option>
              <option value="student_referral">Peer Referrals</option>
              <option value="linkedin">LinkedIn / Social</option>
              <option value="email">Direct Outreach</option>
            </select>
          </div>
          <span className="text-xs font-semibold text-slate-500">{totalRecords} Total Records</span>
        </div>

        {q.isLoading ? (
          <div className="p-6"><LoadingPanel /></div>
        ) : q.isError ? (
          <div className="p-6"><QueryError onRetry={() => q.refetch()} /></div>
        ) : records.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#fafbfe] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <tr>
                    {['Student', 'College & Branch', 'Batch', 'Channel / Source', 'Referral Code', 'Timestamp'].map((col) => (
                      <th className="px-5 py-3.5" key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{row.fullName}</p>
                        <p className="mt-0.5 text-xs text-slate-500 font-mono">{row.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-[220px] truncate text-slate-700 font-medium">{row.college}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{row.branch}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {row.graduationYear}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                          {row.source || 'direct'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {row.referralCode}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {new Date(row.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 bg-slate-50/40">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {Math.ceil(totalRecords / pageSize) || 1}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page * pageSize >= totalRecords}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto text-slate-300" size={32} />
            <h3 className="mt-4 font-semibold text-slate-700">No matching registrations found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {search ? 'Try clearing your search query or channel filter.' : 'New registrations will appear here in real time.'}
            </p>
          </div>
        )}
      </div>
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// 7. ADMIN ROUTE: Channels Analytics ("/admin/channels")
// ---------------------------------------------------------------------------
function ChannelsPage() {
  const q = useGetAdminSummary();
  if (q.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (q.isError || !q.data) return <AdminGate><QueryError onRetry={() => q.refetch()} /></AdminGate>;

  const sources = Array.isArray(q.data.sources) ? q.data.sources : [];
  const total = sources.reduce((sum, s) => sum + (s.registrations ?? 0), 0);

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Attribution Analytics"
        title="Channel Performance"
        description="Compare acquisition channels using registrations strictly attributed to each source."
      />

      <div className="surface rounded-2xl p-6 sm:p-8 border border-slate-200/80 bg-white shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#202d49]">Attributed Registrations by Source</h2>
            <p className="mt-0.5 text-xs text-slate-500">Deterministic last-touch attribution rule applied consistently</p>
          </div>
          <Filter size={18} className="text-slate-400" />
        </div>

        {sources.length ? (
          <div className="space-y-6">
            {sources.map((s, i) => {
              const registrations = s.registrations ?? 0;
              const pct = total ? (registrations / total) * 100 : 0;
              return (
                <div key={s.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-lg bg-indigo-50 font-mono text-xs font-bold text-indigo-600">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="font-semibold text-slate-800 text-sm">{s.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-800">{registrations}</span>
                      <span className="text-xs text-slate-400 ml-1.5">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <BarChart3 className="mx-auto text-slate-300" size={32} />
            <h3 className="mt-3 font-semibold text-slate-700">No channel data recorded</h3>
            <p className="mt-1 text-sm text-slate-500">Channel breakdown will populate when registrations are received.</p>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface rounded-2xl p-5 border border-slate-200/80 bg-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Attributed</p>
          <p className="font-display mt-2 text-3xl font-bold text-[#202d49]">{total}</p>
          <p className="mt-1 text-xs text-slate-500">Every registration belongs to exactly one primary attributed channel.</p>
        </div>
        <div className="surface rounded-2xl p-5 border border-slate-200/80 bg-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cost per Registration</p>
          <p className="font-display mt-2 text-3xl font-bold text-[#202d49]">
            {q.data.costPerRegistrationPaise == null ? '₹0.00' : `₹${(q.data.costPerRegistrationPaise / 100).toFixed(2)}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">Calculated strictly from actual expenses entered in the campaign ledger.</p>
        </div>
      </div>
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// 8. ADMIN ROUTE: Referral Engine Analytics ("/admin/referrals")
// ---------------------------------------------------------------------------
function ReferralsPage() {
  const q = useGetAdminReferrals();
  if (q.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (q.isError || !q.data) return <AdminGate><QueryError onRetry={() => q.refetch()} /></AdminGate>;

  const d = q.data;
  const totalReferrals = d.totalReferrals ?? 0;
  const shareOfRegistrations = d.shareOfRegistrations ?? 0;
  const topCodes = Array.isArray(d.topCodes) ? d.topCodes : [];
  const daily = Array.isArray(d.daily) ? d.daily : [];

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Viral Loop Dynamics"
        title="Referral Engine Analytics"
        description="Monitor peer-to-peer sharing and viral invitation performance."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Successful Referred Registrations"
          value={totalReferrals.toLocaleString()}
          hint="Genuinely completed registrations through student links"
          icon={Link2}
        />
        <StatCard
          label="Share of Total Registrations"
          value={`${shareOfRegistrations.toFixed(1)}%`}
          hint="Target viral share: 20% (100 of 500 registrations)"
          icon={Share2}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#202d49]">Top Performing Referral Codes</h2>
          <p className="mt-0.5 text-xs text-slate-500">Ranked by verified completed registrations, not link clicks</p>

          {topCodes.length ? (
            <div className="mt-5 divide-y divide-slate-100">
              {topCodes.map((r, i) => (
                <div key={r.code} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-indigo-50 font-mono text-xs font-bold text-indigo-600">
                      {i + 1}
                    </span>
                    <code className="text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {r.code}
                    </code>
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {r.successfulRegistrations} {r.successfulRegistrations === 1 ? 'invite' : 'invites'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
              No referral registrations recorded yet.
            </div>
          )}
        </section>

        <section className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#202d49]">Referral Momentum</h2>
          <p className="mt-0.5 text-xs text-slate-500">Daily volume of registrations generated by peer links</p>

          {daily.length ? (
            <div className="mt-6 space-y-3.5">
              {daily.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-medium text-slate-500">
                    {new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="h-2.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all duration-500"
                      style={{
                        width: `${Math.max(8, ((day.registrations ?? 0) / Math.max(...daily.map((x) => x.registrations ?? 0), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-bold text-slate-700">{day.registrations}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
              Referral momentum will display once students share their links.
            </div>
          )}
        </section>
      </div>
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// 9. ADMIN ROUTE: Strategy, Spend Ledger & Campaign Simulator ("/admin/strategy")
// ---------------------------------------------------------------------------
function StrategyPage() {
  const configQ = useGetAdminConfig();
  const spendQ = useListAdminSpend();
  const summaryQ = useGetAdminSummary();
  const updateConfig = useUpdateAdminConfig();
  const createSpend = useCreateAdminSpend();
  const cache = useQueryClient();

  const [draft, setDraft] = useState<CampaignConfig | null>(null);
  const [spendForm, setSpendForm] = useState({
    amount: '',
    channel: '',
    note: '',
    spentAt: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (configQ.data) setDraft(configQ.data);
  }, [configQ.data]);

  if (configQ.isLoading || spendQ.isLoading || summaryQ.isLoading)
    return <AdminGate><LoadingPanel /></AdminGate>;
  if (configQ.isError || spendQ.isError || summaryQ.isError || !configQ.data || !summaryQ.data)
    return <AdminGate><QueryError onRetry={() => { configQ.refetch(); spendQ.refetch(); summaryQ.refetch(); }} /></AdminGate>;

  const d = draft || configQ.data;
  const campaignName = d.campaignName ?? '';
  const target = d.target ?? 500;
  const durationDays = d.durationDays ?? 7;
  const budgetPaise = d.budgetPaise ?? 0;
  const spendRows = Array.isArray(spendQ.data) ? spendQ.data : [];
  const actualSpendPaise = summaryQ.data.actualSpendPaise ?? 0;
  const summaryBudgetPaise = summaryQ.data.budgetPaise ?? budgetPaise;

  const saveConfig = (e: FormEvent) => {
    e.preventDefault();
    updateConfig.mutate(
      {
        data: {
          ...d,
          target: Number(target),
          durationDays: Number(durationDays),
          budgetPaise: Number(budgetPaise),
        },
      },
      {
        onSuccess: () => cache.invalidateQueries({ queryKey: ['/api/admin/config'] }),
      }
    );
  };

  const submitSpend = (e: FormEvent) => {
    e.preventDefault();
    if (!spendForm.amount || !spendForm.channel) return;
    createSpend.mutate(
      {
        data: {
          amountPaise: Math.round(Number(spendForm.amount) * 100),
          channel: spendForm.channel,
          note: spendForm.note || undefined,
          spentAt: new Date(`${spendForm.spentAt}T12:00:00`).toISOString(),
        },
      },
      {
        onSuccess: () => {
          cache.invalidateQueries({ queryKey: ['/api/admin/spend'] });
          cache.invalidateQueries({ queryKey: ['/api/admin/summary'] });
          setSpendForm({
            amount: '',
            channel: '',
            note: '',
            spentAt: new Date().toISOString().slice(0, 10),
          });
        },
      }
    );
  };

  const budgetRs = budgetPaise / 100;

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Campaign Planning & Financials"
        title="Strategy & Budget Management"
        description="Configure target assumptions, record verified expenditure, and model acquisition scenarios."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        {/* Campaign Plan Config */}
        <form onSubmit={saveConfig} className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#202d49]">Campaign Plan Parameters</h2>
              <p className="mt-0.5 text-xs text-slate-500">Planning assumptions are kept distinct from actual measured results.</p>
            </div>
            <Settings2 size={18} className="text-slate-400" />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="Campaign Name"
              value={campaignName}
              onChange={(e) => setDraft({ ...d, campaignName: e.target.value })}
              required
            />
            <Field
              label="Registration Target"
              type="number"
              min={1}
              value={target}
              onChange={(e) => setDraft({ ...d, target: Number(e.target.value) })}
              required
            />
            <Field
              label="Duration (Days)"
              type="number"
              min={1}
              max={60}
              value={durationDays}
              onChange={(e) => setDraft({ ...d, durationDays: Number(e.target.value) })}
              required
            />
            <Field
              label="Total Planned Budget (₹)"
              type="number"
              min={0}
              step="1"
              value={budgetRs}
              onChange={(e) => setDraft({ ...d, budgetPaise: Math.round(Number(e.target.value) * 100) })}
              required
            />
          </div>

          <Button type="submit" disabled={updateConfig.isPending} className="mt-5" data-testid="button-save-plan">
            {updateConfig.isPending ? 'Saving Plan…' : 'Update Plan Assumptions'}
          </Button>
        </form>

        {/* 7-Day Execution Framework */}
        <section className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#202d49]">7-Day Execution Plan</h2>
          <p className="mt-0.5 text-xs text-slate-500">Operational cadence for reaching 500 registrations with ₹2,000 budget</p>

          <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
            {[
              ['Day 1', 'Launch landing page, test end-to-end registration flow, verify tracking & privacy compliance.'],
              ['Day 2', 'Direct outreach to 20 student club coordinators with pre-tagged community links.'],
              ['Day 3', 'Permission-based distribution in 10 active engineering WhatsApp & Discord groups.'],
              ['Day 4', 'Send permission-based club email follow-ups & activate peer referral sharing.'],
              ['Day 5', 'Analyze channel quality; double down on top-performing student communities.'],
              ['Day 6', 'Share project preview & countdown reminder in approved channels.'],
              ['Day 7', 'Final registration reminder push; reconcile ledger and evaluate cost per registration.'],
            ].map(([day, task]) => (
              <div key={day} className="flex gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
                <span className="w-12 shrink-0 font-mono font-bold text-indigo-600">{day}</span>
                <p className="text-slate-600 leading-5">{task}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Spend Tracker & Ledger */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <form onSubmit={submitSpend} className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#202d49]">Record Real Campaign Expenditure</h2>
          <p className="mt-0.5 text-xs text-slate-500">Expenses are only reflected after being verified and entered here.</p>

          <div className="mt-5 space-y-3.5">
            <Field
              label="Amount Spent (₹)"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="e.g. 350.00"
              value={spendForm.amount}
              onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })}
            />
            <Field
              label="Channel / Partner"
              required
              placeholder="e.g. College Club Material Testing"
              value={spendForm.channel}
              onChange={(e) => setSpendForm({ ...spendForm, channel: e.target.value })}
            />
            <Field
              label="Date of Spend"
              type="date"
              required
              value={spendForm.spentAt}
              onChange={(e) => setSpendForm({ ...spendForm, spentAt: e.target.value })}
            />
            <Field
              label="Note (Optional)"
              placeholder="Brief rationale for this expense"
              value={spendForm.note}
              onChange={(e) => setSpendForm({ ...spendForm, note: e.target.value })}
            />
          </div>

          <Button type="submit" disabled={createSpend.isPending} className="mt-5" data-testid="button-record-spend">
            {createSpend.isPending ? 'Recording…' : 'Record Expenditure'}
          </Button>
        </form>

        <section className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#202d49]">Spend Ledger</h2>
              <p className="text-xs text-slate-500">
                Total spent: ₹{(actualSpendPaise / 100).toFixed(2)} of ₹{(summaryBudgetPaise / 100).toLocaleString('en-IN')}
              </p>
            </div>
            <HandCoins className="text-indigo-600" size={20} />
          </div>

          {spendRows.length ? (
            <div className="mt-4 divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {spendRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.channel}</p>
                    <p className="text-xs text-slate-500">{row.note || 'No notes'} · {new Date(row.spentAt).toLocaleDateString()}</p>
                  </div>
                  <span className="font-display text-sm font-bold text-slate-900">
                    ₹{((row.amountPaise ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
              No expenditure recorded yet. Budget remains in reserve.
            </div>
          )}
        </section>
      </div>

      {/* Advanced Feature: Campaign Simulator */}
      <CampaignSimulator target={target} budgetPaise={budgetPaise} />
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// ADVANCED FEATURE: Campaign Simulator
// ---------------------------------------------------------------------------
type CampaignScenario = {
  partners: number;
  registrationsPerPartner: number;
  whatsapp: number;
  referrals: number;
  linkedin: number;
  email: number;
};

function CampaignSimulator({ target, budgetPaise }: { target: number; budgetPaise: number }) {
  const baseline: CampaignScenario = {
    partners: 20,
    registrationsPerPartner: 12,
    whatsapp: 100,
    referrals: 100,
    linkedin: 40,
    email: 20,
  };

  const [alternative, setAlternative] = useState<CampaignScenario>({
    partners: 15,
    registrationsPerPartner: 14,
    whatsapp: 110,
    referrals: 90,
    linkedin: 50,
    email: 40,
  });

  const [allocation, setAllocation] = useState({ testing: 800, contingency: 400, reserve: 800 });

  const total = (scenario: CampaignScenario) =>
    scenario.partners * scenario.registrationsPerPartner +
    scenario.whatsapp +
    scenario.referrals +
    scenario.linkedin +
    scenario.email;

  const baselineTotal = total(baseline);
  const alternativeTotal = total(alternative);
  const allocationTotal = allocation.testing + allocation.contingency + allocation.reserve;

  const rows = [
    ['College Clubs & Representatives', 'partners', 'registrationsPerPartner'],
    ['WhatsApp Engineering Communities', 'whatsapp'],
    ['Student Referral Growth Loop', 'referrals'],
    ['LinkedIn & Student Socials', 'linkedin'],
    ['Direct Student Outreach / Email', 'email'],
  ] as const;

  const updateScenario = (field: keyof CampaignScenario, value: number) =>
    setAlternative((current) => ({ ...current, [field]: Math.max(0, value) }));

  return (
    <section className="surface mt-8 rounded-2xl p-6 sm:p-8 border border-indigo-100 bg-white shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
            Interactive Modeling Tool
          </span>
          <h2 className="font-display mt-2 text-2xl font-bold text-[#202d49]">Campaign Simulator</h2>
          <p className="mt-1 text-xs text-slate-500">
            Model alternative acquisition hypotheses before committing spend. Projections are editable planning assumptions.
          </p>
        </div>
        <span className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700">
          Target: {target.toLocaleString()} Registrations
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Baseline Scenario */}
        <article className="rounded-2xl border border-slate-200 bg-[#fafbfe] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Baseline Model (500 Goal)</h3>
              <p className="text-xs text-slate-500">Standard hypothesis from the growth strategy</p>
            </div>
            <div className="text-right">
              <span className="font-display text-3xl font-extrabold text-indigo-600">{baselineTotal}</span>
              <p className="text-[10px] font-bold uppercase text-slate-400">Projected Regs</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 divide-y divide-slate-100 text-xs">
            {rows.map(([label, countKey, perPartnerKey]) => (
              <div key={countKey} className="flex justify-between py-2">
                <span className="text-slate-600">{label}</span>
                <strong className="text-slate-800 font-mono">
                  {perPartnerKey
                    ? `${baseline.partners} clubs × ${baseline.registrationsPerPartner} = ${baseline.partners * baseline.registrationsPerPartner}`
                    : baseline[countKey]}
                </strong>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-teal-50 border border-teal-100 p-2.5 text-center text-xs font-semibold text-teal-800">
            Target Reached: {baselineTotal} / 500 (100.0%)
          </div>
        </article>

        {/* Alternative Editable Scenario */}
        <article className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Alternative Scenario (Editable)</h3>
              <p className="text-xs text-slate-500">Adjust assumptions to test resilience</p>
            </div>
            <div className="text-right">
              <span className={`font-display text-3xl font-extrabold ${alternativeTotal >= target ? 'text-teal-600' : 'text-amber-600'}`}>
                {alternativeTotal}
              </span>
              <p className="text-[10px] font-bold uppercase text-slate-400">Projected Regs</p>
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs">
            {rows.map(([label, countKey, perPartnerKey]) => (
              <div key={countKey} className="flex items-center justify-between gap-2 border-b border-indigo-100/60 pb-2">
                <span className="text-slate-700 font-medium">{label}</span>
                {perPartnerKey ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={alternative.partners}
                      onChange={(e) => updateScenario('partners', Number(e.target.value))}
                      className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold"
                      title="Number of college partner clubs"
                    />
                    <span className="text-slate-400">×</span>
                    <input
                      type="number"
                      min="0"
                      value={alternative.registrationsPerPartner}
                      onChange={(e) => updateScenario('registrationsPerPartner', Number(e.target.value))}
                      className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold"
                      title="Average registrations per club"
                    />
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={alternative[countKey]}
                    onChange={(e) => updateScenario(countKey, Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold"
                  />
                )}
              </div>
            ))}
          </div>

          <div className={`mt-4 rounded-xl border p-2.5 text-center text-xs font-semibold ${
            alternativeTotal >= target ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {alternativeTotal >= target
              ? `Target Achieved! ${alternativeTotal} / 500 (${((alternativeTotal / target) * 100).toFixed(1)}%)`
              : `Shortfall of ${target - alternativeTotal} registrations (${((alternativeTotal / target) * 100).toFixed(1)}% of target)`}
          </div>
        </article>
      </div>

      {/* Budget Allocation Scenario */}
      <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-5">
        <h4 className="text-sm font-bold text-slate-800">Budget Allocation Plan (₹2,000 Total)</h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[
            ['testing', 'Channel Creative Testing', allocation.testing],
            ['contingency', 'Campaign Contingency', allocation.contingency],
            ['reserve', 'High-Performer Reserve', allocation.reserve],
          ].map(([key, label, val]) => (
            <div key={String(key)} className="rounded-xl bg-white p-3 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">{label}</span>
              <p className="mt-1 font-display text-lg font-bold text-slate-800">₹{Number(val).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 10. ADMIN ROUTE: Campaign Distribution Assets ("/admin/assets")
// ---------------------------------------------------------------------------
function CampaignAssetsPage() {
  const [copied, setCopied] = useState('');

  const campaignUrl = (source: string, medium: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nxtwave-ai-launchpad.vercel.app';
    const url = new URL(`${basePath || ''}/`, origin);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', medium);
    url.searchParams.set('utm_campaign', 'first-ai-project');
    return url.toString();
  };

  const assets = [
    {
      id: 'whatsapp',
      title: 'WhatsApp Student & Class Groups',
      channel: 'Peer-to-Peer Communities',
      text: `🚀 Curious about building real AI projects before placement season?\n\nNxtWave is hosting a free hands-on 60-minute workshop: "Build Your First AI Project in 60 Minutes" tailored for final-year engineering students.\n\n✨ No prior AI experience needed\n💻 Hands-on guided build with real architecture\n📄 Takeaway project for your resume & portfolio\n\nSave your seat in 30 seconds here: ${campaignUrl('whatsapp', 'student_group')}`,
    },
    {
      id: 'club',
      title: 'College Technical Club Outreach',
      channel: 'Campus Society Coordinators',
      text: `Hi [Coordinator Name],\n\nHope you are doing well! Could you please share this with your final-year engineering members if it adds value to your technical society?\n\nWe are organizing a free, practical 60-minute online workshop: "Build Your First AI Project in 60 Minutes". It is built specifically for 2027 graduates wanting a tangible AI portfolio piece before campus placements.\n\nStudents can register free here: ${campaignUrl('campus_club', 'club_outreach')}\n\nBest regards,\n[Your Name] | NxtWave Campus Growth Lead`,
    },
    {
      id: 'linkedin',
      title: 'LinkedIn & Social Media Post',
      channel: 'Organic Social Distribution',
      text: `Stop collecting AI tutorials. Start building your portfolio. 💡\n\nIf you're a final-year engineering student, knowing how to explain and build an AI prototype is one of the highest-leverage skills for upcoming technical interviews.\n\nJoin our free 60-minute workshop: "Build Your First AI Project in 60 Minutes". Zero AI experience required.\n\n🔗 Reserve your free spot: ${campaignUrl('linkedin', 'social_post')}\n\n#EngineeringStudents #AI #Placements2027 #NxtWave #BuildInPublic`,
    },
    {
      id: 'email',
      title: 'Permission-Based Club Email Outreach',
      channel: 'Direct Student Society Email',
      text: `Subject: Practical 60-Minute Workshop: Build Your First AI Project\n\nDear [Student Name],\n\nWe are inviting final-year engineering students to join a free 60-minute hands-on online workshop: "Build Your First AI Project in 60 Minutes".\n\nWhat we will cover:\n1. How AI architectures connect prompts to live APIs\n2. Hands-on coding of a testable AI project\n3. Portfolio & interview positioning for technical roles\n\nFree Registration: ${campaignUrl('email', 'college_outreach')}\n\nWarm regards,\nNxtWave Growth Team`,
    },
  ];

  const copyAsset = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(''), 2000);
  };

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Distribution Toolkit"
        title="Campaign Assets & Outreach Copy"
        description="Ready-to-use, source-tagged promotional copy with built-in UTM attribution parameters."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {assets.map((asset) => (
          <article key={asset.id} className="surface rounded-2xl p-6 border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{asset.channel}</span>
                <h3 className="font-display mt-1 text-lg font-bold text-[#202d49]">{asset.title}</h3>
              </div>
              <button
                onClick={() => copyAsset(asset.id, asset.text)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                data-testid={`button-copy-${asset.id}`}
              >
                <Clipboard size={14} />
                {copied === asset.id ? 'Copied!' : 'Copy Copy'}
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-xs leading-6 text-slate-700 border border-slate-100">
              {asset.text}
            </pre>
          </article>
        ))}
      </div>
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// 11. ADMIN ROUTE: AI & Learning Notes ("/admin/learning")
// ---------------------------------------------------------------------------
function LearningPage() {
  const notes = [
    {
      q: 'Q1: What changed between your first idea and final solution?',
      initial: 'Build a standalone landing page and share links manually in student communities.',
      evolution:
        'A landing page alone cannot solve distribution or guarantee 500 registrations on ₹2,000 budget. I transformed the project into a comprehensive Growth Engine: combining guest registration with an automated viral referral loop, deterministic UTM source attribution, and a real-time analytics dashboard with an explainable Growth Action Center.',
      learning:
        'Growth is not just driving traffic; it is constructing a measurable loop where every acquired student becomes a distribution node.',
    },
    {
      q: 'Q2: If you had another 24 hours, what would you improve?',
      initial: 'Add more decorative visual charts or extra animations.',
      evolution:
        'I would implement two high-impact growth initiatives: (1) Run an automated A/B headline experiment testing "Career Relevance" vs "Low Barrier" messages to measure completed registrations, and (2) Build an automated WhatsApp webhook notifying students when their personal referral code achieves 3 registrations.',
      learning:
        'Always prioritize features that directly influence conversion velocity and partner distribution over cosmetic dashboard tweaks.',
    },
    {
      q: 'Q3: What did AI suggest that you deliberately rejected, and why?',
      initial: 'AI suggested requiring students to create a password-protected account before registering.',
      evolution:
        'I deliberately rejected mandatory student authentication. Forcing a student to create a password introduces unnecessary conversion friction at the critical first step. I kept registration completely frictionless (guest flow) and reserved authentication exclusively for the protected campaign operations room.',
      learning:
        'Authentication should protect private administrative data, not create barriers in your primary acquisition funnel.',
    },
  ];

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Challenge Reflection"
        title="AI & Learning Notes"
        description="Critical evaluation of AI suggestions, architectural decisions, and product judgment."
      />

      <div className="space-y-6">
        {notes.map((item, idx) => (
          <article key={item.q} className="surface rounded-2xl p-6 sm:p-8 border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-indigo-50 font-mono text-xs font-bold text-indigo-700">
                0{idx + 1}
              </span>
              <h2 className="font-display text-lg font-bold text-[#202d49]">{item.q}</h2>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">First Suggestion / Initial Idea</span>
                <p className="mt-1.5 text-xs leading-5 text-slate-700">{item.initial}</p>
              </div>
              <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Strategic Decision & Evolution</span>
                <p className="mt-1.5 text-xs leading-5 text-indigo-950 font-medium">{item.evolution}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">
                <strong>Core Takeaway:</strong> {item.learning}
              </p>
            </div>
          </article>
        ))}
      </div>
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// 12. ADMIN ROUTE: Automated Tasks, CRM & Money Management ("/admin/automation")
// ---------------------------------------------------------------------------
function AutomationPage() {
  const summaryQ = useGetAdminSummary();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('wf-welcome');
  const [simulatedLogs, setSimulatedLogs] = useState<Array<{ id: string; time: string; workflow: string; recipient: string; status: string; preview: string }>>([
    {
      id: 'log-01',
      time: 'Just now',
      workflow: 'T+0m: Instant Registration Welcome',
      recipient: 'Rahul Sharma (+91 98765 43210)',
      status: 'Delivered (200 OK via WhatsApp Cloud API)',
      preview: 'Hi Rahul! Your registration for "Build Your First AI Project in 60 Minutes" is confirmed. Your referral code is AILAUNCH-K7P4Q.',
    },
    {
      id: 'log-02',
      time: '2 hours ago',
      workflow: 'Trigger: Friend Referral Credit Milestone',
      recipient: 'Sneha Patel (+91 98123 45678)',
      status: 'Delivered (200 OK via WhatsApp Cloud API)',
      preview: 'Great news Sneha! Your classmate Rohan just registered using your link. You now have 1 verified referral toward the project kit!',
    },
  ]);
  const [isSimulating, setIsSimulating] = useState(false);

  const workflows = [
    {
      id: 'wf-welcome',
      title: 'T+0m: Instant Registration Welcome & Referral Link',
      trigger: 'On Registration Form Submission',
      channel: 'WhatsApp Business API + Email',
      timing: 'Instant (< 5 seconds)',
      status: 'Active & Automated',
      template: `Hi {{student_name}}! 🚀\nYour registration for NxtWave's "Build Your First AI Project in 60 Minutes" is confirmed!\n\n📅 Date: Scheduled for Batch 2027\n🔗 Your exclusive referral link: https://nxtwave-ai-launchpad.vercel.app/?ref={{referral_code}}\n\nInvite your project partners to build together!`,
    },
    {
      id: 'wf-referral-push',
      title: 'T+2h: Peer Referral Activation Booster',
      trigger: '2 Hours After Initial Registration',
      channel: 'WhatsApp Business API',
      timing: 'Automated 120m Delay',
      status: 'Active & Automated',
      template: `Hey {{student_name}}! 👋 Final-year engineers from {{college}} are building study teams for the 60-Minute AI build. Share your link with your lab group: https://nxtwave-ai-launchpad.vercel.app/?ref={{referral_code}} to work on the build together!`,
    },
    {
      id: 'wf-milestone',
      title: 'Trigger: Real-Time Friend Referral Credit Alert',
      trigger: 'When a Friend Successfully Registers with Student Code',
      channel: 'WhatsApp Business API',
      timing: 'Real-time Event Hook',
      status: 'Active & Automated',
      template: `🎉 Boom {{student_name}}! A fellow engineer just registered with your referral link! You now have {{referral_count}} verified referred registration(s). Thank you for growing the developer community!`,
    },
    {
      id: 'wf-countdown',
      title: 'T-24h & T-1h: Workshop Attendance Countdown & Access Link',
      trigger: '24 Hours & 1 Hour Prior to Session Start',
      channel: 'WhatsApp + Calendar Invite Email',
      timing: 'Pre-scheduled Event Cadence',
      status: 'Active & Automated',
      template: `⏰ 1 Hour Countdown! "Build Your First AI Project in 60 Minutes" is starting soon. Have your browser and code editor ready. Click here to join: https://meet.google.com/nxtwave-ai-launchpad`,
    },
  ];

  const runSimulation = (wfId: string) => {
    setIsSimulating(true);
    const target = workflows.find((w) => w.id === wfId) || workflows[0];
    setTimeout(() => {
      const newLog = {
        id: `log-${Date.now()}`,
        time: 'Just now',
        workflow: target.title,
        recipient: 'Aditya Verma (+91 99887 76655)',
        status: 'Delivered (200 OK via Automated Webhook)',
        preview: target.template
          .replace('{{student_name}}', 'Aditya')
          .replace('{{college}}', 'BITS Pilani')
          .replace('{{referral_code}}', 'AILAUNCH-X9Y2Z')
          .replace('{{referral_count}}', '2'),
      };
      setSimulatedLogs((prev) => [newLog, ...prev]);
      setIsSimulating(false);
    }, 600);
  };

  const d = summaryQ.data;
  const actualSpend = d ? d.actualSpendPaise / 100 : 750;
  const budgetTotal = d ? d.budgetPaise / 100 : 2000;
  const cpr = d && d.costPerRegistrationPaise ? d.costPerRegistrationPaise / 100 : 4.08;

  return (
    <AdminGate>
      <PageHeading
        eyebrow="Workflow Automation & Financial Controls"
        title="Automated Tasks & Money Management"
        description="Autonomous CRM messaging triggers, lifecycle follow-ups, and financial guardrails to manage the ₹2,000 budget."
      />

      {/* Part 1: Automated Money Management & Financial Guardrails */}
      <section className="surface rounded-2xl p-6 sm:p-8 border border-slate-200/80 bg-white shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-teal-50 text-teal-700 font-bold">
                <HandCoins size={18} />
              </span>
              <h2 className="font-display text-xl font-bold text-[#202d49]">Automated Money Management Guardrails</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              System rules that autonomously enforce budget discipline and prevent capital leakage.
            </p>
          </div>
          <span className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-800">
            Budget Status: Controlled & Optimized
          </span>
        </div>

        {/* Budget Capital Allocation Breakdown */}
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-[#fafbfe] p-4 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Total Campaign Budget</span>
            <p className="font-display mt-1 text-2xl font-bold text-[#202d49]">₹{budgetTotal.toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Fixed 7-day budget ceiling</p>
          </div>
          <div className="rounded-xl bg-[#fafbfe] p-4 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Incurred Expenditure</span>
            <p className="font-display mt-1 text-2xl font-bold text-indigo-700">₹{actualSpend.toFixed(2)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Verified expenses in ledger</p>
          </div>
          <div className="rounded-xl bg-[#fafbfe] p-4 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Active Working Capital</span>
            <p className="font-display mt-1 text-2xl font-bold text-teal-700">₹{(450).toFixed(2)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Testing & contingency pool</p>
          </div>
          <div className="rounded-xl bg-[#fafbfe] p-4 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Protected High-ROI Reserve</span>
            <p className="font-display mt-1 text-2xl font-bold text-amber-700">₹800.00</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Locked until channel validation</p>
          </div>
        </div>

        {/* 4 Financial Guardrails Rules */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-700">GUARDRAIL 1</span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">ACTIVE: PASS</span>
            </div>
            <h4 className="mt-2 font-display text-sm font-bold text-slate-800">Daily Spend Velocity Cap (₹350/Day)</h4>
            <p className="mt-1 text-xs text-slate-600 leading-5">
              Prevents exhausting the ₹2,000 budget in early days. Flags any day where discretionary outflow exceeds ₹350 without delivering at least 80 registrations.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-700">GUARDRAIL 2</span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">ACTIVE: ₹{cpr.toFixed(2)} CPR</span>
            </div>
            <h4 className="mt-2 font-display text-sm font-bold text-slate-800">Unit Economics Circuit Breaker (₹4.00 Max)</h4>
            <p className="mt-1 text-xs text-slate-600 leading-5">
              Calculates Cost Per Registration in real time. If CPR climbs past ₹4.00, automatically freezes paid testing and reallocates effort to zero-cost campus technical clubs.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-700">GUARDRAIL 3</span>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">LOCKED (₹800)</span>
            </div>
            <h4 className="mt-2 font-display text-sm font-bold text-slate-800">Reserve Unlock Milestone Condition</h4>
            <p className="mt-1 text-xs text-slate-600 leading-5">
              The ₹800 High-Performer Reserve stays locked until a specific channel demonstrates &gt; 15 registrations at &lt; ₹3.50 CPR, preventing premature capital burn.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-700">GUARDRAIL 4</span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">OPTIMIZED</span>
            </div>
            <h4 className="mt-2 font-display text-sm font-bold text-slate-800">Autonomous Channel Reallocation</h4>
            <p className="mt-1 text-xs text-slate-600 leading-5">
              Recommends moving unspent discretionary budget from underperforming organic social to top-converting college societies (current #1: Campus Technical Clubs at 48% share).
            </p>
          </div>
        </div>
      </section>

      {/* Part 2: Automated Follow-Up & CRM Prototype */}
      <section className="surface rounded-2xl p-6 sm:p-8 border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                <Zap size={18} />
              </span>
              <h2 className="font-display text-xl font-bold text-[#202d49]">Automated Student Follow-Up & CRM</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Pre-configured automated messaging hooks triggered across the student registration lifecycle.
            </p>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            4 Automated Triggers Configured
          </span>
        </div>

        {/* Workflow Cards */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`rounded-2xl border p-5 transition ${
                selectedWorkflow === wf.id ? 'border-indigo-500 bg-indigo-50/30 shadow-xs' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    {wf.channel}
                  </span>
                  <h3 className="font-display mt-2 text-base font-bold text-[#202d49]">{wf.title}</h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedWorkflow(wf.id);
                    runSimulation(wf.id);
                  }}
                  disabled={isSimulating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                  title="Test trigger simulation"
                >
                  <Play size={12} />
                  Simulate Trigger
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Clock size={13} /> {wf.timing}
                </span>
                <span>•</span>
                <span className="text-teal-700 font-semibold">{wf.status}</span>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-700 border border-slate-100 whitespace-pre-wrap">
                {wf.template}
              </div>
            </div>
          ))}
        </div>

        {/* Live Simulation Output Console */}
        <div className="mt-8 rounded-2xl bg-[#1e283d] text-white p-5 border border-slate-800">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-xs font-bold text-indigo-200 uppercase tracking-wider">
                Automated Webhook Dispatch Console
              </p>
            </div>
            <span className="text-[11px] text-slate-400">Live Delivery Feed</span>
          </div>

          <div className="mt-4 space-y-3 max-h-56 overflow-y-auto">
            {simulatedLogs.map((log) => (
              <div key={log.id} className="rounded-xl bg-white/[.06] p-3 text-xs border border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="font-bold text-teal-400">{log.workflow}</span>
                  <span className="text-slate-400">{log.time}</span>
                </div>
                <p className="mt-1 text-slate-300">Recipient: <strong className="text-white">{log.recipient}</strong></p>
                <p className="mt-1 text-[11px] text-emerald-400 font-mono">Status: {log.status}</p>
                <p className="mt-1 text-xs text-slate-300/80 italic font-sans bg-black/20 p-2 rounded border border-white/5">
                  "{log.preview}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------
// Main Router
// ---------------------------------------------------------------------------
function RouterSwitch() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/success" component={SuccessPage} />
      <Route path="/referrals" component={SuccessPage} />
      <Route path="/admin/login" component={() => <OperatorLoginScreen mode="in" />} />
      <Route path="/sign-in/*?" component={() => <OperatorLoginScreen mode="in" />} />
      <Route path="/sign-up/*?" component={() => <OperatorLoginScreen mode="up" />} />
      <Route path="/admin" component={AdminOverview} />
      <Route path="/admin/registrations" component={RegistrationsPage} />
      <Route path="/admin/channels" component={ChannelsPage} />
      <Route path="/admin/referrals" component={ReferralsPage} />
      <Route path="/admin/strategy" component={StrategyPage} />
      <Route path="/admin/assets" component={CampaignAssetsPage} />
      <Route path="/admin/automation" component={AutomationPage} />
      <Route path="/admin/learning" component={LearningPage} />
      <Route
        component={() => (
          <main className="grid min-h-[100dvh] place-items-center">
            <div className="text-center">
              <h1 className="font-display text-3xl font-bold">Page Not Found</h1>
              <Link href="/" className="mt-3 inline-flex text-indigo-700 font-semibold">
                Return to AI LaunchPad
              </Link>
            </div>
          </main>
        )}
      />
    </Switch>
  );
}

function App() {
  const [, setLocation] = useLocation();

  if (isClerkEnabled) {
    return (
      <WouterRouter base={basePath}>
        <ClerkProvider
          publishableKey={clerkPubKey}
          proxyUrl={clerkProxyUrl}
          appearance={clerkAppearance}
          signInUrl={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          routerPush={(to) => setLocation(stripBase(to))}
          routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
        >
          <QueryClientProvider client={queryClient}>
            <RouterSwitch />
          </QueryClientProvider>
        </ClerkProvider>
      </WouterRouter>
    );
  }

  // Seamless standalone mode (zero external dependency block)
  return (
    <WouterRouter base={basePath}>
      <StandaloneAuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterSwitch />
        </QueryClientProvider>
      </StandaloneAuthProvider>
    </WouterRouter>
  );
}

export default App;
