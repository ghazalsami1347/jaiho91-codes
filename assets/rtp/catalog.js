import { createCycleClock, rankFeaturedGames, percent } from './core.js';

const page = document.querySelector('[data-rtp]');
const copy = JSON.parse(page.dataset.copy);
const controls = page.querySelector('.rtp-controls');
const search = page.querySelector('[data-rtp-search]');
const category = page.querySelector('[data-rtp-category]');
const savedOnly = page.querySelector('[data-rtp-saved]');
const ranked = page.querySelector('[data-rtp-ranked]');
const catalog = [...ranked.children, ...page.querySelector('[data-rtp-reserve]').content.children];
const games = catalog.map(card => ({id:card.dataset.game}));
const count = page.querySelector('[data-rtp-count]');
const empty = page.querySelector('[data-rtp-empty]');
const cards = new Map(catalog.map(card => [card.dataset.game, card]));
const storageKey = 'jaiho91-rtp-favourites';
let saved = new Set();
try {
  const entries = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(entries)) saved = new Set(entries.filter(id => cards.has(id)));
} catch {}

function refresh() {
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  for (const card of ranked.children) {
    const selected = saved.has(card.dataset.game);
    const button = card.querySelector('.rtp-save');
    button.textContent = selected ? copy.remove : copy.save;
    button.setAttribute('aria-pressed', String(selected));
    card.hidden = !card.dataset.search.includes(query)
      || (category.value !== 'all' && card.dataset.theme !== category.value)
      || (savedOnly.checked && !selected);
    if (!card.hidden) visible += 1;
  }
  count.textContent = copy.count + ' ' + visible;
  empty.hidden = visible > 0;
}

function renderDemo(cycle) {
  const next = rankFeaturedGames(games, cycle.key).map(game => {
    const card = cards.get(game.id);
    card.querySelector('.rtp-value').textContent = copy.demoValue + ' · ' + percent(game.basisPoints);
    return card;
  });
  if (next.some((card, index) => ranked.children[index] !== card)) {
    const hadFocus = ranked.contains(document.activeElement);
    ranked.replaceChildren(...next);
    if (hadFocus) search.focus();
  }
  refresh();
}

for (const card of catalog) {
  const button = card.querySelector('.rtp-save');
  button.hidden = false;
  button.setAttribute('aria-label', copy.saved + ' · ' + card.querySelector('h3').textContent);
  button.addEventListener('click', () => {
    const id = card.dataset.game;
    if (!saved.delete(id)) saved.add(id);
    try { localStorage.setItem(storageKey, JSON.stringify([...saved])); } catch {}
    refresh();
    if (card.hidden) savedOnly.focus();
  });
}
search.addEventListener('input', refresh);
category.addEventListener('change', refresh);
savedOnly.addEventListener('change', refresh);
controls.hidden = false;
const clock = createCycleClock({onCycle:renderDemo,onTick(){}});
window.addEventListener('pageshow', () => clock.start());
window.addEventListener('pagehide', () => clock.stop());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clock.stop();
  else clock.start();
});
clock.start();
