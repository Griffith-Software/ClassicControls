# Chrome Web Store Listing Draft (1.0.0)

The release copies of this text, the privacy answers, images and dashboard steps are in `release/v1.0.0/` (`shared/copy/listing.md`, `chrome/privacy-practices.md`, `DASHBOARD_STEPS.md`). Keep the two in step when the wording changes.

Kept to the store's keyword rules learned from ChatScribe's 2026-10-08 rejection: each brand named sparingly, no word repeated more than five times in the description, and the independence line doesn't list company names more than needed.

## Before Submitting

Checked 2026-11-18. The package passes the code readability policy (plain source, no bundler output, no minified or encoded code; `npm test` checks this). These links in the package or listing don't work yet, and a reviewer may open them:

- https://griffith.software/classic-controls.html (manifest `homepage_url`, About link, privacy policy URL): returns 404. Goes live through the website chat.
- https://github.com/Griffith-Software/ClassicControls/issues (popup's "See If It's Already Known" link): the repo doesn't exist yet (GR10).
- "Classic Controls is also tested automatically every few hours" (Description): true only once the repo exists and the scheduled workflow is running. Remove that sentence if submitting before then.

## Name

Classic Controls

## Summary (manifest description, 127 characters)

Brings back YouTube desktop controls that were removed: hover queue buttons, newest-first search and a Subscriptions list view.

## Category

Workflow & Planning (TODO(owner): confirm; "Fun" and "Tools" are the other likely fits)

## Description

Classic Controls restores desktop controls that were removed from YouTube in 2026.

Watch Later and Add to Queue buttons
Hover over a video thumbnail on the home page, your Subscriptions feed or search results to get the two buttons back. A click uses that video's own menu, so the result is the same as choosing the item by hand. The buttons also show on the inline preview while it plays.

Newest First in search
Sorting search results by upload date is no longer offered. The Newest First button sorts the results that have loaded by upload time, newest at the top, and keeps sorting as more load. It orders what the site returns; it can't recreate the old server-side sort. Upload-time buttons (Last Hour, Today, This Week, This Month, This Year) apply the site's own upload-date filter, including Last Hour.

Subscriptions list view
Show your Subscriptions feed as one video per row, in upload-time order. A separate switch hides Shorts from the feed.

Tells you when something stops working
Each fix checks itself on every page. If a site change stops one, the popup says so plainly and marks the toolbar icon, and the other fixes keep working. Classic Controls is also tested automatically every few hours, and fixes arrive as normal extension updates.

Private by design
No network requests of its own, no account, no tracking. It stores only your settings.

Each fix has its own on/off switch, and settings can be exported and imported.

Classic Controls is an independent project. It is not made by, endorsed by, or affiliated with YouTube or Google, and those names belong to their owners.

By Griffith Software · https://griffith.software/classic-controls.html

## Single Purpose

Restores YouTube desktop controls that YouTube removed.

## Permission Justifications

- **Host permission, https://www.youtube.com/\***: The extension adds its controls (hover buttons, the Newest First control and the Subscriptions list view) to YouTube pages, and reads those pages to find video cards and upload times. It runs on no other site.
- **storage**: Keeps the user's settings (which fixes are on, Hide Shorts, Newest First default) and each fix's status for the open tab, so the popup can show whether each fix is working.

## Remote Code

No. All code ships in the package. The page-matching rules (data/fixes.json) are part of the package too.

## Data Usage

The extension sends nothing anywhere and has no server. It reads YouTube page content in the browser only, to find video cards and upload times.

Recommended answer, matching the decision made for ChatScribe (the store asks for data handled on the device too): tick **Website content** only, and certify the three statements (not sold, not used for unrelated purposes, not used for creditworthiness). TODO(owner): confirm.

Privacy policy URL: TODO(owner): the product page's privacy section once it is live (https://griffith.software/classic-controls.html is the product page in the reference doc).

## Images

Made by `npm run store-art` into `release/v1.0.0/chrome/listing/`: screenshots of the hover buttons, Newest First and the popup (1280×800), the 440×280 small promo tile and the 128 px store icon. The Subscriptions list view screenshot needs a signed-in feed and is optional (`shot-list.md`).
