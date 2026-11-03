# Implementation plan — Nigerian Customs Service Visitor

## Product scope

Build a client-presentable Visitor Desk Check demo as a pure static website, explicitly labeled **DEMO VERSION** and not presented as an official government service. Use HTML, CSS, and browser-native JavaScript; do not add a backend or third-party runtime dependencies. Persist demo records in browser `localStorage`, including resized/compressed JPEG photos as data URLs. Keep the storage adapter isolated so a future Laravel or Django API can replace it.

The screens are a demo login with visible Receptionist/Admin credentials; a three-step visitor check-in wizard; a second-monitor customer display at `/display/`; a live Visitors Inside list; a standalone 1–50 Tag Board; Admin Reports; and Admin Settings plus an Admin-visible audit log and end-of-day in-use tag panel. First launch seeds about 30 fictional Nigerian visitors across the previous two weeks, with a mix of completed and active visits. The full implementation preserves the requested fields, validation, search/filter behavior, tag safety, checkout, export/print, settings, demo-data reset/load, and display synchronization described in the supplied requirements.

## Implementation approach

The two HTML entry points share browser modules and styles. The reception screen is a client-side, role-aware dashboard. Its storage module owns versioned localStorage records for visitors, visits, tags, officers/departments, purposes, and audit events; UI modules call it rather than accessing storage directly. Utilities normalize and validate Nigerian phone numbers, format dates/durations, compress uploaded/captured photos, and escape exported CSV values. A BroadcastChannel carries live draft/assignment updates to the customer display, with a storage-event fallback. `getUserMedia` is used only after a user action; unavailable/denied cameras expose an image-upload fallback. Tag assignment is checked again against current stored state before a visit is committed.

Keep the project deployable from static files and GitHub Pages. A checked-in GitHub Actions workflow deploys the repository's static root; local instructions use Python's built-in static server. For Manus Preview, use a development-only static file server on the configured port 3000. No runtime server code, database, account service, or network API is part of the product.

## Project structure

- `index.html` — reception/admin application shell and login screen.
- `display/index.html` — full-screen second-monitor visitor display.
- `assets/css/app.css` — responsive reception, modal, forms, table, and display styles.
- `assets/js/storage.js` — versioned localStorage adapter, seed/sample data, persistence, and audit events.
- `assets/js/utils.js` — phone/date/CSV/photo and display formatting helpers.
- `assets/js/app.js` — login, navigation, check-in wizard, visitor list, tag board, reports, settings, and display broadcast coordination.
- `assets/js/display.js` — idle and live customer display rendering and NDPA privacy notice.
- `public/manus-routes.json` — page route manifest for `/` and `/display/`.
- `.github/workflows/deploy.yml` — GitHub Pages static deployment workflow.
- `README.md` — features, screenshot placeholder, local run, GitHub Pages setup/deployment, and demo-account details.
- `DEMO-SCRIPT.md` — concise five-minute client walkthrough.

## Design direction

Three low-probability alternatives were considered before choosing the direction: **Airport wayfinding**, a high-contrast signage-led interface (0.026); **Paper-led registry**, a warm archival form system (0.054); **Civic operations console**, a restrained reception dashboard with clear status color (0.083). The chosen direction is **Civic operations console**.

- **Design Movement:** Contemporary civic-service interface, drawing on the legibility and calm order of public-service wayfinding rather than consumer-app gloss.
- **Core Principles:** Make the next action obvious; keep visitor and tag status scannable; prioritize readable forms at arm's length; use accessible, keyboard-friendly interaction.
- **Color Philosophy:** Warm off-white and slate neutrals reduce visual noise; an ownable deep leaf-green accent references Nigerian identity without reproducing an official seal. Green signals available/confirmed, red signals in-use/attention, and amber signals unavailable or caution. Color is always paired with labels or icons.
- **Layout Paradigm:** A narrow persistent left rail anchors navigation while the main workspace uses a wide, task-focused content area; the check-in wizard progresses in a clear horizontal stepper and tag selection uses a dense, touch-friendly board.
- **Signature Elements:** A compact shield-and-check placeholder mark; numbered tag chips with consistent status labels; thin progress rules that connect the wizard steps.
- **Interaction Philosophy:** Direct manipulation with immediate, plain-language feedback; destructive/reset actions are explicit; focus remains visible; errors appear beside the relevant control.
- **Animation:** Brief 140–200 ms fades/slides for view changes and confirmation; subtle hover/focus transitions; honor reduced-motion preferences; no motion that delays form use.
- **Typography System:** System UI sans-serif for fast, familiar reading; strong size/weight contrast for page titles, form labels, metadata, and large customer-facing tag numbers. Tabular numerals for durations and tag IDs.
- **Brand Essence:** A composed, practical visitor-desk demo for reception teams that makes check-in and custody of entry tags easy to follow. Personality: **clear, dependable, welcoming**.
- **Brand Voice:** Short, respectful, operational prompts. Examples: “Start a visitor check-in.” “Tag 12 is ready to assign.”
- **Wordmark & Logo:** A custom shield outline with a centered checkmark and small doorway motif, beside the product name; it is a demo mark, not an official Nigerian Customs Service insignia.
- **Signature Brand Color:** Deep leaf green, used sparingly for primary actions, progress, and available-tag status.

## Constraints and dependencies

Use no package/runtime dependencies. Browser storage is local to each browser/device and is not shared across reception computers; the customer display works on the same browser origin through browser messaging and localStorage events. Sample names and records are fictional. Camera permission requires a secure context (HTTPS or localhost); photo upload remains available if webcam capture cannot be used. GitHub Pages serves only static files, so the README will explain that visitor data is demo-local and does not synchronize to a central system.
