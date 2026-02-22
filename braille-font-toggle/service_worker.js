const STATE_KEY_PREFIX = "braille_enabled_tab_";

function toggleBrailleInPage(enable, fontUrl) {
  const ATTR = "data-braille-font";
  const VAR = "--braille-orig-font";
  const STYLE_ID = "__braille_font_toggle_style";
  const STATE_KEY = "__braille_font_toggle_state";

  if (!document?.body) return;

  const state = (globalThis[STATE_KEY] ||= {
    observer: null,
    scheduled: false,
    lastFontUrl: "",
  });

  const iconFontHints = [
    "font awesome",
    "material icons",
    "material symbols",
    "segoe mdl2 assets",
    "ionicons",
    "glyphicons",
    "bootstrap-icons",
    "feather",
    "octicons",
  ];

  const skipTags = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "SVG",
    "IMG",
    "CANVAS",
    "VIDEO",
    "AUDIO",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "SELECT",
    "OPTION",
    "LINK",
    "META",
    "HEAD",
  ]);

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    if (skipTags.has(el.tagName)) return true;

    const className = (el.className || "").toString().toLowerCase();
    const text = (el.textContent || "").trim();

    if ((className.includes("icon") || className.includes("fa-") || className.includes("material-icons")) && text.length <= 2) {
      return true;
    }

    const fontFamily = (getComputedStyle(el).fontFamily || "").toLowerCase();
    if (iconFontHints.some((hint) => fontFamily.includes(hint))) return true;
    if (fontFamily.includes("icon") && text.length <= 2) return true;

    return false;
  }

  function ensureStyle(url) {
    if (typeof url !== "string" || !url) return;
    if (state.lastFontUrl === url && document.getElementById(STYLE_ID)) return;
    state.lastFontUrl = url;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }

    style.textContent = `@font-face {
  font-family: "ExtensionBraille";
  src: url("${url}") format("woff2");
  font-weight: normal;
  font-style: normal;
}

[${ATTR}="1"] {
  font-family: "ExtensionBraille", var(${VAR}, inherit) !important;
}`;
  }

  function applyToElement(el) {
    if (!el) return false;
    if (el.hasAttribute?.(ATTR)) return false;
    if (shouldSkipElement(el)) return false;

    const originalFontFamily = getComputedStyle(el).fontFamily;
    if (!originalFontFamily) return false;

    el.style.setProperty(VAR, originalFontFamily);
    el.setAttribute(ATTR, "1");
    return true;
  }

  function isEditableControl(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;

    if (tag === "INPUT") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      // Target typical text-like inputs; avoid checkboxes/radios/buttons/etc.
      return ["text", "search", "url", "email", "tel", "number"].includes(type);
    }

    // contenteditable can be "" or "true"; treat both as enabled.
    const ce = (el.getAttribute("contenteditable") || "").toLowerCase();
    return ce === "" ? el.isContentEditable === true : ce === "true";
  }

  function applyToEditableControl(el) {
    if (!isEditableControl(el)) return false;
    if (el.hasAttribute?.(ATTR)) return false;

    const originalFontFamily = getComputedStyle(el).fontFamily;
    if (!originalFontFamily) return false;

    el.style.setProperty(VAR, originalFontFamily);
    el.setAttribute(ATTR, "1");
    return true;
  }

  function applyToEditableControls(root, maxControls) {
    const base = root?.querySelectorAll ? root : document;
    if (!base?.querySelectorAll) return 0;

    const nodes = base.querySelectorAll('input, textarea, [contenteditable]');
    let applied = 0;
    for (const el of nodes) {
      if (applied >= maxControls) break;
      if (applyToEditableControl(el)) applied += 1;
    }
    return applied;
  }

  function scanRoot(root, maxElements) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node?.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let applied = 0;
    const touched = new Set();

    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (!el || touched.has(el)) continue;
      touched.add(el);

      if (applyToElement(el)) {
        applied += 1;
        if (applied >= maxElements) break;
      }
    }

    return applied;
  }

  function scheduleRescan(nodes) {
    if (state.scheduled) return;
    state.scheduled = true;

    const run = () => {
      state.scheduled = false;

      const MAX_ELEMENTS_PER_TICK = 1200;
      let remaining = MAX_ELEMENTS_PER_TICK;

      const MAX_CONTROLS_PER_TICK = 200;
      let remainingControls = MAX_CONTROLS_PER_TICK;

      for (const node of nodes) {
        if (remaining <= 0) break;
        const root =
          node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE
            ? node
            : node?.nodeType === Node.ELEMENT_NODE
              ? node
              : node?.nodeType === Node.TEXT_NODE
                ? node.parentElement
                : null;
        if (!root) continue;
        remaining -= scanRoot(root, remaining);

        if (remainingControls > 0) {
          remainingControls -= applyToEditableControls(root, remainingControls);
        }
      }
    };

    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 500 });
    else setTimeout(run, 0);
  }

  if (!enable) {
    if (state.observer) {
      try {
        state.observer.disconnect();
      } catch {
        // ignore
      }
      state.observer = null;
    }

    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();

    document.querySelectorAll(`[${ATTR}="1"]`).forEach((el) => {
      el.removeAttribute(ATTR);
      el.style.removeProperty(VAR);
    });

    delete globalThis[STATE_KEY];
    return;
  }

  if (typeof fontUrl !== "string" || !fontUrl) return;

  ensureStyle(fontUrl);
  scanRoot(document.body, 5000);
  applyToEditableControls(document, 500);

  if (!state.observer) {
    state.observer = new MutationObserver((mutations) => {
      const added = [];
      for (const m of mutations) {
        for (const n of m.addedNodes || []) added.push(n);
      }
      if (added.length) scheduleRescan(added);
    });

    state.observer.observe(document.body, { childList: true, subtree: true });
  }
}

