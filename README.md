# AI LaunchPad — The 500-Student Growth Engine
**NxtWave Growth Intern Challenge Submission**  
**Campaign:** "Build Your First AI Project in 60 Minutes"  
**Goal:** 500 Unique Registrations | **Audience:** Final-Year Engineering Students (2027 Batch)  
**Budget:** ₹2,000 | **Duration:** 7 Days  

---

## 🌟 Executive Summary

Instead of submitting only a slide deck or a static landing page, this repository contains a complete, working **Growth Campaign Platform** engineered for NxtWave. It demonstrates how to combine marketing strategy, product thinking, AI usage, and data-driven execution to acquire 500 students on a ₹2,000 budget.

### Core Growth Thesis:
> *"Don't just promote a workshop. Build a measurable growth loop where every student who registers becomes an organic acquisition channel for more students."*

---

## 🏗️ System Architecture & Key Features

### 1. Student Experience (`/` and `/register`)
- **Conversion-Optimized Landing Page:** High-clarity value proposition tailored for final-year engineering students preparing for placements.
- **Frictionless Guest Registration:** Zero mandatory passwords or account creation before registering. Students register in under 30 seconds.
- **Deduplication & Validation:** Enforces normalized email uniqueness and graduation year validation (2027 priority).
- **UTM Attribution Capture:** Automatically captures and preserves `utm_source`, `utm_medium`, and `utm_campaign` across navigation.

### 2. Peer Referral Engine (`/success` and `/referrals`)
- **Unique Referral Codes:** Generates non-guessable, personalized referral codes (e.g. `AILAUNCH-K7P4Q`).
- **1-Click Share & Copy:** Direct copy-to-clipboard button with visual confirmation.
- **Direct WhatsApp Sharing:** 1-click button opening WhatsApp with pre-filled, contextual invitation text containing the student's unique link.
- **Live Attribution Feedback:** Registrants can view how many friends have registered through their link.

### 3. Operator Control Room (`/admin`)
- **Core KPI Cards:** Real-time tracking of total registrations, progress toward 500, required daily pace, and unit economics.
- **Daily Acquisition Trend:** Bar chart tracking daily acquisition momentum against the 7-day timeline.
- **Measured Conversion Funnel:** Tracks unique visitors $\rightarrow$ form starts $\rightarrow$ completed registrations with pseudonymous deduplication.
- **Cost Per Registration (CPR):**
  $$\text{CPR} = \frac{\text{Campaign Spend}}{\text{Attributed Registrations}}$$
- **Registrations Table (`/admin/registrations`):** Live search by name, email, college, and channel, with verified CSV export.
- **Campaign Assets (`/admin/assets`):** Copy-ready outreach drafts for WhatsApp groups, technical clubs, email, and LinkedIn with built-in UTM parameters.

### 4. Advanced Growth Features
- **Growth Action Center:** Rule-based decision engine that analyzes live metrics and triggers operational recommendations (e.g. pace shortfall alerts, conversion rate warnings, and budget reallocation).
- **Campaign Simulator (`/admin/strategy`):** Internal modeling tool allowing operators to compare the baseline plan against alternative acquisition assumptions before spending capital.
- **Dual Runtime Engine:** Seamlessly connects to a live PostgreSQL / Supabase database when configured, or runs in interactive zero-dependency Standalone Demo Mode with local storage persistence.

---

## 🚀 Quick Start & How to Run

### Prerequisites
- Node.js (v18+)
- pnpm (`npm install -g pnpm`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start the Application
To run the interactive frontend application:
```bash
pnpm --filter @workspace/ai-launchpad run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 3. Full-Stack / API Server (Optional)
If running with a local or remote PostgreSQL / Supabase database:
1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Push database schema:
   ```bash
   pnpm --filter @workspace/db run push
   ```
3. Start the API server:
   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

---

## 📊 The 500-Student Acquisition Model

$$\text{Projected Total} = (P \times R_p) + R_w + R_r + R_l + R_e = 500$$

| Priority | Channel | Planning Assumption | Target | Share (%) |
| :---: | :--- | :--- | :---: | :---: |
| **1** | **College Technical Clubs** | 20 active partner clubs × 12 registrations each | **240** | 48% |
| **2** | **WhatsApp Student Groups** | 10 permitted class group distributions × 10 | **100** | 20% |
| **3** | **Peer Referral Loop** | 100 registrations attributed to student share links | **100** | 20% |
| **4** | **LinkedIn & Social Media** | Tech community posts & ambassador amplification | **40** | 8% |
| **5** | **Direct Club Email Outreach** | Permission-based society mailing lists | **20** | 4% |
| **Total** | **Unified Engine** | **5 Deduplicated Organic Channels** | **500** | **100%** |

---

## 🧪 Acceptance Test Checklist

| Scenario | Tested Action | Expected Result | Status |
| :--- | :--- | :--- | :---: |
| **Landing Page** | Open `/` on mobile and desktop | Renders responsive hero, agenda, FAQs, CTA | ✅ Verified |
| **Registration** | Submit valid registration form | Record saved, redirected to `/success` with referral code | ✅ Verified |
| **Duplicate Prevention** | Submit same email twice | Rejected with "Registration already exists" message | ✅ Verified |
| **Referral Generation** | Check `/success` page | Unique `AILAUNCH-XXXXX` code and share link generated | ✅ Verified |
| **WhatsApp Share** | Tap "Share Directly on WhatsApp" | Opens WhatsApp with prefilled title and referral URL | ✅ Verified |
| **Referral Attribution** | Register via `/?ref=CODE` | Referrer's count increments, attributed to `student_referral` | ✅ Verified |
| **Admin Gateway** | Navigate to `/admin` | Protected gate requires operator authentication | ✅ Verified |
| **1-Click Operator Sign-In** | Tap "Sign In as Campaign Operator" | Instant authorization and redirect to dashboard | ✅ Verified |
| **Growth Action Center** | Inspect `/admin` recommendations | Displays explainable rules based on pace and conversion | ✅ Verified |
| **Campaign Simulator** | Edit partner & club assumptions | Dynamically recalculates gap to 500 target | ✅ Verified |
| **CSV Export** | Click "Export Verified CSV" | Generates and downloads sanitized registration CSV | ✅ Verified |
| **Empty State Test** | Click "Toggle Demo / Empty State" | Seamlessly toggles between 184 seed records and 0 records | ✅ Verified |

---

## 📁 Repository Deliverables

- `artifacts/ai-launchpad/` — Frontend React + TypeScript application with Tailwind CSS and TanStack Query.
- `artifacts/api-server/` — Express 5 backend with Drizzle ORM and PostgreSQL integration.
- `lib/db/` — Database schema definitions with Drizzle and PostgreSQL types.
- `lib/api-client-react/` — Generated API client with dual runtime support (Live API + MockGrowthEngine).
- `SUPABASE_SCHEMA.sql` — Production-grade PostgreSQL migration script with Row Level Security (RLS) policies.
- `FIVE_SLIDE_GROWTH_PLAN.md` — Complete 5-slide growth presentation with visual layouts and speaker notes.
- `THREE_MINUTE_VIDEO_SCRIPT.md` — Word-by-word 3-minute video presentation script with exact timestamp cues.
- `AI_AND_LEARNING_NOTES.md` — Strategic reflection answering the three mandatory AI critique questions.

---

## 🤝 Authors & Credits
Developed for the **NxtWave Growth Intern Challenge**.

