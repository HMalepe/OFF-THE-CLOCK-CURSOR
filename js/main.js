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

  // Libraries missing → fully static. Reduced motion still animates, just quietly (see gentleMotion).
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionOK = !!window.gsap && !!window.ScrollTrigger;
  if (!motionOK) root.classList.add('static');

  // Small entrance used by UI that re-renders (menu, quiz). No-op only when GSAP is missing.
  const enter = (els, opts = {}) => {
    if (!motionOK || !els || (Array.isArray(els) && !els.length)) return;
    const dist = opts.y ?? 18;
    gsap.fromTo(els, { y: reduce ? Math.sign(dist || 1) * Math.min(Math.abs(dist), 8) : dist, opacity: 0 }, {
      y: 0, opacity: 1,
      duration: reduce ? Math.min(opts.duration ?? 1.05, 0.75) : (opts.duration ?? 1.05),
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

  // Header (solid after hero, hides on scroll down, returns on scroll up)
  // + back-to-top button (appears after 1 viewport, ring = page progress)
  const hdr = $('[data-hdr]');
  const toTop = $('[data-totop]');
  const toTopBar = $('[data-totop-bar]');
  let lastY = window.scrollY;
  let travel = 0;
  const onScroll = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const past = y > vh * 0.6;
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
    if ((dy > 0 && travel < 0) || (dy < 0 && travel > 0)) travel = 0;
    travel += dy;
    if (travel > 72) hdr.classList.add('is-hidden');
    else if (travel < -32) hdr.classList.remove('is-hidden');
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
    if (!motionOK || reduce || conn.saveData || !candidates.length) { drop(); return; }

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
     2 · NO LIBRARIES — everything stays visible, no tweens
     ------------------------------------------------------------------------ */
  if (!motionOK) {
    root.classList.add('is-loaded');
    return;
  }

  // Dark pie starts empty, then sweeps 12 → 3 → 6 → 9 → 12 until the O is full.
  function startClocks(once) {
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
    const cycle = once ? 2800 : 12000;
    const t0 = performance.now();
    let drawn = -1;
    const tick = (now) => {
      const elapsed = now - t0;
      if (once) {
        const u = Math.min(1, elapsed / cycle);
        apply(0, u * 360);
        if (u < 1) requestAnimationFrame(tick);
        return;
      }
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
  startClocks(reduce);

  /* ------------------------------------------------------------------------
     2b · REDUCED MOTION — short fades only. No loader, pins, parallax,
         Lenis, marquee loop, or hero video. Anchor jumps still ease.
         The wordmark clock still fills once, then stays full.
     ------------------------------------------------------------------------ */
  if (reduce) {
    root.classList.add('is-loaded');
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const ease = 'power2.out';
    const fade = (el, start = 'top 88%') =>
      gsap.fromTo(el, { y: 14, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease,
        scrollTrigger: { trigger: el, start, once: true },
      });

    gsap.fromTo('[data-hero-content] > *, .hero__cue', { y: 16, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.05, ease: 'expo.out', stagger: 0.12, delay: 0.12,
    });

    $$('[data-split], [data-fade], [data-reveal], [data-stagger], [data-principle], .qcard, .jcard')
      .filter((el) => !el.closest('.hero'))
      .filter((el) => !el.parentElement.closest('[data-split], [data-fade], [data-reveal], [data-stagger]'))
      .forEach((el) => {
        if (el.hasAttribute('data-stagger')) {
          gsap.fromTo([...el.children], { y: 10, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.9, ease, stagger: 0.09,
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          });
        } else fade(el);
      });

    ScrollTrigger.sort();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
    return;
  }

  /* ------------------------------------------------------------------------
     3 · MOTION SETUP
     ------------------------------------------------------------------------ */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const EASE = 'expo.out';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mm = gsap.matchMedia();
  const DESKTOP = '(min-width: 761px)';

  // Native scrolling on phones. Lenis fights the iOS rubber-band and makes a thumb feel late.
  mm.add(DESKTOP, () => {
    if (!window.Lenis) return;
    const instance = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95 });
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

  const once = (el, start) => ({ trigger: el, start, once: true });

  // Primitive: masked word-rise, once
  const wordRise = (el, start = 'top 85%') =>
    gsap.fromTo(split(el), { yPercent: 118 }, {
      yPercent: 0, duration: 1.55, ease: EASE, stagger: 0.12,
      scrollTrigger: once(el, start),
    });

  // Primitive: fade-up, once
  const fadeUp = (el, start = 'top 88%') =>
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
    gsap.fromTo(split(el), { y: 14, opacity: 0, filter: 'blur(12px)' }, {
      y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.6, ease: EASE, stagger: 0.14,
      clearProps: 'filter',
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
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 30%', scrub: 1 },
    });
  };

  // Masked word rise locked to scroll, so it reverses if you scroll back
  const scrubWords = (el) =>
    gsap.fromTo(split(el), { yPercent: 118 }, {
      yPercent: 0, ease: 'none', stagger: 0.28,
      scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 38%', scrub: 1 },
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
      case 'decode': return decodeIn(el);
      default:
        if (el.hasAttribute('data-split')) return wordRise(el);
        if (el.hasAttribute('data-stagger')) return staggerUp(el);
        return fadeUp(el);
    }
  };

  const reveal = (scope, skip) => {
    $$('[data-split], [data-fade], [data-stagger], [data-reveal]', scope).forEach((el) => {
      if (skip && skip(el)) return;
      if (el.dataset.reveal === 'flip' || el.dataset.reveal === 'type') return;
      playReveal(el);
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
    gsap.set(imgs, { scale: 1.08 });
    ScrollTrigger.batch(items, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.55, ease: EASE, stagger: 0.16, clearProps: 'clipPath' });
        gsap.to(batch.map((b) => $('.ph', b)), { scale: 1, duration: 2, ease: EASE, stagger: 0.16 });
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
  // Pinned letter sequence is desktop-only. On a phone the card is already in view.
  mm.add(DESKTOP, () => {
    const storyChars = splitChars($('[data-split]', storyCard));
    const storyTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: story, start: 'top top', end: () => '+=' + window.innerHeight * 3.2,
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
    storyTl
      .fromTo('[data-story-img]', { scale: 1.06 }, { scale: 1, duration: 1 }, 0)
      .fromTo('.story__veil', { opacity: 0 }, { opacity: 1, duration: 1 }, 0)
      .fromTo('[data-story-shade]', { opacity: 0.1 }, { opacity: 0.55, duration: 1 }, 0)
      .fromTo(storyCard, { y: () => window.innerHeight * 0.8 }, { y: 0, duration: 1, ease: 'power2.out' }, 0)
      .fromTo(storyChars, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.045, ease: 'none' }, 0.75)
      .fromTo('[data-principle]', { clipPath: 'inset(0% 100% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, stagger: 0.8, ease: 'power2.out',
      }, 1.9)
      .to({}, { duration: 0.7 }); // hold
  });
  mm.add('(max-width: 760px)', () => {
    fadeUp(storyCard, 'top 92%');
  });

  // Background slideshow (crossfade 2s, hold 6s, loop, slow Ken Burns) — runs only while the story is on screen
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
    const kenBurns = (el) => gsap.fromTo(el, { scale: 1.03 }, { scale: 1, duration: 8, ease: 'none', overwrite: 'auto' });
    const next = () => {
      const prev = slides[cur];
      cur = (cur + 1) % slides.length;
      const nx = slides[cur];
      gsap.set(slides, { zIndex: 1 });
      gsap.set(nx, { zIndex: 2, opacity: 0 });
      syncVeil(nx);
      kenBurns(nx);
      gsap.to(nx, { opacity: 1, duration: 2, ease: 'power1.inOut', onComplete: () => gsap.set(prev, { opacity: 0 }) });
      timer = gsap.delayedCall(8, next);
    };
    syncVeil(slides[0]);
    kenBurns(slides[0]);
    timer = gsap.delayedCall(6, next);
    ScrollTrigger.create({
      trigger: story, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => timer && timer.paused(!self.isActive),
    });
  }

  /* ------------------------------------------------------------------------
     04c · MASTERCLASS
     ------------------------------------------------------------------------ */
  reveal($('.masterclass'));

  /* ------------------------------------------------------------------------
     04b · MARQUEE — continuous loop; scroll velocity boosts speed, direction flips it, adds skew
     ------------------------------------------------------------------------ */
  const mRow = $('[data-marquee]');
  if (mRow) {
    const loop = gsap.to(mRow, { xPercent: -50, duration: 46, ease: 'none', repeat: -1 });
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
        trigger: topics, start: 'top top', end: () => '+=' + dist() * 1.15,
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
  decodeIn($('.tryquiz__title'));
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
     11 · FOOTER
     ------------------------------------------------------------------------ */
  fadeUp($('.ftr__top'), 'top 92%');
  reveal($('.ftr'));

  /* ------------------------------------------------------------------------
     4 · FINALISE
     ------------------------------------------------------------------------ */
  ScrollTrigger.sort();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
