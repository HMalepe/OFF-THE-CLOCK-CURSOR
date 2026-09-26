# MOTION_SPEC: Off The Clock site

Source of truth for every animation. If the site is ported (Next.js, Astro, Webflow), rebuild from this file, not from memory. Implementation: `js/main.js`.

**Feel:** calm, premium and unhurried. Long `expo.out` settles, masked reveals instead of pops, heavy scrubbing (`scrub: 1`) on anything tied to scroll.

## Global

| Setting | Value |
|---|---|
| Libraries | GSAP 3.15, ScrollTrigger, Lenis 1.3 (vendored) |
| Smooth scroll | `new Lenis({ lerp: 0.1, smoothWheel: true })`, driven by `gsap.ticker`, `lagSmoothing(0)`, `lenis.on('scroll', ScrollTrigger.update)` |
| ScrollTrigger config | `ignoreMobileResize: true` |
| Default ease | `expo.out` (CSS mirror: `--ease-out: cubic-bezier(.16,1,.3,1)`) |
| Creation order | DOM order, then `ScrollTrigger.sort()`; `refresh()` after `document.fonts.ready` and `load` |
| Static mode | `html.static` when `prefers-reduced-motion: reduce` **or** GSAP/ScrollTrigger missing. No loader, pins, Lenis or scroll tweens. Everything is visible |
| Anchors | `lenis.scrollTo(target, { duration: 1.4, offset: section ? 0 : -96 })` |
| Desktop-only motion | `gsap.matchMedia()` with `(min-width: 761px)` for `[data-speed]` floats; tilt only on `(hover:hover) and (pointer:fine)` |

## Reusable primitives

| Name | What | Trigger | From → To | Duration / ease / stagger |
|---|---|---|---|---|
| `split(el)` | Wraps words in `span.w > span.wi` (mask = `.w { overflow:hidden }`). Sets `aria-label` on the element | none | none | none |
| `wordRise(el)` | Masked word rise | `top 85%`, once | `.wi` yPercent 118 → 0 | 1.1s, expo.out, 0.07 |
| `fadeUp(el)` | Fade-up for `[data-fade]` | `top 88%`, once | y 40, opacity 0 → y 0, opacity 1 | 1.0s, expo.out |
| `reveal(scope)` | Runs wordRise/fadeUp on every `[data-split]` / `[data-fade]` inside scope in DOM order | none | none | none |
| `leave(el)` | Soft exit as a block leaves the top | `bottom 35%` → `bottom top`, scrub 1 | opacity 1, y 0 → opacity 0, y −60 | linear |
| `batchReveal(list)` | Card clip reveal + image un-zoom (`ScrollTrigger.batch`), plus `drift()` on each card image | `top 90%`, once | li `clipPath inset(100% 0 0 0)` → `inset(0)`; `.ph` scale 1.08 → 1 | 1.2s clip / 1.6s scale, expo.out, 0.1; clipPath cleared after (scale kept so drift survives) |
| `staggerUp(el)` | Children of `[data-stagger]` fade up in sequence | `top 90%`, once | y 24, opacity 0 → 0/1 | 0.9s, expo.out, 0.08 |
| `drift(ph)` | Image drifts inside its frame while visible (`.ph` has 10% headroom) | parent `top bottom` → `bottom top`, scrub 1 | yPercent −6 → 6 | linear |
| `speed(el)` | `[data-speed]` parallax float (desktop only). `<1` = slower than scroll | `top bottom` → `bottom top`, scrub 1, invalidateOnRefresh | y `−(1−s)·(vh+h)/2` → `+(1−s)·(vh+h)/2` | linear |
| `enter(els)` | Entrance for UI that re-renders (menu items, quiz steps, form message, FAQ answer). No-op in static mode | on event | y 18, opacity 0 → 0/1 | 0.8s, expo.out, 0.06 |
| `tilt(el)` | Pointer tilt, fine pointers only | pointermove | rotationX/Y ±4° (`quickTo`, perspective 900) | 0.6s, power3.out; resets on leave |
| CSS hovers | `.tlink` underline wipes out right, accent line draws in left; cards lift −4px; the `.zoom` layer around card images scales 1.05–1.06 (GSAP owns the inner `.ph`, CSS owns `.zoom`, so they never fight); buttons lift −2px; marquee words fill on hover | hover | none | 0.3–1.2s, `--ease-out` |

