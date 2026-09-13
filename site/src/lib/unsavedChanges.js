"use client";

import { useEffect, useRef } from "react";

// Half-finished work in the dashboard used to disappear without a word.
// Switching tabs to glance at a new lead unmounted whatever was being edited,
// and Cancel threw it away on one click — in a form that can hold a rewritten
// article. Closing the browser tab did the same.
//
// One module-level flag is enough because only one editor is ever open: the
// dashboard mounts a single tab at a time.

let dirty = false;

// True when it is safe to navigate away: nothing unsaved, or the admin said so.
export function confirmDiscard(
  message = "You have unsaved changes here. Leave and lose them?"
) {
  if (!dirty) return true;
  const ok = confirm(message);
  if (ok) dirty = false;
  return ok;
}

// Watches an editor's working copy. Only counts as unsaved once something has
// actually changed, so opening a form and closing it again asks nothing.
// `savedAt` is any value that changes when the form is successfully saved — a
// counter, a timestamp. Most editors close on save, which re-baselines them for
// free; the Content tab stays open with the saved document still in it, so
// without this it went on reporting unsaved changes for ever afterwards and
// asked about them on the way out of every tab.
export function useUnsavedChanges(value, savedAt) {
  const baseline = useRef(null);
  const lastSaved = useRef(savedAt);
  const open = Boolean(value);
  const snapshot = open ? JSON.stringify(value) : null;

  if (savedAt !== lastSaved.current) {
    lastSaved.current = savedAt;
    baseline.current = snapshot;
    dirty = false;
  }

  useEffect(() => {
    if (!open) {
      baseline.current = null;
      dirty = false;
      return undefined;
    }
    if (baseline.current === null) baseline.current = snapshot;
    dirty = baseline.current !== snapshot;
    if (!dirty) return undefined;

    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, snapshot]);

  // Whatever happens to this component, the flag must not outlive it.
  useEffect(() => () => {
    dirty = false;
  }, []);
}
