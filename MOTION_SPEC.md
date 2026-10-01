# MOTION_SPEC: Off The Clock site

Source of truth for every animation. If the site is ported (Next.js, Astro, Webflow), rebuild from this file, not from memory. Implementation: `js/main.js`.

**Feel:** calm, premium and unhurried. Long `expo.out` settles, masked reveals instead of pops, heavy scrubbing (`scrub: 1`) on anything tied to scroll.

## Global

| Setting | Value |
|---|---|
| Libraries | GSAP 3.15, ScrollTrigger, Lenis 1.3 (vendored) |
| Smooth scroll | Desktop only (`min-width: 761px`): `new Lenis({ lerp: 0.22, smoothWheel: true, wheelMultiplier: 1 })`, driven by `gsap.ticker` with `lagSmoothing(0)`, `lenis.on('scroll', ScrollTrigger.update)`. A lower lerp was lagging a frame behind the pins. Phones, and a machine with `deviceMemory` ≤ 4 or ≤ 2 cores, use native scrolling and stay on the hero poster |
| ScrollTrigger config | `ignoreMobileResize: true` |
| Default ease | `expo.out` (CSS mirror: `--ease-out: cubic-bezier(.16,1,.3,1)`) |
| Creation order | DOM order, then `ScrollTrigger.sort()`; `refresh()` after `document.fonts.ready` and `load` |
| Static mode | `html.static` only when GSAP or ScrollTrigger is missing. No loader, pins, Lenis or tweens. Everything is visible |
| Anchors | `lenis.scrollTo` duration is `clamp(0.9, 1.6, distance / 1500)` so a short jump doesn’t crawl and a long one doesn’t snap. Offset is 0 for a section, −96 otherwise |
| Desktop-only motion | `gsap.matchMedia()` with `(min-width: 761px)` for the story and topics pins; tilt only on `(hover:hover) and (pointer:fine)` |

## Reusable primitives