## Section choreography

### 00 Loader → 02 Hero intro (timeline, not scroll)
Lenis is stopped during the intro and the scroll is reset to the top when there is no hash.

| t (s) | Target | Tween |
|---|---|---|
| 0.15 | `.loader__mark` | yPercent 40, opacity 0 → 0/1 · 0.9 expo.out |
| +0.4 | `.loader__rule` | scaleX 0 → 1 · 0.9 expo.inOut |
| +0.5 | `.loader__word` | opacity 0, y 12 → 0.85, 0 · 0.7 power2.out |
| +0.35 hold | `.loader__inner` | opacity → 0, y −20 · 0.5 power2.in |
| −0.1 | `.loader` (curtain) | yPercent 0 → −100 · 1.1 expo.inOut |
| −0.75 | `[data-hero-zoom]` (poster + video together) | scale 1.25 → 1 · 2.0 expo.out |
| +0.2 | header | opacity 0, y −20 → 1, 0 · 1.0 |
| same | hero words | yPercent 118 → 0 · 1.2 expo.out, stagger 0.07 |
| +0.4 | `[data-hero-fade]` (eyebrow, sub, cue) + video toggle | opacity 0, y 24 → 1, 0 · 1.0, stagger 0.1 |
| end | none | `html.is-loaded`, `lenis.start()` |

CSS failsafe: `.js .loader` hides itself at 5 s (`animation: loader-safety 0s 5s forwards`).

### Hero video (basics, `main.js` §1)
Reference behaviour: a looping muted background video (~18s) under a 65% dark gradient. This build:

