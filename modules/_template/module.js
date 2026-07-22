(() => {
  'use strict';
  const root = document.getElementById('widget');
  const label = document.getElementById('label');
  const value = document.getElementById('value');
  let settings = { accent: '#f2c94c', showTrack: true };

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'apex:init' || message.type === 'apex:settings') {
      settings = { ...settings, ...(message.settings || {}) };
      root.style.setProperty('--accent', String(settings.accent));
    }

    if (message.type === 'apex:frame') {
      const session = message.payload?.session;
      const player = message.payload?.player;
      label.textContent = settings.showTrack ? (session?.trackName || 'NO SESSION') : 'CURRENT LAP';
      value.textContent = player?.lap ? `LAP ${player.lap}` : '—';
    }
  });

  window.parent.postMessage({ type: 'apex:ready', moduleId: 'com.example.apexhud.template' }, '*');
})();
