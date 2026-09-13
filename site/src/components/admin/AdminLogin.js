"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Whether a second factor is switched on for this site. Asked once, so the
  // code box is already there rather than appearing after a failed attempt.
  const [totp, setTotp] = useState(false);

  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((j) => setTotp(Boolean(j?.totp)))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.currentTarget;
    const password = form.password.value;
    const code = form.code?.value || "";

    let res;
    try {
      res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      });
    } catch {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    setLoading(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (json.totp) setTotp(true);
    setError(json.error || "Login failed.");
  }

  return (
    <div style={{ maxWidth: 420, marginInline: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div className="eyebrow">Oswego Legacy Partners</div>
        <h1 style={{ fontSize: "2.2rem", marginTop: 10 }}>Admin Dashboard</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 16 }}>
          Sign in to manage custom pages.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ background: "#fff" }}
      >
        <div className="field">
          <label htmlFor="admin-pass">Password</label>
          <input id="admin-pass" name="password" type="password" required autoComplete="current-password" />
        </div>
        {totp && (
          <div className="field">
            <label htmlFor="admin-code">Authenticator code</label>
            <input
              id="admin-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              required
            />
          </div>
        )}
        <button
          type="submit"
          className="btn btn-ember"
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
        {error && (
          <p style={{ marginTop: 14, color: "#9c3f20", fontSize: 15 }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
