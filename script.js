(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Welcome screen, background music and hero start */
  const hero = document.getElementById('hero');
  const welcome = document.getElementById('welcome');
  const mainEl = document.querySelector('main');
  const musicBtn = document.getElementById('music');
  const root = document.documentElement;
  const AUDIO_SRC = 'assets/wedding-music.mp3';
  const VOLUME = 0.35;
  let audio = null, musicOn = false, opened = false, resumeAfterHide = false, fadeTimer;

  const startHero = () => requestAnimationFrame(() => hero.classList.add('go'));

  const setMusicUI = () => {
    musicBtn.classList.toggle('on', musicOn);
    musicBtn.setAttribute('aria-pressed', String(musicOn));
    musicBtn.setAttribute('aria-label', musicOn ? 'Mute music' : 'Play music');
  };
  const fadeIn = () => {
    clearInterval(fadeTimer);
    if (reduce) { audio.volume = VOLUME; return; }
    let v = 0; audio.volume = 0;
    fadeTimer = setInterval(() => {
      v = Math.min(VOLUME, v + 0.025);
      try { audio.volume = v; } catch (e) { /* iOS ignores volume */ }
      if (v >= VOLUME) clearInterval(fadeTimer);
    }, 80);
  };
  /* must run inside a click handler so browsers allow playback */
  const playMusic = () => {
    try {
      if (!audio) {
        audio = new Audio(AUDIO_SRC);
        audio.loop = true;
        audio.preload = 'auto';
        audio.addEventListener('error', () => { musicOn = false; setMusicUI(); });
      }
      audio.muted = false;
      const p = audio.play();
      musicOn = true; setMusicUI();
      if (p && typeof p.then === 'function') p.then(fadeIn).catch(() => { musicOn = false; setMusicUI(); });
      else fadeIn();
    } catch (e) { musicOn = false; setMusicUI(); }
  };

  musicBtn.addEventListener('click', () => {
    if (musicOn) { if (audio) audio.muted = true; musicOn = false; setMusicUI(); }
    else if (audio && !audio.paused) { audio.muted = false; musicOn = true; setMusicUI(); }
    else playMusic();
  });
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) { resumeAfterHide = !audio.paused; audio.pause(); }
    else if (resumeAfterHide) { resumeAfterHide = false; audio.play().catch(() => {}); }
  });

  const openInvitation = withMusic => {
    if (opened) return;
    opened = true;
    if (withMusic) playMusic(); else setMusicUI();   /* playback is requested here, inside the click */
    musicBtn.hidden = false;
    root.classList.remove('locked');
    mainEl.inert = false;
    window.scrollTo(0, 0);
    startHero();
    welcome.classList.add('closing');
    hero.setAttribute('tabindex', '-1');
    hero.focus({ preventScroll: true });
    const done = () => welcome.remove();
    if (reduce) done(); else setTimeout(done, 900);
  };

  if (welcome) {
    root.classList.add('locked');
    mainEl.inert = true;
    document.getElementById('open-btn').addEventListener('click', () => openInvitation(true));
    const first = document.getElementById('open-btn');
    first.focus({ preventScroll: true });
  } else { startHero(); }

  /* Scroll reveals: each text / floral element is observed on its own (works for tall sections on small phones).
     Only opacity + translateY change; backgrounds are never animated. */
  const items = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });
    items.forEach(el => io.observe(el));
    /* safety net: never leave content hidden if the observer is delayed */
    setTimeout(() => items.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
    }), 1500);
  }

  /* Light parallax (transform only, disabled for reduced motion) */
  const px = [...document.querySelectorAll('.px')];
  if (!reduce && px.length) {
    let tick = false;
    const run = () => {
      const vh = innerHeight;
      px.forEach(el => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        el.style.transform = `translate3d(0, ${((r.top + r.height / 2) - vh / 2) * parseFloat(el.dataset.speed) * -1}px, 0)`;
      });
      tick = false;
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  /* Events (IST = UTC+5:30) */
  const EVENTS = {
    nikkah: { title: 'Nikkah — Alresin & Amina', start: '2026-12-23T19:00:00+05:30', hours: 2,
      loc: 'Malabar Marina Convention Centre, Kozhikode, Kerala', file: 'nikkah-alresin-amina.ics' },
    reception: { title: 'Wedding Reception — Alresin & Amina', start: '2026-12-28T19:00:00+05:30', hours: 3,
      loc: 'Adlux International Convention Centre, Angamaly, Kerala', file: 'reception-alresin-amina.ics' }
  };
  const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = s => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const buildICS = (key, ev) => {
    const s = new Date(ev.start), e = new Date(s.getTime() + ev.hours * 3600000);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alresin and Amina//Wedding Invitation//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:${key}-2026@alresin-amina-wedding`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(s)}`, `DTEND:${stamp(e)}`,
      `SUMMARY:${esc(ev.title)}`, `LOCATION:${esc(ev.loc)}`, `DESCRIPTION:${esc('With best compliments from Family & Friends.')}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  };
  document.querySelectorAll('[data-cal]').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.cal, ev = EVENTS[key];
    const blob = new Blob([buildICS(key, ev)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: ev.file });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }));

  /* Countdown to Nikkah, Asia/Kolkata */
  const box = document.getElementById('countdown');
  const T = Date.parse(EVENTS.nikkah.start);
  const out = { d: document.getElementById('cd-d'), h: document.getElementById('cd-h'), m: document.getElementById('cd-m'), s: document.getElementById('cd-s') };
  const p2 = n => String(n).padStart(2, '0');
  let timer;
  const update = () => {
    const diff = T - Date.now();
    if (diff <= 0) { box.hidden = true; clearInterval(timer); return; }
    const t = Math.floor(diff / 1000);
    out.d.textContent = Math.floor(t / 86400);
    out.h.textContent = p2(Math.floor(t % 86400 / 3600));
    out.m.textContent = p2(Math.floor(t % 3600 / 60));
    out.s.textContent = p2(t % 60);
  };
  update(); timer = setInterval(update, 1000);

  /* WhatsApp share */
  document.getElementById('share').addEventListener('click', async () => {
    const text = 'You are warmly invited to the wedding of Alresin & Amina.\nNikkah: Wed 23 Dec 2026, 7:00 PM, Malabar Marina Convention Centre, Kozhikode.\nReception: Mon 28 Dec 2026, 7:00–10:00 PM, Adlux International Convention Centre, Angamaly.';
    const url = location.href.split('#')[0];
    if (navigator.share) {
      try { await navigator.share({ title: 'Alresin & Amina — Wedding Invitation', text, url }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + url), '_blank', 'noopener');
  });

  /* Deployment reminder: warn in the console if the Open Graph domain was not set */
  const og = document.querySelector('meta[property="og:image"]');
  if (og && /YOUR-DOMAIN/.test(og.content) && !/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    console.warn('Open Graph URLs still contain YOUR-DOMAIN.com — replace it with your live https:// address.');
  }
})();
