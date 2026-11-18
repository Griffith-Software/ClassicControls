# Classic Controls

**by Griffith Software** · Version 1.0.0 · Chrome extension

Classic Controls brings back YouTube desktop controls that YouTube removed in 2026:

- **Watch Later and Add to Queue buttons** on video thumbnails on the home page, the Subscriptions feed and search results. A click opens that video's own three-dot menu out of sight and chooses the matching item, so the result is the same as doing it by hand. If YouTube's inline preview starts playing over a thumbnail, the buttons show on the preview too. Cards that still have YouTube's own buttons are left alone, and ads never get buttons.
- **Newest First in search.** YouTube no longer sorts search results by upload date. The Newest First button sorts the results YouTube has loaded by their upload time, newest at the top, and keeps sorting as more load. It can only order what YouTube returns. The upload-time buttons (Last Hour, Today, This Week, This Month, This Year) apply YouTube's own upload-date filter, including Last Hour, which YouTube still supports but no longer shows.
- **Subscriptions list view.** Shows the Subscriptions feed as one video per row (thumbnail, title, channel, upload time), in upload-time order. A separate switch hides Shorts from the feed.

Each fix has its own switch in the toolbar popup. Turning one off removes its changes straight away, without reloading the page.

Install: TODO(owner): add the Chrome Web Store link once the listing is live.

## When YouTube Changes a Page

YouTube changes its pages often, and a change can stop a fix from working. Classic Controls checks itself on every YouTube page. A few seconds after a page loads, each fix that applies to it reports one of these states in the popup:

| State | When | Popup shows |
| --- | --- | --- |
| Working | The fix found the parts of the page it needs and applied | A green dot and "Working" |
| Off | You turned it off | A grey dot and "Off" |
| Not on this page | The page doesn't use this fix | Nothing for that fix |
| YouTube Changed This Page | The parts it needs were missing on two loads in a row, on a page that has videos | A message, and a small mark on the toolbar icon |

Pages with no videos (an empty feed, the signed-out home page) never cause a warning, one fix failing never stops the others, and the warning clears by itself as soon as the fix works again. The message has two links: the list of known YouTube changes on GitHub, and the Griffith Software feedback page. Nothing is sent anywhere; the links open only when you click them.

Classic Controls is also tested against YouTube automatically every few hours (see [Scheduled Test](#scheduled-test)). Fixes arrive as normal extension updates, after Chrome Web Store review.

## Privacy

- Classic Controls makes no network requests of its own. Its only effect on the network is YouTube's own requests when it uses YouTube's menu for you, the same as clicking it yourself.
- It stores only your settings (which fixes are on, the Hide Shorts switch, and whether Newest First starts on) in Chrome's synced extension storage, and each fix's status for the open tab in Chrome's session storage. Nothing about the videos you watch, your searches or your account is stored.
- It reads the YouTube page in your browser to find upload times and video cards. That stays in your browser.

## Permissions

- `https://www.youtube.com/*`: to add the controls to YouTube pages.
- `storage`: to keep your settings and each fix's status for the open tab.

No other sites, no tabs permission, no remote code.

## Settings Export and Import

The popup's **Export Settings** button saves a JSON file (`"generator": "Classic Controls by Griffith Software"`, with `appVersion` and `schemaVersion: 1`). **Import Settings** opens the settings page, because a file picker would close the small popup; choose the file there.

## Development

Plain JavaScript, HTML and CSS, Manifest V3, no runtime dependencies and no build step. Playwright is a dev dependency, used only by the tests.

```
manifest.json          Extension manifest
data/fixes.json        Page-matching rules (selectors and menu wording) for every fix
src/lib/               Pure logic shared by the extension and the tests
src/content/           Content script: core helpers, one file per fix, main loop
src/background.js      Rules for the content script, self-check state, toolbar mark
src/popup/             Popup and settings page
tests/unit/            Node tests for the pure logic, ownership marks and permissions
tests/e2e/             Browser test against stand-in YouTube pages
tests/canary/          Scheduled test against live YouTube, and the GitHub issue step
scripts/               Packaging, icon and store-image export, signed-in test runner and scheduler
```

Most YouTube breaks are fixed by editing `data/fixes.json`. Each fix is a module with the same shape (`id`, `enabled`, `start`, `stop`, `apply`, `check`), and the pages each fix applies to are listed in that file.

```bash
npm install
npx playwright install chromium
npm test                 # unit tests
npm run e2e              # browser test against stand-in pages
npm run canary           # live YouTube test, signed out
npm run package          # release/v1.0.0/chrome/ClassicControls_v1.0.0_chrome.zip
npm run store-art        # store icon, promo tile and screenshots (live YouTube, signed out)
```

To try it in Chrome, open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick this folder.

## Scheduled Test

`tests/canary/run.mjs` loads the extension into a real Chromium, opens YouTube and checks that each fix appears and works. It records which page parts it found, so slow drift in YouTube's pages shows up before a full break. YouTube still shows its own hover buttons to some users, so the test always checks the version without them.

**Signed out, every 6 hours, on GitHub Actions** (`.github/workflows/canary.yml`): searches a fixed list of queries, checks the hover buttons on result thumbnails and on the inline preview, adds a video to the queue, and turns on Newest First to check the results are in upload-time order.

**Signed in, daily, on the owner's PC** (`scripts/canary-signed-in.ps1`): home page and Subscriptions feed hover buttons, that Watch Later really adds the video (then removes it again), and the Subscriptions list view in time order. It uses a separate test Google account in its own browser profile, outside the repo. Its sign-in is never stored in the repo, in CI or in any file the scripts write.

```powershell
powershell -File scripts\canary-signed-in.ps1 -Setup   # once: sign the test profile in by hand
powershell -File scripts\canary-signed-in.ps1          # one run by hand
powershell -File scripts\register-signed-in-task.ps1   # run it daily with Windows Task Scheduler
```

`register-signed-in-task.ps1` takes `-At 14:30` to pick the time and `-Remove` to stop the daily run.

TODO(owner): create the test Google account, then run the setup line and the scheduler line above.

**When a check fails**, `tests/canary/issues.mjs` uses the GitHub CLI:

1. If a `youtube-change` issue is already open for that fix, it adds a comment. Otherwise it opens one titled "&lt;fix name&gt; stopped working (YYYY-MM-DD)" with the failed check, the Chrome version, and the HTML around the missing part of the page. Screenshots are in the run's artifacts (GitHub Actions) or in the results folder on the test PC.
2. GitHub emails the repository's watchers.
3. After two passing runs in a row, it comments "Working again" and closes the issue. A signed-out pass never closes an issue the signed-in run opened.
4. The fix ships as a new patch version. Nothing is published without the owner's go-ahead.

To test the issue automation, run the workflow by hand with **force_fail** set to a fix ID (`hoverButtons`, `newestFirst` or `subsList`).

Limits: YouTube tries changes on some users first, so the scheduled test can miss a version real users see; the self-check and the report link cover that gap. A fix still waits on Chrome Web Store review.

## License

Classic Controls is source-available under the Apache License 2.0 with the Commons Clause (see [LICENSE](LICENSE) and [NOTICE](NOTICE)). You may use, modify and share it free of charge, but you may not sell it. To resell Classic Controls or bundle it with a product you sell, ask Griffith Software for a commercial license at https://griffith.software.

© 2026 Griffith Software · https://griffith.software

Classic Controls is an independent project. It is not made by, endorsed by, or affiliated with YouTube or Google, and those names belong to their owners.
