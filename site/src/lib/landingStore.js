import crypto from "node:crypto";
import { USE_PG, getPool, readJson, writeJson, getMeta, setMeta, once } from "@/lib/db";

// -----------------------------------------------------------------------------
//  Ad landing pages, served at /go/<slug> with no site navigation.
//
//  A landing page is a short funnel the admin assembles in the dashboard:
//    1. an intro (headline, bullets, optional image)
//    2. an OPTIONAL questionnaire — single-choice, "select all that apply", or
//       short-answer questions, each answer worth points if wanted, with score
//       bands that each carry a message (and optionally a "schedule" button)
//    3. a contact form (name + email, phone/message optional or required)
//    4. the next step: a gated PDF download, a scheduling link, or just thanks
//    5. a thank-you screen that can send the visitor on to any page (e.g. /nike)
//  Every submission is saved to the Inbox and emailed to the chosen advisors,
//  with the visitor's answers and raw score.
// -----------------------------------------------------------------------------


export const PHONE_MODES = ["hidden", "optional", "required"];
export const OFFER_TYPES = ["download", "schedule", "none"];
export const QUESTION_TYPES = ["single", "multi", "text"];

export function validateLandingSlug(slug) {
  if (!slug) return "A web address is required.";
  if (slug.length > 60) return "The web address must be 60 characters or fewer.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return "The web address may only contain lowercase letters, numbers, and single hyphens.";
  return null;
}

const txt = (v, max) => String(v ?? "").trim().slice(0, max);
const shortId = () => crypto.randomBytes(4).toString("hex");
const cleanId = (v) => (/^[a-z0-9]{1,24}$/i.test(String(v || "")) ? String(v) : shortId());

