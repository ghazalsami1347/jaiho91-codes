import { featuredGames, percent, filterGames, countdown, cycleAt, createCycleClock } from './core.js';
import { icon } from './icons.js';
import { normalizeGames } from './game-data.js';
const $ = selector => document.querySelector(selector);
const ui = JSON.parse($('[data-rtp-ui]').dataset.rtpUi);
const dateLocale = document.documentElement.lang === 'hi-IN' ? 'hi-IN' : 'en-IN';
const storageKey = 'jaiho91-saved-v1';
const themeLabel = theme => ui.themes[theme] ?? theme;
document.querySelectorAll('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon));
let catalog, ranked = [], cycle, clock, theme = 'all', savedOnly = false, dialogGameId;
let saved;
try { const parsed = JSON.parse(localStorage.getItem(storageKey) ?? localStorage.getItem('jaiho91-rtp-favourites') ?? '[]'); saved = new Set(Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : []); }
catch { saved = new Set(); }
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function artwork(game, className = '', size = 'card', eager = false) {
  if (game.thumbnail) {
    const path=escape(game.thumbnail), small=escape(game.thumbnailSmall||game.thumbnail), large=escape(game.thumbnailLarge||game.thumbnail);
    const src=size==='leader'?small:size==='dialog'?large:path;
    const srcset=size==='card'&&(small!==path||large!==path)?' srcset="'+small+' 128w, '+path+' 320w, '+large+' 640w" sizes="(min-width:1200px) 280px, (min-width:760px) 24vw, (min-width:480px) 30vw, 46vw"':'';
    return '<img class="game-art '+className+'" src="'+src+'"'+srcset+' alt="" width="640" height="640" loading="'+(eager?'eager':'lazy')+'" decoding="async" data-fallback-theme="'+escape(game.theme)+'">';
  }
  return '<div class="game-art placeholder '+className+'" aria-hidden="true">'+icon(game.theme)+'</div>';
}
function saveButton(game) {
  return `<button class="save-button ${saved.has(game.id) ? 'is-saved' : ''}" type="button" data-save="${game.id}" aria-label="${escape(ui.save)} · ${escape(game.name)}" aria-pressed="${saved.has(game.id)}">${icon('bookmark')}</button>`;
}
function card(game) {
  return `<article class="game-card ${game.rank<=3?'top-game':''}" id="game-${game.id}" data-art-theme="${escape(game.theme)}"><div class="cover-wrap"><button class="cover-link" data-details="${game.id}" type="button" aria-label="${escape(ui.details)} · ${escape(game.name)}">${artwork(game)}</button><span class="cover-rank ${game.rank<=3?'is-top':''}">#${game.rank}</span>${saveButton(game)}</div><div class="card-body"><span class="game-theme">${escape(themeLabel(game.theme))}</span><h3><button class="game-title" data-details="${game.id}" type="button">${escape(game.name)}</button></h3><div class="card-rtp"><span>RTP</span><strong>${percent(game.basisPoints)}</strong></div><div class="meter" aria-hidden="true"><span data-width="${game.basisPoints/100}"></span></div></div></article>`;
}
function renderLeaders() {
  $('#leaders').innerHTML = ranked.slice(0,3).map((game,index) => `<article class="spotlight spotlight-${index+1}"><div class="spotlight-cap"><span class="podium-number">${String(index+1).padStart(2,'0')}</span><span class="podium-label">${escape(ui.podium[index])}<small>${escape(themeLabel(game.theme))} · RTP</small></span><span class="podium-emblem">${icon('trophy')}</span></div><div class="spotlight-visual"><button class="spotlight-cover" type="button" data-details="${game.id}" aria-label="${escape(ui.details)} · ${escape(game.name)}">${artwork(game,'spotlight-image','card',true)}</button><span class="spotlight-view">${escape(ui.details)} ${icon('arrow')}</span></div><div class="spotlight-body"><h3><button class="game-title" type="button" data-details="${game.id}">${escape(game.name)}</button></h3><div class="spotlight-value"><div><small>RTP</small><strong>${percent(game.basisPoints)}</strong></div><button class="spotlight-open" type="button" data-details="${game.id}" aria-label="${escape(ui.details)} · ${escape(game.name)}">${icon('arrow')}</button></div></div></article>`).join('');
  $('#hero-deck').innerHTML = ranked.slice(0,3).map((game,index)=>`<div class="deck-card deck-card-${index}">${artwork(game,'','card',false)}<span>#${index+1}</span></div>`).join('');
}
function render() {
  const filtered = filterGames(ranked, $('#search').value, theme, savedOnly, saved);
  $('#games').innerHTML = filtered.map(card).join('');
  for (const meter of document.querySelectorAll('.meter > span')) {
    meter.style.width = meter.dataset.width + '%';
  }
  $('#games').setAttribute('aria-busy','false');
  $('#empty').hidden = filtered.length > 0;
  $('#results-count').textContent = `${filtered.length} ${ui.count}`;
  $('#empty p').textContent = savedOnly ? ui.emptySaved : ui.empty;
  $('#saved-count').textContent = ranked.filter(game => saved.has(game.id)).length;
  $('#saved-filter').setAttribute('aria-pressed', savedOnly);
}
function renderDialog(id) {
  const game = ranked.find(game => game.id === id);
  if (!game) return;
  dialogGameId = id;
  $('#dialog-content').innerHTML = `${artwork(game,'dialog-art','dialog',true)}<span class="rtp-eyebrow">${escape(themeLabel(game.theme))} / ${escape(ui.rank)} #${game.rank}</span><h2 id="dialog-title">${escape(game.name)}</h2><div class="dialog-value"><span>RTP</span><strong>${percent(game.basisPoints)}</strong></div><p id="dialog-preview">${escape(ui.detailsNotice)}</p>${ui.published ? '' : `<p>${escape(ui.updated)} · ${escape($('#cycle-date').textContent)}</p>`}${game.description?'<p lang="en">'+escape(game.description)+'</p>':''}<button type="button" class="secondary" data-save="${game.id}" aria-pressed="${saved.has(game.id)}">${icon('bookmark')} ${escape(saved.has(game.id) ? ui.saved : ui.save)}</button>`;
}
function onCycle(nextCycle) {
  const changed = Boolean(cycle);
  cycle = nextCycle;
  ranked = featuredGames(catalog.games, cycle.key);
  const featuredThemes = [...new Set(ranked.map(game => game.theme))].sort();
  if(!featuredThemes.includes(theme))theme='all';
  $('.collection-count').textContent = ranked.length;
  $('#total-games').textContent = ranked.length;
  $('#intro-count').textContent = ranked.length;
  $('#filters').innerHTML = ['all',...featuredThemes].map(item => '<button class="filter" data-theme="'+escape(item)+'" type="button" aria-pressed="'+(item === theme)+'">'+escape(item === 'all' ? ui.all : themeLabel(item))+'</button>').join('');
  const date = new Intl.DateTimeFormat(dateLocale, {timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'}).format(cycle.start);
  $('#cycle-date').textContent = date + ' · 12 PM IST';
  $('#edition').textContent = 'IST / ' + new Intl.DateTimeFormat(dateLocale, { timeZone:'Asia/Kolkata', day:'2-digit', month:'short' }).format(cycle.start).toUpperCase();
  renderLeaders(); render();
  if ($('#game-dialog').open) {
    if(ranked.some(game => game.id === dialogGameId))renderDialog(dialogGameId);
    else $('#game-dialog').close();
  }
  if (changed) $('#announcer').textContent = ui.rotated;
}
function applyCatalog(raw) {
    const nextCatalog=normalizeGames(raw);
    if (nextCatalog.games.some(game => game.basisPoints !== undefined) !== ui.published) {
      throw new Error('RTP data is from a different build. Refresh the page and try again.');
    }
    catalog=nextCatalog;
    $('#error').hidden=true;
    $('.catalog-tools').hidden=false;
    clock?.stop();
    if (ui.published) {
      onCycle(cycleAt());
      return;
    }
    clock = createCycleClock({ onCycle, onTick: (c,time) => {
      $('#countdown').textContent = countdown(c.end,time);
      $('#countdown').dateTime = 'PT' + Math.max(0,Math.ceil((c.end-time)/1000)) + 'S';
    }});
    clock.start();
}
async function init() {
  $('#error').hidden = true;
  $('#games').setAttribute('aria-busy','true');
  try {
    const response = await fetch(new URL('./games.json', import.meta.url));
    if (!response.ok) throw new Error('Could not load games.json (HTTP ' + response.status + ').');
    applyCatalog(await response.json());
  } catch (error) {
    $('#error').hidden = false;
    $('#games').setAttribute('aria-busy','false');
    $('#leaders').textContent = ui.unavailable;
    $('#cycle-date').textContent = ui.unavailable;
    console.error('Unable to load game list:',error);
  }
}
$('#retry').addEventListener('click',init);
$('#search').addEventListener('input',() => {if(catalog)render();});
$('#filters').addEventListener('click',event => {
  const target = event.target.closest('[data-theme]'); if (!target) return;
  theme = target.dataset.theme;
  document.querySelectorAll('[data-theme]').forEach(button => button.setAttribute('aria-pressed',button === target)); render();
});
$('#saved-filter').addEventListener('click',() => { savedOnly = !savedOnly; if(catalog) render(); });
$('#clear-filters').addEventListener('click',() => {
  theme = 'all'; savedOnly = false; $('#search').value = '';
  document.querySelectorAll('[data-theme]').forEach(button => button.setAttribute('aria-pressed',button.dataset.theme === 'all')); render(); $('#search').focus();
});
document.addEventListener('click',event => {
  const save = event.target.closest('[data-save]');
  if(save) {
    const id = save.dataset.save;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    try { localStorage.setItem(storageKey,JSON.stringify([...saved])); } catch { /* Saving remains functional in memory. */ }
    // Preserve focus when replacing the card collection.
    const inDialog = Boolean(save.closest('dialog'));
    render();
    if(inDialog) { renderDialog(id); $('#dialog-content [data-save]').focus(); }
    else (document.querySelector(`[data-save="${id}"]`) || $('#saved-filter')).focus();
    $('#announcer').textContent = saved.has(id) ? ui.saved : ui.removed;
  }
  const details = event.target.closest('[data-details]');
  if(details) { renderDialog(details.dataset.details); $('#game-dialog').showModal(); }
});
$('#dialog-close').addEventListener('click',() => $('#game-dialog').close());
$('#game-dialog').addEventListener('click',event => { if(event.target === $('#game-dialog')) { const r=event.target.getBoundingClientRect(); if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
document.addEventListener('keydown',event => {
  if(event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]') && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); $('#search').focus(); }
});
document.addEventListener('visibilitychange',() => { if (document.hidden) clock?.stop(); else clock?.start(); });
window.addEventListener('focus',() => clock?.sync());
window.addEventListener('pageshow',() => clock?.sync());
window.addEventListener('storage',event => { if(event.key === storageKey) { try {const value=JSON.parse(event.newValue || '[]'); saved=new Set(Array.isArray(value)?value.filter(x=>typeof x==='string'):[]);if(catalog)render();if($('#game-dialog').open)renderDialog(dialogGameId);}catch {} } });
// Broken replacement images degrade to the existing theme placeholder.
document.addEventListener('error',event => {
  const img = event.target;
  if(img.matches?.('img[data-fallback-theme]')) {
    const game = { theme:img.dataset.fallbackTheme,thumbnail:null };
    img.outerHTML = artwork(game);
  }
},true);
init();
