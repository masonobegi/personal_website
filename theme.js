/* Shared behavior used on every page: force the light theme + copy-email. */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// Single fixed theme — no user-facing light/dark toggle.
function initTheme() {
  applyTheme("light");
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