| Name | What | Trigger | From → To | Duration / ease / stagger |
|---|---|---|---|---|
| `split(el)` | Wraps words in `span.w > span.wi` (mask = `.w { overflow:hidden }`). Sets `aria-label` on the element | none | none | none |
| `splitChars(el)` | Splits each word into `span.ch` inside `.wi` | none | none | none |
| `wordRise(el)` | Masked word rise. Default for `[data-split]` with no `data-reveal` | `top 85%`, once | `.wi` yPercent 118 → 0 | 1.55s, expo.out, 0.12 |
| `fadeUp(el)` | Fade-up for `[data-fade]` | `top 88%`, once | y 40, opacity 0 → y 0, opacity 1 | 1.35s, expo.out |
| `wordFade(el)` | `[data-reveal="words"]`. Words fade and rise, unmasked | `top 86%`, once | y 16, opacity 0 → 0/1 | 1.25s, expo.out, 0.05 |
| `blurIn(el)` | `[data-reveal="blur"]`. Words rise and fade. No live blur filter | `top 84%`, once | y 14, opacity 0 → 0/1 | 1.6s, expo.out, 0.14 |
| `dropIn(el)` | `[data-reveal="drop"]`. Letters fall and settle | `top 84%`, once | y −48 → 0, rotation ±5° → 0, opacity 0 → 1 | 1.35s, back.out(1.4), 0.09 |
| `waveIn(el)` | `[data-reveal="wave"]`. Letters land from a sine offset | `top 84%`, once | y `22 + sin(i·0.7)·16`, opacity 0 → 1 | 1.45s, expo.out, 0.05 |
| `maskLines(el)` | `[data-reveal="mask"]`. Each `span.line` wipes open | `top 82%`, once | clipPath `inset(0 100% 0 0)` → `inset(0)`. Cleared after | 1.45s, expo.inOut, 0.24 |
| `colorWipe(el)` | `[data-reveal="wipe"]`. A white copy wipes over a muted copy | heading `top 85%` → `top 30%`, scrub true | fill clipPath `inset(0 100% 0 0)` → `inset(0)` | linear |
| `scrubWords(el)` | `[data-reveal="scrub"]`. Masked word rise tied to scroll | `top 92%` → `top 38%`, scrub true | `.wi` yPercent 118 → 0 | linear, stagger 0.28 |
| `decodeIn(el)` | `[data-reveal="decode"]`. Letters cycle A–Z, then settle. `?` stays | `top 72%`, once | text only | 0.8s each, delay 0.07, linear |
| `reveal(scope)` | Runs the matching reveal on every `[data-split]` / `[data-fade]` / `[data-stagger]` / `[data-reveal]` in DOM order. Skips `flip` and `type` (those belong to the hero timeline and the story pin) | none | none | none |
| `leave(el)` | Unused. A scrubbed fade-out was repainting whole sections on every frame | — | — | — |
| `batchReveal(list)` | Cards rise in together. No clip-path and no image scale | `top 92%`, once | y 24, opacity 0 → 0/1 | 1.05s, expo.out, 0.1; transform and opacity cleared |
| `staggerUp(el)` | Children of `[data-stagger]` fade up in sequence | `top 90%`, once | y 24, opacity 0 → 0/1 | 1.2s, expo.out, 0.12 |
| `drift(ph)` | Unused. Moving photos for their whole time on screen was the stutter between sections | — | — | — |
| `speed(el)` | Unused. The same per-frame float as drift | — | — | — |
| `enter(els)` | Entrance for UI that re-renders (menu items, quiz steps, form message, FAQ answer). No-op only when GSAP is missing | on event | y 18, opacity 0 → 0/1 | 1.05s, expo.out, 0.06 |
| `tilt(el)` | Pointer tilt, fine pointers only | pointermove | rotationX/Y ±4° (`quickTo`, perspective 900) | 0.6s, power3.out; resets on leave |
| CSS hovers | `.tlink` underline wipes out right, accent line draws in left; cards lift −4px; the `.zoom` layer around card images scales 1.05–1.06 (GSAP owns the inner `.ph`, CSS owns `.zoom`, so they never fight); buttons lift −2px; marquee words fill on hover | hover | none | 0.3–1.2s, `--ease-out` |

## Section choreography

### 00 Loader → 02 Hero intro (timeline, not scroll)
The cinematic loader plays once per session, and only when the home page opens at the top. A section link, the back button, or a return from another page skips it. The loader is a still cover until the pinned layout is measured, then the page opens on the saved position or the requested section. Lenis is not stopped on those visits.

Lenis is stopped during the intro and the scroll is reset to the top when the intro plays.

| t (s) | Target | Tween |
|---|---|---|
| 0.15 | `.loader__mark` | yPercent 40, opacity 0 → 0/1 · 0.9 expo.out |
| +0.4 | `.loader__rule` | scaleX 0 → 1 · 0.9 expo.inOut |
| +0.5 | `.loader__word` | opacity 0, y 12 → 0.85, 0 · 0.7 power2.out |
| +0.35 hold | `.loader__inner` | opacity → 0, y −20 · 0.5 power2.in |
| −0.1 | `.loader` (curtain) | yPercent 0 → −100 · 1.1 expo.inOut |
| −0.75 | `[data-hero-zoom]` (poster + video together) | scale 1.25 → 1 · 2.0 expo.out |
| +0.2 | header | opacity 0, y −20 → 1, 0 · 1.0 |
| same | hero letters | rotationX −88, yPercent 50, opacity 0 → 0/0/1 · 1.5 expo.out, stagger 0.07. Perspective 640 on each `.line` |
| +0.4 | `[data-hero-fade]` (eyebrow, sub, cue) + video toggle | opacity 0, y 24 → 1, 0 · 1.0, stagger 0.1 |
| end | none | `html.is-loaded`, `lenis.start()` |

The wordmark clock is separate from this timeline. See "Wordmark clock" below.

CSS failsafe: `.js .loader` hides itself at 8 s (`animation: loader-safety 0s 8s forwards`).