| Rule | Implementation |
|---|---|
| Layers | `.hero__zoom` → `.ph` with `<picture>` poster (desktop 16:9, mobile 9:16 via `<source media>`) → `<video>` on top |
| Loading | Sources are injected by JS only when motion is allowed and `navigator.connection.saveData` is off. Order: WebM (VP9) then MP4 (H.264), filtered by `canPlayType`. ≤760px uses the `-mobile` pair + mobile poster |
| Reveal | Video starts at `opacity 0` and gets `.is-ready` on the first `playing` event → CSS fade 1.2s `--ease-out` (the poster is visible underneath the whole time) |
| Failure | If the last `<source>` errors, the video and toggle are removed and the poster stays |
| Pausing | Pauses when the hero is < 5% visible (IntersectionObserver), when the tab is hidden, or when the user presses the toggle. Resumes automatically unless the user paused it |
| Toggle | `button[data-video-toggle]` bottom-right, `aria-pressed`, label swaps Pause/Play (WCAG 2.2.2) |
| Static mode | No sources are ever requested. Video + toggle are removed and the poster shows |
| Scroll | Zoom wrapper moves with `.hero__media` parallax. Cue + toggle fade out over the first 30% of the hero (`immediateRender:false` so they don't fight the intro) |

### 01 Header (plain scroll listener, all modes)
- Transparent over the hero. It gets `.is-solid` (ink background, 96 → 80px height) after 60% of the viewport has scrolled.
- It hides with `.is-hidden` (translateY −100%) when scrolling down and returns on any scroll up (0.45s `--ease-out`).
- The drawer slides in from the right (0.7s) over a scrim. Lenis stops while it's open. Menu titles, groups and social links stagger in with `enter()` (y 28, 0.05 stagger, 0.15s delay, 0.9s).

### Back to top (plain scroll listener, all modes)
Reference behaviour: a floating circular button with a scroll-progress ring.
- `.totop` fixed bottom-right. It fades and rises in (0.4s/0.5s) once scroll passes 1 viewport.
- The ring is an SVG circle with `pathLength=1`, `stroke-dashoffset = 1 − scrollY / (scrollHeight − vh)`.
- Click → `#top` via Lenis (1.4s). Hidden while the menu is open.

### 02 Hero scroll-out
| Target | Trigger | From → To |
|---|---|---|
| `[data-hero-content]` | `.hero` top top → bottom top, scrub 1 | yPercent 0, opacity 1 → −30, 0 |
| `.hero__media` | same | yPercent 0 → 20 (parallax) |
| `.hero__shade` | same | opacity 1 → 0.6 |
| `.hero__cue`, `.hero__toggle` | top top → 30% top, scrub true | opacity 1 → 0 |
| Scroll cue | CSS loop | 2.4s bob |

### 03 Hello
- Heading `wordRise` + `[data-speed="0.8"]` float (desktop). Both paragraphs and the link `fadeUp`; the stats list uses `staggerUp` (three items).
- Stats `[data-count]` keep the printed number until the trigger starts, then count 0 → value with the suffix (1.8s power2.out, `top 92%`, once).
- `.hello__grid` → `leave()`.

### 04 Story: PINNED
Trigger `.story`, start `top top`, end `+= 2.2 × innerHeight`, `pin: true`, `scrub: 1`, `anticipatePin: 1`, `invalidateOnRefresh: true`. The timeline is 2.8 units long.

| Step | Timeline pos | Scroll % (approx) | Target | From → To | Ease |
|---|---|---|---|---|---|
| 1 | 0 → 1 | 0 → 36% | `[data-story-img]` | scale 1.06 → 1 (un-zoom) | none |
| 1 | 0 → 1 | 0 → 36% | `[data-story-shade]` | opacity 0.1 → 0.55 | none |
| 1 | 0 → 1 | 0 → 36% | `[data-story-card]` | y `0.8 × innerHeight` → 0 (lands centred) | power2.out |
| 2 | 0.45 → ~1.05 | 16 → 38% | card heading words | yPercent 118 → 0, stagger 0.05 | power3.out |
| 3 | 1.1 → 1.4 | 39 → 50% | principle 01 | opacity 0.2, x 16 → 1, 0 | power2.out |
| 4 | 1.6 → 1.9 | 57 → 68% | principle 02 | same | power2.out |
| 5 | 2.1 → 2.4 | 75 → 86% | principle 03 | same | power2.out |
| 6 | 2.4 → 2.8 | 86 → 100% | none | hold | none |

**Background slideshow (reference: 3-slide fade, 6s hold, 2s fade, loop).** It runs outside the scrub, on a timer:

| Setting | Value |
|---|---|
| Slides | `[data-slide]` inside `.story__media` (1–5). Slide 1 is the static-mode image |
| Cycle | Hold 6s → next slide gets `zIndex++`, fades opacity 0 → 1 over 2s `power1.inOut` → previous is set to 0. Repeats every 8s |
| Ken Burns | Each incoming slide scale 1.03 → 1 over 8s linear |
| Play/pause | `ScrollTrigger` `top bottom` → `bottom top` on `.story`: the timer is paused while the section is off screen |
| Interaction with pin | The pinned un-zoom scales the `.story__media` wrapper. Ken Burns scales the individual slides, so they stack cleanly |

Verified: from 50% progress onward the card centre = `innerHeight / 2` at 1280×800 and 390×844. The card has `max-height: calc(100svh − 120px)` and verified 0px overflow.

### 04b Marquee (reference: continuous carousel ticker)
- `[data-marquee]` holds two identical sets. `gsap.to(row, { xPercent: −50, duration: 32, ease: 'none', repeat: −1 })` gives a seamless loop.
- ScrollTrigger on `.marquee` (`top bottom` → `bottom top`): the loop is paused off screen. On update, `timeScale` → `direction × clamp(1, 6, 1 + |velocity|/350)` over 0.25s, then eases back to `±1` over 1.2s `power2.out` (scrolling up reverses it).
- Skew: `quickTo(skewX)` = `clamp(−8°, 8°, −velocity/300)`, settling back to 0.
- The section fades up at `top 95%`. Static mode: a single wrapped set with no animation.

### 05 Topics: PINNED horizontal
Trigger `.topics`, start `top top`, end `+= dist()`, where `dist = track.scrollWidth − viewport.clientWidth`. Settings: `pin`, `scrub: 1`, `invalidateOnRefresh`.

| Step | Scroll % | Target | From → To |
|---|---|---|---|
| 1 | 0 → 100% | `[data-track]` | x 0 → −dist() (linear) |
| 1 | 0 → 100% | `[data-track-bar]` | scaleX 0.02 → 1 (via onUpdate) |
| per card | while the card crosses the viewport | card `.ph` | xPercent −7 → 7 (`containerAnimation: hTween`, `left right` → `right left`, scrub true) |
| per card | card left edge 90% → 50% of the viewport | `.tcard__label`, `.tcard__meta` | x 60, opacity 0 → 0/1, stagger 0.15, power2.out (`containerAnimation`, scrub true) |

The heading uses `wordRise` and the hint uses `fadeUp`. At 100% the last card's right edge sits one gutter from the viewport edge (verified).
Below 761px the pin is not created. The track is a native `overflow-x: auto` swipe row with scroll-snap, same as static mode, because a pinned horizontal gallery fights a phone.
Static mode: the track becomes a native `overflow-x: auto` swipe row with scroll-snap.

### 06 Quizzes
- `.sec-head`: `reveal`, then `leave()`.
- `.qgrid`: `batchReveal` (clip + un-zoom + drift), and each card gets `tilt` (desktop).
- `.tryquiz`: `fadeUp`. `.tryquiz__intro` gets `[data-speed="0.92"]` (desktop).
- Quiz steps: each new question or score screen staggers in with `enter()`. After an answer, the explanation + Next button stagger in (0.1). `ScrollTrigger.refresh()` runs after each render.

### 07 Mission
- `[data-drift]` image (inset −12% top/bottom for headroom): yPercent −8 → 8, trigger `top bottom` → `bottom top`, scrub 1.
- Heading `wordRise`, paragraph + link `fadeUp`. `.mission__content` → `leave()`.
- Image fades as it exits: `.mission__media` opacity 1 → 0.25, trigger `bottom 70%` → `bottom top`, scrub 1.

### 08 Journal
- Heading `wordRise`, `.jgrid` → `batchReveal` (clip + un-zoom + drift), and the "All posts" link `fadeUp` at `top 95%`.

### 09 FAQ
- Eyebrow + heading `reveal`. Each `<details>` has its own `fadeUp`, so they cascade naturally as they enter.
- `.sec-head` gets `[data-speed="0.85"]` (desktop).
- Opening a question: the answer `enter()`s (y −8, 0.6s) and `ScrollTrigger.refresh()` runs.

### 10 Newsletter
- Heading `wordRise`; copy, form and fine print `fadeUp`. The form message `enter()`s (y 8, 0.6s) on every submit.

### 11 Footer
- `[data-footer-mark]` giant "CLOCK": yPercent 100 → 0, trigger `.ftr` `top bottom` → `bottom bottom`, scrub 1 (rises as the page ends).
- `.ftr__top` `fadeUp` at `top 92%`. Social icons (`staggerUp`), the link row (`staggerUp`, 0.08) and the disclaimer/copyright (`fadeUp`) follow in DOM order.

## Tuning knobs

| Knob | Where | Effect |
|---|---|---|
| Lenis `lerp` (0.1) | setup | Lower = floatier scroll, higher = snappier |
| `scrub: 1` | pins, parallax | 0.5 = tighter, 2 = heavier lag |
| Story length `2.2 × innerHeight` | 04 | Longer = slower principle steps |
| Topics end `+= dist()` | 05 | Multiply (e.g. `dist() * 1.3`) for slower travel |
| `wordRise` stagger 0.07 / 1.1s | primitives | Faster headings = 0.04 / 0.8s |
| `yPercent 118` | wordRise | Must stay > 100 so words start fully masked |
| batch `start: 'top 90%'` | primitives | Earlier/later card reveals |
| `leave` start `bottom 35%` | primitives | When blocks start fading out |
| Tilt ±4° | primitives | Increase the multiplier (8) for more drama |
| Drift ±6% | `drift()` | Keep ≤ the `.ph` headroom (10%) |
| `data-speed` | HTML attribute | 0.8 = noticeable float, 0.95 = subtle |
| Slideshow 6s + 2s | 04 slideshow | Hold / crossfade lengths (reference uses 6s / 2s) |
| Marquee `duration: 32`, boost cap 6 | 04b | Base speed / max velocity boost |
| Video fade 1.2s | CSS `.hero__video` | How the video appears over the poster |
