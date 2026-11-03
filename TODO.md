# TODO — Nigerian Customs Service Visitor

## 1. Static demo shell, login, and project documentation
- [x] Build a pure static app using HTML, CSS, and vanilla JavaScript (or a static build) with no backend; store all application data in the browser using localStorage or IndexedDB. Photos are saved as compressed base64 JPEGs.
- [x] Make the responsive reception-desk interface clean and professional, with a neutral palette, one accent color, large buttons, and clear typography. Include smooth transitions, form validation messages, empty states, and keyboard-friendly forms (Enter advances to the next wizard step).
- [x] Show a visible “DEMO VERSION” ribbon.
- [x] Provide a demo-only login with Receptionist and Admin roles and hardcoded demo accounts shown on the login page; enforce role-appropriate screens/actions in the demo UI.
- [x] Organize code into clear files/modules, including storage and utilities, with comments so a Laravel or Django backend can replace the storage layer later.
- [x] Include a README with a feature list, screenshots placeholder, local run instructions, and GitHub Pages deployment steps (GitHub Actions workflow or `/docs` method).
- [x] Include `DEMO-SCRIPT.md` with a five-minute walkthrough covering visitor registration, live customer-display mirroring, tag assignment, tag board, checkout, and reports.
- [x] Include complete project files ready to push to GitHub and deploy as static files on GitHub Pages.

## 2. Reception check-in wizard and photos
- [x] Provide a reception screen with a three-step wizard and progress indicator.
- [x] Step 1 collects required phone number, visitor name, and address, plus optional email. When the phone matches a previous visitor, auto-fill name, address, and email and show “Returning visitor”. Switching to an unmatched phone clears details from the former match.
- [x] Validate Nigerian phone formats, including local `0803...` and international `+234...` examples.
- [x] Step 2 uses the browser webcam (`getUserMedia`) with live preview, Capture, and Retake controls. If the camera is unavailable, offer image upload fallback. Require a captured or uploaded photo before continuing. Save a compressed base64 JPEG photo with the visit.
- [x] Step 3 provides a searchable dropdown seeded with about eight officers/departments; purpose choices Official, Meeting, Personal, Delivery, Enquiry, Interview, Contractor/Maintenance, and Other, with a text box to specify Other; add/remove rows for additional visitors with name and phone; appointment Yes/No and a reference field when Yes.
- [x] After visit details, an “Assign Tag” action opens a 1–50 tag grid. Available tags are green and clickable; tags in use are red and disabled, with the visitor name shown on hover. Include “Suggest next free tag”. After selecting a tag, show check-in-time confirmation and complete check-in.
- [x] Never assign a tag already in use. Persist each visit's visitor id, photo, host, purpose, group members, appointment flag/reference, tag number, check-in time, and check-out time.

## 3. Customer-facing display and live synchronization
- [x] Provide a separate full-screen `/display` customer display page for a second monitor.
- [x] Mirror the reception form in real time: visitor name, phone, address, host, purpose, photo preview, and assigned tag in large type. Use `BroadcastChannel` with a `localStorage` event fallback.
- [x] Show an idle welcome screen with a logo placeholder when no visitor is being entered. Show a data privacy consent notice (NDPA).
- [x] Add “Open Customer Display” to reception and open the display in a new window.

## 4. Visitors Inside, checkout, tags, and end-of-day controls
- [x] Show a live Visitors Inside table with photo, name, host, purpose, tag number, check-in time, and visit duration, plus search and filtering.
- [x] Show an “X available / Y in use” counter. Provide a Check Out action per row; checkout records exit time and frees the tag.
- [x] Provide a standalone Tag Board with the configured 1–50 grid. Clicking an in-use/red tag shows visitor details and a Check Out action.
- [x] Let Admin mark a tag Lost/Unavailable and restore it; unavailable/lost tags cannot be assigned.
- [x] Keep an audit log visible to Admin recording who did what and when.
- [x] Add an end-of-day panel listing tags still in use.

## 5. Admin reports
- [x] Provide daily and monthly visit logs filterable by date range, officer, and purpose.
- [x] Show summary cards for total visits today, currently inside, and average visit duration.
- [x] Show a simple chart of visits per day.
- [x] Support CSV export and a print-friendly view.

## 6. Admin settings, seed data, and sample data controls
- [x] Let Admin add, edit, and remove officers and departments, edit the purpose list, and set the number of tags (default 50).
- [x] Seed sample data on first load so the demo is not empty: about 30 realistic fictional Nigerian names and visits across the past two weeks.
- [x] Provide actions to reset demo data and load sample data.
