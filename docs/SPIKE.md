# Build Step 1: Spike Report (2026-11-17)

Checked against live YouTube (English, signed out) in the app's browser pane and in Playwright Chromium.

## Hover Buttons: Can Be Done

- Search results are still `ytd-video-renderer` cards. Their thumbnails have no Watch Later or Add to Queue hover buttons any more.
- The three-dot button (`aria-label="Action menu"`) fills in when the card is hovered. Its menu (`ytd-menu-popup-renderer`, items `role="menuitem"`) lists "Add to queue" and "Save to Watch later". Clicking "Add to queue" from script opened the miniplayer queue, the same as doing it by hand.
- Home, subscriptions and channel grids use the newer `ytd-rich-item-renderer > yt-lockup-view-model` card. Its three-dot button is `aria-label="More actions"`, and its menu is a `yt-sheet-view-model` with `yt-list-item-view-model` rows (`role="menuitem"`), with the same item wording.
- Channel video pages still show YouTube's own hover buttons (`yt-thumbnail-hover-overlay-toggle-actions-view-model`: 32 px round, dark see-through background, top right, stacked). The extension leaves any card that already has them alone.
- The signed-out home page shows no videos, so home and subscriptions can only be checked signed in (the daily signed-in run).

## Newest First: Partly Possible on YouTube's Side

- The old sort-by-upload-date code (`sp=CAI%3D`) is accepted but ignored: results come back in relevance order.
- Upload-date filters still work on YouTube's side. The Search Filters dialog offers Today, This Week, This Month and This Year. **"Last hour" is gone from the dialog, but its filter code (`sp=EgIIAQ%3D%3D`) still works**: results came back 14 to 55 minutes old.
- Plan shipped in 1.0.0: a Newest First switch that sorts the results YouTube has loaded by upload time (and keeps sorting as more load), plus upload-time chips (Last Hour, Today, This Week, This Month, This Year) that apply YouTube's own filter. The listing says exactly this.
- Upload time is read from the card's text ("2d ago", "55 min ago", "Streamed 4d ago").

## Subscriptions List View: Can Be Done

- The grid's `#contents` is a flex container holding `ytd-rich-item-renderer` cards directly (no row wrappers), so it can be restyled into one column and reordered with CSS `order`, without moving YouTube's elements or making extra requests.
- Not checked live (needs a signed-in account). The same grid and card markup on channel video pages was used to build and check the layout.

## Notes

- Content scripts can't read YouTube's internal data objects, so everything is read from the page's text and attributes.
- YouTube's class names are now camel case (for example `ytLockupViewModelContentImage`). The page-matching rules in `data/fixes.json` prefer element names and `aria-label`s, with class names as fallbacks.
