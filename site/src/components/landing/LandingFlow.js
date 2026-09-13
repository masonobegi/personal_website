"use client";

import { useEffect, useRef, useState } from "react";
import { readAttribution, trackLead } from "@/lib/attribution";
import { formatText as fmt } from "@/lib/formatText";

// The interactive part of an ad landing page:
//
//   intro → (questions, one per screen) → contact form → results / thank you
//
// With no questionnaire it opens straight on the form. After a successful
// submit it starts the download (if there is one), shows the score and its
// message (if there's a questionnaire), offers the scheduling link (if set),
// and — if the page is set to — moves the visitor on to another page after a
// countdown they can stop.

const DEFAULT_CONSENT =
  "By submitting, you agree that Oswego Legacy Partners may contact you about your request. We never sell your information. See our [Privacy Notice](/privacy).";

export default function LandingFlow({ config }) {
  const { quiz, form, offer, thanks } = config;
  const questions = quiz?.questions || [];
  // Steps: "intro" (quiz only) → 0..n-1 → "form" → "done"
  const [step, setStep] = useState(quiz ? "intro" : "form");
  const [answers, setAnswers] = useState({});
  const [values, setValues] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null); // server response
  const [countdown, setCountdown] = useState(null);
  // Kept separate from `countdown` so the control can stay on the page after
  // it is used. It used to unmount itself, dropping focus onto nothing.
  const [stopped, setStopped] = useState(false);
  const headingRef = useRef(null);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Move focus to each new step's heading so screen-reader and keyboard users
  // land on the new content (skipped on first load).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // Thank-you redirect countdown.
  useEffect(() => {
    if (countdown === null || stopped) return undefined;
    if (countdown <= 0) {
      window.location.href = thanks.redirectTo;
      return undefined;
    }
    const t = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, stopped, thanks.redirectTo]);

  const setValue = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  // ---- questionnaire ----
  const qIndex = typeof step === "number" ? step : -1;
  const current = questions[qIndex];

  function answered(q) {
    const a = answers[q.id];
    if (q.type === "text") return Boolean(String(a || "").trim());
    return Array.isArray(a) ? a.length > 0 : Boolean(a);
  }

  function pick(q, optionId) {
    setError("");
    setAnswers((prev) => {
      if (q.type === "multi") {
        const cur = Array.isArray(prev[q.id]) ? prev[q.id] : [];
        return { ...prev, [q.id]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
      }
      return { ...prev, [q.id]: optionId };
    });
  }

  function next() {
    if (current && current.required && !answered(current)) {
      setError(current.type === "multi" ? "Please choose at least one answer." : "Please choose an answer to continue.");
      return;
    }
    setError("");
    setStep(qIndex + 1 < questions.length ? qIndex + 1 : "form");
  }

  function back() {
    setError("");
    if (step === "form") setStep(questions.length ? questions.length - 1 : "intro");
    else if (qIndex > 0) setStep(qIndex - 1);
    else setStep("intro");
  }

  // ---- submit ----
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return setError("Please enter a valid email address.");
    if (form.phone === "required" && values.phone.replace(/\D/g, "").length < 7) return setError("Please enter a phone number.");
    if (form.message === "required" && !values.message.trim()) return setError("Please add a short message.");

    setSending(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: config.slug,
          ...values,
          answers,
          attribution: readAttribution(),
          elapsedMs: Date.now() - startedAt.current,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
      trackLead(config.slug);
      setDone(json);
      setStep("done");
      // Twenty seconds is the floor. Anyone who needs longer has the control
      // below to stop it; three seconds did not leave time to find it.
      if (thanks.redirectTo && thanks.autoRedirect) {
        setCountdown(Math.max(20, Math.round(thanks.redirectDelay || 20)));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const progress =
    typeof step === "number" ? (step + 1) / (questions.length + 1) : step === "form" && quiz ? 1 : 0;

  // =========================================================================
  if (step === "intro") {
    return (
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="lp-card-title">
          {fmt(quiz.title || "A few quick questions")}
        </h2>
        {quiz.intro && <p className="lp-card-sub">{fmt(quiz.intro)}</p>}
        <p className="lp-card-meta">
          {questions.length} question{questions.length === 1 ? "" : "s"} · about {Math.max(1, Math.round(questions.length * 0.4))} minute
          {Math.round(questions.length * 0.4) > 1 ? "s" : ""}
        </p>
        <button type="button" className="btn btn-ember lp-full" onClick={() => setStep(0)}>
          {quiz.startLabel || "Start"}
        </button>
      </div>
    );
  }

  if (current) {
    const Input = current.type === "multi" ? "checkbox" : "radio";
    const picked = answers[current.id];
    return (
      <div>
        <Progress value={progress} label={`Question ${qIndex + 1} of ${questions.length}`} />
        <fieldset className="lp-q">
          <legend>
            <span ref={headingRef} tabIndex={-1} className="lp-card-title lp-q-text">
              {fmt(current.text)}
            </span>
          </legend>
          {(current.help || current.type === "multi") && (
            <p className="lp-card-sub">{current.help ? fmt(current.help) : "Select all that apply."}</p>
          )}
          {current.type === "text" ? (
            <textarea
              className="lp-input"
              rows={4}
              value={picked || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
              aria-label={current.text}
            />
          ) : (
            <div className="lp-options">
              {current.options.map((o) => {
                const on = Array.isArray(picked) ? picked.includes(o.id) : picked === o.id;
                return (
                  <label key={o.id} className={`lp-option${on ? " is-on" : ""}`}>
                    <input
                      type={Input}
                      name={`q-${current.id}`}
                      checked={on}
                      onChange={() => pick(current, o.id)}
                    />
                    <span className="lp-option-label">{fmt(o.label)}</span>
                    {typeof o.points === "number" && (
                      <span className="lp-points">
                        {o.points} pt{o.points === 1 ? "" : "s"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
        <ErrorLine error={error} />
        <div className="lp-nav">
          <button type="button" className="btn btn-outline" onClick={back}>
            Back
          </button>
          <button type="button" className="btn btn-ember" onClick={next}>
            {qIndex + 1 < questions.length ? "Next" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "form") {
    return (
      <form onSubmit={submit} noValidate>
        {quiz && <Progress value={1} label="Last step" />}
        <h2 ref={headingRef} tabIndex={-1} className="lp-card-title">
          {fmt(form.heading || (quiz ? "Where should we send your results?" : "Get it now"))}
        </h2>
        {form.sub && <p className="lp-card-sub">{fmt(form.sub)}</p>}

        {/* Hidden from people; bots fill it in and are quietly ignored. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={values.website} onChange={setValue("website")} />
          </label>
        </div>

        <div className="field">
          <label htmlFor="lp-name">Name</label>
          <input id="lp-name" autoComplete="name" value={values.name} onChange={setValue("name")} required />
        </div>
        <div className="field">
          <label htmlFor="lp-email">Email</label>
          <input id="lp-email" type="email" autoComplete="email" value={values.email} onChange={setValue("email")} required />
        </div>
        {form.phone !== "hidden" && (
          <div className="field">
            <label htmlFor="lp-phone">Phone{form.phone === "optional" ? " (optional)" : ""}</label>
            <input
              id="lp-phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={setValue("phone")}
              required={form.phone === "required"}
            />
          </div>
        )}
        {form.message !== "hidden" && (
          <div className="field">
            <label htmlFor="lp-message">
              {form.messageLabel || "Anything you'd like us to know?"}
              {form.message === "optional" ? " (optional)" : ""}
            </label>
            <textarea id="lp-message" rows={3} value={values.message} onChange={setValue("message")} required={form.message === "required"} />
          </div>
        )}

        <ErrorLine error={error} />

        <button type="submit" className="btn btn-ember lp-full" disabled={sending}>
          {sending
            ? "Sending…"
            : form.submitLabel ||
              (offer.type === "download" ? offer.downloadLabel || "Download" : quiz ? "See my results" : "Submit")}
        </button>
        <p className="lp-consent">{fmt(form.consent || DEFAULT_CONSENT, { links: true })}</p>
        {quiz && (
          <button type="button" className="lp-back-link" onClick={back}>
            ‹ Back to the questions
          </button>
        )}
      </form>
    );
  }

  // ---- done ----
  const r = done?.result;
  const scheduleExternal = /^https?:\/\//.test(done?.scheduleUrl || "");
  return (
    <div>
      {done?.download && (
        // Starts the download without leaving the page; the button below is
        // the fallback (phones often need a tap).
        <iframe src={done.download} title="Download" style={{ display: "none" }} />
      )}
      <div className="lp-check" aria-hidden="true">
        ✓
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="lp-card-title" style={{ textAlign: "center" }}>
        {fmt(thanks.heading || (done?.download ? "Thank you! Your download has started." : "Thank you!"))}
      </h2>

      {r && (r.showScore || r.band) && (
        <div className="lp-result">
          {r.showScore && (
            <div className="lp-score" aria-label={`Your score: ${r.score} out of ${r.max}`}>
              <span className="lp-score-n">{r.score}</span>
              <span className="lp-score-of">/ {r.max}</span>
            </div>
          )}
          {r.band?.title && <h3 className="lp-band">{fmt(r.band.title)}</h3>}
          {r.band?.message && <p className="lp-card-sub">{fmt(r.band.message, { links: true })}</p>}
        </div>
      )}

      {thanks.message && <p className="lp-card-sub" style={{ textAlign: "center" }}>{fmt(thanks.message, { links: true })}</p>}

      {countdown !== null && (
        <p className="lp-countdown">
          {stopped ? (
            "Staying on this page."
          ) : (
            <>
              <span aria-hidden="true">
                Taking you there in {countdown} second{countdown === 1 ? "" : "s"}.{" "}
              </span>
              <button type="button" onClick={() => setStopped(true)}>
                Stay on this page
              </button>
            </>
          )}
        </p>
      )}

      <div className="lp-actions">
        {done?.download && (
          <>
            <p className="lp-card-meta" style={{ textAlign: "center", margin: 0 }}>
              If the download didn&apos;t start, use this button:
            </p>
            <a href={done.download} className="btn btn-ember lp-full" target="_blank" rel="noopener">
              {offer.downloadLabel || "Download the PDF"}
            </a>
          </>
        )}
        {done?.scheduleUrl && (
          <a
            href={done.scheduleUrl}
            className={`btn ${done.download ? "btn-outline" : "btn-ember"} lp-full`}
            {...(scheduleExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {offer.scheduleLabel || "Schedule a conversation"}
          </a>
        )}
        {thanks.redirectTo && (
          <a href={thanks.redirectTo} className="btn btn-outline lp-full">
            {thanks.redirectLabel || "Continue"} →
          </a>
        )}
      </div>

      {/* Said once, when the countdown starts. The number itself is hidden
          from screen readers — announcing it every second meant the rest of
          the page could never be heard over it. */}
      <p aria-live="polite" className="sr-only">
        {countdown !== null && stopped === false
          ? `This page will move to ${thanks.redirectLabel || "the next page"} shortly. Choose "Stay on this page" to cancel.`
          : ""}
      </p>
    </div>
  );
}

function Progress({ value, label }) {
  return (
    <div className="lp-progress">
      <div className="lp-progress-label">{label}</div>
      <div className="lp-progress-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function ErrorLine({ error }) {
  return (
    <p className="lp-error" role="alert" aria-live="assertive">
      {error}
    </p>
  );
}
