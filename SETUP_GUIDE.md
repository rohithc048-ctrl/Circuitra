# CIRCUITRA Production Integration & Setup Guide

This guide details the complete configuration required to connect CIRCUITRA with Supabase Auth, PostgreSQL persistence with Row Level Security (RLS), Supabase Edge Functions, and the Google Gemini 2.5 API via `@google/genai`.

---

## 1. Supabase Project Setup & Database Migrations

### 1.1 Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Select your closest AWS/GCP region.
3. Note your **Project URL** and **anon public key** from **Project Settings > API**.

### 1.2 Run Database Migrations
Open the **SQL Editor** in your Supabase dashboard and execute the migration file located at:
`supabase/migrations/20261006_init_circuitra.sql`

This migration creates:
- `profiles`: User information synced with Vishnu college scholar records.
- `projects`: Versioned JSONB electronic workspace storage with ownership tracking.
- `conversations` & `messages`: Bounded persistent chat histories for the Circuitra Assistant.
- `user_rate_limits`: Enforces persistent per-user rate limiting (20 calls/hour).
- `project_draft_plans`: Stores structured AI planning outputs before user approval.
- **Row Level Security (RLS)** on all tables ensuring users can only read and write their own rows.
- Domain restriction function and trigger: `validate_vishnu_email_domain()`.

---

## 2. Server-Side Domain Enforcement & Auth Hook Activation

To guarantee that no non-Vishnu email address (such as `@gmail.com`, `@vishnu.edu.in.example.com`, or `@sub.vishnu.edu.in`) can register—even via direct API requests—the migration attaches a trigger to `auth.users`.

### Optional: Activating Supabase Auth Hook (HTTP Hook / Before User Created)
If using Supabase's managed Auth Hooks:
1. Navigate to **Authentication > Hooks** in the Supabase Dashboard.
2. Under **"Before User Created" (Pre-Signup Hook)**, select **Postgres Function**.
3. Choose the function `public.validate_vishnu_email_domain`.
4. Click **Save**.

The function executes:
```sql
IF NEW.email !~* '^[a-zA-Z0-9._%+-]+@vishnu\.edu\.in$' THEN
    RAISE EXCEPTION 'Registration rejected: Only official @vishnu.edu.in college email addresses are permitted.'
        USING ERRCODE = '23514';
END IF;
```

---

## 3. Email Confirmation & Redirect URLs

**Mandatory Security Rule:** Never disable email verification to work around delivery issues. Email verification guarantees proof of ownership of the `@vishnu.edu.in` mailbox.

### 3.1 Configure Auth Redirects
1. Go to **Authentication > URL Configuration**.
2. Set **Site URL** to your production domain:
   ```
   https://circuitra.your-domain.edu.in/
   ```
   *(For local development: `http://localhost:5173/` or `http://localhost:5176/`)*
3. Add to **Redirect URLs**:
   ```
   https://circuitra.your-domain.edu.in/**
   http://localhost:5173/**
   http://localhost:5176/**
   ```

---

## 4. Custom SMTP Configuration for College Users

College domains typically reject or quarantine unauthenticated emails sent from default shared pool mailers. Configure a dedicated SMTP provider (e.g., SendGrid, AWS SES, or the institution's SMTP relay).

1. Go to **Authentication > Email Templates** & **SMTP Settings**.
2. Toggle **Enable Custom SMTP**.
3. Provide:
   - **Sender email**: `noreply@vishnu.edu.in` (or your verified domain sender)
   - **Sender name**: `CIRCUITRA Workbench`
   - **Host**: `smtp.sendgrid.net` (or your mail server)
   - **Port**: `587`
   - **Username / Password**: Your SMTP API Key credentials
4. Test delivery by creating a test account with a valid Vishnu college email address.

---

## 5. Backend Edge Functions & Secrets Deployment

CIRCUITRA isolates `GEMINI_API_KEY` exclusively inside Supabase Edge Functions. The browser never receives or sends the Gemini API key.

### 5.1 Install Supabase CLI
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
```

### 5.2 Set Backend Secrets
Run the following in your terminal:
```bash
# Configure the Google Gemini API key as a backend secret
supabase secrets set GEMINI_API_KEY=your_actual_gemini_api_key_here

# Configure the Gemini model (gemini-3.5-flash-lite is recommended)
supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite
```

### 5.3 Deploy Edge Functions
Deploy both functions:
```bash
supabase functions deploy circuitra-chat --no-verify-jwt
supabase functions deploy circuitra-plan --no-verify-jwt
```
*(Note: JWT validation is performed explicitly inside each function using the scoped Supabase client to inspect email confirmation and the `@vishnu.edu.in` domain).*

---

## 6. Supported Gemini Model Reference

The configured default model is:
- **`gemini-3.5-flash-lite`** (verified active in Google AI Studio)
- **Capabilities**:
  - Native Structured Outputs via `application/json` (used in `circuitra-plan`).
  - High concurrency, low latency token streaming.
  - Large context window to support grounding on full circuit schematics, pinout tables, and C++ firmware.
  - Configurable via `GEMINI_MODEL=gemini-3.5-flash-lite` in Supabase Edge Function secrets.

---

## 7. Client Environment Setup

In the root directory of the project, create `.env.local` or `.env` based on `.env.example`:
```ini
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key-here
```

Start the application:
```bash
npm run dev
```

---

## 8. Security & Feature Verification Checklist

| Test Item | Verification Procedure | Expected Outcome |
| :--- | :--- | :--- |
| **Exact Domain Rejection** | Attempt signup with `user@gmail.com` or `student@vishnu.edu.in.example.com` | Blocked instantly on client and database hook with domain error. |
| **Unverified Access Denial** | Sign up with `user@vishnu.edu.in`, then navigate to Workspace before clicking confirmation link | Workspace displays `“Use your @vishnu.edu.in college email to continue.”` |
| **Cross-User Denial** | User A tries to read or query User B's project via SQL / API | Supabase Row Level Security denies rows (`403 Forbidden` or empty set). |
| **Persistent Cloud Storage** | Sign in, create a project, refresh the browser | Project is fetched from `projects` table; shows `CLOUD WORKSPACE` badge. |
| **Backend-Only Gemini** | Inspect browser network requests in DevTools | No calls to `generativelanguage.googleapis.com`; only requests to `/functions/v1/circuitra-chat`. |
| **AI Status Honesty** | Disconnect internet or provide invalid keys | Panel displays `"Setup required"` or clear error; never fabricates answers. |
