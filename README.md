# Chrome Extension Dev Environment + Build Instructions (MV3)

This repo now includes the extension scaffold in `braille-font-toggle/` (load that folder via **Load unpacked**).
Goal: A Chrome extension that adds a toolbar button (top-right extension area) to toggle ON/OFF a Braille font override for the currently active tab.

---

## 1) Recommended Dev Environment
Use **VS Code** + **Node.js (LTS)** + **Chrome**.

Why:
- VS Code is the most frictionless for extension work (file tree, JSON/JS/CSS editing, simple debugging).
- Node isn’t strictly required for a vanilla extension, but it’s useful for optional tooling (formatting, zipping builds).
- Chrome DevTools makes debugging content injection trivial.

Install:
- VS Code
- Node.js LTS (if you want tooling; optional)
- Google Chrome

---

## 2) Project Setup (Folder + Files)
Create a new folder:
- `braille-font-toggle/`

Inside it, create this structure:
- `braille-font-toggle/`
  - `manifest.json`
  - `service_worker.js`
  - `content.css`
  - `fonts/`
    - `BrailleFont.woff2`   (you will supply this; see notes)
  - `icons/`
    - `icon16.png`
    - `icon32.png`
    - `icon48.png`
    - `icon128.png`

Notes:
- **You must provide a Braille font file**. A `.woff2` is preferred.
- Name it `BrailleFont.woff2` to match the CSS below, or update the CSS to match your filename.
- Make sure you have the right to use/distribute the font.

---

## 3) Manifest (MV3)
Create `manifest.json` with:
- A toolbar button (`action`)
- Permissions to inject CSS into the active tab (`scripting`, `activeTab`)
- A service worker that toggles injection

`manifest.json`:
{
  "manifest_version": 3,
  "name": "Braille Font Toggle",
  "version": "1.0.0",
  "description": "Toggle a Braille font override on the current tab.",
  "permissions": ["activeTab", "scripting", "storage"],
  "action": {
    "default_title": "Toggle Braille Font"
  },
  "background": {
    "service_worker": "service_worker.js"
  },
  "web_accessible_resources": [
    {
      "resources": ["content.css", "fonts/BrailleFont.woff2"],
      "matches": ["<all_urls>"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}

Why `web_accessible_resources`:
- It allows the injected CSS to load the packaged font file via `chrome.runtime.getURL(...)` semantics (Chrome handles the URL mapping).

---

## 4) CSS to Override Fonts
Create `content.css` that:
- Declares the Braille font via `@font-face` using the extension-packaged font
- Forces the font across the page via `font-family: ... !important`

`content.css`:
@font-face {
  font-family: "ExtensionBraille";
  src: url("fonts/BrailleFont.woff2") format("woff2");
  font-weight: normal;
  font-style: normal;
}

html, body, * {
  font-family: "ExtensionBraille", sans-serif !important;
}

Optional improvements (if needed):
- Add `code, pre { font-family: "ExtensionBraille", monospace !important; }` if you want code blocks handled differently.
- Some pages use Shadow DOM; this won’t always penetrate it. Start simple first.

---

## 5) Toggle Logic (Toolbar Button)
Create `service_worker.js` to:
- Track a per-tab ON/OFF state
- Inject or remove the CSS when the user clicks the extension’s toolbar button

`service_worker.js`:
const STATE_KEY_PREFIX = "braille_enabled_tab_";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const key = `${STATE_KEY_PREFIX}${tab.id}`;

  // Read current state
  const stored = await chrome.storage.session.get(key);
  const enabled = Boolean(stored[key]);

  if (enabled) {
    // Turn OFF: remove injected CSS
    try {
      await chrome.scripting.removeCSS({
        target: { tabId: tab.id },
        files: ["content.css"]
      });
    } catch (e) {
      // removeCSS can fail if CSS was never injected; ignore
    }

    await chrome.storage.session.set({ [key]: false });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  } else {
    // Turn ON: inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content.css"]
    });

    await chrome.storage.session.set({ [key]: true });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "ON" });
  }
});

// Clean up state when a tab closes (optional but nice)
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const key = `${STATE_KEY_PREFIX}${tabId}`;
  await chrome.storage.session.remove(key);
});

Notes:
- Uses `chrome.storage.session` so state resets when the browser restarts.
- Badge text shows “ON” when enabled.

---

## 6) Load Extension in Chrome (Dev Mode)
1. Open Chrome.
2. Go to: `chrome://extensions`
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked**
5. Select the `braille-font-toggle/` folder.

Test:
- Visit any normal website (not Chrome Web Store or `chrome://` pages).
- Click the extension icon in the top-right toolbar.
- Font should toggle.

---

## 7) Debugging
- Open DevTools on the page to confirm CSS injection:
  - Inspect an element → look for overridden `font-family`.
- For service worker logs:
  - `chrome://extensions` → your extension → **Service worker** → “Inspect views”.

Common issues:
- Nothing changes: page might be blocking injection or uses canvas/text-as-image.
- Font not loading: confirm `fonts/BrailleFont.woff2` exists and filename matches `content.css`.
- Some sites are restricted: Chrome Web Store pages and internal Chrome pages cannot be modified.

---

## 8) Font Notes (Braille Fonts)
You need a Braille font that:
- Is legally distributable in your extension, and
- Actually maps characters the way you expect.

Most “Braille fonts” render Braille *patterns* for Unicode Braille block characters (U+2800–U+28FF). If you want normal Latin letters to *appear as braille*, you may need a specialty font/mapping (or transform text into braille characters, which is a different feature).

Start with font-only override first. If later you want “translate English to braille,” that requires text replacement logic (content script) and is more invasive.

---

## 9) Packaging (Optional)
To share:
- Zip the folder contents (not the parent directory), then load as unpacked for testing.
For Chrome Web Store distribution, you’ll follow their upload and review process.

---

## 10) Agent Instructions (What the AI Should Generate)
Create a complete MV3 Chrome extension in a folder `braille-font-toggle/` with:
- `manifest.json` exactly as above (or improved, but same behavior)
- `service_worker.js` implementing per-tab toggle using `insertCSS` / `removeCSS`
- `content.css` with `@font-face` and global `font-family` override
- Placeholder icons in `icons/`
- A `fonts/` directory containing a placeholder font file reference and clear instructions for the user to replace it with a real `.woff2`

Deliverable expectations:
- The extension must load via “Load unpacked” and the toolbar button must toggle the font on the active tab.
- Include concise comments in code and ensure no extra frameworks are required.