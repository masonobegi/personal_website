"use client";

// Every request the dashboard makes goes through here.
//
// Each tab used to call fetch directly and then `await res.json()` with nothing
// around it. Three different things went wrong as a result. A dropped
// connection threw before anything was checked, so a Save button sat on
// "Saving…" for ever with the only copy of the edit in the form. A failed
// response was parsed as if it had succeeded, so nothing was said at all. And
// an expired session returned 401 with an empty list, which every tab rendered
// as "nothing here yet" — the Library looked empty rather than signed out.

// Set by the dashboard once, so a 401 anywhere can send the admin back to the
// sign-in screen instead of showing them an empty tab.
let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

// Always resolves: { ok, status, json, error }. `error` is a sentence that can
// be shown to the admin as it is.
export async function adminFetch(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    return {
      ok: false,
      status: 0,
      json: {},
      error: "Couldn't reach the server. Nothing was saved — check your connection and try again.",
    };
  }

  if (res.status === 401) {
    unauthorizedHandler?.();
    return {
      ok: false,
      status: 401,
      json: {},
      error: "Your session has expired. Please sign in again — your changes are still on screen.",
    };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      json,
      error: json.error || `Something went wrong (error ${res.status}). Nothing was saved.`,
    };
  }
  return { ok: true, status: res.status, json, error: null };
}
