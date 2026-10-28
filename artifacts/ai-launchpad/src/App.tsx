import { type ButtonHTMLAttributes, type FormEvent, type InputHTMLAttributes, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
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
  ArrowRight, ArrowUpRight, BarChart3, BookOpenText, Check,
  ChevronLeft, ChevronRight, CircleHelp, Clipboard, Download,
  Filter, GraduationCap, HandCoins, LayoutDashboard, Link2, LoaderCircle,
  LockKeyhole, LogOut, Menu, Search, Settings2, Share2, ShieldCheck, Sparkles,
  Target, Users, X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
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

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className="inline-flex items-center gap-2.5" data-testid="link-brand-home">
    <span className={`grid size-9 place-items-center rounded-xl ${light ? 'bg-white/15 text-white' : 'bg-indigo-600 text-white'}`}><Sparkles size={18} /></span>
    <span className={`font-display text-[15px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-[#202d49]'}`}>AI LaunchPad<span className="ml-1.5 font-medium text-indigo-500">by NxtWave</span></span>
  </Link>;
}

function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(76,79,194,.7)] transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 ${className}`}>{children}</button>;
}

function ShellLink({ href, children, active }: { href: string; children: ReactNode; active?: boolean }) {
  return <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-indigo-50 hover:text-indigo-700 ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}>{children}</Link>;
}

function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block space-y-1.5 text-sm font-semibold text-slate-700">{label}<input {...props} className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 ${props.className || ''}`} /></label>;
}

