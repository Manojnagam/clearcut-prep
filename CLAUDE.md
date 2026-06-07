# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ClearCut is a single-file PWA for Indian bank exam prep (SBI PO, IBPS PO, RRB etc.), built by Manoj for his girlfriend Nanditha. All app logic — HTML, CSS, and JS — lives in `index.html` (~5100 lines). There is no build step, no package.json, no bundler.

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

npx wrangler pages deploy /tmp/clearcut-dist \
  --project-name clearcut-prep --branch main --commit-dirty=true
```

Auth uses `wrangler login` (OAuth, browser-based) — **not** an API token. If the deploy fails with a non-interactive error, ask the user to run `! npx wrangler login` in their terminal first.

The `GROQ_KEY` secret must be set in Cloudflare Pages → Settings → Environment variables (Production). It is **not** in the codebase.

Live URL: `https://clearcut-prep.pages.dev`

## Architecture

### Single-file structure
Everything is in `index.html`. The JS is one `<script>` block starting around line 1408. Sections are delimited by `/* ── SECTION NAME ── */` comments.

### Key constants (top of script block)

| Constant | Purpose |
|---|---|
| `APP_PIN` | `"0226"` — 4-digit PIN, checked via `sessionStorage` (expires on browser close) |
| `SB_URL` / `SB_KEY` | Supabase project credentials (anon key, hardcoded) |
| `TABLE` / `SYLLABUS_TABLE` / `STUDY_LOG_TABLE` | Supabase table names |
| `GROQ_MODEL` | `llama-3.1-8b-instant` — model used for all AI features (key stored as Cloudflare secret `GROQ_KEY`) |
| `NEG` | `0.25` — negative marking per wrong answer |
| `DQ_DAILY_LIMIT` | `10` — practice questions per day cap |
| `SECTIONS_FULL` | 35 topics across English/Quant/Reasoning for non-RRB exams |
| `SECTIONS_RRB` | Quant + Reasoning only (no English) for RRB exams |

### Storage model

- **Supabase** (cloud): mocks (`clearcut_mocks`), syllabus (`clearcut_syllabus`), study logs (`clearcut_study_log`) — RLS is **disabled** on all three tables
- **localStorage** (device-only): profiles (`cc_profiles`), exam dates (`cc_examdates_<name>`), syllabus state (`cc_syllabus_<name>`), DQ log (`cc_dq_log`), daily Q queue (`cc_dq_daily`), milestones (`cc_milestones`), coach notes (`cc_coach_notes`), mistake book (`cc_mistake_book`), coach quiz (`cc_coach_quiz`), daily motivation cache (`cc_daily_motivation`), smart plan cache (`cc_smart_plan`)
- **sessionStorage**: `cc_pin_ok` — PIN unlock flag, cleared on browser close

### Boot flow

PIN → `checkSetup()` → auto-creates Nanditha profile if none exists → `pickUser('Nanditha')` → `bootApp()`

On first launch on a new device, `checkSetup()` automatically creates `{ name: 'Nanditha', targetExam: 'SBI PO' }` in localStorage — no setup screen shown.

### AI features

All AI calls go through `askGroq(system, user)` → `/api/groq` (Cloudflare Pages Function at `functions/api/groq.js`), which proxies to Groq using the `GROQ_KEY` environment secret.

**Critical:** AI-generated MCQs must use **pipe-delimited format**, not JSON. LLMs consistently produce invalid JSON (unescaped quotes, literal newlines in strings). Use this format:
```
TOPIC|SECTION|DIFFICULTY|QUESTION|OPTION_A|OPTION_B|OPTION_C|OPTION_D|CORRECT_LETTER|EXPLANATION
```
Parse with `.split('\n').filter(l => l.includes('|') && l.split('|').length >= 9)`.

AI features: daily practice question generation (`generateDQ`), AI coach chat (`sendChat`), dashboard insights (`askAI`), weekly report (`generateReportAI`), prediction sentence (`renderPrediction`), coach portal assessment (`renderCoachAI`), daily motivation (`renderDailyMotivation`), coach quiz generation (`coachAssignQuiz`), mock simulator (`generateMSSection`), smart revision plan (`generateSmartPlan`).

### JS sections

