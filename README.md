# Nigerian Customs Service Visitor

A pure static HTML, CSS, and vanilla JavaScript visitor-desk MVP for client demonstrations. It is a **demo project, not an official Nigerian Customs Service website or service**. No backend or third-party runtime dependencies are used.

## Features

- Demo-only Receptionist and Admin login roles with visible hardcoded demo credentials.
- Three-step check-in wizard for visitor details, webcam photo or image upload, and visit details.
- Nigerian phone validation and returning-visitor auto-fill.
- Searchable seeded host list, configurable visit purposes, group members, and appointment references.
- Live second-monitor customer display at `/display/`, synchronized by BroadcastChannel with a localStorage-event fallback and an NDPA privacy notice.
- Safe assignment of numbered entry tags; live visitors-inside list, checkout, standalone tag board, lost/unavailable tag controls, and end-of-day list.
- Admin daily/monthly reports with filters, summary cards, 14-day chart, CSV export, and print view.
- Admin settings for officers, departments, purposes, tag count, sample-data reload/reset, and an audit log.
- Fictional sample dataset seeded in the browser on first load: 30 Nigerian names with visits across the preceding two weeks.

## Screenshot

_Screenshot placeholder — add a reception dashboard or customer-display screenshot here._

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Receptionist | `reception@demo.ngcs` | `Desk2026!` |
| Admin | `admin@demo.ngcs` | `Admin2026!` |

These are hardcoded demo-only credentials, not secure production authentication. Do not use real visitor information or real passwords.

## Data and camera notes

All visitor records, audit events, and compressed JPEG photos remain in the current browser's localStorage; they do **not** sync across devices or reception computers. Clearing browser storage may remove locally stored demo records. Avoid entering real or sensitive visitor details. Customer-display mirroring requires the reception and display pages to be open in the same browser and origin.

Webcam access requires a secure context: HTTPS on a deployed site or `localhost` during local use. Browser permission and camera hardware are also required. Image upload is offered if camera access is unavailable.

## Run locally

From the repository root, build the static output using Node.js 22 or later (no packages to install):

```sh
node build.mjs
python3 -m http.server 8000 --directory dist
```

Then open <http://localhost:8000/> or <http://localhost:8000/display/>. The static build copies `index.html`, `display/index.html`, shared assets, and the route manifest into `dist/`.

## Deploy with GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch. If you use a different default branch, update `.github/workflows/deploy.yml` accordingly.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Push to `main`, or open **Actions → Deploy to GitHub Pages → Run workflow** to deploy manually.
4. The workflow checks out the repository, sets up Node.js 22, runs `node build.mjs`, uploads the `dist/` artifact, and deploys it with the official GitHub Pages actions. Check the Actions run for success; the deployment URL appears under **Settings → Pages** or in the deployment job.

The GitHub Pages site is static. This demo has no central server-side storage, production-grade authentication, or cross-device synchronization.
