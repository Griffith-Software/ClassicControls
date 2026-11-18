// SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
// Copyright (c) 2026 Griffith Software — https://griffith.software

// Watch Later and Add to Queue buttons on video thumbnails. A click opens that video's own
// three-dot menu out of sight and chooses the matching item, so the result is the same as
// doing it by hand.
(function () {
  'use strict';
  const CC = globalThis.ClassicControls;

  // 24x24 SVG outlines for the buttons (drawn with CC.svg, never as HTML).
  const ICON = {
    // Clock
    watchLater: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 3v6l5 3 1-1.7-4-2.4V7h-2Z',
    // Three lines and a plus
    queue: 'M3 6h12v2H3V6Zm0 5h12v2H3v-2Zm0 5h8v2H3v-2Zm14-3h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z',
    // Check mark, shown briefly after a click worked
    done: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
    // Exclamation in a circle, shown when the menu item couldn't be found
    fail: 'M11 7h2v7h-2V7Zm0 9h2v2h-2v-2Zm1-14a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z'
  };
  const LABEL = { watchLater: 'Watch Later', queue: 'Add to Queue' };

  let ctx = null;
  let busy = false;

  function anchors() {
    return ctx.rules.anchors;
  }

  function hasNative(card) {
    return !!CC.q(card, anchors().nativeButtons);
  }

  function onOver(e) {
    const preview = CC.closest(e.target, anchors().preview);
    if (preview) {
      decoratePreview(preview);
      return;
    }
    const card = CC.closest(e.target, anchors().card);
    if (!card) return;
    const box = card.querySelector(':scope .cc-hover:not(.cc-in-preview)');
    if (!box) decorate(card);
    else if (hasNative(card)) box.remove();
  }

  function videoIdOf(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
      return u.searchParams.get('v');
    } catch (_) {
      return null;
    }
  }

  // The card a playing preview belongs to: the shown card linking to the same video.
  function cardForVideo(id) {
    const scope = document.querySelector('ytd-page-manager') || document;
    return CC.qa(scope, anchors().card).find((card) => {
      if (!CC.isShown(card) || card.closest(joinedPreview())) return false;
      return CC.qa(card, anchors().videoLink).some((a) => videoIdOf(a.getAttribute('href')) === id);
    }) || null;
  }

  function joinedPreview() {
    return anchors().preview.join(', ');
  }

  // YouTube's inline preview plays on top of the thumbnail and covers it, so the buttons are
  // added to the preview too (left of its own mute and captions buttons). They act on the card
  // underneath, the same as the thumbnail's buttons.
  function decoratePreview(preview) {
    if (!CC.isShown(preview)) return;
    const link = CC.q(preview, anchors().previewLink);
    const id = link && videoIdOf(link.getAttribute('href'));
    const old = preview.querySelector(':scope > .cc-in-preview');
    if (old && old.dataset.ccFor === id) return;
    if (old) old.remove();
    if (!id) return;
    const card = cardForVideo(id);
    if (!card || !isVideoCard(card) || hasNative(card)) return;
    preview.setAttribute('data-cc-card', '');
    if (getComputedStyle(preview).position === 'static') {
      preview.style.position = 'relative';
      preview.setAttribute('data-cc-pos', '');
    }
    const box = document.createElement('div');
    box.className = 'cc-hover cc-in-preview';
    box.dataset.ccFor = id;
    box.appendChild(makeButton(card, 'watchLater'));
    box.appendChild(makeButton(card, 'queue'));
    preview.appendChild(box);
  }

  function makeButton(card, action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc-btn';
    btn.dataset.ccAction = action;
    btn.setAttribute('aria-label', LABEL[action]);
    btn.appendChild(CC.svg(ICON[action]));
    const tip = document.createElement('span');
    tip.className = 'cc-tip';
    tip.textContent = LABEL[action];
    btn.appendChild(tip);
    const swallow = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    };
    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'dblclick']) {
      btn.addEventListener(type, swallow, true);
    }
    btn.addEventListener('click', (ev) => {
      swallow(ev);
      run(card, action, btn);
    }, true);
    return btn;
  }

  // A video card that isn't an ad. Ads have no Watch Later or queue menu items.
  function isVideoCard(card) {
    return !CC.closest(card, anchors().notCard) && !!CC.q(card, anchors().videoLink);
  }

  function decorate(card) {
    if (!isVideoCard(card) || hasNative(card)) return;
    const thumb = CC.q(card, anchors().thumbnail);
    if (!thumb) return;
    card.setAttribute('data-cc-card', '');
    if (getComputedStyle(thumb).position === 'static') {
      thumb.style.position = 'relative';
      thumb.setAttribute('data-cc-pos', '');
    }
    const box = document.createElement('div');
    box.className = 'cc-hover';
    box.appendChild(makeButton(card, 'watchLater'));
    box.appendChild(makeButton(card, 'queue'));
    thumb.appendChild(box);
    // YouTube's own buttons can appear a moment after hover on pages that still have them.
    setTimeout(() => { if (box.isConnected && hasNative(card)) box.remove(); }, 400);
  }

  function findMenuButton(card) {
    return CC.qa(card, anchors().menuButton).find((b) => !b.classList.contains('cc-btn')) || null;
  }

  function openPopups() {
    return CC.qa(document, anchors().menuPopup).filter((p) => CC.isShown(p) && getComputedStyle(p).display !== 'none');
  }

  function textOf(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function findItem(action, popups) {
    const want = (ctx.rules.menuText[action] || []).map((s) => s.toLowerCase());
    const already = (ctx.rules.menuText[action + 'Done'] || []).map((s) => s.toLowerCase());
    for (const popup of popups) {
      for (const item of CC.qa(popup, anchors().menuItem)) {
        const t = textOf(item);
        if (want.some((w) => t === w || t.startsWith(w))) return { item, already: false };
        if (already.some((w) => t === w || t.startsWith(w))) return { item, already: true };
      }
    }
    return null;
  }

  function closeMenus() {
    const target = document.activeElement || document.body;
    for (const type of ['keydown', 'keyup']) {
      target.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, composed: true }));
    }
  }

  function flash(btn, kind, tipText) {
    const svg = btn.querySelector('svg');
    const tip = btn.querySelector('.cc-tip');
    const action = btn.dataset.ccAction;
    if (svg) svg.replaceWith(CC.svg(ICON[kind]));
    if (tip) tip.textContent = tipText;
    btn.setAttribute('data-cc-result', kind);
    setTimeout(() => {
      const now = btn.querySelector('svg');
      if (now) now.replaceWith(CC.svg(ICON[action]));
      if (tip) tip.textContent = LABEL[action];
      btn.removeAttribute('data-cc-result');
    }, kind === 'fail' ? 4000 : 1500);
  }

  async function run(card, action, btn) {
    if (busy) return;
    busy = true;
    const html = document.documentElement;
    try {
      let menuBtn = findMenuButton(card);
      if (!menuBtn) {
        for (const type of ['mouseover', 'mouseenter', 'mousemove']) {
          card.dispatchEvent(new MouseEvent(type, { bubbles: type !== 'mouseenter' }));
        }
        menuBtn = await CC.waitFor(() => findMenuButton(card), 1500);
      }
      if (!menuBtn) throw new Error('menu button');
      if (openPopups().length) {
        closeMenus();
        await CC.waitFor(() => !openPopups().length, 600);
      }
      html.setAttribute('data-cc-menu-hidden', '');
      const before = new Set(openPopups());
      menuBtn.click();
      const found = await CC.waitFor(() => {
        const fresh = openPopups().filter((p) => !before.has(p));
        return fresh.length ? findItem(action, fresh) : null;
      }, 2500);
      if (!found) {
        closeMenus();
        throw new Error('menu item');
      }
      if (found.already) {
        closeMenus();
        flash(btn, 'done', 'Already in Watch Later');
      } else {
        found.item.click();
        flash(btn, 'done', action === 'queue' ? 'Added to Queue' : 'Saved to Watch Later');
      }
      ctx.report('ok');
    } catch (_) {
      flash(btn, 'fail', "Didn't work. YouTube may have changed this page.");
      ctx.report('miss');
    } finally {
      setTimeout(() => html.removeAttribute('data-cc-menu-hidden'), 350);
      busy = false;
    }
  }

  CC.registerFix({
    id: 'hoverButtons',
    enabled: (s) => s.fixes.hoverButtons,
    start(c) {
      ctx = c;
      document.addEventListener('mouseover', onOver, true);
      document.addEventListener('focusin', onOver, true);
    },
    stop() {
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('focusin', onOver, true);
      document.querySelectorAll('.cc-hover').forEach((el) => el.remove());
      document.querySelectorAll('[data-cc-card]').forEach((el) => el.removeAttribute('data-cc-card'));
      document.querySelectorAll('[data-cc-pos]').forEach((el) => {
        el.style.position = '';
        el.removeAttribute('data-cc-pos');
      });
      document.documentElement.removeAttribute('data-cc-menu-hidden');
    },
    // A preview that starts playing gets its buttons right away (it covers the thumbnail).
    apply() {
      for (const preview of CC.qa(document, anchors().preview)) decoratePreview(preview);
    },
    // Cards with thumbnails on the page means the buttons can be added on hover.
    check() {
      const cards = CC.qa(document.querySelector('ytd-page-manager') || document, anchors().card).filter(CC.isShown);
      return cards.some((card) => isVideoCard(card) && (hasNative(card) || CC.q(card, anchors().thumbnail)));
    }
  });
})();
