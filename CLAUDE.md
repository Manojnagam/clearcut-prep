# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ClearCut is a single-file PWA for Indian bank exam prep (SBI PO, IBPS PO, RRB etc.), built by Manoj for his girlfriend Nanditha. All app logic — HTML, CSS, and JS — lives in `index.html` (~3960 lines). There is no build step, no package.json, no bundler.

## Running Locally

Serve the folder over HTTP (required for service worker and PWA features):

```
npx serve . -l 3000
```

Then open `http://localhost:3000`. Opening `index.html` directly as a `file://` URL will work for basic testing but the service worker won't register.

**Coach portal** (Manoj's private view): `http://localhost:3000?coach=manoj`

## Deploying

Deploy only the essential files — do NOT deploy the `screenshots/` folder or `.ps1` script as they cause Cloudflare upload failures:

```bash
mkdir -p /tmp/clearcut-dist/functions/api
cp index.html manifest.json sw.js /tmp/clearcut-dist/
cp functions/api/groq.js /tmp/clearcut-dist/functions/api/

CLOUDFLARE_API_TOKEN=<token> npx wrangler pages deploy /tmp/clearcut-dist \
  --project-name clearcut-prep --branch main --commit-dirty=true
```

The `GROQ_KEY` secret must be set in Cloudflare Pages → Settings → Environment variables (Production). It is **not** in the codebase.

Live URL: `https://clearcut-prep.pages.dev`

## Architecture

### Single-file structure
Everything is in `index.html`. The JS is one `<script>` block starting around line 1165. Sections are delimited by `/* ── SECTION NAME ── */` comments.

### Key constants (top of script block)

| Constant | Purpose |
|---|---|
| `APP_PIN` | `"0226"` — 4-digit PIN, checked via `sessionStorage` (expires on browser close) |
| `SB_URL` / `SB_KEY` | Supabase project credentials (anon key, hardcoded) |
| `TABLE` / `SYLLABUS_TABLE` / `STUDY_LOG_TABLE` | Supabase table names |
| `GROQ_MODEL` | `llama-3.1-8b-instant` — model used for all AI features (key stored as Cloudflare secret `GROQ_KEY`) |
| `NEG` | `0.25` — negative marking per wrong answer |
| `DQ_DAILY_LIMIT` | `10` — practice questions per day cap |

### Storage model

- **Supabase** (cloud): mocks (`clearcut_mocks`), syllabus (`clearcut_syllabus`), study logs (`clearcut_study_log`) — filtered by `user_name` column for multi-user isolation
- **localStorage** (device-only): profiles (`cc_profiles`), exam dates (`cc_examdates_<name>`), syllabus state (`cc_syllabus_<name>`), DQ log (`cc_dq_log`), daily Q queue (`cc_dq_daily`), milestones (`cc_milestones`), coach notes, notification settings
- **sessionStorage**: `cc_pin_ok` — PIN unlock flag, cleared on browser close

### Multi-user flow

PIN → `checkSetup()` → `migrateProfiles()` → `showUserPicker()` → `pickUser(name)` → `bootApp()`

Profiles stored as array in `cc_profiles`. Each user's syllabus/exam dates are keyed by name (`cc_syllabus_Nanditha`). Mocks and study logs use `user_name` column filter in both Supabase and localStorage.

### AI features

All AI calls go through `askGroq(system, user)` → `/api/groq` (Cloudflare Pages Function at `functions/api/groq.js`), which proxies to Groq using the `GROQ_KEY` environment secret. Used for: daily practice question generation (`generateDQ`), AI coach chat (`sendChat`), dashboard insights (`askAI`), weekly report (`generateReportAI`), prediction sentence (`renderPrediction`), coach portal assessment (`renderCoachAI`).

### JS sections

| Section | Key functions |
|---|---|
| Storage | `local` object, `db` (mocks), `studyLogDb` |
| Setup / multi-user | `completeSetup`, `editUser`, `showUserPicker`, `pickUser`, `deleteUser` |
| PIN | `pinPress`, `checkPin`, `checkSetup` |
| Dashboard | `renderDash`, `renderCutoffProgress`, `renderPrediction` |
| Log Mock | `buildSecInputs`, `saveMock`, `editMock`, `delMock` |
| Syllabus | `renderSyllabus`, `toggleTopic` |
| Timer | `buildTimerChips`, `toggleTimer`, `paintClock`, `beep` |
| Notifications | `scheduleNotification`, `saveNotifSettings` |
| AI Chat | `initChat`, `sendChat`, `askGroq` |
| Study Log | `saveStudyLog`, `renderStudyLog` |
| Report Card | `renderReport`, `generateReportAI`, `downloadReport` |
| Daily Question | `generateDQ`, `submitDQ`, `nextDQ`, `showDQComplete` |
| Milestones | `checkMilestones`, `showCelebration`, `MILESTONES` array |
| Coach View | `initCoachView`, `renderCoachDQ`, `renderCoachActivity`, `renderCoachAI` |
| Boot | `load`, `bootApp` |

### Exam sections

- **Non-RRB**: English (30q) + Quant (35q) + Reasoning (35q) = 100 marks
- **RRB**: Quant (40q) + Reasoning (40q) = 80 marks
- Detected by `isRRB(exam)`, sections returned by `getSections(exam)`

## Patterns to Follow

- **DOM access**: always use `$(id)` (alias for `document.getElementById`)
- **Score calculation**: use `secScore(mock, sectionKey)` and `totalScore(mock)` — never calculate inline
- **Adding a milestone**: add entry to `MILESTONES` array + note in `MILESTONE_NOTES`; `checkMilestones()` is called automatically after mock save and DQ submit
- **Per-user storage**: `local.getSyl()` and `local.getDates()` already apply the `_<name>` suffix via `PROFILE.name` — no need to key manually
- **Supabase user filter**: `db._uq()` returns `&user_name=eq.<name>` — already included in all db queries

## Known Issues / Gotchas

- `SB_KEY` is hardcoded in the HTML — visible in DevTools. Acceptable for this private personal app (Supabase anon key).
- `GROQ_KEY` is stored as a Cloudflare Pages secret and proxied via `functions/api/groq.js` — not exposed to the browser.
- Service worker notifications only fire while the browser/PWA is open — no real push server.
- `prelims-tracker.html` is a dead v1 file — safe to delete.
- Do NOT include `screenshots/` or `screenshot_dashboard.png` in Cloudflare deploys — causes 502 upload failures.
