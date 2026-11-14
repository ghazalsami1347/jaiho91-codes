const analyticsEnabled = document.body.hasAttribute('data-analytics') &&
  navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1' && window.doNotTrack !== '1';

export function track(action, tier) {
  if (!analyticsEnabled) return;
  fetch('/api/events', {
    method:'POST',
    credentials:'omit',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ action, path:location.pathname, tier }),
    keepalive:true,
  }).catch(() => {});
}

if (analyticsEnabled) {
  if (document.prerendering) document.addEventListener('prerenderingchange', () => track('page_view'), { once:true });
  else track('page_view');
  window.addEventListener('pageshow', event => { if (event.persisted) track('page_view'); });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-track]');
    if (target) track(target.dataset.track, target.closest('[data-tier]')?.dataset.tier);
  });
}
