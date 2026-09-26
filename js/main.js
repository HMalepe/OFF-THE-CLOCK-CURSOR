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
  let lenis = null; // set in motion mode

  // Motion is allowed only when the user hasn't asked for reduced motion AND the libraries loaded
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionOK = !reduce && !!window.gsap && !!window.ScrollTrigger;
  if (!motionOK) root.classList.add('static');

  // Small entrance used by UI that re-renders (menu, quiz). No-op in static mode.
  const enter = (els, opts = {}) => {
    if (!motionOK || !els || (Array.isArray(els) && !els.length)) return;
    gsap.fromTo(els, { y: opts.y ?? 18, opacity: 0 }, {
      y: 0, opacity: 1, duration: opts.duration ?? 0.8, ease: 'expo.out', stagger: opts.stagger ?? 0.06, delay: opts.delay ?? 0,
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

  // Header (solid after hero, hides on scroll down, returns on scroll up)
  // + back-to-top button (appears after 1 viewport, ring = page progress)
  const hdr = $('[data-hdr]');
  const toTop = $('[data-totop]');
  const toTopBar = $('[data-totop-bar]');
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const past = y > vh * 0.6;
    hdr.classList.toggle('is-solid', past);
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    toTopBar.style.strokeDashoffset = String(1 - Math.min(1, y / max));
    toTop.classList.toggle('is-visible', y > vh);
    if (root.classList.contains('menu-open')) return;
    if (past && y > lastY + 2) hdr.classList.add('is-hidden');
    else if (y < lastY - 2 || !past) hdr.classList.remove('is-hidden');
    lastY = y;
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
    lenis && lenis.stop();
    enter($$('.drawer__title, .drawer details, .drawer__social a', drawer), { y: 28, stagger: 0.05, delay: 0.15, duration: 0.9 });
    setTimeout(() => $('.drawer__close').focus(), 50);
  };
  const closeMenu = () => {
    if (!root.classList.contains('menu-open')) return;
    root.classList.remove('menu-open');
    drawer.inert = true;
    burger.setAttribute('aria-expanded', 'false');
    lenis && lenis.start();
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
      if (lenis) lenis.scrollTo(target, { duration: 1.4, offset: target.tagName === 'SECTION' ? 0 : -96 });
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
      <p>${score === QUIZ.length ? 'That is the show. ' : ''}The full conversations are on YouTube — new ones land in the newsletter first.</p>
      <div class="q__opts">
        <a class="btn btn--light" href="#newsletter">Get the next quiz</a>
        <button class="q__opt" type="button" data-restart>Play again</button>
      </div>`;
    enter([...panel.children]);
    refresh();
  };
  panel.addEventListener('click', (e) => {
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
  renderQ(false);

  // FAQ open/close changes page height → keep triggers accurate; answer eases in
  $$('.faq__list details').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) enter($('p', d), { y: -8, duration: 0.6 });
    refresh();
  }));

  // HERO VIDEO — only loads when motion is allowed and the visitor isn't on Save-Data.
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
    if (!motionOK || conn.saveData || !candidates.length) { drop(); return; }

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
    video.preload = 'auto';
    video.load();
    sync();
  })();

  /* ------------------------------------------------------------------------
     2 · STATIC MODE — reduced motion or libraries missing
     ------------------------------------------------------------------------ */
  if (!motionOK) {
    root.classList.add('is-loaded');
    return;
  }

  /* ------------------------------------------------------------------------
     3 · MOTION SETUP
     ------------------------------------------------------------------------ */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    window.__lenis = lenis; // handy for debugging / tests
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const EASE = 'expo.out';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mm = gsap.matchMedia();
  const DESKTOP = '(min-width: 761px)';

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

  // Primitive: masked word-rise, once
  const wordRise = (el, start = 'top 85%') =>
    gsap.fromTo(split(el), { yPercent: 118 }, {
      yPercent: 0, duration: 1.1, ease: EASE, stagger: 0.07,
      scrollTrigger: { trigger: el, start, once: true },
    });

  // Primitive: fade-up, once
  const fadeUp = (el, start = 'top 88%') =>
    gsap.fromTo(el, { y: 40, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1, ease: EASE,
      scrollTrigger: { trigger: el, start, once: true },
    });

  // Primitive: staggered children fade-up, once ([data-stagger])
  const staggerUp = (el, start = 'top 90%') =>
    gsap.fromTo([...el.children], { y: 24, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.9, ease: EASE, stagger: 0.08,
      scrollTrigger: { trigger: el, start, once: true },
    });

  // Primitive: reveal every [data-split] / [data-fade] / [data-stagger] inside a scope (DOM order)
  const reveal = (scope, skip) => {
    $$('[data-split], [data-fade], [data-stagger]', scope).forEach((el) => {
      if (skip && skip(el)) return;
      if (el.hasAttribute('data-split')) wordRise(el);
      else if (el.hasAttribute('data-stagger')) staggerUp(el);
      else fadeUp(el);
    });
  };

  // Primitive: soft fade-out as a block leaves the top
  const leave = (el) =>
    gsap.fromTo(el, { opacity: 1, y: 0 }, {
      opacity: 0, y: -60, ease: 'none',
      scrollTrigger: { trigger: el, start: 'bottom 35%', end: 'bottom top', scrub: 1 },
    });

  // Primitive: image drift while visible (inner .ph has 10% headroom top/bottom)
  const drift = (ph, amount = 6) =>
    gsap.fromTo(ph, { yPercent: -amount }, {
      yPercent: amount, ease: 'none',
      scrollTrigger: { trigger: ph.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 },
    });

  // Primitive: [data-speed] parallax float (desktop only; <1 = slower than scroll)
  const speed = (el) =>
    mm.add(DESKTOP, () => {
      const sp = parseFloat(el.dataset.speed) || 1;
      const range = () => (1 - sp) * (window.innerHeight + el.offsetHeight) * 0.5;
      gsap.fromTo(el, { y: () => -range() }, {
        y: () => range(), ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1, invalidateOnRefresh: true },
      });
    });

  // Primitive: card batch reveal — clip from bottom + image un-zoom (+ drift on the same image)
  const batchReveal = (list) => {
    const items = $$(':scope > li', list);
    const imgs = items.map((i) => $('.ph', i));
    gsap.set(items, { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(imgs, { scale: 1.3 });
    ScrollTrigger.batch(items, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: EASE, stagger: 0.1, clearProps: 'clipPath' });
        gsap.to(batch.map((b) => $('.ph', b)), { scale: 1, duration: 1.6, ease: EASE, stagger: 0.1 });
      },
    });
    imgs.forEach((ph) => drift(ph));
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
     ------------------------------------------------------------------------ */
  if (!location.hash) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }
  lenis && lenis.stop();
  const loader = $('.loader');
  const heroWords = split($('[data-split="hero"]'));
  const heroFades = $$('[data-hero-fade], .hero__toggle:not([hidden])');

  const intro = gsap.timeline({
    delay: 0.15,
    onComplete: () => { root.classList.add('is-loaded'); lenis && lenis.start(); },
  });
  intro
    .fromTo('.loader__mark', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: EASE })
    .fromTo('.loader__rule', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, '-=0.5')
    .fromTo('.loader__word', { opacity: 0, y: 12 }, { opacity: 0.85, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.4')
    .to('.loader__inner', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' }, '+=0.35')
    .to(loader, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
    .fromTo('[data-hero-zoom]', { scale: 1.25 }, { scale: 1, duration: 2, ease: EASE }, '-=0.75')
    .fromTo(hdr, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1, ease: EASE, clearProps: 'transform' }, '<0.2')
    .fromTo(heroWords, { yPercent: 118 }, { yPercent: 0, duration: 1.2, ease: EASE, stagger: 0.07 }, '<')
    .fromTo(heroFades, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, ease: EASE, stagger: 0.1 }, '<0.4');

  /* 02 · HERO scroll-out (scrub) */
  const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 };
  gsap.fromTo('[data-hero-content]', { yPercent: 0, opacity: 1 }, { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: heroST });
  gsap.fromTo('.hero__media', { yPercent: 0 }, { yPercent: 20, ease: 'none', scrollTrigger: heroST });
  gsap.fromTo('.hero__shade', { opacity: 1 }, { opacity: 0.6, ease: 'none', scrollTrigger: heroST });
  // cue + video toggle: recorded lazily (immediateRender:false) so they don't fight the intro fade
  gsap.fromTo('.hero__cue, .hero__toggle', { opacity: 1 }, {
    opacity: 0, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '30% top', scrub: true },
  });

  /* ------------------------------------------------------------------------
     03 · HELLO
     ------------------------------------------------------------------------ */
  reveal($('.hello'));
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const suf = el.dataset.suffix || '';
    const o = { v: 0 };
    gsap.to(o, {
      v: end, duration: 1.8, ease: 'power2.out',
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
  const storyWords = split($('[data-split]', storyCard));
  const storyTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: story, start: 'top top', end: () => '+=' + window.innerHeight * 2.2,
      pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
    },
  });
  storyTl
    .fromTo('[data-story-img]', { scale: 1.3 }, { scale: 1, duration: 1 }, 0)
    .fromTo('[data-story-shade]', { opacity: 0.1 }, { opacity: 0.55, duration: 1 }, 0)
    .fromTo(storyCard, { y: () => window.innerHeight * 0.8 }, { y: 0, duration: 1, ease: 'power2.out' }, 0)
    .fromTo(storyWords, { yPercent: 118 }, { yPercent: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out' }, 0.45)
    .fromTo('[data-principle]', { opacity: 0.2, x: 16 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.5, ease: 'power2.out' }, 1.1)
    .to({}, { duration: 0.4 }); // hold

  // Background slideshow (crossfade 2s, hold 6s, loop, slow Ken Burns) — runs only while the story is on screen
  const slides = $$('[data-slide]', story);
  if (slides.length > 1) {
    let cur = 0;
    let z = slides.length;
    let timer = null;
    gsap.set(slides, { opacity: (i) => (i === 0 ? 1 : 0), zIndex: (i) => (i === 0 ? z : 0) });
    const kenBurns = (el) => gsap.fromTo(el, { scale: 1.08 }, { scale: 1, duration: 8, ease: 'none', overwrite: 'auto' });
    const next = () => {
      const prev = slides[cur];
      cur = (cur + 1) % slides.length;
      const nx = slides[cur];
      gsap.set(nx, { zIndex: ++z, opacity: 0 });
      kenBurns(nx);
      gsap.to(nx, { opacity: 1, duration: 2, ease: 'power1.inOut', onComplete: () => gsap.set(prev, { opacity: 0 }) });
      timer = gsap.delayedCall(8, next);
    };
    kenBurns(slides[0]);
    timer = gsap.delayedCall(6, next);
    ScrollTrigger.create({
      trigger: story, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => timer && timer.paused(!self.isActive),
    });
  }

  /* ------------------------------------------------------------------------
     04b · MARQUEE — continuous loop; scroll velocity boosts speed, direction flips it, adds skew
     ------------------------------------------------------------------------ */
  const mRow = $('[data-marquee]');
  if (mRow) {
    const loop = gsap.to(mRow, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
    const skew = gsap.quickTo(mRow, 'skewX', { duration: 0.5, ease: 'power3.out' });
    let skewReset = null;
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onToggle: (self) => loop.paused(!self.isActive),
      onUpdate: (self) => {
        const v = self.getVelocity();
        const boost = gsap.utils.clamp(1, 6, 1 + Math.abs(v) / 350);
        gsap.to(loop, {
          timeScale: self.direction * boost, duration: 0.25, overwrite: true,
          onComplete: () => gsap.to(loop, { timeScale: self.direction, duration: 1.2, ease: 'power2.out', overwrite: true }),
        });
        skew(gsap.utils.clamp(-8, 8, v / -300));
        if (skewReset) skewReset.kill();
        skewReset = gsap.delayedCall(0.15, () => skew(0));
      },
    });
    fadeUp($('.marquee'), 'top 95%');
  }

  /* ------------------------------------------------------------------------
     05 · TOPICS — pinned horizontal track on desktop; native swipe below 761px
     ------------------------------------------------------------------------ */
  const topics = $('.topics');
  const track = $('[data-track]');
  const vp = $('.topics__viewport');
  const dist = () => Math.max(0, track.scrollWidth - vp.clientWidth);
  reveal($('.topics__head'));
  mm.add(DESKTOP, () => {
    const hTween = gsap.fromTo(track, { x: 0 }, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: topics, start: 'top top', end: () => '+=' + dist(),
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => gsap.set('[data-track-bar]', { scaleX: 0.02 + self.progress * 0.98 }),
      },
    });
    $$('.tcard', track).forEach((card) => {
      const ph = $('.ph', card);
      if (ph) {
        gsap.fromTo(ph, { xPercent: -7 }, {
          xPercent: 7, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: hTween, start: 'left right', end: 'right left', scrub: true },
        });
      }
      gsap.fromTo([$('.tcard__label', card), $('.tcard__meta', card)], { x: 60, opacity: 0 }, {
        x: 0, opacity: 1, ease: 'power2.out', stagger: 0.15,
        scrollTrigger: { trigger: card, containerAnimation: hTween, start: 'left 90%', end: 'left 50%', scrub: true },
      });
    });
  });

  /* ------------------------------------------------------------------------
     06 · QUIZZES
     ------------------------------------------------------------------------ */
  const quizzes = $('.quizzes');
  reveal($('.sec-head', quizzes));
  batchReveal($('.qgrid'));
  $$('[data-tilt]').forEach(tilt);
  fadeUp($('.tryquiz'));
  $$('.quizzes [data-speed]').forEach(speed);
  leave($('.sec-head', quizzes));

  /* ------------------------------------------------------------------------
     07 · MISSION — image drift + reveal + leave + image fades as it exits
     ------------------------------------------------------------------------ */
  const mission = $('.mission');
  gsap.fromTo($('[data-drift]', mission), { yPercent: -8 }, {
    yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: mission, start: 'top bottom', end: 'bottom top', scrub: 1 },
  });
  reveal(mission);
  leave($('.mission__content'));
  gsap.fromTo('.mission__media', { opacity: 1 }, {
    opacity: 0.25, ease: 'none',
    scrollTrigger: { trigger: mission, start: 'bottom 70%', end: 'bottom top', scrub: 1 },
  });

  /* ------------------------------------------------------------------------
     08 · JOURNAL
     ------------------------------------------------------------------------ */
  const journal = $('.journal');
  reveal($('.sec-head', journal));
  batchReveal($('.jgrid'));
  fadeUp($('.center', journal), 'top 95%');

  /* ------------------------------------------------------------------------
     09 · FAQ
     ------------------------------------------------------------------------ */
  reveal($('.faq'));
  $$('.faq [data-speed]').forEach(speed);

  /* ------------------------------------------------------------------------
     10 · NEWSLETTER
     ------------------------------------------------------------------------ */
  reveal($('.newsletter'));

  /* ------------------------------------------------------------------------
     11 · FOOTER — content reveals + giant wordmark rises as the page ends
     ------------------------------------------------------------------------ */
  fadeUp($('.ftr__top'), 'top 92%');
  reveal($('.ftr'));
  gsap.fromTo('[data-footer-mark]', { yPercent: 100 }, {
    yPercent: 0, ease: 'none',
    scrollTrigger: { trigger: '.ftr', start: 'top bottom', end: 'bottom bottom', scrub: 1 },
  });

  /* ------------------------------------------------------------------------
     4 · FINALISE
     ------------------------------------------------------------------------ */
  ScrollTrigger.sort();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
