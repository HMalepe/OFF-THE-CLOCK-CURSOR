/* ==========================================================================
   Off The Clock — main.js
   Order: 1) basics (always run: header, back-to-top, menu, anchors, form,
             quiz, hero video)
          2) static-mode early return
          3) motion blocks in DOM order (00 → 11)
          4) ScrollTrigger.sort() + refreshes
   Timings/eases are documented in MOTION_SPEC.md (source of truth).
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  let lenis = null; // set in motion mode, desktop only
  let lockY = 0; // page position while the menu locks a phone's native scroll
  let bodyLocked = false; // the menu pinned <body> (native scroll) rather than stopping Lenis
  let lockAnchor = null; // section in view when the menu opened, and its offset from the top
  let playIntro = false;
  const pendingHash = window.__otcHash || '';
  const fromHistory = !!window.__otcBack;
  const scrollKey = 'otc-y:' + location.pathname;
  let userScrolled = false;
  let armUser = false;
  window.addEventListener('pagehide', () => {
    try { sessionStorage.setItem(scrollKey, String(Math.round(window.scrollY))); } catch (e) {}
  });
  // Ignore the scroll events the browser fires while the page is settling.
  window.addEventListener('wheel', () => { if (armUser) userScrolled = true; }, { passive: true });
  window.addEventListener('touchmove', () => { if (armUser) userScrolled = true; }, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (armUser && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) userScrolled = true;
  });
  setTimeout(() => { armUser = true; }, 700);

  // Libraries missing → fully static. Otherwise the full motion always runs.
  const motionOK = !!window.gsap && !!window.ScrollTrigger;
  if (!motionOK) root.classList.add('static');
  // A small machine cannot composite pins, a video decoder and a second scroll loop at once.
  const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

  // Small entrance used by UI that re-renders (menu, quiz). No-op only when GSAP is missing.
  const enter = (els, opts = {}) => {
    if (!motionOK || !els || (Array.isArray(els) && !els.length)) return;
    const dist = opts.y ?? 18;
    gsap.fromTo(els, { y: dist, opacity: 0 }, {
      y: 0, opacity: 1,
      duration: opts.duration ?? 1.05,
      ease: 'expo.out', stagger: opts.stagger ?? 0.06, delay: opts.delay ?? 0,
    });
  };

  /* ------------------------------------------------------------------------
     1 · BASICS — work in every mode
     ------------------------------------------------------------------------ */

  // Photo paths: write style="--img:url(../assets/photo.jpg)" — relative to css/styles.css, because
  // a url() inside a custom property resolves against the stylesheet in Chromium/WebKit.
  // This normalises it to an absolute URL so every browser (incl. Firefox) resolves it the same way.
  const cssBase = ($('link[href$="styles.css"]') || {}).href || document.baseURI;
  $$('[style*="--img"]').forEach((el) => {
    const m = el.getAttribute('style').match(/--img:\s*url\((['"]?)([^'")]+)\1\)/);
    if (m && !/^(?:[a-z]+:|\/\/)/i.test(m[2])) el.style.setProperty('--img', `url("${new URL(m[2], cssBase).href}")`);
  });

  // Footer year
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  const warmNext = () => {
    const next = /faq\.html$/i.test(location.pathname) ? 'index.html' : 'faq.html';
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = next;
    document.head.appendChild(link);
  };
  if (window.requestIdleCallback) requestIdleCallback(warmNext, { timeout: 2500 });
  else setTimeout(warmNext, 1500);

  // Header (solid after hero, hides on scroll down, returns on scroll up)
  // + back-to-top button (appears after 1 viewport, ring = page progress)
  const hdr = $('[data-hdr]');
  const toTop = $('[data-totop]');
  const toTopBar = $('[data-totop-bar]');
  let lastY = window.scrollY;
  let travel = 0;
  let downAt = 0;
  const onScroll = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const past = !$('.hero') || y > vh * 0.6;
    hdr.classList.toggle('is-solid', past);
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    toTopBar.style.strokeDashoffset = String(1 - Math.min(1, y / max));
    toTop.classList.toggle('is-visible', y > vh);
    const dy = y - lastY;
    lastY = y;
    if (root.classList.contains('menu-open')) return;
    if (!past || y < 8) {
      hdr.classList.remove('is-hidden');
      travel = 0;
      return;
    }
    if (Math.abs(dy) < 0.5) return;
    if (dy > 0) {
      travel = Math.max(0, travel) + dy;
      if (travel > 48) {
        hdr.classList.add('is-hidden');
        downAt = performance.now();
      }
    } else if (performance.now() - downAt > 700) {
      travel = Math.min(0, travel) + dy;
      if (travel < -140) hdr.classList.remove('is-hidden');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // Set in motion mode: pause / resume the scroll effects. The phone drawer locks the page with
  // position:fixed, which reads as scrollY 0, so without a pause every reveal would rewind behind it
  // and replay at once when it closes.
  let freezeFx = null;
  let thawFx = null;
  let navFromMenu = false;

  // Off-canvas menu (items stagger in when motion is on)
  const drawer = $('#drawer');
  const burger = $('[data-menu-open]');
  const openMenu = () => {
    root.classList.add('menu-open');
    drawer.inert = false;
    burger.setAttribute('aria-expanded', 'true');
    const sec = $$('#main > section, #main > div').find((el) => el.getBoundingClientRect().bottom > 0);
    lockAnchor = sec ? { el: sec, top: sec.getBoundingClientRect().top, w: window.innerWidth, h: window.innerHeight } : null;
    if (lenis) lenis.stop();
    else {
      if (freezeFx) freezeFx();
      bodyLocked = true; // remembered: rotating can switch Lenis on or off while the drawer is open
      lockY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + lockY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
    }
    enter($$('.drawer__title, .drawer details, .drawer__social a', drawer), { y: 28, stagger: 0.09, delay: 0.2, duration: 1.25 });
    setTimeout(() => $('.drawer__close').focus(), 50);
  };
  const closeMenu = () => {
    if (!root.classList.contains('menu-open')) return;
    root.classList.remove('menu-open');
    drawer.inert = true;
    burger.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    if (bodyLocked) {
      bodyLocked = false;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      if (lenis) { lenis.resize(); lenis.scrollTo(lockY, { immediate: true, force: true }); }
      else window.scrollTo(0, lockY);
      if (thawFx && !navFromMenu) thawFx(); // a menu jump thaws when it lands
    }
    // The screen resized or rotated while open: return to the same section, not the same pixel.
    const an = lockAnchor;
    lockAnchor = null;
    if (an && !navFromMenu && (an.w !== window.innerWidth || an.h !== window.innerHeight)) {
      const ay = Math.max(0, window.scrollY + an.el.getBoundingClientRect().top - an.top);
      if (lenis) lenis.scrollTo(ay, { immediate: true, force: true }); else window.scrollTo(0, ay);
      if (window.ScrollTrigger) ScrollTrigger.update();
    }
    burger.focus({ preventScroll: true });
  };
  burger.addEventListener('click', openMenu);
  // Desktop (≥1025px) has the inline top bar instead of the drawer: close it if the window widens
  const DESKTOP_NAV = window.matchMedia('(min-width: 1025px)');
  const onNavChange = (e) => { if (e.matches) closeMenu(); };
  if (DESKTOP_NAV.addEventListener) DESKTOP_NAV.addEventListener('change', onNavChange);
  else DESKTOP_NAV.addListener(onNavChange);
  $$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key !== 'Tab' || !root.classList.contains('menu-open')) return;
    const focusable = $$('a[href], button, summary', drawer).filter((el) => {
      const details = el.closest('details');
      return !(details && !details.open && el.tagName !== 'SUMMARY');
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // In-page anchors (smooth via Lenis when available). In motion mode navTo (set below) takes over:
  // menu jumps travel quietly, with every scroll effect paused, and land on finished states.
  let navTo = null;
  let navQuiet = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#') { e.preventDefault(); return; } // placeholder links
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    userScrolled = true; // a late load/fonts settle must not pull the page back after a menu jump
    const wasOpen = root.classList.contains('menu-open');
    navFromMenu = !!navTo;
    closeMenu();
    navFromMenu = false;
    const go = () => {
      if (navTo) { navTo(target, target.tagName === 'SECTION' ? 0 : -96); return; }
      if (lenis) {
        const offset = target.tagName === 'SECTION' ? 0 : -96;
        const dist = Math.abs(target.getBoundingClientRect().top - offset);
        const duration = gsap.utils.clamp(0.9, 1.6, dist / 1500);
        lenis.scrollTo(target, { duration, offset });
      }
      else target.scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto' });
    };
    wasOpen ? setTimeout(go, 120) : go();
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  // Newsletter — TODO: set SIGNUP_ENDPOINT to your provider's form URL (PROMPTS.md #3)
  const SIGNUP_ENDPOINT = '';
  const form = $('[data-signup]');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('[data-signup-msg]', form);
    const email = form.email.value.trim();
    const say = (t) => { msg.textContent = t; enter(msg, { y: 8, duration: 0.6 }); };
    if (form.company && form.company.value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      say('Please enter a valid email address.');
      form.email.focus();
      return;
    }
    if (!SIGNUP_ENDPOINT) {
      say('Almost there — sign-ups open very soon.');
      return;
    }
    try {
      const res = await fetch(SIGNUP_ENDPOINT, { method: 'POST', body: new FormData(form) });
      say(res.ok ? 'You\'re in. Check your inbox to confirm.' : 'Something went wrong — please try again.');
      if (res.ok) form.reset();
    } catch {
      say('Something went wrong — please try again.');
    }
  });

  // Demo quiz — general education only; edit questions here
  const QUIZ = [
    {
      q: 'Rest is a weakness for leaders at the top.',
      a: false,
      why: 'Off The Clock was founded on the opposite idea. Rest is not a weakness, and burnout is not a strategy. Longevity at the top needs room for the person behind the title.',
    },
    {
      q: 'Lack of sleep is a badge of honour.',
      a: false,
      why: 'In a conversation with Dr Jedd Myers, the line was plain: lack of sleep should not be worn as a badge of honour. You cannot lead well from an empty cup.',
    },
    {
      q: 'Off The Clock is hosted by a father, son and daughter.',
      a: true,
      why: 'Peter Mehlape started the show with his son, Mahlatse, after Mahlatse challenged him to take their conversations further. Today he hosts it with his son, Mahlatse, and his daughter, Tshepiso.',
    },
  ];
  const panel = $('[data-quiz]');
  const newsHref = $('#newsletter') ? '#newsletter' : 'index.html#newsletter';
  let qi = 0;
  let score = 0;
  const refresh = () => window.ScrollTrigger && motionOK && requestAnimationFrame(() => ScrollTrigger.refresh());
  const renderQ = (animate = true) => {
    const item = QUIZ[qi];
    panel.innerHTML = `
      <p class="q__count">Question ${qi + 1} of ${QUIZ.length}</p>
      <p class="q__text">${item.q}</p>
      <div class="q__opts">
        <button class="q__opt" type="button" data-ans="false">Myth</button>
        <button class="q__opt" type="button" data-ans="true">Fact</button>
      </div>`;
    if (animate) enter([...panel.children]);
  };
  const renderEnd = () => {
    panel.innerHTML = `
      <p class="q__count">Your score</p>
      <p class="q__score">${score}/${QUIZ.length}</p>
      <p>${score === QUIZ.length ? 'That is the show. ' : ''}The full conversations are on <a href="https://www.youtube.com/@OffTheClock-ds3cf" target="_blank" rel="noopener">YouTube</a>. New ones land in the newsletter first.</p>
      <div class="q__opts">
        <a class="btn btn--light" href="${newsHref}">Get the next quiz</a>
        <button class="q__opt" type="button" data-restart>Play again</button>
      </div>`;
    enter([...panel.children]);
    refresh();
  };
  if (panel) panel.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-ans]');
    if (opt) {
      const item = QUIZ[qi];
      const right = String(item.a) === opt.dataset.ans;
      if (right) score++;
      $$('[data-ans]', panel).forEach((b) => {
        b.disabled = true;
        if (b.dataset.ans === String(item.a)) b.classList.add('is-right');
        else if (b === opt) b.classList.add('is-wrong');
      });
      panel.insertAdjacentHTML('beforeend', `
        <p class="q__why"><strong>${item.a ? 'Fact.' : 'Myth.'}</strong> ${item.why}</p>
        <button class="btn btn--light q__next" type="button" data-next>${qi < QUIZ.length - 1 ? 'Next question' : 'See my score'}</button>`);
      enter($$('.q__why, [data-next]', panel), { stagger: 0.1 });
      $('[data-next]', panel).focus({ preventScroll: true });
      refresh();
      return;
    }
    if (e.target.closest('[data-next]')) {
      qi++;
      qi < QUIZ.length ? renderQ() : renderEnd();
      return;
    }
    if (e.target.closest('[data-restart]')) { qi = 0; score = 0; renderQ(); refresh(); }
  });
  if (panel) renderQ(false);

  // FAQ open/close changes page height → keep triggers accurate; answer eases in
  $$('.faq__list details').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) enter($('p', d), { y: -8, duration: 0.6 });
    refresh();
  }));

  // HERO VIDEO — loads unless the visitor is on Save-Data.
  // Poster (.ph) stays underneath; video fades in on 'playing'. Pauses off-screen / hidden tab.
  (() => {
    const video = $('[data-hero-video]');
    const toggle = $('[data-video-toggle]');
    if (!video) { toggle && toggle.remove(); $$('[data-video-sound], [data-video-seek], [data-video-follow]').forEach((b) => b.remove()); return; }
    const d = video.dataset;
    const isMobile = window.matchMedia && matchMedia('(max-width: 760px)').matches;
    const useMobile = isMobile && (d.srcWebmMobile || d.srcMp4Mobile);
    if (useMobile && d.posterMobile) video.poster = d.posterMobile; // <picture> handles the still layer
    const conn = navigator.connection || {};
    const candidates = (useMobile
      ? [[d.srcWebmMobile, 'video/webm'], [d.srcMp4Mobile, 'video/mp4']]
      : [[d.srcWebm, 'video/webm'], [d.srcMp4, 'video/mp4']]
    ).filter(([src, type]) => src && video.canPlayType(type));
    const drop = () => { const he = $('.hero'); he.classList.remove('hero--video', 'is-watching'); video.remove(); toggle && toggle.remove(); $$('[data-video-sound], [data-video-seek], [data-video-follow]').forEach((b) => b.remove()); };
    if (!motionOK || conn.saveData || lowPower || !candidates.length) { drop(); return; }

    candidates.forEach(([src, type]) => {
      const s = document.createElement('source');
      s.src = src; s.type = type;
      video.appendChild(s);
    });
    // Navy start: the poster and title stay hidden while the trailer is on its way (JS-only classes,
    // so static mode / no-JS still shows the poster and title).
    $('.hero').classList.add('hero--video', 'is-watching');
    // If every source fails, the last <source> fires 'error' → fall back to the poster
    video.lastElementChild.addEventListener('error', drop);
    video.addEventListener('playing', () => video.classList.add('is-ready'));
    // While the trailer plays, the centre title steps aside; it returns on pause or at the end.
    const heroEl = $('.hero');
    video.addEventListener('playing', () => heroEl.classList.add('is-watching'));
    video.addEventListener('pause', () => heroEl.classList.remove('is-watching'));
    video.addEventListener('ended', () => heroEl.classList.remove('is-watching'));
    // Seamless loop. The clip ends on a black title card, so a native loop hard-cuts back to the
    // opening shot. Instead: fade the video out over the last FADE seconds onto the poster (which is
    // the exact first frame), restart underneath, and fade back in — the restart is invisible.
    // data-play-once (a long trailer): no loop. It plays through once, rests on its last frame and
    // the button shows Play; pressing it starts again from the top.
    const once = 'playOnce' in d;
    const FADE = 1.8; // matches the .hero__video opacity transition
    if (!once) video.addEventListener('timeupdate', () => {
      if (video.duration && video.duration - video.currentTime <= FADE) video.classList.remove('is-ready');
    });
    video.addEventListener('ended', () => {
      if (once) { setPaused(true); return; }
      video.currentTime = 0;
      if (!userPaused) video.play().catch(() => {});
    });

    let userPaused = false;
    let inView = true;
    let tabVisible = !document.hidden;
    let docked = false;
    // Stillness: the video must not start while the loader/zoom intro is running (it stalled while
    // buffering and the picture jerked under the zoom). It starts once the intro is done AND enough
    // of the clip is buffered to play through, then fades in over the identical poster frame.
    let introDone = false;
    let buffered = false;
    const go = () => { if (introDone) return; introDone = true; sync(); };
    document.addEventListener('otc:curtain', go, { once: true }); // the loader starts to lift
    document.addEventListener('otc:intro-done', go, { once: true }); // no loader on this visit
    video.addEventListener('canplaythrough', () => { buffered = true; sync(); }, { once: true });
    const setPaused = (p) => {
      userPaused = p;
      toggle.setAttribute('aria-pressed', String(p));
      $('[data-video-label]', toggle).textContent = p ? 'Play video' : 'Pause video';
      toggle.dataset.tip = p ? 'Play' : 'Pause';
      if (!p && video.ended) video.currentTime = 0;
      sync();
    };
    // First start: as soon as the loader lifts and enough is buffered (see stageStart).
    let gateOpen = false;
    let staging = false;
    // The trailer starts the moment the loader lifts and fades in from the navy (no poster, no
    // title in between). If it has not started a few seconds after that, the title comes back.
    const stageStart = () => {
      if (staging) return;
      staging = true;
      gateOpen = true;
      sync();
      if (typeof placeDock === 'function') placeDock();
    };
    setTimeout(() => { if (video.paused && !docked) heroEl.classList.remove('is-watching'); }, 9000);
    const sync = () => {
      if (!video.isConnected) return;
      const ready = introDone && buffered && !userPaused && (inView || docked) && tabVisible;
      if (!gateOpen) { if (ready) stageStart(); return; }
      const shouldPlay = ready;
      if (shouldPlay && video.paused) video.play().catch(() => {});
      else if (!shouldPlay && !video.paused) video.pause();
    };
    // Sound on/off: only for a clip that has an audio track (data-has-audio). Starts muted (autoplay rule);
    // the click is the user gesture browsers need before playing sound.
    const sound = $('[data-video-sound]');
    if (sound && 'hasAudio' in d) {
      sound.hidden = false;
      sound.addEventListener('click', () => {
        video.muted = !video.muted;
        const on = !video.muted;
        sound.setAttribute('aria-pressed', String(on));
        $('[data-sound-label]', sound).textContent = on ? 'Turn sound off' : 'Turn sound on';
        sound.dataset.tip = on ? 'Sound off' : 'Sound on';
        if (on && userPaused) setPaused(false); // asking for sound means "play it"
        if (on) hideCue();
      });
      // Sound prompt: once per visit, ~1.2s after the trailer first plays (muted), for ~8s.
      const cue = $('[data-sound-cue]');
      let cueTimer = 0;
      var hideCue = () => { if (!cue) return; cue.classList.remove('is-on'); sound.classList.remove('is-cued'); clearTimeout(cueTimer); };
      const showCue = () => {
        if (!cue || !video.muted || userPaused || docked) return;
        try { if (sessionStorage.getItem('otc-sound-cue')) return; sessionStorage.setItem('otc-sound-cue', '1'); } catch (e) {}
        cue.hidden = false;
        // point the pill's arrow at the sound button, wherever the layout put them
        const sr = sound.getBoundingClientRect();
        const pr = cue.getBoundingClientRect();
        const left = pr.left + (pr.width - cue.offsetWidth) / 2; // undo the .96 entry scale
        cue.style.setProperty('--cue-x', `${Math.round(sr.left + sr.width / 2 - left)}px`);
        requestAnimationFrame(() => { cue.classList.add('is-on'); sound.classList.add('is-cued'); });
        cueTimer = setTimeout(hideCue, 8000);
      };
      if (cue) {
        cue.addEventListener('click', () => { if (video.muted) sound.click(); hideCue(); });
        video.addEventListener('playing', () => setTimeout(showCue, 1200), { once: true });
        video.addEventListener('pause', hideCue);
      }
    } else if (sound) { sound.remove(); const c = $('[data-sound-cue]'); if (c) c.remove(); }
    toggle.hidden = false;
    toggle.addEventListener('click', () => setPaused(!userPaused));

    // Rewind / fast-forward 10s (also ← / → while the hero or the floating player is on screen)
    const seek = (by) => {
      if (!video.duration) return;
      video.currentTime = Math.min(Math.max(0, video.currentTime + by), Math.max(0, video.duration - 0.05));
    };
    $$('[data-video-seek]').forEach((b) => { b.hidden = false; b.addEventListener('click', () => seek(+b.dataset.videoSeek)); });

    // Keep playing while scrolling: the trailer docks into a small floating player (bottom right)
    // once the hero is mostly off screen, with its controls; it moves back when the hero returns.
    // Moving a <video> between parents in one task does not pause it.
    const follow = $('[data-video-follow]');
    const ctrls = $('.hero__ctrls');
    const home = { video: [video.parentNode, video.nextSibling], ctrls: [ctrls.parentNode, ctrls.nextSibling] };
    const dock = document.createElement('div');
    dock.className = 'hero-dock';
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-label', 'Trailer, floating player');
    dock.innerHTML = '<button class="hero-dock__close" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg><span class="sr">Close floating player</span></button><div class="hero-dock__screen"></div>';
    document.body.appendChild(dock);
    const screen = $('.hero-dock__screen', dock);
    let following = false;
    let heroShown = 1; // visible fraction of the hero
    const tip = (b) => { b.classList.add('show-tip'); clearTimeout(b._tip); b._tip = setTimeout(() => b.classList.remove('show-tip'), 1800); };
    const placeDock = () => {
      const want = following && gateOpen && heroShown < 0.35 && !root.classList.contains('menu-open');
      if (want === docked) return;
      docked = want;
      if (want) {
        screen.appendChild(video);
        dock.appendChild(ctrls);
        requestAnimationFrame(() => dock.classList.add('is-on'));
      } else {
        dock.classList.remove('is-on');
        home.video[0].insertBefore(video, home.video[1]);
        home.ctrls[0].insertBefore(ctrls, home.ctrls[1]);
      }
      sync();
    };
    const setFollow = (on) => {
      following = on;
      follow.setAttribute('aria-pressed', String(on));
      follow.dataset.tip = on ? 'Playing while you scroll · tap to stop' : 'Keep playing while scrolling';
      $('[data-follow-label]', follow).textContent = on ? 'Stop playing while scrolling' : 'Keep playing while scrolling the page';
      placeDock();
    };
    if (follow) {
      follow.hidden = false;
      follow.addEventListener('click', () => { setFollow(!following); tip(follow); });
    }
    $('.hero-dock__close', dock).addEventListener('click', () => setFollow(false));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.ctrlKey || e.metaKey || e.altKey || root.classList.contains('menu-open')) return;
      if (!docked && $('.hero').getBoundingClientRect().bottom < window.innerHeight * 0.5) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable], .topics__viewport')) return;
      e.preventDefault();
      seek(e.key === 'ArrowLeft' ? -10 : 10);
    });
    // Space bar = play / pause while the hero is on screen. Elsewhere it scrolls as usual, and it is
    // left alone in fields, buttons, links and the open menu (they use Space themselves).
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !video.isConnected) return;
      if (!docked && $('.hero').getBoundingClientRect().bottom < window.innerHeight * 0.5) return; // hero mostly scrolled away
      if (root.classList.contains('menu-open')) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, button, a, summary, [contenteditable], [role="button"]')) return;
      e.preventDefault();
      setPaused(!userPaused);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting && e.intersectionRatio >= 0.05; heroShown = e.intersectionRatio; placeDock(); sync(); }, { threshold: [0, 0.05, 0.2, 0.35, 0.5, 1] }).observe($('.hero'));
    }
    document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; sync(); });
    video.muted = true; // required for autoplay
    video.preload = 'auto'; // buffer during the loader so playback can start clean afterwards
    video.load();
    sync();
  })();

  /* ------------------------------------------------------------------------
     2 · NO LIBRARIES — everything stays visible, no tweens
     ------------------------------------------------------------------------ */
  // After pins exist, open on the section that was requested or the spot
  // the back button was meant to restore. A late image load can shift that
  // spot, so it runs once more — unless the person has already scrolled.
  function settlePlace() {
    if (window.ScrollTrigger) {
      if (!settlePlace.cleared) {
        ScrollTrigger.clearScrollMemory();
        settlePlace.cleared = true;
      }
      ScrollTrigger.refresh();
    }
    const go = (y) => {
      if (lenis) lenis.resize();
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const dest = Math.max(0, Math.min(y, max));
      if (lenis) lenis.scrollTo(dest, { immediate: true, force: true });
      else window.scrollTo(0, dest);
      if (window.ScrollTrigger) ScrollTrigger.update();
      onScroll();
    };
    if (!userScrolled) {
      if (fromHistory) {
        let y = 0;
        try { y = +(sessionStorage.getItem(scrollKey) || 0); } catch (e) {}
        go(y);
      } else if (pendingHash && pendingHash !== '#top') {
        const target = document.querySelector(pendingHash);
        history.replaceState(null, '', pendingHash);
        if (target) {
          const offset = target.tagName === 'SECTION' ? 0 : -96;
          go(Math.max(0, target.getBoundingClientRect().top + window.scrollY + offset));
        }
      }
    }
    if (!playIntro) root.classList.add('is-loaded');
    if (settlePlace.bound) return;
    settlePlace.bound = true;
    const again = () => {
      if (userScrolled || settlePlace.queued) return;
      settlePlace.queued = true;
      requestAnimationFrame(() => { settlePlace.queued = false; if (!userScrolled) settlePlace(); });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(again));
    window.addEventListener('load', () => requestAnimationFrame(again));
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      userScrolled = false;
      requestAnimationFrame(again);
    });
  }

  if (!motionOK) {
    root.classList.add('is-loaded');
    document.dispatchEvent(new Event('otc:intro-done'));
    settlePlace();
    return;
  }

  // Dark pie starts empty, then sweeps 12 → 3 → 6 → 9 → 12 until the O is full.
  function startClocks() {
    const pies = $$('[data-pie]');
    if (!pies.length) return;
    const cx = 50, cy = 50, r = 25;
    const pt = (deg) => {
      const rad = (deg - 90) * Math.PI / 180;
      return [(cx + r * Math.cos(rad)).toFixed(2), (cy + r * Math.sin(rad)).toFixed(2)];
    };
    const wedge = (start, end) => {
      const span = end - start;
      if (span <= 0.4) return `M${cx} ${cy} Z`;
      if (span >= 359.6) {
        return `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
      }
      const [x0, y0] = pt(start);
      const [x1, y1] = pt(end);
      const large = span > 180 ? 1 : 0;
      return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    };
    const apply = (start, end) => {
      const d = wedge(start, end);
      pies.forEach((p) => p.setAttribute('d', d));
    };
    const cycle = 12000;
    const t0 = performance.now();
    let drawn = -1;
    const tick = (now) => {
      const elapsed = now - t0;
      const u = (elapsed % cycle) / cycle;
      const step = Math.round(u * 240);
      if (step !== drawn) {
        drawn = step;
        const fill = 0.84;
        apply(0, u < fill ? (u / fill) * 360 : 360);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  startClocks();

  /* ------------------------------------------------------------------------
     3 · MOTION SETUP
     ------------------------------------------------------------------------ */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  document.addEventListener('visibilitychange', () => {
    if (!gsap.ticker.sleep) return;
    if (document.hidden) gsap.ticker.sleep();
    else gsap.ticker.wake();
  });

  const EASE = 'expo.out';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mm = gsap.matchMedia();
  const DESKTOP = '(min-width: 761px)';
  // Native scrolling on phones, and on a desktop that is short of memory.
  // Lenis fights the iOS rubber-band, and on a weak CPU it lags a frame behind the pins.
  mm.add(DESKTOP, () => {
    if (!window.Lenis || lowPower) return;
    const instance = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 0.7,
      respectReducedMotion: false,
    });
    lenis = instance;
    window.__lenis = instance;
    instance.on('scroll', ScrollTrigger.update);
    const tick = (t) => instance.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      if (lenis === instance) lenis = null;
      if (window.__lenis === instance) window.__lenis = null;
    };
  });

  // Split [data-split] headings into masked words: span.w > span.wi
  const split = (el) => {
    if (el._words) return el._words;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.textContent = part;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    [...el.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
    el._words = $$('.wi', el);
    return el._words;
  };

  // Letters inside the word masks. Spaces stay between words.
  const splitChars = (el) => {
    if (el._chars) return el._chars;
    const chars = [];
    split(el).forEach((wi) => {
      const text = wi.textContent;
      wi.textContent = '';
      [...text].forEach((ch) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        wi.appendChild(s);
        chars.push(s);
      });
    });
    el._chars = chars;
    return chars;
  };

  // Entrances replay: forward when the element scrolls into view going down, in reverse when it
  // scrolls back out below the screen going up. (Name kept from when they played once.)
  const REPLAY = 'play none none reverse';
  const once = (el, start) => ({ trigger: el, start, toggleActions: REPLAY });

  // Primitive: masked word-rise, once
  const wordRise = (el, start = 'top 85%') =>
    gsap.fromTo(split(el), { yPercent: 118 }, {
      yPercent: 0, duration: 1.55, ease: EASE, stagger: 0.12,
      scrollTrigger: once(el, start),
    });

  // Primitive: fade-up, once
  const fadeUp = (el, start = 'top 88%') => el &&
    gsap.fromTo(el, { y: 40, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.35, ease: EASE,
      scrollTrigger: once(el, start),
    });

  // Words fade and rise, unmasked, so a paragraph can cascade without a clip
  const wordFade = (el, start = 'top 86%') =>
    gsap.fromTo(split(el), { y: 16, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.25, ease: EASE, stagger: 0.05,
      scrollTrigger: once(el, start),
    });

  // Words sharpen as they arrive. Filter is cleared so it doesn't linger on the layer.
  const blurIn = (el, start = 'top 84%') =>
    gsap.fromTo(split(el), { filter: 'blur(14px)', opacity: 0, scale: 1.08 }, {
      filter: 'blur(0px)', opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: once(el, start),
    });

  // ---- More text entrances, each visibly different ----
  // Typewriter: letters snap on one after another, with a blinking caret riding the end
  const typeIn = (el, start = 'top 86%') => {
    const chars = splitChars(el);
    const caret = (on) => () => el.classList.toggle('has-caret', on);
    return gsap.fromTo(chars, { opacity: 0 }, {
      opacity: 1, duration: 0.01, stagger: 0.022, ease: 'none',
      onStart: caret(true), onComplete: () => setTimeout(caret(false), 1200), onReverseComplete: caret(false),
      scrollTrigger: once(el, start),
    });
  };
  // Scatter: letters fly in from random spots and spins, then lock into place
  const scatterIn = (el, start = 'top 84%') =>
    gsap.fromTo(splitChars(el), {
      x: () => gsap.utils.random(-160, 160), y: () => gsap.utils.random(-90, 90),
      rotation: () => gsap.utils.random(-90, 90), opacity: 0,
    }, {
      x: 0, y: 0, rotation: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: { each: 0.025, from: 'random' },
      scrollTrigger: once(el, start),
    });
  // Pop: letters scale up from nothing with a little overshoot, from the centre outwards
  const popIn = (el, start = 'top 84%') =>
    gsap.fromTo(splitChars(el), { scale: 0, opacity: 0 }, {
      scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(2.2)', stagger: { each: 0.04, from: 'center' },
      scrollTrigger: once(el, start),
    });
  // Flip: letters rotate up like a split-flap board
  const flipChars = (el, start = 'top 84%') =>
    gsap.fromTo(splitChars(el), { rotationX: -100, opacity: 0, transformPerspective: 600, transformOrigin: '50% 50% -20px' }, {
      rotationX: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.05,
      scrollTrigger: once(el, start),
    });
  // Spread: the line starts tracked very wide and faint, then pulls together
  const spreadIn = (el, start = 'top 88%') =>
    gsap.fromTo(el, { letterSpacing: '0.6em', opacity: 0 }, {
      letterSpacing: () => getComputedStyle(el).letterSpacing === 'normal' ? '0em' : getComputedStyle(el).letterSpacing,
      opacity: 1, duration: 1.6, ease: 'expo.out', clearProps: 'letterSpacing',
      scrollTrigger: once(el, start),
    });
  // Skew: words slide in from the right leaning forward, then straighten
  const skewIn = (el, start = 'top 86%') =>
    gsap.fromTo(split(el), { x: 80, skewX: -24, opacity: 0 }, {
      x: 0, skewX: 0, opacity: 1, duration: 1.1, ease: 'power4.out', stagger: 0.035,
      scrollTrigger: once(el, start),
    });
  // Alternate: words come from opposite sides, left, right, left…
  const sidesIn = (el, start = 'top 86%') =>
    gsap.fromTo(split(el), { x: (i) => (i % 2 ? 46 : -46), opacity: 0 }, {
      x: 0, opacity: 1, duration: 1.2, ease: EASE, stagger: 0.04,
      scrollTrigger: once(el, start),
    });
  // Fold: whole words tip down from above like cards being laid
  const foldIn = (el, start = 'top 86%') =>
    gsap.fromTo(split(el), { rotationX: 90, opacity: 0, transformPerspective: 500, transformOrigin: '50% 0%' }, {
      rotationX: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.045,
      scrollTrigger: once(el, start),
    });

  // Letters fall in and settle. back.out is the one ease that isn't expo: a drop needs the overshoot.
  const dropIn = (el, start = 'top 84%') =>
    gsap.fromTo(splitChars(el), {
      y: -48, rotation: (i) => (i % 2 ? 5 : -5), opacity: 0,
    }, {
      y: 0, rotation: 0, opacity: 1, duration: 1.35, ease: 'back.out(1.4)', stagger: 0.09,
      scrollTrigger: once(el, start),
    });

  // Letters arrive on a sine wave, then land on the baseline
  const waveIn = (el, start = 'top 84%') =>
    gsap.fromTo(splitChars(el), {
      y: (i) => 22 + Math.sin(i * 0.7) * 16, opacity: 0,
    }, {
      y: 0, opacity: 1, duration: 1.45, ease: EASE, stagger: 0.05,
      scrollTrigger: once(el, start),
    });

  // Each line wipes open left to right. Lines are authored as span.line so wrapping can't reshuffle them.
  const maskLines = (el, start = 'top 82%') => {
    const lines = $$('.line', el);
    const targets = lines.length ? lines : [el];
    return gsap.fromTo(targets, { clipPath: 'inset(0% 100% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.45, ease: 'expo.inOut', stagger: 0.24,
      scrollTrigger: once(el, start),
      onComplete: () => gsap.set(targets, { clearProps: 'clipPath' }),
    });
  };

  // Fill colour wipes across a duplicate of the line. The dim copy stays put underneath.
  const colorWipe = (el) => {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const dim = document.createElement('span');
    dim.className = 'wipe__dim';
    dim.textContent = text;
    const fill = document.createElement('span');
    fill.className = 'wipe__fill';
    fill.textContent = text;
    fill.setAttribute('aria-hidden', 'true');
    el.append(dim, fill);
    return gsap.fromTo(fill, { clipPath: 'inset(0% 100% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 30%', scrub: true },
    });
  };

  // Masked word rise locked to scroll, so it reverses if you scroll back
  const scrubWords = (el) =>
    gsap.fromTo(split(el), { yPercent: 118 }, {
      yPercent: 0, ease: 'none', stagger: 0.28,
      scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 38%', scrub: true },
    });

  // Letters cycle through capitals, then settle. Question marks and spaces stay still.
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const decodeIn = (el, start = 'top 72%') => {
    const chars = splitChars(el);
    const finals = chars.map((c) => c.textContent);
    ScrollTrigger.create({
      ...once(el, start),
      onEnter: () => {
        if (navQuiet) return; // menu jump: the word is already final, no scramble
        chars.forEach((ch, i) => {
          const real = finals[i];
          if (!/[A-Za-z]/.test(real)) return;
          const steps = 7;
          const o = { n: 0 };
          gsap.to(o, {
            n: steps, duration: 0.8, delay: i * 0.07, ease: 'none',
            onUpdate: () => {
              ch.textContent = (steps - o.n) > 0.35 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : real;
            },
            onComplete: () => { ch.textContent = real; },
            onInterrupt: () => { ch.textContent = real; },
          });
        });
      },
    });
  };

  // Primitive: staggered children fade-up, once ([data-stagger])
  const staggerUp = (el, start = 'top 90%') =>
    gsap.fromTo([...el.children], { y: 24, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.2, ease: EASE, stagger: 0.12,
      scrollTrigger: { trigger: el, start, toggleActions: REPLAY },
    });

  // Block entrances (whole element, not split): slide in from a side, zoom, clip up, or tilt forward.
  const blockIn = (from) => (el, start = 'top 88%') =>
    gsap.fromTo(el, { opacity: 0, ...from }, {
      opacity: 1, x: 0, y: 0, scale: 1, rotationX: 0, clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.3, ease: EASE, scrollTrigger: once(el, start),
    });
  const slideLeft = blockIn({ x: -64 });
  const slideRight = blockIn({ x: 64 });
  const zoomIn = blockIn({ scale: 0.86 });
  const clipUp = blockIn({ y: 24, clipPath: 'inset(100% 0% 0% 0%)' });
  const tiltIn = blockIn({ rotationX: 55, y: 40, transformPerspective: 900, transformOrigin: '50% 100%' });

  // Primitive: one reveal per element, in DOM order. data-reveal picks the treatment; data-split alone stays the masked word rise.
  const playReveal = (el) => {
    switch (el.dataset.reveal) {
      case 'words': return wordFade(el);
      case 'blur': return blurIn(el);
      case 'drop': return dropIn(el);
      case 'wave': return waveIn(el);
      case 'mask': return maskLines(el);
      case 'wipe': return colorWipe(el);
      case 'scrub': return scrubWords(el);
      case 'decode': return decodeIn(el);
      case 'type': return typeIn(el);
      case 'scatter': return scatterIn(el);
      case 'pop': return popIn(el);
      case 'flipchars': return flipChars(el);
      case 'spread': return spreadIn(el);
      case 'skew': return skewIn(el);
      case 'sides': return sidesIn(el);
      case 'fold': return foldIn(el);
      case 'left': return slideLeft(el);
      case 'right': return slideRight(el);
      case 'zoom': return zoomIn(el);
      case 'clip': return clipUp(el);
      case 'tilt': return tiltIn(el);
      default:
        if (el.hasAttribute('data-split')) return wordRise(el);
        if (el.hasAttribute('data-stagger')) return staggerUp(el);
        return fadeUp(el);
    }
  };

  const reveal = (scope, skip) => {
    if (!scope) return;
    // One by one: items in the same section are delayed in DOM order, so elements that
    // enter the screen together still arrive in sequence (0.16s apart, capped at 0.96s).
    let order = 0;
    $$('[data-split], [data-fade], [data-stagger], [data-reveal]', scope).forEach((el) => {
      if (skip && skip(el)) return;
      if (el.dataset.reveal === 'flip') return;
      const t = playReveal(el);
      const scrubbed = el.dataset.reveal === 'wipe' || el.dataset.reveal === 'scrub';
      if (t && t.delay && !scrubbed) t.delay(Math.min(order * 0.16, 0.96));
      order++;
    });
  };

  // Continuous scroll effects repainted on every frame and stuttered both pages.
  // One-shot entrances and the two pins stay.
  const leave = () => {};
  const drift = () => {};
  const speed = () => {};

  // Primitive: cards rise in together. No clip or image scale — those repaint the photos.
  const batchReveal = (list) => {
    if (!list) return;
    const items = $$(':scope > li', list);
    if (!items.length) return;
    gsap.set(items, { y: 24, opacity: 0 });
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      onEnter: (batch) => (navQuiet
        ? gsap.set(batch, { y: 0, opacity: 1, overwrite: true })
        : gsap.to(batch, { y: 0, opacity: 1, duration: 1.05, ease: EASE, stagger: 0.1, overwrite: true })),
      onLeaveBack: (batch) => gsap.to(batch, { y: 24, opacity: 0, duration: 0.6, ease: 'power2.in', stagger: -0.06, overwrite: true }),
    });
  };

  // Primitive: pointer tilt (desktop only)
  const tilt = (el) => {
    if (!finePointer) return;
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 8);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  };

  /* ------------------------------------------------------------------------
     MENU JUMPS — quiet travel. Every non-pinned ScrollTrigger is paused (frozen where it is),
     the page travels (long trips dip out and glide the last stretch), then each reveal is set
     straight to its finished or unrevealed state for where you landed. Pins stay live: they
     hold the page height. Manual scrolling keeps all the effects.
     ------------------------------------------------------------------------ */
  const mainEl = $('#main');
  let introTl = null; // set by the loader intro below
  let navRun = 0; // a newer click supersedes an unfinished jump
  let frozen = null; // triggers paused by freezeFx, resumed by thawFx
  let staleFx = false; // a resize refresh skipped the paused triggers
  ScrollTrigger.addEventListener('refreshInit', () => { if (frozen) staleFx = true; });
  freezeFx = () => {
    navQuiet = true;
    if (frozen) return;
    frozen = ScrollTrigger.getAll().filter((st) => !st.pin);
    frozen.forEach((st) => st.disable(false));
  };
  thawFx = () => {
    if (!frozen) return;
    const list = frozen;
    frozen = null;
    const now = window.scrollY;
    // No per-trigger refresh: start/end are unchanged, and refreshing a trigger that sits inside a
    // pinned section briefly reverts that pin, which shrinks the page and drops you at the bottom.
    list.forEach((st) => st.enable(false, false));
    if (Math.abs(window.scrollY - now) > 1) { if (lenis) lenis.scrollTo(now, { immediate: true, force: true }); else window.scrollTo(0, now); }
    if (staleFx) { staleFx = false; ScrollTrigger.refresh(); } // full refresh keeps the scroll position
    list.forEach((st) => {
      const anim = st.animation;
      // finished if its trigger has been reached or it's anywhere on screen
      if (anim && !st.vars.scrub) anim.progress(now >= st.start - window.innerHeight * 0.14 ? 1 : 0);
    });
    ScrollTrigger.update();
    setTimeout(() => { navQuiet = false; }, 150);
  };
  navTo = (target, offset = 0) => {
    const run = ++navRun;
    gsap.killTweensOf(mainEl);
    // Clicked while the opening intro is still running: finish it now (curtain up, scroll unlocked,
    // callbacks fired so the video may start), otherwise the locked scroll ignores the click.
    if (introTl && introTl.progress() < 1) introTl.progress(1, false);
    if (lenis) lenis.start();
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY + offset);
    const vh = window.innerHeight;
    const dist = Math.abs(y - window.scrollY);
    freezeFx();
    const land = () => {
      if (run !== navRun) return;
      thawFx();
      // a refresh on thaw (the screen resized or rotated mid-way) can move the target a few pixels
      const off = target.getBoundingClientRect().top + offset;
      if (Math.abs(off) > 1) { const fy = window.scrollY + off; if (lenis) lenis.scrollTo(fy, { immediate: true, force: true }); else window.scrollTo(0, fy); }
      if (mainEl) gsap.set(mainEl, { clearProps: 'opacity' });
    };
    const glide = (dur, done) => {
      if (lenis) lenis.scrollTo(y, { duration: dur, force: true, onComplete: done });
      else {
        window.scrollTo({ top: y, behavior: 'smooth' });
        let last = -1, still = 0;
        const watch = () => {
          const cur = Math.round(window.scrollY);
          still = cur === last ? still + 1 : 0;
          last = cur;
          if (still > 6 || Math.abs(cur - y) < 2 && still > 2) done(); else requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      }
    };
    if (dist <= vh * 2) { glide(gsap.utils.clamp(0.7, 1.1, dist / 1400), land); return; }
    // Long trip: a short dip, jump to just before the target, glide in.
    const dir = y > window.scrollY ? 1 : -1;
    gsap.to(mainEl, {
      opacity: 0, duration: 0.2, ease: 'power1.in',
      onComplete: () => {
        if (run !== navRun) return;
        const pre = Math.max(0, y - dir * vh * 0.45);
        if (lenis) lenis.scrollTo(pre, { immediate: true, force: true }); else window.scrollTo(0, pre);
        gsap.to(mainEl, { opacity: 1, duration: 0.45, ease: 'power1.out' });
        glide(0.9, land);
      },
    });
  };

  /* ------------------------------------------------------------------------
     00 · LOADER → 02 · HERO INTRO
     The curtain plays once, on a first look at the top of the home page.
     A section link, the back button, or a return from the questions page
     opens on the right spot instead of replaying it.
     ------------------------------------------------------------------------ */
  const seenIntro = (() => { try { return sessionStorage.getItem('otc-intro') === '1'; } catch (e) { return false; } })();
  playIntro = !!$('.hero') && !fromHistory && !pendingHash && !seenIntro;
  if ($('.hero')) {
    try { sessionStorage.setItem('otc-intro', '1'); } catch (e) {}
    if (playIntro) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      lenis && lenis.stop();
      const loader = $('.loader');
      const heroChars = splitChars($('[data-split="hero"]'));
      const heroFades = $$('[data-hero-fade], .hero__toggle:not([hidden])');

      // During the intro a main-thread hitch should slow the motion, not make it jump.
      gsap.ticker.lagSmoothing(500, 33);
      const intro = introTl = gsap.timeline({
        paused: true,
        delay: 0.15,
        onComplete: () => {
          root.classList.add('is-loaded');
          gsap.ticker.lagSmoothing(0);
          lenis && lenis.start();
        },
      });
      intro
        .fromTo('.loader__mark', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: EASE })
        .fromTo('.loader__rule', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, '-=0.5')
        .fromTo('.loader__word', { opacity: 0, y: 12 }, { opacity: 0.85, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.4')
        .to('.loader__inner', { opacity: 0, y: -20, duration: 0.6, ease: 'power2.in' }, '+=0.6')
        .call(() => document.dispatchEvent(new Event('otc:curtain')), null, '-=0.15')
        .to(loader, { yPercent: -100, duration: 1.35, ease: 'expo.inOut' }, '<')
        .fromTo('[data-hero-zoom]', { scale: 1.25 }, { scale: 1, duration: 2.6, ease: EASE }, '-=0.9')
        .addLabel('zoomed', '>')
        .fromTo(hdr, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1.25, ease: EASE, clearProps: 'transform' }, '<0.25')
        .fromTo(heroChars, { rotationX: -88, yPercent: 50, opacity: 0 }, {
          rotationX: 0, yPercent: 0, opacity: 1, duration: 1.5, ease: EASE, stagger: 0.07,
        }, '<')
        .fromTo(heroFades, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.3, ease: EASE, stagger: 0.14 }, '<0.55')
        .call(() => document.dispatchEvent(new Event('otc:intro-done')), null, 'zoomed');
      // Start only when the logo is decoded and the fonts are in, so nothing swaps or pops
      // mid-animation (capped so a slow font never holds the page).
      const logo = $('.loader__mark img');
      const ready = [
        document.fonts && document.fonts.ready,
        logo && logo.decode ? logo.decode().catch(() => {}) : null,
      ].filter(Boolean);
      Promise.race([Promise.all(ready), new Promise((r) => setTimeout(r, 900))]).then(() => intro.play());
    } else {
      document.dispatchEvent(new Event('otc:intro-done'));
    }

  /* 02 · HERO scroll-out (scrub) */
  const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.fromTo('[data-hero-content]', { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { ...heroST } });
  gsap.fromTo('.hero__shade', { opacity: 1 }, { opacity: 0.72, ease: 'none', scrollTrigger: { ...heroST } });
  // cue, video toggle + desktop social bar: recorded lazily (immediateRender:false) so they don't fight the intro fade
  gsap.fromTo('.hero__cue, .hero__toggle, .hero__social', { opacity: 1 }, {
    opacity: 0, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '30% top', scrub: true },
  });
  } else {
    root.classList.add('is-loaded');
    document.dispatchEvent(new Event('otc:intro-done'));
  }

  /* ------------------------------------------------------------------------
     03 · HELLO
     ------------------------------------------------------------------------ */
  reveal($('.hello'));
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const suf = el.dataset.suffix || '';
    const o = { v: 0 };
    gsap.to(o, {
      v: end, duration: 2.4, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: REPLAY },
      onStart: () => { el.textContent = '0' + suf; },
      onUpdate: () => (el.textContent = Math.round(o.v) + suf),
    });
  });
  $$('.hello [data-speed]').forEach(speed);
  leave($('.hello__grid'));

  /* ------------------------------------------------------------------------
     04 · STORY — text reveals only (no pin, no scroll hijack)
     ------------------------------------------------------------------------ */
  // No pin and no wheel control: the section scrolls like any other, and each line
  // reveals once as it enters. Nothing here is tied to scroll position.
  const story = $('.story');
  if (story) reveal(story);

  /* ------------------------------------------------------------------------
     05 · TOPICS — a native sideways row at every size. Scrolling down moves the page down;
     the row moves only on a sideways swipe / trackpad / shift+wheel, or a mouse drag on desktop.
     ------------------------------------------------------------------------ */
  const topics = $('.topics');
  const track = $('[data-track]');
  const vp = $('.topics__viewport');
  if (topics && track && vp) {
  reveal($('.topics__head'));
  const bar = $('[data-track-bar]');
  const syncBar = () => {
    const max = vp.scrollWidth - vp.clientWidth;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.max(0.02, vp.scrollLeft / max) : 1})`;
  };
  vp.addEventListener('scroll', syncBar, { passive: true });
  window.addEventListener('resize', syncBar);
  syncBar();
  // One card per gesture, from anywhere on the section (heading, gaps, cards, progress line).
  // A trackpad swipe or shift+wheel moves exactly one card; its momentum tail is ignored, but a
  // swipe the other way always counts at once (so going back never gets swallowed).
  // The ← → buttons do the same for mouse users. Vertical wheel passes through to the page.
  const pad = () => parseFloat(getComputedStyle(vp).scrollPaddingInlineStart) || 0;
  const maxLeft = () => vp.scrollWidth - vp.clientWidth;
  // distinct stops only (the last cards can share the end position on wide screens)
  const stops = () => [...new Set([...track.children].map((c) => Math.round(Math.min(c.offsetLeft - pad(), maxLeft()))))];
  const nearest = () => { const st = stops(); const cur = vp.scrollLeft; return st.reduce((b, l, k) => (Math.abs(l - cur) < Math.abs(st[b] - cur) ? k : b), 0); };
  let idx = 0;
  let gliding = false;
  const prevBtn = $('[data-topics-prev]');
  const nextBtn = $('[data-topics-next]');
  const syncArrows = () => {
    const last = stops().length - 1;
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= last;
  };
  const goTo = (i) => {
    const st = stops();
    idx = Math.max(0, Math.min(st.length - 1, i));
    gliding = true;
    vp.scrollTo({ left: st[idx], behavior: 'smooth' });
    syncArrows();
  };
  const goCard = (dir) => goTo(idx + dir);
  const nearestFrom = (x) => { const st = stops(); return st.reduce((b, l, k) => (Math.abs(l - x) < Math.abs(st[b] - x) ? k : b), 0); };
  let settle = 0;
  vp.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => { gliding = false; idx = nearest(); syncArrows(); }, 140); // touch / drag / end of a glide
  }, { passive: true });
  if (prevBtn) prevBtn.addEventListener('click', () => goCard(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => goCard(1));
  syncArrows();
  let wheelSum = 0;
  let lockDir = 0;
  let wheelQuiet = 0;
  topics.addEventListener('wheel', (e) => {
    const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!horiz) return; // vertical: let the page scroll
    e.preventDefault();
    e.stopPropagation(); // keep Lenis from reading a shift+wheel as page scroll
    const dir = Math.sign(horiz);
    clearTimeout(wheelQuiet);
    wheelQuiet = setTimeout(() => { lockDir = 0; wheelSum = 0; }, 160); // gesture (and its momentum) over
    if (lockDir === dir) return; // momentum of the swipe we already acted on
    if (lockDir && lockDir !== dir) { lockDir = 0; wheelSum = 0; } // reversed: a new swipe
    wheelSum += horiz;
    if (Math.abs(wheelSum) > 18) { lockDir = dir; wheelSum = 0; goCard(dir); }
  }, { passive: false });

  // Mouse drag (touch and trackpads scroll natively). Snap is paused while dragging.
  let drag = null;
  vp.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: vp.scrollLeft, moved: false };
    vp.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    vp.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    const dir = Math.sign(vp.scrollLeft - drag.left); // 1 = dragged towards later cards
    const far = Math.abs(drag.left - vp.scrollLeft) > 60;
    const from = drag.left;
    drag = null;
    vp.classList.remove('is-dragging');
    if (far) goTo(nearestFrom(from) + dir); // a deliberate drag lands on the next / previous card
    if (moved) vp.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
  });
  mm.add(DESKTOP, () => {
    gsap.fromTo($$('.tcard__label, .tcard__meta', track), { y: 12, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.05,
      scrollTrigger: { trigger: topics, start: 'top 75%', toggleActions: REPLAY },
    });
  });
  }

  /* ------------------------------------------------------------------------
     06 · QUIZZES — episode cards stay on the home page; the myth/fact block can live on faq.html
     ------------------------------------------------------------------------ */
  const quizzes = $('.quizzes');
  if (quizzes) {
    reveal($('.sec-head', quizzes));
    reveal($('.ig-head', quizzes));
    $$('.center', quizzes).forEach((p, i) => { const t = playReveal(p); if (t && t.delay) t.delay(i * 0.16); });
    batchReveal($('.qgrid'));
    $$('[data-tilt]').forEach(tilt);
    $$('.quizzes [data-speed]').forEach(speed);
    leave($('.sec-head', quizzes));
  }
  const tryquiz = $('.tryquiz');
  if (tryquiz) $$('[data-speed]', tryquiz).forEach(speed);

  /* ------------------------------------------------------------------------
     07 · MISSION — image drift + reveal + leave + image fades as it exits
     ------------------------------------------------------------------------ */
  const mission = $('.mission');
  if (mission) {
  reveal(mission);
  }

  /* ------------------------------------------------------------------------
     09 · FAQ — faq.html, ahead of the journal on that page
     ------------------------------------------------------------------------ */
  reveal($('.page-lead'));
  reveal($('.faq'));
  $$('.faq [data-speed]').forEach(speed);

  /* ------------------------------------------------------------------------
     08 · JOURNAL — faq.html, after the questions
     ------------------------------------------------------------------------ */
  const journal = $('.journal');
  if (journal) {
    reveal($('.sec-head', journal));
    batchReveal($('.jgrid'));
    fadeUp($('.center', journal), 'top 95%');
  }

  /* ------------------------------------------------------------------------
     08 · NEWSLETTER
     ------------------------------------------------------------------------ */
  reveal($('.newsletter'));

  /* ------------------------------------------------------------------------
     09 · MARQUEE (podcast/book divider) — one steady loop. No scroll skew: stroking giant type on
     every frame was the hitch through the middle of the home page.
     ------------------------------------------------------------------------ */
  const mRow = $('[data-marquee]');
  if (mRow) {
    const loop = gsap.to(mRow, { xPercent: -50, duration: 46, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onToggle: (self) => loop.paused(!self.isActive),
    });
    fadeUp($('.marquee'), 'top 95%');
  }

  /* ------------------------------------------------------------------------
     10 · BOOK
     ------------------------------------------------------------------------ */
  const book = $('.book');
  if (book) reveal(book);

  /* ------------------------------------------------------------------------
     11 · MASTERCLASS
     ------------------------------------------------------------------------ */
  reveal($('.masterclass'));

  /* ------------------------------------------------------------------------
     12 · FOOTER
     ------------------------------------------------------------------------ */
  fadeUp($('.ftr__top'), 'top 92%');
  reveal($('.ftr'));

  /* ------------------------------------------------------------------------
     4 · FINALISE
     ------------------------------------------------------------------------ */
  ScrollTrigger.sort();
  settlePlace();
})();
