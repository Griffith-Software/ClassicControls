# Changelog

## 1.0.0 (2026-11-17)

First release.

- Watch Later and Add to Queue buttons on video thumbnails on the home page, the Subscriptions feed and search results, using each video's own menu. The buttons also show on YouTube's inline preview while it plays. Cards that still have YouTube's own buttons, and ads, are left alone.
- Newest First on the search results page: sorts the results YouTube has loaded by upload time, newest first, and keeps sorting as more load. Upload-time buttons apply YouTube's own filter: Last Hour, Today, This Week, This Month and This Year.
- Subscriptions list view: one video per row, in upload-time order, with a separate Hide Shorts switch.
- Self-check on every YouTube page, with a status for each fix in the popup, a "YouTube Changed This Page" message after two failed loads in a row, and a mark on the toolbar icon.
- Popup with a switch per fix, About, and settings export and import.
- Scheduled YouTube test (signed out on GitHub Actions every 6 hours, signed in daily on a test PC) that opens, updates and closes GitHub issues.