async function getEnabledForTab(tabId) {
  const key = `${STATE_KEY_PREFIX}${tabId}`;
  const stored = await chrome.storage.session.get(key);
  return Boolean(stored[key]);
}

async function setEnabledForTab(tabId, enabled) {
  const key = `${STATE_KEY_PREFIX}${tabId}`;
  await chrome.storage.session.set({ [key]: Boolean(enabled) });
}

async function refreshBadge(tabId) {
  if (!tabId) return;
  const enabled = await getEnabledForTab(tabId);
  await chrome.action.setBadgeText({ tabId, text: enabled ? "ON" : "" });
}

async function applyBraille(tabId) {
  const fontUrl = chrome.runtime.getURL("fonts/BrailleFont.woff2");
  await chrome.scripting.executeScript({
    target: { tabId },
    func: toggleBrailleInPage,
    args: [true, fontUrl],
  });
}

async function removeBraille(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: toggleBrailleInPage,
    args: [false, ""],
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  const enabled = await getEnabledForTab(tab.id);

  if (enabled) {
    try {
      await removeBraille(tab.id);
    } catch {
      // ignore: pages like chrome:// or the Web Store can block injection
    }

    await setEnabledForTab(tab.id, false);
    await refreshBadge(tab.id);
    return;
  }

  try {
    await applyBraille(tab.id);
  } catch {
    // If we can't inject, don't persist an enabled state.
    await setEnabledForTab(tab.id, false);
    await refreshBadge(tab.id);
    return;
  }

  await setEnabledForTab(tab.id, true);
  await refreshBadge(tab.id);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const key = `${STATE_KEY_PREFIX}${tabId}`;
  await chrome.storage.session.remove(key);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;

  const enabled = await getEnabledForTab(tabId);
  if (!enabled) {
    await refreshBadge(tabId);
    return;
  }

  try {
    await applyBraille(tabId);
  } catch {
    // If the page blocks injection, fall back to off for that tab.
    await setEnabledForTab(tabId, false);
  }

  await refreshBadge(tabId);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await refreshBadge(tabId);
});
