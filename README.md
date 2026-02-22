# Blind Mode

A Chrome extension that replaces all fonts on any webpage with a Braille font at the click of a button.

## What it does

Blind Mode adds a toolbar button to Chrome. Clicking it toggles a Braille font override on the active tab — all text on the page is instantly re-rendered in Braille. Click again to restore the original fonts.

## How it works

The extension is built as a Manifest V3 Chrome extension with no external dependencies:

- **Service worker** (`service_worker.js`) listens for toolbar button clicks and tracks on/off state per tab using `chrome.storage.session`. It injects or removes a CSS stylesheet into the active tab via the `chrome.scripting` API.
- **Stylesheet** (`content.css`) declares a `@font-face` rule pointing to a packaged Braille `.woff2` font file, then overrides `font-family` globally across the page.
- State is session-scoped, so it resets when the browser restarts. A badge label ("ON") indicates when the override is active on a given tab.
