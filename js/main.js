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

  // Off-canvas menu (items stagger in when motion is on)
  const drawer = $('#drawer');
  const burger = $('[data-menu-open]');
  const openMenu = () => {
    root.classList.add('menu-open');
    drawer.inert = false;
    burger.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    else {
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
    else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, lockY);
    }
    burger.focus({ preventScroll: true });
  };
  burger.addEventListener('click', openMenu);
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

  // In-page anchors (smooth via Lenis when available)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#') { e.preventDefault(); return; } // placeholder links
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    const wasOpen = root.classList.contains('menu-open');
    closeMenu();
    const go = () => {
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
      q: 'Off The Clock is hosted by a father and son.',
      a: true,
      why: 'Peter Mehlape started the show with his son, Mahlatse, after Mahlatse challenged him to take their conversations further. They host it together.',
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
    if (!video) { toggle && toggle.remove(); return; }
    const d = video.dataset;
    const isMobile = window.matchMedia && matchMedia('(max-width: 760px)').matches;
    const useMobile = isMobile && (d.srcWebmMobile || d.srcMp4Mobile);
    if (useMobile && d.posterMobile) video.poster = d.posterMobile; // <picture> handles the still layer
    const conn = navigator.connection || {};
    const candidates = (useMobile
      ? [[d.srcWebmMobile, 'video/webm'], [d.srcMp4Mobile, 'video/mp4']]
      : [[d.srcWebm, 'video/webm'], [d.srcMp4, 'video/mp4']]
    ).filter(([src, type]) => src && video.canPlayType(type));
    const drop = () => { video.remove(); toggle && toggle.remove(); };
    if (!motionOK || conn.saveData || lowPower || !candidates.length) { drop(); return; }

    candidates.forEach(([src, type]) => {
      const s = document.createElement('source');
      s.src = src; s.type = type;
      video.appendChild(s);
    });
    // If every source fails, the last <source> fires 'error' → fall back to the poster
    video.lastElementChild.addEventListener('error', drop);
    video.addEventListener('playing', () => video.classList.add('is-ready'), { once: true });

    let userPaused = false;
    let inView = true;
    let tabVisible = !document.hidden;
    const sync = () => {
      if (!video.isConnected) return;
      const shouldPlay = !userPaused && inView && tabVisible;
      if (shouldPlay && video.paused) video.play().catch(() => {});
      else if (!shouldPlay && !video.paused) video.pause();
    };
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      userPaused = !userPaused;
      toggle.setAttribute('aria-pressed', String(userPaused));
      $('[data-video-label]', toggle).textContent = userPaused ? 'Play background video' : 'Pause background video';
      sync();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.05 }).observe($('.hero'));
    }
    document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; sync(); });
    video.muted = true; // required for autoplay
    video.preload = 'metadata';
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
  // The story pin sets this. One wheel gesture should move one step, so the
  // raw flick distance is ignored while that section is on screen.
  let consumeStoryScroll = null;
  // Ease through a step: slow to leave, slow to arrive. A hard ease-out
  // covers most of the distance at once and feels like a jump.
  const scrollEase = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Native scrolling on phones, and on a desktop that is short of memory.
  // Lenis fights the iOS rubber-band, and on a weak CPU it lags a frame behind the pins.
  mm.add(DESKTOP, () => {
    if (!window.Lenis || lowPower) return;
    const instance = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 0.7,
      respectReducedMotion: false,
      virtualScroll: (data) => (consumeStoryScroll && consumeStoryScroll(data) ? false : undefined),
    });
    lenis = instance;
    window.__lenis = instance;
    instance.on('scroll', ScrollTrigger.update);
    const tick = (t) => instance.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      consumeStoryScroll = null;
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

  const once = (el, start) => ({ trigger: el, start, once: true });

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
    gsap.fromTo(split(el), { y: 14, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.6, ease: EASE, stagger: 0.14,
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
      scrollTrigger: { trigger: el, start, once: true },
    });

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
      case 'decode': return wordRise(el);
      default:
        if (el.hasAttribute('data-split')) return wordRise(el);
        if (el.hasAttribute('data-stagger')) return staggerUp(el);
        return fadeUp(el);
    }
  };

  const reveal = (scope, skip) => {
    if (!scope) return;
    $$('[data-split], [data-fade], [data-stagger], [data-reveal]', scope).forEach((el) => {
      if (skip && skip(el)) return;
      if (el.dataset.reveal === 'flip' || el.dataset.reveal === 'type') return;
      playReveal(el);
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
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, {
          y: 0, opacity: 1, duration: 1.05, ease: EASE, stagger: 0.1,
          clearProps: 'transform,opacity',
        });
      },
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

      const intro = gsap.timeline({
        delay: 0.15,
        onComplete: () => { root.classList.add('is-loaded'); lenis && lenis.start(); },
      });
      intro
        .fromTo('.loader__mark', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: EASE })
        .fromTo('.loader__rule', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, '-=0.5')
        .fromTo('.loader__word', { opacity: 0, y: 12 }, { opacity: 0.85, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.4')
        .to('.loader__inner', { opacity: 0, y: -20, duration: 0.6, ease: 'power2.in' }, '+=0.6')
        .to(loader, { yPercent: -100, duration: 1.35, ease: 'expo.inOut' }, '-=0.15')
        .fromTo('[data-hero-zoom]', { scale: 1.25 }, { scale: 1, duration: 2.6, ease: EASE }, '-=0.9')
        .fromTo(hdr, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1.25, ease: EASE, clearProps: 'transform' }, '<0.25')
        .fromTo(heroChars, { rotationX: -88, yPercent: 50, opacity: 0 }, {
          rotationX: 0, yPercent: 0, opacity: 1, duration: 1.5, ease: EASE, stagger: 0.07,
        }, '<')
        .fromTo(heroFades, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.3, ease: EASE, stagger: 0.14 }, '<0.55');
    }

  /* 02 · HERO scroll-out (scrub) */
  const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.fromTo('[data-hero-content]', { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { ...heroST } });
  gsap.fromTo('.hero__shade', { opacity: 1 }, { opacity: 0.72, ease: 'none', scrollTrigger: { ...heroST } });
  // cue + video toggle: recorded lazily (immediateRender:false) so they don't fight the intro fade
  gsap.fromTo('.hero__cue, .hero__toggle', { opacity: 1 }, {
    opacity: 0, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '30% top', scrub: true },
  });
  } else {
    root.classList.add('is-loaded');
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
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onStart: () => { el.textContent = '0' + suf; },
      onUpdate: () => (el.textContent = Math.round(o.v) + suf),
    });
  });
  $$('.hello [data-speed]').forEach(speed);
  leave($('.hello__grid'));

  /* ------------------------------------------------------------------------
     04 · STORY — pinned sequence (step table in MOTION_SPEC.md)
     ------------------------------------------------------------------------ */
  const story = $('.story');
  const storyCard = $('[data-story-card]');
  if (story && storyCard) {
  // Pinned letter sequence is desktop-only. On a phone the card is already in view.
  mm.add(DESKTOP, () => {
    const storyChars = splitChars($('[data-split]', storyCard));
    const principles = $$('[data-principle]', storyCard);
    const shown = principles.map(() => false);
    // Resting points. One wheel gesture moves to the next one only.
    const stops = [0.17, 0.34, 0.51, 0.68, 0.85];
    const marks = [0.45, 0.62, 0.79];
    let veilOn = false;
    let lettersOn = false;
    gsap.set(principles, { clipPath: 'inset(0% 100% 0% 0%)' });
    gsap.set(storyChars, { opacity: 0 });
    gsap.set('[data-story-shade]', { opacity: 0.1 });
    // Only the card position is tied to the wheel. The blur, the heading and
    // the line wipes each play once when their step is reached. Updating them
    // on every scroll tick was the hitch through this pin.
    const step = (progress) => {
      if ((progress > 0.02) !== veilOn) {
        veilOn = !veilOn;
        gsap.to('.story__veil', { opacity: veilOn ? 1 : 0, duration: 0.6, ease: 'power2.out', overwrite: true });
        gsap.to('[data-story-shade]', { opacity: veilOn ? 0.55 : 0.1, duration: 0.6, ease: 'power2.out', overwrite: true });
      }
      if ((progress >= 0.28) !== lettersOn) {
        lettersOn = !lettersOn;
        gsap.to(storyChars, {
          opacity: lettersOn ? 1 : 0, duration: lettersOn ? 0.7 : 0.3,
          stagger: lettersOn ? 0.04 : 0, ease: 'none', overwrite: true,
        });
      }
      principles.forEach((el, i) => {
        const open = progress >= marks[i];
        if (open === shown[i]) return;
        shown[i] = open;
        gsap.to(el, {
          clipPath: open ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)',
          duration: 0.5, ease: 'power2.out', overwrite: true,
        });
      });
    };
    const storyTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: story, start: 'top top', end: () => '+=' + window.innerHeight * 5.2,
        pin: true, scrub: true, invalidateOnRefresh: true,
        onUpdate: (self) => step(self.progress),
        onRefresh: (self) => step(self.progress),
      },
    });
    storyTl
      .fromTo(storyCard, { y: () => window.innerHeight * 0.8 }, { y: 0, duration: 0.85, ease: 'power2.out' }, 0)
      .to({}, { duration: 4.15 }, 0.85);
    const storyST = storyTl.scrollTrigger;
    let lock = false;
    let readyAt = 0;
    const go = (dest) => {
      if (!lenis) return false;
      lock = true;
      readyAt = performance.now() + 1500;
      lenis.scrollTo(dest, {
        duration: 1.25, easing: scrollEase, force: true, lock: true,
        onComplete: () => { lock = false; readyAt = performance.now() + 220; },
      });
      return true;
    };
    consumeStoryScroll = (data) => {
      if (!storyST) return false;
      const dy = data.deltaY || 0;
      if (!dy) return false;
      const y = storyST.scroll();
      const dir = dy > 0 ? 1 : -1;
      const revisit = storyST.end + window.innerHeight * 0.7;
      if (y > storyST.end + 4) {
        if (dir < 0 && y < revisit) {
          if (lock || performance.now() < readyAt) return true;
          const last = stops[stops.length - 1];
          return go(storyST.start + (storyST.end - storyST.start) * last);
        }
        return false;
      }
      if (y < storyST.start - 120) return false;
      if (lock || performance.now() < readyAt) return true;
      const p = storyST.progress;
      const target = dir > 0
        ? stops.find((s) => s > p + 0.04)
        : [...stops].reverse().find((s) => s < p - 0.04);
      if (target == null) {
        const dest = dir > 0
          ? storyST.end + window.innerHeight * 0.55
          : Math.max(0, storyST.start - 80);
        return go(dest);
      }
      return go(storyST.start + (storyST.end - storyST.start) * target);
    };
    return () => { consumeStoryScroll = null; };
  });
  mm.add('(max-width: 760px)', () => {
    fadeUp(storyCard, 'top 92%');
  });

  // Background slideshow (crossfade 2s, hold 6s, loop). No extra scale: the pin already moves this image.
  const slides = $$('[data-slide]', story);
  if (slides.length > 1) {
    let cur = 0;
    let timer = null;
    gsap.set(slides, { opacity: (i) => (i === 0 ? 1 : 0), zIndex: (i) => (i === 0 ? 2 : 1) });
    const veilImg = $('img', $('.story__veil', story));
    const syncVeil = (slide) => {
      const img = $('img', slide);
      if (!veilImg || !img) return;
      if (veilImg.getAttribute('src') !== img.getAttribute('src')) veilImg.setAttribute('src', img.getAttribute('src'));
      veilImg.style.objectPosition = img.style.objectPosition || 'center';
    };
    const next = () => {
      const prev = slides[cur];
      cur = (cur + 1) % slides.length;
      const nx = slides[cur];
      gsap.set(slides, { zIndex: 1 });
      gsap.set(nx, { zIndex: 2, opacity: 0 });
      syncVeil(nx);
      gsap.to(nx, { opacity: 1, duration: 2, ease: 'power1.inOut', onComplete: () => gsap.set(prev, { opacity: 0 }) });
      timer = gsap.delayedCall(8, next);
    };
    syncVeil(slides[0]);
    timer = gsap.delayedCall(6, next);
    timer.pause();
    ScrollTrigger.create({
      trigger: story, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => timer && timer.paused(!self.isActive),
    });
  }
  }

  /* ------------------------------------------------------------------------
     04c · MASTERCLASS
     ------------------------------------------------------------------------ */
  reveal($('.masterclass'));

  /* ------------------------------------------------------------------------
     04b · MARQUEE — one steady loop. No scroll skew: stroking giant type on
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
     05 · TOPICS — pinned horizontal track on desktop; native swipe below 761px
     ------------------------------------------------------------------------ */
  const topics = $('.topics');
  const track = $('[data-track]');
  const vp = $('.topics__viewport');
  if (topics && track && vp) {
  const dist = () => Math.max(0, track.scrollWidth - vp.clientWidth);
  reveal($('.topics__head'));
  mm.add(DESKTOP, () => {
    const pin = {
      trigger: topics, start: 'top top', end: () => '+=' + dist() * 1.15,
      pin: true, scrub: true, invalidateOnRefresh: true,
    };
    gsap.timeline({ scrollTrigger: pin })
      .fromTo(track, { x: 0 }, { x: () => -dist(), ease: 'none' }, 0)
      .fromTo('[data-track-bar]', { scaleX: 0.02 }, { scaleX: 1, ease: 'none' }, 0);
    gsap.fromTo($$('.tcard__label, .tcard__meta', track), { y: 12, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.05,
      scrollTrigger: { trigger: topics, start: 'top 75%', once: true },
    });
  });
  }

  /* ------------------------------------------------------------------------
     06 · QUIZZES — episode cards stay on the home page; the myth/fact block can live on faq.html
     ------------------------------------------------------------------------ */
  const quizzes = $('.quizzes');
  if (quizzes) {
    reveal($('.sec-head', quizzes));
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
     10 · NEWSLETTER
     ------------------------------------------------------------------------ */
  reveal($('.newsletter'));

  /* ------------------------------------------------------------------------
     11 · FOOTER
     ------------------------------------------------------------------------ */
  fadeUp($('.ftr__top'), 'top 92%');
  reveal($('.ftr'));

  /* ------------------------------------------------------------------------
     4 · FINALISE
     ------------------------------------------------------------------------ */
  ScrollTrigger.sort();
  settlePlace();
})();
