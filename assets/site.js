import { track } from './analytics-client.js';

const menu = document.querySelector('.menu-button');
const nav = document.querySelector('#utility-nav');
const ui = JSON.parse(document.body.dataset.ui);
nav.dataset.collapsible = '';
menu.hidden = false;

const installPopup = document.querySelector('[data-install-popup]');
if (installPopup) {
  const mobile = matchMedia('(max-width: 640px)');
  const key = 'jaiho91-apk-popup-dismissed';
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(key) === '1'; } catch {}

  function updateInstallPopup() {
    installPopup.hidden = dismissed || !mobile.matches;
  }

  function dismissInstallPopup() {
    dismissed = true;
    try { sessionStorage.setItem(key, '1'); } catch {}
    const restoreFocus = installPopup.contains(document.activeElement);
    updateInstallPopup();
    if (restoreFocus) document.querySelector('.download-button')?.focus({preventScroll:true});
  }

  installPopup.querySelector('.install-dismiss').addEventListener('click', dismissInstallPopup);
  installPopup.querySelector('.install-action').addEventListener('click', dismissInstallPopup);
  installPopup.addEventListener('keydown', event => {
    if (event.key === 'Escape') dismissInstallPopup();
  });
  mobile.addEventListener('change', updateInstallPopup);
  window.addEventListener('pageshow', updateInstallPopup);
  updateInstallPopup();
}

const bonusPopup = document.querySelector('[data-bonus-popup]');
if (bonusPopup?.showModal) {
  const key = 'jaiho91-bonus-popup-dismissed';
  let dismissed = wasBonusDismissed();
  const form = bonusPopup.querySelector('.bonus-form');

  function wasBonusDismissed() {
    try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
  }

  function showBonusPopup() {
    if (dismissed || wasBonusDismissed() || bonusPopup.open) return;
    const otherDialog = document.querySelector('dialog[open]');
    if (otherDialog) {
      otherDialog.addEventListener('close', showBonusPopup, { once:true });
      return;
    }
    bonusPopup.showModal();
  }

  function dismissBonusPopup() {
    dismissed = true;
    try { sessionStorage.setItem(key, '1'); } catch {}
    bonusPopup.close();
    if (document.activeElement === document.body) document.querySelector('#main').focus({ preventScroll:true });
  }

  bonusPopup.querySelector('.bonus-dismiss').addEventListener('click', dismissBonusPopup);
  bonusPopup.addEventListener('click', event => {
    if (event.target === bonusPopup) dismissBonusPopup();
  });
  bonusPopup.querySelectorAll('[data-bonus-close]').forEach(link => {
    link.addEventListener('click', dismissBonusPopup);
  });
  bonusPopup.addEventListener('cancel', event => {
    event.preventDefault();
    dismissBonusPopup();
  });
  window.addEventListener('pageshow', () => {
    if (bonusPopup.open && wasBonusDismissed()) dismissBonusPopup();
  });
  if (!dismissed) setTimeout(showBonusPopup, 2200);

  if (form) {
    const messages = JSON.parse(form.dataset.messages);
    const status = bonusPopup.querySelector('.bonus-status');
    const button = form.querySelector('button');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled) return;
      const body = new URLSearchParams(new FormData(form));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      button.disabled = true;
      status.textContent = messages.sending;
      try {
        const response = await fetch(form.action, { method:'POST', body, credentials:'omit', signal:controller.signal });
        if (!response.ok) throw new Error('Signup request failed');
        const { result } = await response.json();
        status.textContent = Object.hasOwn(messages, result) ? messages[result] : messages.retry;
        if (result === 'saved') {
          form.reset();
          form.hidden = true;
          if (bonusPopup.open) status.focus({ preventScroll:true });
        }
      } catch {
        status.textContent = messages.retry;
      } finally {
        clearTimeout(timeout);
        button.disabled = false;
      }
    });
  }
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motion;
if (!reducedMotion.matches) {
  import('./motion-mini.js').then(({ animate }) => {
    motion = animate;
    if (reducedMotion.matches) return;
    const hero = document.querySelector('.hero');
    if (hero && scrollY < 80) {
      animate('.hero-copy', { opacity:[0.65, 1], transform:['translateY(14px)', 'translateY(0)'] }, { duration:0.5, ease:'easeOut' });
      animate('.hero-art img', { opacity:[0.45, 1], transform:['translateY(22px) rotate(-16deg) scale(.92)', 'translateY(0) rotate(-9deg) scale(1)'] }, { duration:0.75, ease:[0.16, 1, 0.3, 1] });
      animate('.spark', { opacity:[0.25, 1, 0.6, 1], scale:[0.75, 1, 0.93, 1] }, { duration:0.9, delay:0.15 });
    }
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue;
          observer.unobserve(target);
          reveal(target);
        }
      }, { threshold:0.18 });
      document.querySelectorAll('.guide-card, .aside-card').forEach(card => observer.observe(card));
    }
  }).catch(() => {});
}