### Wordmark clock
The cyan O is a ring with a cyan face behind it, so the clock starts as nothing: no dark pie. `[data-pie]` is a dark gradient (`#clock-dark`, ink to ink-2) redrawn by angle in `startClocks`, clockwise from 12. It passes a quarter, a half, and three quarters, then the face is a full dark circle. It holds there, then the next turn starts from nothing again. There are no hands. Without JavaScript the pie stays empty.

| Where | Motion |
|---|---|
| Every logo, including the loader | 0° → 360°, linear, about 10s, then a short hold on the full circle. 12s loop |
| No libraries (`html.static`) | No sweep. The pie stays empty |

### Hero video (basics, `main.js` §1)
Reference behaviour: a looping muted background video (~18s) under a 65% dark gradient. This build:

| Rule | Implementation |
|---|---|
| Layers | `.hero__zoom` → `.ph` with `<picture>` poster (desktop 16:9, mobile 9:16 via `<source media>`) → `<video>` on top |
| Loading | Sources are injected by JS only when Save-Data is off and the machine is not low-power (`deviceMemory` ≤ 4 or ≤ 2 cores). `preload` stays `metadata`. Order: WebM (VP9) then MP4 (H.264), filtered by `canPlayType`. ≤760px uses the `-mobile` pair + mobile poster |
| Reveal | Video starts at `opacity 0` and gets `.is-ready` on the first `playing` event → CSS fade 1.2s `--ease-out` (the poster is visible underneath the whole time) |
| Failure | If the last `<source>` errors, the video and toggle are removed and the poster stays |
| Pausing | Pauses when the hero is < 5% visible (IntersectionObserver), when the tab is hidden, or when the user presses the toggle. Resumes automatically unless the user paused it |
| Toggle | `button[data-video-toggle]` bottom-right, `aria-pressed`, label swaps Pause/Play (WCAG 2.2.2) |
| Static mode | No sources are ever requested. Video + toggle are removed and the poster shows |
| Scroll | Zoom wrapper moves with `.hero__media` parallax. Cue + toggle fade out over the first 30% of the hero (`immediateRender:false` so they don't fight the intro) |

### 01 Header (plain scroll listener, all modes)
- Transparent over the hero. It gets `.is-solid` (ink background, 96 → 80px height) after 60% of the viewport has scrolled.
- It hides with `.is-hidden` (translateY −100%) only after about 72px of continuous downward travel, and returns after about 32px upward (0.45s `--ease-out`). Tiny Lenis steps do not flicker it. It stays visible over the hero and while the menu is open.
- The drawer slides in from the right (0.7s) over a scrim. Lenis stops while it's open. Menu titles, groups and social links stagger in with `enter()` (y 28, 0.05 stagger, 0.15s delay, 0.9s).

### Back to top (plain scroll listener, all modes)
Reference behaviour: a floating circular button with a scroll-progress ring.
- `.totop` fixed bottom-right. It fades and rises in (0.4s/0.5s) once scroll passes 1 viewport.
- The ring is an SVG circle with `pathLength=1`, `stroke-dashoffset = 1 − scrollY / (scrollHeight − vh)`.
- Click → `#top` via the same distance-based Lenis duration as other anchors. Hidden while the menu is open.

### 02 Hero scroll-out
| Target | Trigger | From → To |
|---|---|---|
| `[data-hero-content]` | `.hero` top top → bottom top, scrub true | yPercent 0, opacity 1 → −18, 0 |
| `.hero__shade` | same | opacity 1 → 0.72 |
| `.hero__cue`, `.hero__toggle` | top top → 30% top, scrub true | opacity 1 → 0 |
| Scroll cue | CSS loop | 2.4s bob |

### 03 Hello
- Heading `wordRise`. Both paragraphs and the link `fadeUp`; the stats list uses `staggerUp` (three items).
- Stats `[data-count]` keep the printed number until the trigger starts, then count 0 → value with the suffix (2.4s power2.out, `top 92%`, once).

### 04 Story: PINNED
Desktop only (`min-width: 761px`). Trigger `.story`, start `top top`, end `+= 3.2 × innerHeight`, `pin: true`, `scrub: true`, `invalidateOnRefresh: true`. The pin tracks the scroll directly. Lenis already eases the wheel, and a second one-second catch-up was making the next section arrive late and then snap. The timeline is about 4.8 units long. Below 761px there is no pin: the stage grows with the card, the photo stays at `blur(18px)`, the veil is hidden, and the card uses a single `fadeUp`.

| Step | Timeline pos | Scroll % (approx) | Target | From → To | Ease |
|---|---|---|---|---|---|
| 1 | — | 2% | `.story__veil`, `[data-story-shade]` | fade in over 0.6s when the pin starts. Not scrubbed. The photo does not scale | power2.out |
| 1 | 0 → 1 | 0 → 21% | `[data-story-card]` | y `0.8 × innerHeight` → 0 (lands centred). This is the only value tied to the wheel | power2.out |
| 2 | — | 16% | card heading letters | type on over 0.7s, stagger 0.04, when the pin crosses the mark. Not scrubbed | none |
| 3 | — | 40% | principle 01 | left-to-right clip wipe, 0.5s, when scroll crosses the mark. Scrolling back closes it the same way | power2.out |
| 4 | — | 57% | principle 02 | same | power2.out |
| 5 | — | 74% | principle 03 | same | power2.out |
| 6 | 1 → 4.75 | 21 → 100% | none | pin holds after the card has landed | none |

**Background slideshow (reference: 3-slide fade, 6s hold, 2s fade, loop).** It runs outside the scrub, on a timer:

| Setting | Value |
|---|---|
| Slides | `[data-slide]` inside `.story__media` (1–5). Slide 1 is the static-mode image |
| Cycle | Hold 6s → next slide gets `zIndex++`, fades opacity 0 → 1 over 2s `power1.inOut` → previous is set to 0. Repeats every 8s. The timer stays paused until the story is on screen |
| Play/pause | `ScrollTrigger` `top bottom` → `bottom top` on `.story`: the timer is paused while the section is off screen |
| Interaction with pin | The card’s position is the only value tied to the wheel. The photo does not scale. `.story__media` stays at `z-index: 0` so the veil, which is inside it, cannot paint over the card. The veil, the heading and the three lines each play once when their step is reached, and reverse if you scroll back, so the pin does not repaint them on every tick. The veil is a small bitmap blurred 2px and scaled up. It fades in as the pin starts, and its source follows the active slide. Static mode and phones hide the veil and soften the photo the same cheap way |

Verified: from 50% progress onward the card centre = `innerHeight / 2` at 1280×800 and 390×844. The card has `max-height: calc(100svh − 120px)` and verified 0px overflow.

### 04c Masterclass
- Heading `wordRise`. The booking link `fadeUp` at the default start. No pin.
- The booking button carries a CSS ring, `cta-pulse`: scale 1 → 1.12 and opacity .55 → 0, 2.8s, `--ease-out`, looping. The button itself does not move, so the hover lift stays free. The ring rests while the button is hovered or focused. Static mode turns the ring off.

### 04b Marquee (reference: continuous carousel ticker)
- `[data-marquee]` holds two identical sets. `gsap.to(row, { xPercent: −50, duration: 46, ease: 'none', repeat: −1 })` gives a seamless loop.
- ScrollTrigger on `.marquee` (`top bottom` → `bottom top`) pauses the loop off screen. The row does not skew or change speed with the wheel. Outlined type cannot be moved and restyled on the same frame without a hitch.
- The section fades up at `top 95%`. Static mode: a single wrapped set with no animation.

### 05 Topics: PINNED horizontal
Trigger `.topics`, start `top top`, end `+= dist() × 1.15`, where `dist = track.scrollWidth − viewport.clientWidth`. Settings: `pin`, `scrub: true`, `invalidateOnRefresh`. Same as the story pin, it tracks the scroll instead of lagging behind it.

| Step | Scroll % | Target | From → To |
|---|---|---|---|
| 1 | 0 → 100% | `[data-track]` | x 0 → −dist() (linear, same timeline as the pin) |
| 1 | 0 → 100% | `[data-track-bar]` | scaleX 0.02 → 1 (same timeline, no per-frame callback) |
| once | section `top 75%` | `.tcard__label`, `.tcard__meta` | y 12, opacity 0 → 0/1, 0.8s, stagger 0.05 |

The heading uses `blurIn` and the hint uses `fadeUp`. At 100% the last card's right edge sits one gutter from the viewport edge (verified).
Below 761px the pin is not created. The track is a native `overflow-x: auto` swipe row with scroll-snap, same as static mode, because a pinned horizontal gallery fights a phone.
Static mode: the track becomes a native `overflow-x: auto` swipe row with scroll-snap.

### 06 Quizzes
The episode cards stay on the home page. The myth-or-fact panel lives on `faq.html`, and its tweens run only when `.tryquiz` is on the page.
- `.sec-head`: `reveal` (eyebrow `fadeUp`, heading `dropIn`, lead `wordFade`).
- `.tryquiz__title`: `wordRise` (the decode scramble was a visible hitch). The block itself `fadeUp`s with the FAQ reveals.
- `.qgrid`: `batchReveal` (a rise, no clip and no image scale), and each card gets `tilt` (desktop).
- Quiz steps: each new question or score screen staggers in with `enter()`. After an answer, the explanation + Next button stagger in (0.1). `ScrollTrigger.refresh()` runs after each render.

### 07 Mission
- Heading `colorWipe` (muted line, white copy wipes on as you scroll). Paragraph + link `fadeUp`. The photo stays still.

### 08 Journal
Lives on `faq.html`, after the questions. Tweens run only when `.journal` is on the page.
- Heading `waveIn`. `.jgrid` → `batchReveal` (a rise), and the "All episodes" link `fadeUp` at `top 95%`.

### 09 FAQ
Lives on `faq.html`. The page opens with `.page-lead` (a short ink block under the header). The header starts solid, because this page has no hero. Tweens run only when `.faq` is on the page.
- Eyebrow `fadeUp`. The page title uses `wordRise`. Each `<details>` has its own `fadeUp`, so they cascade naturally as they enter.
- Opening a question: the answer `enter()`s (y −8, 0.6s) and `ScrollTrigger.refresh()` runs.

### 10 Newsletter
- Heading `scrubWords` (the rise is tied to scroll and reverses). Copy, form and fine print `fadeUp`. The form message `enter()`s (y 8, 0.6s) on every submit.

### 11 Footer
- `.ftr__top` `fadeUp` at `top 92%`. Social icons (`staggerUp`), the link row (`staggerUp`, 0.08) and the disclaimer/copyright (`fadeUp`) follow in DOM order. The wordmark clock in the footer logo still takes the last time (11:50).

## Tuning knobs

| Knob | Where | Effect |
|---|---|---|
| Lenis `lerp` (0.22) and `wheelMultiplier` (1) | setup | Lower lerp = floatier scroll. 0.22 stays close to the wheel so the pins don't lag |
| `scrub: true` on the pins, the colour wipe, and the scrubbed newsletter words | those triggers | The tween tracks the scroll. Lenis is already the ease |
| Story length `3.2 × innerHeight` | 04 | Longer = slower principle steps |
| Topics end `+= dist() × 1.15` | 05 | Multiply further for slower travel |
| `wordRise` stagger 0.12 / 1.55s | primitives | Faster headings = 0.06 / 1.0s |
| `yPercent 118` | wordRise | Must stay > 100 so words start fully masked |
| batch `start: 'top 92%'` | primitives | Earlier/later card reveals |
| Tilt ±4° | primitives | Increase the multiplier (8) for more drama |
| Marquee `duration: 46` | 04b | Base speed of the loop. It does not react to scroll velocity |
| Slideshow 6s + 2s | 04 slideshow | Hold / crossfade lengths (reference uses 6s / 2s) |
| Video fade 1.2s | CSS `.hero__video` | How the video appears over the poster |