function SelectField({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-semibold text-slate-700">{label}<select {...props} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">{children}</select></label>;
}

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Users }) {
  return <article className="surface rounded-2xl p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={17} /></span></div><p className="mt-4 font-display text-3xl font-bold tracking-tight text-[#202d49]">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</article>;
}

function LoadingPanel() {
  return <div className="surface space-y-4 rounded-2xl p-6" aria-label="Loading"><div className="h-4 w-1/4 animate-pulse rounded bg-slate-100" /><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" /></div>;
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  const { user } = useUser();
  return <div className="surface rounded-2xl p-8 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><CircleHelp size={21} /></div><h3 className="mt-4 font-display text-lg font-bold">We couldn’t load this view</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">The request may have failed or you may not have access. If you are signed in and this is an admin view, a 403 means your account is not authorized for campaign operations.</p>{user && <div className="mx-auto mt-5 max-w-md rounded-xl bg-slate-50 p-4 text-left"><p className="text-xs font-bold text-slate-700">Administrator setup</p><p className="mt-1 text-xs leading-5 text-slate-500">Add this Clerk user ID to the AI_LAUNCHPAD_ADMIN_USER_IDS secret to authorize this account.</p><code className="mt-2 block break-all rounded-lg bg-white p-2 text-xs text-slate-700">{user.id}</code></div>}<button onClick={onRetry} className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50" data-testid="button-retry">Try again</button></div>;
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

function Landing() {
  const recordEvent = useRecordCampaignEvent();
  useEffect(() => {
    const attribution = rememberAttribution();
    recordEvent.mutate({ data: { eventType: 'landing_view', visitorId: visitorId(), page: '/', source: attribution.source, medium: attribution.medium, campaign: attribution.campaign } });
  // only record a view when the route is entered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toRegister = () => {
    rememberAttribution();
  };
  return <main className="min-h-[100dvh] bg-[#f8f9fd]">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Logo /><div className="flex items-center gap-3"><Link href="/sign-in" className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white sm:inline-flex" data-testid="link-admin-sign-in">Operator sign in</Link><Link href="/register" onClick={toRegister} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700" data-testid="link-header-register">Save my place</Link></div></header>
    <section className="hero-wash soft-grid relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pt-20">
        <div className="reveal relative z-10"><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/75 px-3.5 py-2 text-xs font-bold uppercase tracking-[.13em] text-indigo-700"><span className="size-1.5 rounded-full bg-teal-500" />A free, practical AI workshop · 60 minutes</div>
          <h1 className="font-display max-w-3xl text-[clamp(3.1rem,7vw,6.2rem)] font-extrabold leading-[.99] tracking-[-.065em] text-[#1e2b48]">Don’t just use AI.<br /><span className="text-indigo-600">Build with it.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">A focused first step for final-year engineering students curious about turning AI ideas into working projects.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/register" onClick={toRegister} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(76,79,194,.8)] transition hover:-translate-y-0.5 hover:bg-indigo-700" data-testid="link-register-primary">Register for the free workshop <ArrowRight size={17} /></Link><a href="#what-youll-make" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-slate-200 bg-white/70 px-6 text-sm font-semibold text-slate-700 transition hover:bg-white" data-testid="link-workshop-details">See what you’ll explore</a></div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><Check size={16} className="text-teal-600" />No prior AI experience needed</span><span className="inline-flex items-center gap-2"><Check size={16} className="text-teal-600" />Built for engineering students</span></div>
        </div>
        <div className="reveal-delay relative mx-auto w-full max-w-[550px]">
          <div className="absolute -inset-8 rounded-[40%] bg-gradient-to-br from-indigo-200/50 via-transparent to-teal-100/60 blur-2xl" />
          <div className="surface relative rounded-[28px] bg-white/85 p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">From question</p><p className="mt-1 font-display text-lg font-bold">“Could AI help here?”</p></div><span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700">01 → 03</span></div>
            <div className="relative my-7 space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-[#fbfcff] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e9edff] text-indigo-600"><Sparkles size={20} /></span><div><p className="text-sm font-bold text-slate-800">Start with a real problem</p><p className="mt-1 text-xs text-slate-500">Find a small, useful place to begin</p></div></div>
              <div className="ml-6 h-5 border-l-2 border-dashed border-indigo-200" />
              <div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/75 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-600"><GraduationCap size={20} /></span><div><p className="text-sm font-bold text-slate-800">Make an AI-powered prototype</p><p className="mt-1 text-xs text-slate-500">Understand the building blocks, hands-on</p></div></div>
              <div className="ml-6 h-5 border-l-2 border-dashed border-teal-200" />
              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-[#f5fbfa] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#dcf2ed] text-teal-700"><ArrowUpRight size={20} /></span><div><p className="text-sm font-bold text-slate-800">Leave with a next step</p><p className="mt-1 text-xs text-slate-500">A project direction worth exploring further</p></div></div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#f5f6fa] px-4 py-3"><span className="text-xs font-semibold text-slate-500">One hour. A tangible starting point.</span><span className="font-mono text-xs text-indigo-600">AI / BUILD</span></div>
          </div>
          <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-lg sm:block"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Designed for</p><p className="mt-1 text-sm font-bold text-[#263552]">Final-year engineers</p></div>
        </div>
      </div>
    </section>
    <section id="what-youll-make" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:gap-20"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">A practical first hour</p><h2 className="font-display mt-4 text-4xl font-bold leading-tight tracking-[-.04em] text-[#202d49] sm:text-5xl">Less hype.<br />More “I made this.”</h2><p className="mt-5 max-w-md leading-7 text-slate-600">You’ll get a guided introduction to the way AI products come together: from a useful prompt to a small, testable build.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[['01','Choose a useful problem','Look for a task where a small AI feature can make a meaningful difference.'],['02','Understand the AI loop','See how a model, instructions, and a simple interface work together.'],['03','Try a build workflow','Explore a practical path from an idea to an early prototype.'],['04','Plan your next experiment','Leave with a clear direction you can personalize and keep building.']].map(([n,t,d])=><article key={n} className="rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"><span className="font-mono text-xs font-bold text-indigo-500">{n} / 04</span><h3 className="mt-4 font-display text-lg font-bold text-[#25324d]">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{d}</p></article>)}
        </div></div>
    </section>
    <section className="border-y border-[#e8ebf4] bg-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-teal-700">The right place to start</p><h2 className="font-display mt-4 max-w-2xl text-3xl font-bold tracking-[-.035em] text-[#202d49] sm:text-4xl">Built for the moment you’re ready to move from curiosity to capability.</h2></div><div className="max-w-sm rounded-2xl bg-[#f5f7fc] p-5"><p className="text-sm font-semibold leading-6 text-slate-600">For final-year engineering students. No prior AI experience required. Registration is free.</p><Link href="/register" onClick={toRegister} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-indigo-700" data-testid="link-register-secondary">Take your first step <ArrowRight size={16} /></Link></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"><div className="grid gap-12 lg:grid-cols-2 lg:items-center">
      <div className="surface overflow-hidden rounded-3xl p-7 text-white shadow-xl sm:p-10" style={{ backgroundColor: '#202d49' }}><div className="mb-8 flex items-center justify-between"><span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-indigo-100">60-minute workshop</span><span className="font-mono text-xs text-indigo-200">YOUR FIRST BUILD</span></div><h2 className="font-display max-w-lg text-4xl font-bold leading-tight tracking-[-.04em]">A small step can change how you see AI.</h2><p className="mt-4 max-w-md text-sm leading-7 text-indigo-100/80">Come with curiosity. Leave knowing how to approach a practical AI project, and what to try next.</p><Link href="/register" onClick={toRegister} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#202d49] transition hover:bg-indigo-50" data-testid="link-register-panel">I’m ready to explore <ArrowRight size={16} /></Link></div>
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Straightforward by design</p><h2 className="font-display mt-4 text-4xl font-bold tracking-[-.04em] text-[#202d49]">What to expect</h2><div className="mt-7 divide-y divide-slate-200">{[['A real introduction','Practical context instead of big promises.'],['A welcoming room','A first step made for students, not AI specialists.'],['Your own next move','Ideas you can take further in your own way.']].map(([a,b])=><div className="flex gap-4 py-5" key={a}><Check className="mt-1 shrink-0 text-teal-600" size={18} /><div><h3 className="font-semibold text-slate-800">{a}</h3><p className="mt-1 text-sm text-slate-500">{b}</p></div></div>)}</div></div>
    </div></section>
    <section className="px-5 pb-20 sm:px-8 sm:pb-28"><div className="mx-auto max-w-7xl rounded-[28px] border border-indigo-100 bg-gradient-to-r from-[#f1f2ff] via-[#f7f9ff] to-[#eef8f8] px-6 py-12 text-center sm:px-14 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-700">Your next chapter starts with a first step</p><h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-[-.04em] text-[#202d49] sm:text-5xl">Make the next hour count.</h2><p className="mx-auto mt-4 max-w-xl text-slate-600">Register for the proposed free 60-minute AI workshop. We’ll share the details when they’re confirmed.</p><Link href="/register" onClick={toRegister} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 font-bold text-white transition hover:bg-indigo-700" data-testid="link-register-final">Register your interest <ArrowRight size={17} /></Link><p className="mt-4 text-xs text-slate-500">Free to register · No workshop date has been announced yet</p></div></section>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1fr]">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">A few useful details</p><h2 className="font-display mt-3 text-3xl font-bold tracking-[-.04em] text-[#202d49]">Questions, answered.</h2>
        <div className="mt-6 divide-y divide-slate-200">{[
          ['When is the workshop?', 'The date and time have not been confirmed. Register your interest and details will be shared when they are ready.'],
          ['Do I need AI experience?', 'No. The proposed workshop is designed as a practical first step for engineering students.'],
          ['Is registration free?', 'Yes. There is no registration fee.'],
          ['What will I build?', 'The session is planned around a small, guided AI project. The exact project will be confirmed before the workshop.'],
        ].map(([question, answer]) => <details className="group py-4" key={question}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-800">{question}<span className="text-indigo-600 transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{answer}</p></details>)}</div>
      </div>
      <aside className="surface self-start rounded-2xl p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#202d49]">Your information</h2><p className="mt-3 text-sm leading-6 text-slate-600">We ask for your name, email, college, graduation year, and branch to manage the workshop registration. Your record is not published or listed for other visitors. Workshop updates are optional and the preference is stored with your registration.</p><p className="mt-3 text-sm leading-6 text-slate-600">Campaign analytics use a random browser identifier and source tags to count visits and form starts. They do not include your name or email.</p></aside>
    </section>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Logo /><p>A practical first step into AI building.</p><span>© NxtWave</span></div></footer>
  </main>;
}

function RegisterPage() {
  const createRegistration = useCreateRegistration();
  const recordEvent = useRecordCampaignEvent();
  const [, setLocation] = useLocation();
  const [values, setValues] = useState({ fullName: '', email: '', college: '', graduationYear: '', branch: '', referralCode: new URLSearchParams(window.location.search).get('ref') || '', communicationsConsent: false });
  const [formError, setFormError] = useState('');
  const update = (key: keyof typeof values, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));
  useEffect(() => {
    const attribution = rememberAttribution();
    recordEvent.mutate({ data: { eventType: 'form_start', visitorId: visitorId(), page: '/register', source: attribution.source, medium: attribution.medium, campaign: attribution.campaign } });
  // The event table deduplicates visitors and event types.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
    const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!values.fullName.trim() || !values.email.trim() || !values.college.trim() || !values.branch.trim() || !values.graduationYear) {
      setFormError('Complete each field so we can save your registration.'); return;
    }
    const attribution = rememberAttribution();
    const input: RegistrationInput = {
      fullName: values.fullName.trim(), email: values.email.trim(), college: values.college.trim(), branch: values.branch.trim(),
      graduationYear: Number(values.graduationYear), communicationsConsent: values.communicationsConsent,
      referralCode: attribution.referralCode || values.referralCode.trim() || undefined, visitorId: visitorId(),
      source: attribution.source, medium: attribution.medium, campaign: attribution.campaign,
    };
    createRegistration.mutate({ data: input }, { onSuccess: receipt => { sessionStorage.setItem('launchpad-receipt', JSON.stringify(receipt)); sessionStorage.removeItem('launchpad-attribution'); setLocation('/success'); }, onError: error => { const apiError = error as { data?: { error?: string } }; setFormError(apiError.data?.error || 'We could not complete your registration. Please check your details and try again.'); } });
  };
  return <main className="min-h-[100dvh] bg-[#f8f9fd]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Logo /><Link href="/" className="text-sm font-semibold text-slate-500 hover:text-indigo-700" data-testid="link-back-home">Back to workshop</Link></header>
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-16 lg:pt-14">
      <div className="pt-3"><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Your first step</p><h1 className="font-display mt-4 text-4xl font-extrabold tracking-[-.05em] text-[#202d49] sm:text-5xl">Save your place.</h1><p className="mt-5 max-w-md leading-7 text-slate-600">Tell us a little about yourself. We’ll share confirmed workshop details when they’re ready.</p><div className="surface mt-8 rounded-2xl p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><GraduationCap size={19} /></span><div><p className="font-semibold text-slate-800">Free · 60 minutes</p><p className="mt-1 text-sm leading-6 text-slate-500">A practical introduction for final-year engineering students. Date and speaker details are not yet announced.</p></div></div></div></div>
      <form onSubmit={submit} className="surface rounded-3xl p-5 sm:p-8">
        <div className="mb-6"><h2 className="font-display text-xl font-bold text-[#202d49]">Registration details</h2><p className="mt-1 text-sm text-slate-500">Fields marked below are required.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required autoComplete="name" placeholder="Your name" value={values.fullName} onChange={e => update('fullName', e.target.value)} data-testid="input-full-name" />
          <Field label="Email address" required type="email" autoComplete="email" placeholder="you@college.edu" value={values.email} onChange={e => update('email', e.target.value)} data-testid="input-email" />
          <Field label="College or university" required placeholder="Institution name" value={values.college} onChange={e => update('college', e.target.value)} data-testid="input-college" />
          <SelectField label="Graduation year" required value={values.graduationYear} onChange={e => update('graduationYear', e.target.value)} data-testid="select-graduation-year"><option value="">Select year</option>{[2026,2027,2028,2029,2030,2031,2032,2033,2034,2035].map(y=><option key={y} value={y}>{y}</option>)}</SelectField>
          <Field label="Branch / specialization" required placeholder="e.g. Computer Science" value={values.branch} onChange={e => update('branch', e.target.value)} className="sm:col-span-2" data-testid="input-branch" />
          <Field label="Referral code (optional)" placeholder="Enter a friend’s code" value={values.referralCode} onChange={e => update('referralCode', e.target.value)} className="sm:col-span-2" data-testid="input-referral-code" />
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3.5 text-sm leading-6 text-slate-600"><input type="checkbox" checked={values.communicationsConsent} onChange={e => update('communicationsConsent', e.target.checked)} className="mt-1 size-4 accent-indigo-600" data-testid="checkbox-consent" /><span>Optional: Send me updates about this workshop and related learning opportunities.</span></label>
        {formError && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert" data-testid="text-form-error">{formError}</p>}
        <Button type="submit" disabled={createRegistration.isPending} className="mt-6 w-full" data-testid="button-submit-registration">{createRegistration.isPending ? <><LoaderCircle size={17} className="animate-spin" />Saving your registration</> : <>Register for free <ArrowRight size={17} /></>}</Button>
        <p className="mt-4 text-center text-xs leading-5 text-slate-400">Your details are used to manage workshop registration and updates.</p>
      </form>
    </div>
  </main>;
}

function SuccessPage() {
  const receipt = useMemo(() => { try { return JSON.parse(sessionStorage.getItem('launchpad-receipt') || 'null') as { referralCode: string; referralUrl: string } | null; } catch { return null; } }, []);
  const referral = useGetReferralSummary(receipt?.referralCode || '', { query: { enabled: Boolean(receipt?.referralCode), queryKey: ['/api/referrals', receipt?.referralCode || ''] } });
  const [copied, setCopied] = useState(false);
  const shareUrl = referral.data?.shareUrl || receipt?.referralUrl || '';
  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return <main className="hero-wash soft-grid flex min-h-[100dvh] items-center justify-center px-5 py-12"><section className="surface w-full max-w-xl rounded-3xl p-6 text-center sm:p-10"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-700"><Check size={29} /></div><p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-teal-700">Registration received</p><h1 className="font-display mt-3 text-4xl font-extrabold tracking-[-.045em] text-[#202d49]">You’re on your way.</h1><p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">Thanks for registering. We’ll share more once the workshop details are confirmed.</p><div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 text-left"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-indigo-600"><Share2 size={19} /></span><div><h2 className="font-semibold text-slate-800">Invite a classmate</h2><p className="mt-1 text-xs text-slate-500">Share your personal link with someone who might build along.</p></div></div>{shareUrl && <div className="mt-4 flex gap-2"><input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-lg border border-indigo-100 bg-white px-3 py-2.5 text-xs text-slate-600" aria-label="Personal referral link" data-testid="input-referral-link" /><button onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700" data-testid="button-copy-link">{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? 'Copied' : 'Copy'}</button></div>}{referral.isLoading && <div className="mt-3 h-4 w-40 animate-pulse rounded bg-indigo-100" />}{referral.isError && <p className="mt-3 text-xs text-slate-500">Your share link is ready; referral activity will appear when available.</p>}{referral.data?.valid && <p className="mt-3 text-xs text-slate-500">Successful registrations from your link: {referral.data.successfulRegistrations}</p>}</div><Link href="/" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700" data-testid="link-return-workshop">Back to the workshop <ArrowRight size={16} /></Link></section></main>;
}

function AuthScreen({ mode }: { mode: 'in' | 'up' }) {
  return <main className="hero-wash soft-grid flex min-h-[100dvh] flex-col items-center justify-center gap-7 px-4 py-10"><Logo /><p className="max-w-md text-center text-sm text-slate-600">{mode === 'in' ? 'Operator access to campaign performance and controls.' : 'Create an account to continue.'}</p><div className="w-full max-w-[440px]">{mode === 'in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div></main>;
}

function AdminFrame({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const paths = [
    ['/admin', 'Overview', LayoutDashboard],
    ['/admin/registrations', 'Registrations', Users],
    ['/admin/channels', 'Channels', BarChart3],
    ['/admin/referrals', 'Referrals', Link2],
    ['/admin/strategy', 'Strategy & budget', Target],
    ['/admin/assets', 'Campaign assets', Clipboard],
    ['/admin/learning', 'Learning notes', BookOpenText],
  ] as const;
  return <div className="min-h-[100dvh] bg-[#f6f7fb] md:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col bg-[#202d49] px-4 py-5 transition-transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2"><Logo light /><button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white md:hidden" aria-label="Close navigation"><X size={18} /></button></div>
      <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-indigo-200/60">Growth control room</div>
      <nav className="mt-3 space-y-1">{paths.map(([href, label, Icon]) => <ShellLink key={href} href={href} active={location === href}><Icon size={17} />{label}</ShellLink>)}</nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.06] p-4"><p className="text-xs font-semibold text-white">Progress, not assumptions.</p><p className="mt-1 text-xs leading-5 text-indigo-100/60">Targets stay targets. Only recorded activity counts as results.</p></div>
      <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-indigo-100/75 transition hover:bg-white/10 hover:text-white" data-testid="button-sign-out"><LogOut size={17} />Sign out</button>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/30 md:hidden" aria-label="Close menu backdrop" onClick={() => setMobileOpen(false)} />}
       <main className="min-w-0 flex-1 md:ml-[258px]"><header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Open navigation"><Menu size={19} /></button><div><p className="font-display text-sm font-bold text-[#202d49]">NxtWave Growth Engine</p><p className="text-[11px] text-slate-500">Campaign operations</p></div></div><div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"><ShieldCheck size={14} className="text-teal-600" />Session verified</div></header><div className="mx-auto max-w-[1400px] p-4 sm:p-7 lg:p-9">{children}</div></main>
  </div>;
}

function AdminGate({ children }: { children: ReactNode }) {
  return <><Show when="signed-in"><AdminFrame>{children}</AdminFrame></Show><Show when="signed-out"><main className="hero-wash flex min-h-[100dvh] items-center justify-center px-5"><div className="surface max-w-md rounded-3xl p-8 text-center"><div className="mx-auto grid size-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><LockKeyhole size={21} /></div><h1 className="font-display mt-5 text-2xl font-bold">Operator access</h1><p className="mt-2 text-sm leading-6 text-slate-500">Sign in to view campaign operations. Admin endpoints also verify authorization; a signed-in account may still be denied access.</p><Link href="/sign-in" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white" data-testid="link-admin-sign-in-gate">Continue to sign in</Link></div></main></Show></>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-600">{eyebrow}</p><h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-.045em] text-[#202d49]">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div>{action}</div>;
}

function AdminOverview() {
  const q = useGetAdminSummary();
  if (q.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (q.isError || !q.data) return <AdminGate><QueryError onRetry={() => q.refetch()} /></AdminGate>;
  const d = q.data;
  const maxDaily = Math.max(...d.daily.map(x => x.registrations), 1);
  const currency = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  return <AdminGate><PageHeading eyebrow="Campaign pulse" title="Overview" description="A live view of recorded progress against the campaign plan." action={<div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600">Plan: {d.campaign.durationDays} days · Target {d.campaign.target.toLocaleString()} registrations</div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Registrations recorded" value={d.registrations.toLocaleString()} hint={`${d.remaining.toLocaleString()} remaining to target`} icon={Users} /><StatCard label="Target progress" value={`${d.targetPercent.toFixed(1)}%`} hint={`${d.target.toLocaleString()} planned registrations`} icon={Target} /><StatCard label="Referral registrations" value={d.referrals.toLocaleString()} hint="Recorded successful referrals" icon={Link2} /><StatCard label="Actual spend" value={currency(d.actualSpendPaise)} hint={`Budget assumption ${currency(d.budgetPaise)}`} icon={HandCoins} /></div>
    <section className="surface mt-5 rounded-2xl p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Target size={17} /></span><div><h2 className="font-display font-bold text-[#202d49]">Action center</h2><p className="mt-1 text-xs text-slate-500">Next steps based on recorded activity and the campaign plan.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{[
      d.registrations === 0 ? ['Start with one approved channel', 'No registrations are recorded yet. Confirm the workshop details, then share a tagged draft from Campaign assets.'] : ['Review the strongest source', 'Compare attributed registrations and referrals before repeating or expanding a channel.'],
      d.actualSpendPaise === 0 ? ['Keep spend at zero until approved', 'No actual spend is recorded. Choose and approve a small test before entering an expense.'] : ['Check spend against plan', `Recorded spend is ${currency(d.actualSpendPaise)} against a planned ${currency(d.budgetPaise)}.`],
      !d.funnel.trackingComplete ? ['Verify the funnel instrumentation', 'Unique visits or form starts are not available yet, so conversion performance cannot be assessed.'] : ['Use measured funnel signals', `${d.funnel.uniqueVisitors.toLocaleString()} unique visitors and ${d.funnel.formStarts.toLocaleString()} form starts are recorded; compare them with completed registrations.`],
    ].map(([title, body]) => <article key={title} className="rounded-xl bg-[#f7f8fc] p-4"><h3 className="text-sm font-semibold text-slate-800">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{body}</p></article>)}</div></section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
      <section className="surface rounded-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-display text-lg font-bold text-[#202d49]">Daily registrations</h2><p className="mt-1 text-xs text-slate-500">Measured daily activity · no projected values</p></div><span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700">{d.daysRemaining ?? '—'} days left</span></div>
        {d.daily.length ? <div className="mt-7 flex h-52 items-end gap-2 overflow-x-auto border-b border-slate-100 pb-2">{d.daily.map((item, i) => <div key={`${item.date}-${i}`} className="group flex min-w-8 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-semibold text-slate-500">{item.registrations}</span><div className="w-full max-w-10 rounded-t-md bg-indigo-500 transition hover:bg-indigo-700" style={{ height: `${Math.max(4, item.registrations / maxDaily * 145)}px` }} /><span className="text-[9px] text-slate-400">{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>)}</div> : <div className="mt-7 rounded-xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">No registrations recorded yet.</div>}
      </section>
      <section className="surface rounded-2xl p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#202d49]">What is measured</h2><div className="mt-5 space-y-4">{[['Unique visitors', d.funnel.uniqueVisitors],['Form starts',d.funnel.formStarts],['Completed registrations',d.funnel.registrations]].map(([label,value])=><div key={label} className="flex justify-between border-b border-slate-100 pb-3 text-sm"><span className="text-slate-500">{label}</span><strong className="text-slate-800">{Number(value).toLocaleString()}</strong></div>)}</div>
        <div className="rounded-xl bg-[#f5f6fb] p-3"><p className="text-xs font-semibold text-slate-700">Conversion rate</p><p className="mt-1 font-display text-2xl font-bold text-indigo-700">{d.funnel.conversionRate == null ? 'Not available' : `${d.funnel.conversionRate.toFixed(1)}%`}</p><p className="mt-1 text-[11px] text-slate-500">Tracking {d.funnel.trackingComplete ? 'complete' : 'incomplete'} · reporting based on recorded events</p></div>
      </section>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3">{[['Top sources',d.sources],['Colleges represented',d.colleges],['Graduation years',d.graduationYears]].map(([title,rows])=><section key={String(title)} className="surface rounded-2xl p-5"><h3 className="font-display font-bold text-[#202d49]">{String(title)}</h3>{(rows as {label:string;registrations:number}[]).length ? <div className="mt-4 space-y-3">{(rows as {label:string;registrations:number}[]).slice(0,5).map(row=><div key={row.label} className="flex justify-between gap-4 text-sm"><span className="truncate text-slate-500">{row.label}</span><span className="font-semibold text-slate-700">{row.registrations}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-400">No measured activity yet.</p>}</section>)}</div>
    <p className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs leading-5 text-indigo-900"><strong>Plan vs. result:</strong> the {d.campaign.target.toLocaleString()}-registration, {d.campaign.durationDays}-day, {currency(d.campaign.budgetPaise)} objective is a target assumption—not a forecast or measured outcome. Results above come from campaign records.</p>
  </AdminGate>;
}

function RegistrationsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exportReady, setExportReady] = useState(false);
  const params = useMemo(() => ({ page, pageSize: 20, search: search.trim() || undefined }), [page, search]);
  const q = useListAdminRegistrations(params);
  const exportParams = useMemo(() => ({}), []);
  const exportQ = useExportAdminRegistrations(exportParams, { query: { enabled: exportReady, queryKey: getExportAdminRegistrationsQueryKey(exportParams) } });
  useEffect(() => {
    if (!exportReady || typeof exportQ.data !== 'string') return;
    const href = URL.createObjectURL(new Blob([exportQ.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = 'registrations.csv';
    a.click();
    URL.revokeObjectURL(href);
    setExportReady(false);
  }, [exportReady, exportQ.data]);
  useEffect(() => {
    if (exportReady && exportQ.isError) setExportReady(false);
  }, [exportReady, exportQ.isError]);
  return <AdminGate><PageHeading eyebrow="People" title="Registrations" description="Search and review the private registration records." action={<button onClick={() => setExportReady(true)} disabled={exportReady || exportQ.isLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" data-testid="button-export"><Download size={16} />{exportReady && exportQ.isLoading ? 'Preparing…' : 'Export CSV'}</button>} />
    <div className="surface rounded-2xl"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><label className="relative block w-full sm:max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => {setSearch(e.target.value);setPage(1);}} placeholder="Search name, email, college…" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" data-testid="input-search-registrations" /></label><span className="text-xs text-slate-500">{q.data?.total ?? '—'} records</span></div>{exportQ.isError && <p className="border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-xs text-rose-700" role="alert">CSV export failed. Confirm operator access and try again.</p>}
    {q.isLoading ? <div className="p-5"><LoadingPanel /></div> : q.isError ? <div className="p-5"><QueryError onRetry={() => q.refetch()} /></div> : q.data?.records.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#fafbfe] text-[11px] uppercase tracking-wide text-slate-400"><tr>{['Student','College & branch','Year','Source','Registered'].map(col=><th className="px-5 py-3 font-semibold" key={col}>{col}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{q.data.records.map(row=><tr key={row.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{row.fullName}</p><p className="mt-1 text-xs text-slate-500">{row.email}</p></td><td className="px-5 py-4"><p className="max-w-[230px] truncate text-slate-700">{row.college}</p><p className="mt-1 text-xs text-slate-500">{row.branch}</p></td><td className="px-5 py-4 text-slate-600">{row.graduationYear}</td><td className="px-5 py-4 text-slate-600">{row.source || '—'}</td><td className="px-5 py-4 text-slate-500">{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><span className="text-xs text-slate-500">Page {q.data.page} · {q.data.pageSize} per page</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(p => Math.max(1,p-1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} /></button><button disabled={page * (q.data.pageSize || 20) >= q.data.total} onClick={() => setPage(p => p+1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} /></button></div></div></> : <div className="px-6 py-16 text-center"><Users className="mx-auto text-slate-300" size={26} /><h3 className="mt-4 font-semibold text-slate-700">No matching registrations</h3><p className="mt-1 text-sm text-slate-500">{search ? 'Try a different name, email, or college.' : 'New registrations will appear here when they are received.'}</p></div>}</div>
  </AdminGate>;
}

function ChannelsPage() {
  const q = useGetAdminSummary();
  if (q.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (q.isError || !q.data) return <AdminGate><QueryError onRetry={() => q.refetch()} /></AdminGate>;
  const total = q.data.sources.reduce((sum, s) => sum + s.registrations, 0);
  return <AdminGate><PageHeading eyebrow="Acquisition" title="Channels" description="Compare sources using registrations actually attributed to them." />
    <div className="surface rounded-2xl p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-[#202d49]">Source performance</h2><p className="mt-1 text-xs text-slate-500">A source not present in the data is not assumed to have delivered results.</p></div><Filter size={18} className="text-slate-400" /></div>
    {q.data.sources.length ? <div className="space-y-5">{q.data.sources.map((s, i) => <div key={s.label}><div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-indigo-50 font-mono text-xs font-bold text-indigo-600">{String(i+1).padStart(2,'0')}</span><span className="font-semibold text-slate-700">{s.label}</span></div><span className="text-sm font-bold text-slate-800">{s.registrations} <span className="font-normal text-slate-400">registrations</span></span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${total ? s.registrations/total*100 : 0}%` }} /></div></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center"><BarChart3 className="mx-auto text-slate-300" size={28} /><h3 className="mt-3 font-semibold text-slate-700">No source results yet</h3><p className="mt-1 text-sm text-slate-500">Source performance will appear once attributed registrations are recorded.</p></div>}
    </div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="surface rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Measured registrations</p><p className="font-display mt-2 text-3xl font-bold text-[#202d49]">{total}</p><p className="mt-1 text-xs text-slate-500">Sum of registrations attributed to known sources.</p></div><div className="surface rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cost per registration</p><p className="font-display mt-2 text-3xl font-bold text-[#202d49]">{q.data.costPerRegistrationPaise == null ? '—' : `₹${(q.data.costPerRegistrationPaise / 100).toFixed(2)}`}</p><p className="mt-1 text-xs text-slate-500">Calculated only from actual recorded spend and registrations.</p></div></div>
  </AdminGate>;
}

function ReferralsPage() {
  const q = useGetAdminReferrals();
  if (q.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (q.isError || !q.data) return <AdminGate><QueryError onRetry={() => q.refetch()} /></AdminGate>;
  const d = q.data;
  return <AdminGate><PageHeading eyebrow="Peer sharing" title="Referrals" description="Aggregate referral performance from successful registrations." />
    <div className="grid gap-4 sm:grid-cols-2"><StatCard label="Successful referrals" value={d.totalReferrals.toLocaleString()} hint="Recorded referral registrations" icon={Link2} /><StatCard label="Share of registrations" value={`${d.shareOfRegistrations.toFixed(1)}%`} hint="Measured share of completed registrations" icon={Share2} /></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]"><section className="surface rounded-2xl p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#202d49]">Top referral codes</h2><p className="mt-1 text-xs text-slate-500">Ranked by successful registrations, not link visits.</p>{d.topCodes.length ? <div className="mt-5 divide-y divide-slate-100">{d.topCodes.map((r,i)=><div key={r.code} className="flex items-center justify-between py-3"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-indigo-50 font-mono text-xs font-bold text-indigo-600">{i+1}</span><code className="text-sm font-semibold text-slate-700">{r.code}</code></div><span className="text-sm font-bold text-slate-800">{r.successfulRegistrations}</span></div>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">No successful referral registrations yet.</div>}</section>
      <section className="surface rounded-2xl p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#202d49]">Referral activity</h2><p className="mt-1 text-xs text-slate-500">Daily successful referral registrations.</p>{d.daily.length ? <div className="mt-6 space-y-3">{d.daily.map(day=><div key={day.date} className="flex items-center gap-3"><span className="w-24 text-xs text-slate-500">{new Date(day.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-500" style={{width:`${Math.max(5,day.registrations/(Math.max(...d.daily.map(x=>x.registrations),1))*100)}%`}} /></div><span className="w-8 text-right text-xs font-bold text-slate-700">{day.registrations}</span></div>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">Referral activity is empty so far.</div>}</section></div>
  </AdminGate>;
}

function StrategyPage() {
  const configQ = useGetAdminConfig();
  const spendQ = useListAdminSpend();
  const summaryQ = useGetAdminSummary();
  const updateConfig = useUpdateAdminConfig();
  const createSpend = useCreateAdminSpend();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<CampaignConfig | null>(null);
  const [spendForm, setSpendForm] = useState({ amount: '', channel: '', note: '', spentAt: new Date().toISOString().slice(0,10) });
  useEffect(() => { if (configQ.data) setDraft(configQ.data); }, [configQ.data]);
  if (configQ.isLoading || spendQ.isLoading || summaryQ.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (configQ.isError || spendQ.isError || summaryQ.isError || !configQ.data || !summaryQ.data) return <AdminGate><QueryError onRetry={() => {configQ.refetch();spendQ.refetch();summaryQ.refetch();}} /></AdminGate>;
  const d = draft || configQ.data;
  const saveConfig = (e: FormEvent) => { e.preventDefault(); updateConfig.mutate({ data: { ...d, target: Number(d.target), durationDays: Number(d.durationDays), budgetPaise: Number(d.budgetPaise) } }, { onSuccess: () => cache.invalidateQueries({ queryKey: ['/api/admin/config'] }) }); };
  const submitSpend = (e: FormEvent) => { e.preventDefault(); createSpend.mutate({ data: { amountPaise: Math.round(Number(spendForm.amount)*100), channel: spendForm.channel, note: spendForm.note || undefined, spentAt: new Date(`${spendForm.spentAt}T12:00:00`).toISOString() } }, { onSuccess: () => { cache.invalidateQueries({ queryKey: ['/api/admin/spend'] }); cache.invalidateQueries({ queryKey: ['/api/admin/summary'] }); setSpendForm({amount:'',channel:'',note:'',spentAt:new Date().toISOString().slice(0,10)}); } }); };
  const budgetRs = d.budgetPaise / 100;
  return <AdminGate><PageHeading eyebrow="Plan & assumptions" title="Strategy and budget" description="Edit campaign assumptions and record real campaign expenditure." />
    <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
      <form onSubmit={saveConfig} className="surface rounded-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-display text-lg font-bold text-[#202d49]">Campaign plan</h2><p className="mt-1 text-xs text-slate-500">Planning assumptions are never displayed as campaign results.</p></div><Settings2 size={18} className="text-slate-400" /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Campaign name" value={d.campaignName} onChange={e=>setDraft({...d,campaignName:e.target.value})} required /><Field label="Registration target" type="number" min={1} value={d.target} onChange={e=>setDraft({...d,target:Number(e.target.value)})} required /><Field label="Duration (days)" type="number" min={1} max={60} value={d.durationDays} onChange={e=>setDraft({...d,durationDays:Number(e.target.value)})} required /><Field label="Budget (₹)" type="number" min={0} step="1" value={budgetRs} onChange={e=>setDraft({...d,budgetPaise:Math.round(Number(e.target.value)*100)})} required /><Field label="Start date" type="date" value={d.startDate || ''} onChange={e=>setDraft({...d,startDate:e.target.value || null})} className="sm:col-span-2" /></div>{updateConfig.isError && <p className="mt-4 text-sm text-rose-600">Could not save campaign assumptions. Check authorization and try again.</p>}{updateConfig.isSuccess && <p className="mt-4 text-sm text-teal-700">Plan assumptions saved.</p>}<Button type="submit" disabled={updateConfig.isPending} className="mt-5" data-testid="button-save-plan">{updateConfig.isPending ? 'Saving…' : 'Save plan assumptions'}</Button></form>
       <section className="surface rounded-2xl p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#202d49]">Seven-day working plan</h2><p className="mt-1 text-xs leading-5 text-slate-500">Suggested sequence only. Adjust after reviewing measured response; these are not predicted outcomes.</p><div className="mt-5 space-y-2">{[['Day 1','Confirm registration flow, privacy copy, tracking, and the workshop facts that are approved to publish.'],['Day 2','Prepare student-club outreach and source-tagged links; ask campus contacts for permission before sharing.'],['Day 3','Share a concise invitation in approved student communities; review attributed visits and form starts.'],['Day 4','Send permission-based email and club follow-ups; note questions students actually ask.'],['Day 5','Review recorded registrations and source quality; adjust copy only where there is a clear signal.'],['Day 6','Invite registrants to share their personal referral links; check for duplicate or suspicious activity.'],['Day 7','Compare actual registrations and spend with the plan; document learnings and next steps.']].map(([day,task])=><div key={day} className="flex gap-3 rounded-xl bg-[#f7f8fc] p-3.5"><span className="mt-0.5 w-12 shrink-0 font-mono text-xs font-bold text-indigo-600">{day}</span><p className="text-xs leading-5 text-slate-600">{task}</p></div>)}</div><div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900"><strong>Budget discipline:</strong> ₹{(summaryQ.data.budgetPaise/100).toLocaleString('en-IN')} is the plan budget; ₹{(summaryQ.data.actualSpendPaise/100).toLocaleString('en-IN')} is the recorded spend so far.</div></section>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <form onSubmit={submitSpend} className="surface rounded-2xl p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-[#202d49]">Record actual spend</h2><p className="mt-1 text-xs text-slate-500">Enter an expense already incurred. No amount is prefilled.</p><div className="mt-5 space-y-4"><Field label="Amount (₹)" type="number" min="0.01" step=".01" required value={spendForm.amount} onChange={e=>setSpendForm({...spendForm,amount:e.target.value})} /><Field label="Channel" required placeholder="e.g. Campus community" value={spendForm.channel} onChange={e=>setSpendForm({...spendForm,channel:e.target.value})} /><Field label="Date spent" type="date" required value={spendForm.spentAt} onChange={e=>setSpendForm({...spendForm,spentAt:e.target.value})} /><Field label="Note (optional)" placeholder="What was this spend for?" value={spendForm.note} onChange={e=>setSpendForm({...spendForm,note:e.target.value})} /></div>{createSpend.isError && <p className="mt-3 text-sm text-rose-600">Could not record spend. Confirm the amount and authorization.</p>}<Button type="submit" disabled={createSpend.isPending} className="mt-5" data-testid="button-record-spend">{createSpend.isPending ? 'Recording…' : 'Record expenditure'}</Button></form>
      <section className="surface rounded-2xl p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-[#202d49]">Recorded spend</h2><p className="mt-1 text-xs text-slate-500">Actual entries from the campaign ledger</p></div><HandCoins className="text-indigo-500" size={19} /></div>{spendQ.data?.length ? <div className="mt-5 divide-y divide-slate-100">{spendQ.data.map(row=><div key={row.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-700">{row.channel}</p><p className="mt-1 text-xs text-slate-500">{row.note || 'No note'} · {new Date(row.spentAt).toLocaleDateString()}</p></div><span className="font-display font-bold text-[#202d49]">₹{(row.amountPaise/100).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center"><HandCoins className="mx-auto text-slate-300" size={25} /><p className="mt-3 text-sm font-semibold text-slate-600">No campaign spend recorded</p><p className="mt-1 text-xs text-slate-400">The budget remains an assumption until actual expenses are added.</p></div>}</section>
    </div>
    <CampaignSimulator target={configQ.data.target} budgetPaise={configQ.data.budgetPaise} />
  </AdminGate>;
}

type CampaignScenario = {
  partners: number;
  registrationsPerPartner: number;
  whatsapp: number;
  referrals: number;
  linkedin: number;
  email: number;
};

function CampaignSimulator({ target, budgetPaise }: { target: number; budgetPaise: number }) {
  const baseline: CampaignScenario = { partners: 20, registrationsPerPartner: 12, whatsapp: 100, referrals: 100, linkedin: 40, email: 20 };
  const [alternative, setAlternative] = useState<CampaignScenario>({ partners: 12, registrationsPerPartner: 10, whatsapp: 75, referrals: 60, linkedin: 25, email: 15 });
  const [allocation, setAllocation] = useState({ testing: 800, contingency: 400, reserve: 800 });
  const total = (scenario: CampaignScenario) => scenario.partners * scenario.registrationsPerPartner + scenario.whatsapp + scenario.referrals + scenario.linkedin + scenario.email;
  const baselineTotal = total(baseline);
  const alternativeTotal = total(alternative);
  const allocationTotal = allocation.testing + allocation.contingency + allocation.reserve;
  const rows = [
    ['Campus partners', 'partners', 'registrationsPerPartner'],
    ['WhatsApp communities', 'whatsapp'],
    ['Peer referrals', 'referrals'],
    ['LinkedIn / social', 'linkedin'],
    ['Email', 'email'],
  ] as const;
  const updateScenario = (field: keyof CampaignScenario, value: number) => setAlternative(current => ({ ...current, [field]: Math.max(0, value) }));
  return <section className="surface mt-5 rounded-2xl p-5 sm:p-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-600">Planning tool</p><h2 className="font-display mt-1 text-xl font-bold text-[#202d49]">Campaign simulator</h2><p className="mt-1 text-xs leading-5 text-slate-500">Compare a brief-based baseline with an editable alternative. All values are assumptions, not forecasts or results.</p></div><span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Target: {target.toLocaleString()} registrations</span></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-[#fafbfe] p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-800">Baseline from the brief</h3><p className="mt-1 text-xs text-slate-500">Illustrative channel contribution model</p></div><span className="font-display text-2xl font-bold text-indigo-700">{baselineTotal}</span></div><div className="mt-4 space-y-2">{rows.map(([label, countKey, perPartnerKey]) => <div key={countKey} className="flex justify-between gap-4 border-b border-slate-200/70 py-2 text-xs"><span className="text-slate-500">{label}</span><strong className="text-slate-700">{perPartnerKey ? `${baseline.partners} × ${baseline.registrationsPerPartner} = ${baseline[perPartnerKey] * baseline[countKey]}` : baseline[countKey]}</strong></div>)}</div><p className="mt-3 text-xs text-slate-500">Gap to target: {Math.max(0, target - baselineTotal).toLocaleString()}</p></article>
      <article className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-800">Alternative scenario</h3><p className="mt-1 text-xs text-slate-500">Edit assumed contributions to compare</p></div><span className="font-display text-2xl font-bold text-indigo-700">{alternativeTotal}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, countKey, perPartnerKey]) => <div key={countKey} className="grid grid-cols-[1fr_76px] items-center gap-2"><label htmlFor={`sim-${countKey}`} className="text-xs text-slate-600">{label}</label>{perPartnerKey ? <div className="flex items-center gap-1"><input aria-label="Active campus partners" id="sim-partners" type="number" min="0" value={alternative.partners} onChange={e => updateScenario('partners', Number(e.target.value))} className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" /><span className="text-slate-400">×</span><input aria-label="Registrations per partner" type="number" min="0" value={alternative.registrationsPerPartner} onChange={e => updateScenario('registrationsPerPartner', Number(e.target.value))} className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" /></div> : <input id={`sim-${countKey}`} type="number" min="0" value={alternative[countKey]} onChange={e => updateScenario(countKey, Number(e.target.value))} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" />}</div>)}</div><p className="mt-3 text-xs text-slate-500">Gap to target: {Math.max(0, target - alternativeTotal).toLocaleString()}</p></article>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div><h3 className="text-sm font-semibold text-slate-800">Proposed budget allocation</h3><p className="mt-1 text-xs text-slate-500">Editable scenario only; expenses count as actual only after they are entered in the ledger.</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{([['testing', 'Paid testing'], ['contingency', 'Contingency'], ['reserve', 'Reserve']] as const).map(([field, label]) => <label className="text-xs text-slate-600" key={field}>{label}<span className="mt-1 flex items-center rounded-lg border border-slate-200 bg-white px-2.5"><span className="text-slate-400">₹</span><input type="number" min="0" value={allocation[field]} onChange={e => setAllocation(current => ({ ...current, [field]: Math.max(0, Number(e.target.value)) }))} className="w-full bg-transparent px-2 py-2 text-sm text-slate-800 outline-none" aria-label={`${label} budget`} /></span></label>)}</div></div><div className={`rounded-xl px-4 py-3 text-sm font-semibold ${allocationTotal * 100 === budgetPaise ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-900'}`}>Scenario total ₹{allocationTotal.toLocaleString('en-IN')}<div className="mt-1 text-xs font-normal">Plan budget ₹{(budgetPaise / 100).toLocaleString('en-IN')} · {allocationTotal * 100 === budgetPaise ? 'matches' : 'does not match'} current plan</div></div></div>
    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Channel totals can overlap. Treat this as a planning comparison only; deduplicate people and use recorded registrations and spend for actual reporting.</p>
  </section>;
}

function CampaignAssetsPage() {
  const [copied, setCopied] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const campaignUrl = (source: string, medium: string) => {
    const url = new URL(`${basePath || ''}/`, window.location.origin);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', medium);
    url.searchParams.set('utm_campaign', 'first-ai-project');
    return url.toString();
  };
  const assets = [
    { id: 'whatsapp', title: 'WhatsApp student group', channel: 'Peer-led community', text: `Curious about building with AI? Register your interest for a free, practical 60-minute workshop for final-year engineering students. No prior AI experience needed. The date and speaker will be shared once confirmed.\n\n${campaignUrl('whatsapp', 'student_group')}` },
    { id: 'club', title: 'Campus club outreach', channel: 'Student clubs', text: `Hi [Coordinator name],\n\nCould you share this with final-year engineering students if it fits your community? We are collecting interest for a proposed free, practical 60-minute workshop: “Build Your First AI Project in 60 Minutes.” No prior AI experience is required. The date and speaker are not confirmed yet; we will share details once they are.\n\nRegistration: ${campaignUrl('campus_club', 'club_outreach')}\n\nThank you,\n[Your name]` },
    { id: 'email', title: 'Permission-based email', channel: 'College / community email', text: `Subject: A practical first step into building with AI\n\nHello [Name],\n\nWe are inviting final-year engineering students to register interest in a free 60-minute practical AI workshop. It is designed for beginners and will introduce a small, guided AI project. The workshop date and speaker are still being confirmed.\n\nIf this is relevant to your students, please share the registration link below. Please only forward it to people who would reasonably expect this invitation.\n\n${campaignUrl('email', 'college_outreach')}\n\nRegards,\n[Your name]` },
    { id: 'linkedin', title: 'LinkedIn / social post', channel: 'Public social', text: `Ready to move from using AI to building with it?\n\nRegister your interest in a free, practical 60-minute workshop for final-year engineering students. No prior AI experience needed. We will share the confirmed date and speaker details when available.\n\n${campaignUrl('linkedin', 'social_post')}\n\n#AI #EngineeringStudents #BuildWithAI` },
  ];
  const copyAsset = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(id);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopyFailed(true);
    }
  };
  return <AdminGate><PageHeading eyebrow="Distribution toolkit" title="Campaign assets" description="Copy-ready outreach drafts with source-tagged registration links." />
    <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/75 p-4 text-sm text-amber-950"><CircleHelp className="mt-0.5 shrink-0 text-amber-700" size={18} /><p><strong>Before sharing:</strong> confirm the event details, get permission from community owners, and personalize the placeholders. These drafts do not invent a date, speaker, or outcome.</p></div>
    {copyFailed && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">Clipboard access was blocked. Select and copy the draft text manually.</p>}
    <div className="grid gap-4 xl:grid-cols-2">{assets.map(asset => <article key={asset.id} className="surface rounded-2xl p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-indigo-600">{asset.channel}</p><h2 className="font-display mt-1 text-lg font-bold text-[#202d49]">{asset.title}</h2></div><button onClick={() => copyAsset(asset.id, asset.text)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-testid={`button-copy-${asset.id}`}><Clipboard size={14} />{copied === asset.id ? 'Copied' : 'Copy draft'}</button></div><pre className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-[#f7f8fc] p-4 font-sans text-sm leading-6 text-slate-600">{asset.text}</pre></article>)}</div>
  </AdminGate>;
}

function LearningPage() {
  const q = useGetAdminSummary();
  if (q.isLoading) return <AdminGate><LoadingPanel /></AdminGate>;
  if (q.isError || !q.data) return <AdminGate><QueryError onRetry={() => q.refetch()} /></AdminGate>;
  const notes = [
    { title: 'Separate the target from the outcome', tag: 'Build reflection draft', prompt: 'The brief sets a 500-registration target and ₹2,000 budget for a seven-day campaign.', choice: 'This build labels those values as editable assumptions and reports only database registrations and entered spend as actuals.', reason: 'A target or simulator estimate must not be presented as measured performance.' },
    { title: 'Keep registration easy for students', tag: 'Build reflection draft', prompt: 'The product needs a public registration form and referral attribution.', choice: 'Students can register without creating an account; Clerk sign-in is reserved for campaign operators.', reason: 'This keeps the student path short while protecting private campaign records.' },
    { title: 'Measure the path, not just sign-ups', tag: 'Build reflection draft', prompt: 'The campaign needs source attribution and referral tracking.', choice: 'The app records landing views, form starts, completed registrations, UTMs, and referral codes with a pseudonymous browser ID.', reason: 'Source and funnel decisions should be based on observed activity, with incomplete tracking called out.' },
  ];
  return <AdminGate><PageHeading eyebrow="Working notebook" title="Learning notes" description="Starter ideas to personalize honestly before they become campaign decisions." />
    <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/75 p-4 text-sm text-amber-950"><BookOpenText className="mt-0.5 shrink-0 text-amber-700" size={18} /><p><strong>Reflection starters, not personal claims.</strong> These summarize implementation choices made for this build. Rewrite them to describe your own AI interactions and reasoning before using them in an application or presentation.</p></div>
    <div className="grid gap-4 xl:grid-cols-3">{notes.map((note,i)=><article className="surface rounded-2xl p-5 sm:p-6" key={note.title}><div className="flex items-center justify-between"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">{note.tag}</span><span className="font-mono text-xs text-slate-300">0{i+1}</span></div><h2 className="font-display mt-5 text-lg font-bold text-[#202d49]">{note.title}</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Brief starting point</dt><dd className="mt-1 leading-6 text-slate-600">{note.prompt}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Choice in this build</dt><dd className="mt-1 leading-6 text-slate-600">{note.choice}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Reason</dt><dd className="mt-1 leading-6 text-slate-600">{note.reason}</dd></div></dl><p className="mt-5 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-400">VERIFY AND PERSONALIZE BEFORE USE</p></article>)}</div>
    <div className="surface mt-5 rounded-2xl p-5"><h2 className="font-display font-bold text-[#202d49]">Available measured context</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Actual registrations</p><p className="mt-1 font-display text-xl font-bold">{q.data.registrations}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Recorded form starts</p><p className="mt-1 font-display text-xl font-bold">{q.data.funnel.formStarts}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tracking</p><p className="mt-1 font-display text-xl font-bold">{q.data.funnel.trackingComplete ? 'Complete' : 'Incomplete'}</p></div></div></div>
  </AdminGate>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access campaign operations' } }, signUp: { start: { title: 'Create your account', subtitle: 'Continue to AI LaunchPad' } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><Switch>
      <Route path="/" component={Landing} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/success" component={SuccessPage} />
      <Route path="/sign-in/*?" component={() => <AuthScreen mode="in" />} />
      <Route path="/sign-up/*?" component={() => <AuthScreen mode="up" />} />
      <Route path="/admin" component={AdminOverview} />
      <Route path="/admin/registrations" component={RegistrationsPage} />
      <Route path="/admin/channels" component={ChannelsPage} />
      <Route path="/admin/referrals" component={ReferralsPage} />
      <Route path="/admin/strategy" component={StrategyPage} />
      <Route path="/admin/assets" component={CampaignAssetsPage} />
      <Route path="/admin/learning" component={LearningPage} />
      <Route component={() => <main className="grid min-h-[100dvh] place-items-center"><div className="text-center"><h1 className="font-display text-3xl font-bold">Page not found</h1><Link href="/" className="mt-3 inline-flex text-indigo-700">Return to AI LaunchPad</Link></div></main>} />
    </Switch></QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}

export default App;