function num(v, { min = -1000, max = 1000, fallback = 0 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
}

// Where the thank-you screen may send people: a page on this site, or an
// https link. Anything else becomes the home page.
export function cleanRedirect(v) {
  const s = String(v || "").trim();
  if (/^\/(?!\/)[\w\-./?=&#%]*$/.test(s) && s.length <= 300) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s) && s.length <= 600) return s;
  return "";
}

const cleanUrl = (v) => {
  const s = String(v || "").trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) && s.length <= 800 ? s : "";
};

const cleanMedia = (v, { privateOnly = false } = {}) => {
  const s = String(v || "");
  const re = privateOnly ? /^\/media\/[a-f0-9]{32}p\.pdf$/ : /^\/(media\/[a-f0-9]{32}p?\.[a-z0-9]{2,5}|[\w./-]+)$/;
  return re.test(s) ? s : "";
};

export function sanitizeLandingInput(input = {}) {
  const quiz = input.quiz || {};
  const questions = (Array.isArray(quiz.questions) ? quiz.questions : [])
    .map((q) => {
      const type = QUESTION_TYPES.includes(q?.type) ? q.type : "single";
      return {
        id: cleanId(q?.id),
        text: txt(q?.text, 300),
        help: txt(q?.help, 300),
        type,
        required: q?.required !== false,
        options:
          type === "text"
            ? []
            : (Array.isArray(q?.options) ? q.options : [])
                .map((o) => ({ id: cleanId(o?.id), label: txt(o?.label, 200), points: num(o?.points) }))
                .filter((o) => o.label)
                .slice(0, 12),
      };
    })
    .filter((q) => q.text && (q.type === "text" || q.options.length >= 2))
    .slice(0, 30);

  const results = (Array.isArray(quiz.results) ? quiz.results : [])
    .map((r) => ({
      min: num(r?.min),
      max: num(r?.max),
      title: txt(r?.title, 160),
      message: txt(r?.message, 2000),
      showSchedule: Boolean(r?.showSchedule),
    }))
    .filter((r) => r.title || r.message)
    .slice(0, 12);

  const form = input.form || {};
  const offer = input.offer || {};
  const thanks = input.thanks || {};
  const notify = input.notify || {};

  return {
    slug: txt(input.slug, 60).toLowerCase(),
    name: txt(input.name, 120),
    published: input.published !== false,

    eyebrow: txt(input.eyebrow, 120),
    headline: txt(input.headline, 200),
    subhead: txt(input.subhead, 600),
    bullets: (Array.isArray(input.bullets) ? input.bullets : [])
      .map((b) => txt(b, 240))
      .filter(Boolean)
      .slice(0, 10),
    image: cleanMedia(input.image),

    quiz: {
      enabled: Boolean(quiz.enabled) && questions.length > 0,
      title: txt(quiz.title, 160),
      intro: txt(quiz.intro, 600),
      startLabel: txt(quiz.startLabel, 60),
      showPoints: Boolean(quiz.showPoints),
      showScore: quiz.showScore !== false,
      questions,
      results,
    },

    form: {
      heading: txt(form.heading, 160),
      sub: txt(form.sub, 400),
      phone: PHONE_MODES.includes(form.phone) ? form.phone : "optional",
      message: PHONE_MODES.includes(form.message) ? form.message : "hidden",
      messageLabel: txt(form.messageLabel, 120),
      submitLabel: txt(form.submitLabel, 60),
      consent: txt(form.consent, 600),
    },

    offer: {
      type: OFFER_TYPES.includes(offer.type) ? offer.type : "download",
      // Gated files are stored privately: only a signed link issued after the
      // form is submitted can fetch them.
      pdf: cleanMedia(offer.pdf, { privateOnly: true }),
      pdfName: txt(offer.pdfName, 160),
      pdfSize: num(offer.pdfSize, { min: 0, max: 1e9, fallback: 0 }) || null,
      downloadLabel: txt(offer.downloadLabel, 60),
      scheduleUrl: cleanUrl(offer.scheduleUrl),
      scheduleLabel: txt(offer.scheduleLabel, 60),
    },

    thanks: {
      heading: txt(thanks.heading, 160),
      message: txt(thanks.message, 1000),
      redirectTo: cleanRedirect(thanks.redirectTo),
      redirectLabel: txt(thanks.redirectLabel, 80),
      autoRedirect: thanks.autoRedirect !== false,
      redirectDelay: num(thanks.redirectDelay, {
        min: REDIRECT_MIN_SECONDS,
        max: 120,
        fallback: REDIRECT_MIN_SECONDS,
      }),
    },

    notify: {
      // Which advisors get the lead. "Empty means everyone" was the old rule,
      // which meant unticking the last advisor silently emailed all of them —
      // the opposite of what the person clicking had just asked for. The
      // choice is explicit now; a page saved before this keeps its meaning,
      // because an empty list back then did mean everyone.
      notifyAll:
        notify.notifyAll !== undefined
          ? notify.notifyAll !== false
          : !(Array.isArray(notify.memberIds) && notify.memberIds.length),
      memberIds: (Array.isArray(notify.memberIds) ? notify.memberIds : []).map((x) => txt(x, 80)).filter(Boolean).slice(0, 20),
      firmInbox: notify.firmInbox !== false,
    },
  };
}

// Highest score someone could get: the best single answer to each
// single-choice question, plus every positive answer of each multi-select.
export function maxScore(quiz) {
  let total = 0;
  for (const q of quiz?.questions || []) {
    if (q.type === "single") total += Math.max(0, ...q.options.map((o) => o.points));
    else if (q.type === "multi") total += q.options.reduce((s, o) => s + Math.max(0, o.points), 0);
  }
  return Math.round(total * 100) / 100;
}

// Scores a visitor's answers against the page as it is now (never against
// anything the browser claims). Returns readable answers for the Inbox/email.
// The shortest auto-redirect the thank-you page may use. Someone has to be
// able to read the page and find the control that stops it.
export const REDIRECT_MIN_SECONDS = 20;

export function scoreAnswers(quiz, answers = {}) {
  const out = [];
  let score = 0;
  const missing = [];
  for (const q of quiz?.questions || []) {
    const raw = answers[q.id];
    if (q.type === "text") {
      const text = txt(raw, 1000);
      if (q.required && !text) missing.push(q.text);
      out.push({ question: q.text, answer: text, points: null });
      continue;
    }
    const picked = (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .map((id) => q.options.find((o) => o.id === id))
      .filter(Boolean);
    const chosen = q.type === "single" ? picked.slice(0, 1) : picked;
    if (q.required && !chosen.length) missing.push(q.text);
    const pts = chosen.reduce((s, o) => s + o.points, 0);
    score += pts;
    out.push({ question: q.text, answer: chosen.map((o) => o.label).join("; "), points: pts });
  }
  score = Math.round(score * 100) / 100;
  const max = maxScore(quiz);
  const band = (quiz?.results || []).find((r) => score >= r.min && score <= r.max) || null;
  return { score, max, band, answers: out, missing };
}

// ---- storage ----------------------------------------------------------------

function ensurePgSchema() {
  return once("__olsLandingReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS landing_pages (
        slug        TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `));
}

async function rawGetAll() {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query("SELECT data FROM landing_pages ORDER BY updated_at DESC");
    return rows.map((r) => r.data);
  }
  return readJson("landing.json", []);
}

async function rawGet(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query("SELECT data FROM landing_pages WHERE slug = $1", [slug]);
    return rows[0]?.data || null;
  }
  return (await readJson("landing.json", [])).find((p) => p.slug === slug) || null;
}

async function rawSave(page) {
  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query(
      `INSERT INTO landing_pages (slug, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [page.slug, page]
    );
    return page;
  }
  const list = await readJson("landing.json", []);
  const idx = list.findIndex((p) => p.slug === page.slug);
  if (idx >= 0) list[idx] = page;
  else list.unshift(page);
  await writeJson("landing.json", list);
  return page;
}

async function rawDelete(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    return (await getPool().query("DELETE FROM landing_pages WHERE slug = $1", [slug])).rowCount > 0;
  }
  const list = await readJson("landing.json", []);
  await writeJson("landing.json", list.filter((p) => p.slug !== slug));
  return true;
}

// ---- one-time examples --------------------------------------------------------
//
// A working Nike download page to start from (published, but reachable only by
// its link — it isn't in the navigation or the sitemap), and a questionnaire
// example saved as a draft so the scoring features are easy to see.

const SEEDS = [
  {
    slug: "nike-guide",
    name: "Nike guide download (example)",
    published: true,
    eyebrow: "For Nike Employees",
    headline: "The Nike Equity & Retirement Planning Guide",
    subhead:
      "A plain-English guide to the decisions Nike employees face with RSUs, the ESPP, the Nike 401(k), and retirement timing, from the Lake Oswego advisors at Oswego Legacy Partners.",
    bullets: [
      "How age 55 and five years of service can change what happens to unvested awards",
      "How much Nike stock may be too much, and how to diversify deliberately",
      "The questions to answer before your next vest, sale, or retirement date",
    ],
    image: "",
    quiz: { enabled: false, title: "", intro: "", startLabel: "", showPoints: false, showScore: true, questions: [], results: [] },
    form: {
      heading: "Get the free guide",
      sub: "Enter your details and your download will start right away.",
      phone: "optional",
      message: "hidden",
      messageLabel: "",
      submitLabel: "Download the guide",
      consent: "",
    },
    offer: { type: "download", pdf: "", pdfName: "", downloadLabel: "Download the guide", scheduleUrl: "", scheduleLabel: "" },
    thanks: {
      heading: "Thank you! Your guide is downloading.",
      message: "While it downloads, take a look at how we help Nike employees plan for equity, income, and retirement.",
      redirectTo: "/nike",
      redirectLabel: "Continue to our Nike planning page",
      autoRedirect: true,
      redirectDelay: 20,
    },
    notify: { memberIds: [], firmInbox: true },
  },
  {
    slug: "retirement-readiness",
    name: "Retirement readiness questionnaire (example — draft)",
    published: false,
    eyebrow: "Five-minute check-in",
    headline: "How Ready Is Your Retirement Plan?",
    subhead:
      "Answer five quick questions to see where your planning stands today, and what to look at next. Educational only; it's a starting point for a conversation, not advice.",
    bullets: [],
    image: "",
    quiz: {
      enabled: true,
      title: "Retirement Readiness Check",
      intro: "Choose the answer that fits best. There are no wrong answers.",
      startLabel: "Start the check",
      showPoints: false,
      showScore: true,
      questions: [
        {
          id: "q1ret",
          text: "Do you know roughly what you'll spend each year in retirement?",
          help: "",
          type: "single",
          required: true,
          options: [
            { id: "a1", label: "Not yet", points: 1 },
            { id: "a2", label: "A rough idea", points: 3 },
            { id: "a3", label: "Yes, a detailed budget", points: 5 },
          ],
        },
        {
          id: "q2inc",
          text: "Which income sources have you mapped out?",
          help: "",
          type: "multi",
          required: false,
          options: [
            { id: "b1", label: "Social Security timing", points: 1 },
            { id: "b2", label: "Pension or deferred compensation", points: 1 },
            { id: "b3", label: "Withdrawals from savings", points: 1 },
            { id: "b4", label: "Company stock or equity awards", points: 1 },
          ],
        },
        {
          id: "q3tax",
          text: "How much of your savings is in pre-tax accounts like a 401(k)?",
          help: "",
          type: "single",
          required: true,
          options: [
            { id: "c1", label: "Almost all of it", points: 1 },
            { id: "c2", label: "About half", points: 3 },
            { id: "c3", label: "A balanced mix of pre-tax, Roth, and taxable", points: 5 },
          ],
        },
        {
          id: "q4con",
          text: "Is more than 20% of your net worth in a single company's stock?",
          help: "",
          type: "single",
          required: true,
          options: [
            { id: "d1", label: "Yes", points: 1 },
            { id: "d2", label: "I'm not sure", points: 2 },
            { id: "d3", label: "No", points: 5 },
          ],
        },
        {
          id: "q5est",
          text: "When did you last review your estate documents and beneficiaries?",
          help: "",
          type: "single",
          required: true,
          options: [
            { id: "e1", label: "Never, or I'm not sure", points: 1 },
            { id: "e2", label: "More than five years ago", points: 3 },
            { id: "e3", label: "In the last five years", points: 5 },
          ],
        },
      ],
      results: [
        {
          min: 0,
          max: 10,
          title: "Early stages",
          message: "Several important pieces aren't in place yet, which is common and very fixable. A conversation can help you decide what to tackle first.",
          showSchedule: true,
        },
        {
          min: 11,
          max: 17,
          title: "Solid foundation",
          message: "You've covered a lot of ground. A few gaps, often taxes, concentration, or income timing, are worth a closer look.",
          showSchedule: true,
        },
        {
          min: 18,
          max: 24,
          title: "Well prepared",
          message: "Your planning is in good shape. A periodic review helps keep it that way as markets, tax rules, and your goals change.",
          showSchedule: true,
        },
      ],
    },
    form: {
      heading: "Almost done: where should we send your results?",
      sub: "Your score appears on the next screen.",
      phone: "optional",
      message: "hidden",
      messageLabel: "",
      submitLabel: "See my results",
      consent: "",
    },
    offer: { type: "schedule", pdf: "", pdfName: "", downloadLabel: "", scheduleUrl: "", scheduleLabel: "Schedule a conversation" },
    thanks: {
      heading: "Thank you",
      message: "One of our advisors will follow up personally.",
      redirectTo: "",
      redirectLabel: "",
      autoRedirect: false,
      redirectDelay: 20,
    },
    notify: { memberIds: [], firmInbox: true },
  },
];

async function doSeed() {
  // No seeded landing pages on a personal site. Create your own in the admin
  // (Landing tab). SEEDS kept for reference/import only.
  void SEEDS;
  return;
}

function ensureSeed() {
  return once("__olsSeedLanding", doSeed);
}

export async function getAllLandingPages() {
  await ensureSeed();
  return (await rawGetAll()).map(withCurrentRules);
}

// Rows saved before a rule changed are only ever re-checked when an admin
// re-saves them, and nobody re-saves a page that looks fine. The live
// nike-guide row still holds an eight-second redirect, which is too short for
// anyone to read the page, let alone stop it. Enforcing the floor on the way
// out means the page is right today rather than whenever it is next edited.
function withCurrentRules(page) {
  if (!page) return page;
  let next = page;

  const delay = Number(page.thanks?.redirectDelay);
  if (page.thanks && !(Number.isFinite(delay) && delay >= REDIRECT_MIN_SECONDS)) {
    next = { ...next, thanks: { ...page.thanks, redirectDelay: REDIRECT_MIN_SECONDS } };
  }

  // A page saved before notifyAll existed has no opinion about it, and an
  // empty list used to mean "everyone". Reading that as "nobody" would quietly
  // stop every advisor being told about a lead — the page only says so when it
  // is next re-saved, and nobody re-saves a page that looks fine.
  if (page.notify && page.notify.notifyAll === undefined) {
    next = {
      ...next,
      notify: {
        ...page.notify,
        notifyAll: !(Array.isArray(page.notify.memberIds) && page.notify.memberIds.length),
      },
    };
  }

  return next;
}

export async function getLandingPage(slug) {
  await ensureSeed();
  return withCurrentRules(await rawGet(slug));
}

export async function saveLandingPage(page) {
  await ensureSeed();
  return rawSave(page);
}

export async function deleteLandingPage(slug) {
  await ensureSeed();
  return rawDelete(slug);
}
