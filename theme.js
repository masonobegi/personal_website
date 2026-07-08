/* Shared behavior used on every page: light/dark theme toggle + copy-email. */

const SUN =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.innerHTML = theme === "dark" ? SUN : MOON;
}

function initTheme() {
  let theme = "light";
  try {
    theme = localStorage.getItem("theme") || "light";
  } catch (e) {}
  applyTheme(theme);
  const btn = document.getElementById("theme-toggle");
  if (btn)
    btn.addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
    });
}

// Click-to-copy email — avoids opening a mail client (Outlook, etc.)
function initCopyEmail() {
  document.querySelectorAll(".copy-email").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const email = el.getAttribute("data-email");
      const done = () => {
        if (!el.dataset.original) el.dataset.original = el.textContent;
        el.textContent = "Copied!";
        setTimeout(() => { el.textContent = el.dataset.original; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done).catch(done);
      } else {
        done();
      }
    });
  });
}
