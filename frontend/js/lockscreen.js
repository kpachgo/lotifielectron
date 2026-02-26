(() => {
  const LOCK_USER = "LoticadoraSys";
  const LOCK_PASSWORD = "Lotifi2025";
  const STORAGE_KEY = "lotifi_session_unlocked";
  const STYLE_ID = "lotifi-lock-style";
  const OVERLAY_ID = "lotifi-lock-overlay";

  let locked = true;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.lotifi-locked {
        overflow: hidden !important;
      }

      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(12, 18, 28, 0.75);
        backdrop-filter: blur(6px);
        padding: 20px;
      }

      #${OVERLAY_ID}.is-visible {
        display: flex;
      }

      #${OVERLAY_ID} .lotifi-lock-card {
        width: min(420px, 100%);
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
        padding: 22px;
        font-family: "Segoe UI", Tahoma, sans-serif;
      }

      #${OVERLAY_ID} .lotifi-lock-title {
        margin: 0 0 8px 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: #1f2937;
      }

      #${OVERLAY_ID} .lotifi-lock-subtitle {
        margin: 0 0 16px 0;
        color: #6b7280;
        font-size: 0.92rem;
      }

      #${OVERLAY_ID} .lotifi-lock-label {
        display: block;
        font-weight: 600;
        color: #111827;
        margin-bottom: 6px;
      }

      #${OVERLAY_ID} .lotifi-lock-input {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 12px;
        font-size: 0.95rem;
        outline: none;
      }

      #${OVERLAY_ID} .lotifi-lock-input:focus {
        border-color: #111827;
        box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.14);
      }

      #${OVERLAY_ID} .lotifi-lock-user {
        background: #f3f4f6;
        color: #374151;
      }

      #${OVERLAY_ID} .lotifi-lock-help {
        color: #6b7280;
        font-size: 0.83rem;
        margin-bottom: 14px;
      }

      #${OVERLAY_ID} .lotifi-lock-button {
        width: 100%;
        border: none;
        border-radius: 8px;
        padding: 10px 12px;
        font-weight: 600;
        background: #111827;
        color: #ffffff;
      }

      #${OVERLAY_ID} .lotifi-lock-button:hover {
        background: #1f2937;
      }

      #${OVERLAY_ID} .lotifi-lock-error {
        margin-top: 10px;
        color: #b91c1c;
        font-size: 0.88rem;
        min-height: 18px;
      }
    `;

    document.head.appendChild(style);
  }

  function isSessionUnlocked() {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  }

  function markSessionUnlocked(value) {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="lotifi-lock-card" role="dialog" aria-modal="true" aria-label="Bloqueo del sistema">
        <h2 class="lotifi-lock-title">Sistema bloqueado</h2>
        <p class="lotifi-lock-subtitle">Ingrese la contrasena para continuar.</p>
        <form id="lotifi-lock-form" autocomplete="off">
          <label class="lotifi-lock-label" for="lotifi-lock-user">Usuario</label>
          <input
            id="lotifi-lock-user"
            class="lotifi-lock-input lotifi-lock-user"
            type="text"
            value="${LOCK_USER}"
            readonly
          />
          <label class="lotifi-lock-label" for="lotifi-lock-password">Contrasena</label>
          <input
            id="lotifi-lock-password"
            class="lotifi-lock-input"
            type="password"
            required
            autofocus
          />
          <div class="lotifi-lock-help">Atajo para bloquear: Ctrl + Space (respaldo: Ctrl + Shift + L)</div>
          <button class="lotifi-lock-button" type="submit">Desbloquear</button>
          <div class="lotifi-lock-error" id="lotifi-lock-error"></div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector("#lotifi-lock-form");
    const passwordInput = overlay.querySelector("#lotifi-lock-password");
    const errorBox = overlay.querySelector("#lotifi-lock-error");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (passwordInput.value === LOCK_PASSWORD) {
        errorBox.textContent = "";
        passwordInput.value = "";
        unlockSystem();
        return;
      }

      errorBox.textContent = "Contrasena incorrecta.";
      passwordInput.value = "";
      passwordInput.focus();
    });
  }

  function focusPassword() {
    const input = document.querySelector("#lotifi-lock-password");
    if (!input) return;
    window.setTimeout(() => input.focus(), 40);
  }

  function lockSystem() {
    const overlay = document.getElementById(OVERLAY_ID);
    const errorBox = document.getElementById("lotifi-lock-error");
    const passwordInput = document.getElementById("lotifi-lock-password");
    if (!overlay) return;

    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("lotifi-locked");
    locked = true;
    markSessionUnlocked(false);

    if (errorBox) errorBox.textContent = "";
    if (passwordInput) passwordInput.value = "";
    focusPassword();
  }

  function unlockSystem() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lotifi-locked");
    locked = false;
    markSessionUnlocked(true);
  }

  function bindShortcut() {
    document.addEventListener(
      "keydown",
      (event) => {
        const isCtrlSpace =
          event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          (event.code === "Space" || event.key === " ");

        const isCtrlShiftL =
          event.ctrlKey &&
          event.shiftKey &&
          !event.altKey &&
          !event.metaKey &&
          (event.code === "KeyL" || event.key.toLowerCase() === "l");

        if (!isCtrlSpace && !isCtrlShiftL) return;

        event.preventDefault();
        if (!locked) {
          lockSystem();
        }
      },
      true
    );
  }

  function initLock() {
    injectStyle();
    createOverlay();
    bindShortcut();

    if (isSessionUnlocked()) {
      unlockSystem();
      return;
    }

    lockSystem();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLock);
  } else {
    initLock();
  }

  window.LOTIFI_LOCK = {
    lock: lockSystem,
    unlock: unlockSystem,
    isLocked: () => locked,
    user: LOCK_USER
  };
})();