function reveal(element, direction = 0) {
  if (!element || !motion || reducedMotion.matches) return;
  const offset = direction ? `translateX(${direction * 12}px)` : 'translateY(12px)';
  motion(element, { opacity:[0.62, 1], transform:[offset, 'none'] }, { duration:0.29, ease:[0.2, 0.75, 0.3, 1] });
}

function setMenu(open) {
  nav.toggleAttribute('data-open', open);
  menu.setAttribute('aria-expanded', String(open));
}

menu.addEventListener('click', () => setMenu(!nav.hasAttribute('data-open')));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.hasAttribute('data-open')) {
    setMenu(false);
    menu.focus();
  }
});

async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value.textContent);
    return true;
  } catch {
    // Keep a fallback for embedded browsers and denied clipboard access.
    const field = document.createElement('textarea');
    field.value = value.textContent;
    field.className = 'clipboard-buffer';
    field.readOnly = true;
    document.body.append(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Select the code below. */ }
    field.remove();
    button.focus({ preventScroll:true });
    if (copied) return true;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(value);
    selection.removeAllRanges();
    selection.addRange(range);
    return false;
  }
}

const list = document.querySelector('[data-code-list]');
if (list) {
  const filters = document.querySelector('[data-code-filters]');
  const empty = document.querySelector('[data-code-empty]');
  const archive = document.querySelector('[data-archive]');
  const archiveEmpty = document.querySelector('[data-archive-empty]');
  const feedback = document.querySelector('[data-code-feedback]');
  const cards = [...list.querySelectorAll('.code-card')];
  const choices = filters ? [...filters.querySelectorAll('input')] : [];
  let tier = choices.find(choice => choice.checked)?.value;
  let expiryTimer;

  function isExpired(card) {
    return Date.parse(card.dataset.expires) <= Date.now();
  }

  function updateCodes() {
    let visible;
    let nextExpiry = Infinity;
    for (const card of cards) {
      if (card.hasAttribute('data-archived')) continue;
      if (isExpired(card)) {
        card.hidden = true;
        if (archive) {
          card.querySelector('.copy')?.remove();
          const badge = card.querySelector('[data-status]');
          badge.classList.add('muted');
          badge.querySelector('span').textContent = ui.expired;
          badge.querySelector('path').setAttribute('d', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2');
          card.dataset.archived = '';
          card.hidden = false;
          archive.append(card);
          archiveEmpty.hidden = true;
        }
        continue;
      }
      nextExpiry = Math.min(nextExpiry, Date.parse(card.dataset.expires));
      const show = !visible && card.dataset.tier === tier;
      card.hidden = !show;
      if (show) visible = card;
    }
    if (filters) filters.hidden = !Number.isFinite(nextExpiry);
    empty.hidden = !!visible;
    clearTimeout(expiryTimer);
    if (Number.isFinite(nextExpiry)) {
      expiryTimer = setTimeout(updateCodes, Math.max(1, Math.min(nextExpiry - Date.now(), 2_147_483_647)));
    }
    return visible ?? empty;
  }

  filters?.addEventListener('change', event => {
    const selected = event.target;
    if (!choices.includes(selected) || !selected.checked) return;
    const direction = choices.indexOf(selected) > choices.findIndex(choice => choice.value === tier) ? 1 : -1;
    tier = selected.value;
    const shown = updateCodes();
    reveal(shown, direction);
    feedback.textContent = (shown === empty ? ui.noTier : ui.showing) + ' ' + tier;
    track('tier_switch', tier);
  });

  for (const card of cards) {
    const button = card.querySelector('.copy');
    const value = card.querySelector('code');
    const label = button.querySelector('[data-copy-label]');
    let resetTimer;
    button.hidden = false;
    button.addEventListener('click', async () => {
      if (isExpired(card)) {
        updateCodes();
        feedback.textContent = ui.expired;
        return;
      }
      const copied = await copyText(value, button);
      button.toggleAttribute('data-copied', copied);
      label.textContent = copied ? ui.copied : ui.selected;
      feedback.textContent = copied
        ? ui.copiedFor + ' ' + card.dataset.tier
        : ui.copyFallback;
      if (copied) {
        track('copy_code', card.dataset.tier);
        if (motion && !reducedMotion.matches) {
          motion(button.querySelector('.copy-symbol'), { transform:['scale(.78)', 'scale(1.14)', 'scale(1)'] }, { duration:0.24 });
        }
      }
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        button.removeAttribute('data-copied');
        label.textContent = ui.copy;
      }, 2400);
    });
  }
  window.addEventListener('pageshow', () => updateCodes());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateCodes();
  });
  updateCodes();
}

const search = document.querySelector('[data-guide-search]');
if (search) {
  const input = search.querySelector('input');
  const cards = [...document.querySelectorAll('[data-guide-grid] .guide-card')];
  const empty = document.querySelector('[data-guide-empty]');
  const count = document.querySelector('[data-guide-count]');
  search.hidden = false;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      card.hidden = !card.textContent.toLowerCase().includes(query);
      if (!card.hidden) visible += 1;
    }
    empty.hidden = visible > 0;
    count.textContent = ui.found + ' ' + visible;
  });
}
