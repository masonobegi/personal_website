"use client";

import { useEffect, useRef, useState } from "react";
import { readAttribution, trackLead } from "@/lib/attribution";

export default function ContactForm({ source = "website" }) {
  const [status, setStatus] = useState("idle"); // idle | sending | ok | error
  const [message, setMessage] = useState("");
  const startedAt = useRef(0);
  const doneRef = useRef(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = e.currentTarget;
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      concern: form.concern.value.trim(),
      source,
      website: form.website.value, // honeypot — people never see it
      elapsedMs: Date.now() - startedAt.current,
      attribution: readAttribution(),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok) {
        setStatus("ok");
        trackLead(`contact:${source}`);
        // Says only what is certainly true. The server now treats a message as
        // successfully handled once it is safely recorded, which is right — but
        // that means an email has not necessarily gone anywhere, and telling a
        // visitor on a regulated site that it reached the team when it did not
        // is a claim we cannot make.
        setMessage("Your message has been received. We'll be in touch shortly.");
        form.reset();
      } else {
        setStatus("error");
        setMessage(json.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again in a moment.");
    }
  }

  // Sending the form swaps it for the confirmation, which destroys whatever
  // the keyboard was on. Put focus somewhere deliberate.
  useEffect(() => {
    if (status === "ok") doneRef.current?.focus();
  }, [status]);

  // The announcement region below has to survive the swap from the form to
  // the confirmation. A live region that appears at the same moment as its
  // text is never read out — so it sits in a wrapper that is returned either
  // way, and only what is inside the wrapper changes. Returning a <div> on
  // success where a <form> was returned before replaced the whole subtree and
  // took the region with it, which is what was happening.
  const liveRegion = (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {status === "ok" ? `Thank you, we've got it. ${message}` : ""}
    </div>
  );

  if (status === "ok") {
    return (
      <div>
        {liveRegion}
        <div style={{ textAlign: "center", padding: "12px 4px" }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "#e7f0e3",
            color: "#3c6b34",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            margin: "0 auto 16px",
          }}
        >
          ✓
        </div>
        <h3 ref={doneRef} tabIndex={-1} style={{ fontSize: "1.6rem", outline: "none" }}>Thank you — we&apos;ve got it.</h3>
        <p className="muted" style={{ marginTop: 10, lineHeight: 1.55 }}>
          {message}
        </p>
        <button
          type="button"
          className="btn btn-outline"
          style={{ marginTop: 20 }}
          onClick={() => {
            setStatus("idle");
            setMessage("");
          }}
        >
          Send another message
        </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {liveRegion}
      <form onSubmit={handleSubmit} noValidate>
      {/* Hidden from people; bots fill it in and are quietly ignored. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {status === "error" && (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            marginBottom: 18,
            border: "1px solid #e0a58f",
            background: "#fbeee8",
            color: "#9c3f20",
            fontSize: 15,
          }}
        >
          {message}
        </div>
      )}

      <div className="field">
        <label htmlFor="cf-name">Name</label>
        <input id="cf-name" name="name" type="text" required autoComplete="name" />
      </div>

      <div className="field">
        <label htmlFor="cf-email">Email</label>
        <input id="cf-email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="field">
        <label htmlFor="cf-concern">Primary concern</label>
        <textarea
          id="cf-concern"
          name="concern"
          rows={4}
          placeholder="A sentence or two about what's on your mind."
        />
      </div>

      <button
        type="submit"
        className="btn btn-ember"
        disabled={status === "sending"}
        style={{ width: "100%" }}
      >
        {status === "sending" ? "Sending…" : "Schedule a Consultation"}
      </button>
    </form>
  </div>
  );
}