| Section | Key functions |
|---|---|
| Storage | `local` object, `db` (mocks), `studyLogDb` |
| PIN | `pinPress`, `checkPin`, `checkSetup` |
| Dashboard | `renderDash`, `renderCutoffProgress`, `renderPrediction`, `renderStrategyCard`, `renderTopicAccuracy` |
| Daily Motivation | `renderDailyMotivation` — cached per day in `cc_daily_motivation` |
| Log Mock | `buildSecInputs`, `saveMock`, `editMock`, `delMock` |
| Syllabus | `renderSyllabus`, `toggleTopic` |
| Timer | `buildTimerChips`, `toggleTimer`, `paintClock`, `beep`, `onSectionEnd`, `showSectionSummary` |
| Notifications | `scheduleNotification`, `saveNotifSettings` |
| AI Chat | `initChat`, `sendChat`, `askGroq` |
| Study Log | `saveStudyLog`, `renderStudyLog` |
| Report Card | `renderReport`, `generateReportAI`, `downloadReport` |
| Daily Question | `generateDQ`, `submitDQ`, `nextDQ`, `showDQComplete` |
| Mistake Book | `renderMistakeBook`, `retryMistake` — stored in `cc_mistake_book` |
| Smart Plan | `generateSmartPlan`, `renderSmartPlanHTML` — cached in `cc_smart_plan` |
| Milestones | `checkMilestones`, `showCelebration`, `MILESTONES` array |
| Coach Quiz | `coachBuildTopicPicker`, `coachAIPick`, `coachAssignQuiz`, `renderCoachQuizResults`, `checkCoachQuizBanner`, `openCoachQuiz`, `renderCQQuestion`, `submitCQ`, `finishCQ` |
| Mock Simulator | `startMockSim`, `generateMSSection`, `beginMSSection`, `renderMSQuestion` |
| Coach View | `initCoachView`, `renderCoachDQ`, `renderCoachActivity`, `renderCoachAI`, `renderCoachStats` |
| Boot | `load`, `bootApp` |

### Exam sections

- **Non-RRB**: English (30q) + Quant (35q) + Reasoning (35q) = 100 marks
- **RRB**: Quant (40q) + Reasoning (40q) = 80 marks
- Detected by `isRRB(exam)`, sections returned by `getSections(exam)`

### Coach Quiz data schema (`cc_coach_quiz`)
```js
{
  topics: ['Topic1', 'Topic2'],   // array of topic names
  topicStr: 'Topic1 (Section), …', // for display
  questions: [{ topic, section, difficulty, question, options, correct, explanation }],
  assignedAt: ISO string,
  status: 'pending' | 'completed',
  results: {
    correct, total, pct, byTopic,
    perQuestion: [{ topic, question, options, correct, answered, isCorrect, explanation }],
    completedAt: ISO string
  }
}
```

## Patterns to Follow

- **DOM access**: always use `$(id)` (alias for `document.getElementById`)
- **Score calculation**: use `secScore(mock, sectionKey)` and `totalScore(mock)` — never calculate inline
- **AI question rendering**: use `innerHTML` with newlines converted to `<br>` (not `textContent`) so para jumble sentences display correctly
- **Adding a milestone**: add entry to `MILESTONES` array + note in `MILESTONE_NOTES`; `checkMilestones()` runs automatically after mock save and DQ submit
- **Per-user storage**: `local.getSyl()` and `local.getDates()` apply the `_<name>` suffix via `PROFILE.name` automatically
- **Supabase user filter**: `db._uq()` returns `&user_name=eq.<name>` — already included in all db queries
- **AI Pick fallback**: `topWeakTopics()` reads from `m.weak_topics` on mock records — if empty, fall back to `['Data Interpretation', 'Puzzles', 'Reading Comprehension', 'Seating Arrangement (Linear)', 'Number Series']`

## Known Issues / Gotchas

- `SB_KEY` is hardcoded in the HTML — visible in DevTools. Acceptable for this private personal app (Supabase anon key). RLS is intentionally disabled on all Supabase tables.
- `GROQ_KEY` is stored as a Cloudflare Pages secret and proxied via `functions/api/groq.js` — not exposed to the browser. Key was previously accidentally committed; git history was scrubbed with `filter-branch`.
- Service worker notifications only fire while the browser/PWA is open — no real push server.
- Do NOT include `screenshots/` or `screenshot_dashboard.png` in Cloudflare deploys — causes 502 upload failures.
- Daily motivation card (`cc_daily_motivation`) is cached per day — to force regeneration, clear that localStorage key.
- Coach quiz `cc_coach_quiz` persists until explicitly cleared via "Clear & Assign New Quiz" button in coach portal.
