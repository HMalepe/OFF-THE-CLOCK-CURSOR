# MOTION_SPEC: Off The Clock site

Source of truth for every animation. If the site is ported (Next.js, Astro, Webflow), rebuild from this file, not from memory. Implementation: `js/main.js`.

**Feel:** calm, premium and unhurried. Long `expo.out` settles, masked reveals instead of pops, heavy scrubbing (`scrub: 1`) on anything tied to scroll.

## Global

| Setting | Value |
|---|---|
| Libraries | GSAP 3.15, ScrollTrigger, Lenis 1.3 (vendored) |
| Smooth scroll | Desktop only (`min-width: 761px`): `new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.7, respectReducedMotion: false })`, driven by `gsap.ticker` with `lagSmoothing(0)`, `lenis.on('scroll', ScrollTrigger.update)`. The wheel eases toward where you scrolled, so a screen takes a moment to arrive instead of popping there. `respectReducedMotion` stays off: that flag was turning the wheel into an instant jump. Pins use `scrub: true`, so they follow this travel directly and do not add a second delay. Phones, and a machine with `deviceMemory` ≤ 4 or ≤ 2 cores, use native scrolling and stay on the hero poster |
| ScrollTrigger config | `ignoreMobileResize: true` |
| Default ease | `expo.out` (CSS mirror: `--ease-out: cubic-bezier(.16,1,.3,1)`) |
| Creation order | DOM order, then `ScrollTrigger.sort()`; `refresh()` after `document.fonts.ready` and `load` |
| Static mode | `html.static` only when GSAP or ScrollTrigger is missing. No loader, pins, Lenis or tweens. Everything is visible |
| Anchors | `lenis.scrollTo` duration is `clamp(0.9, 1.6, distance / 1500)` so a short jump doesn’t crawl and a long one doesn’t snap. Offset is 0 for a section, −96 otherwise |
| Desktop-only motion | `gsap.matchMedia()` with `(min-width: 761px)` for desktop-only motion; tilt only on `(hover:hover) and (pointer:fine)` |

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
- Current clip: WEBSITE TRAILER V2 (Drive), letterbox cropped (1920x872), first 0.5s black trimmed, last frame (sunset, 85.9s) held through the 7s music fade so it never rests on black. 1920x872 desktop / 1280x582 full-frame phone (shown whole with object-fit: contain, band under the header), MP4 (H.264+AAC) + WebM (VP9+Opus), desktop WebM ~16 MB (MP4 28 MB fallback), phone WebM ~8.5 MB (MP4 12.6 MB); x264 CRF 21 film / VP9 CRF 30-31 with rate caps. Posters = frame 0. Share image moved to `assets/share-book.jpg` so link previews keep the book.
- `data-play-once` (long trailer): no loop or end fade; plays once, rests on the last frame with the button on Play; pressing Play restarts from 0. Scrolling away and back does not restart it.
- Shade (`.hero__shade`) is light so the trailer reads: a tight radial behind the copy (.74 → 0) + thin top/bottom bands for header and social bar; the copy has its own text-shadow. Phones: no shade over the band (copy sits on navy below it).
- Apple devices (iPhone/iPad/Safari) get the H.264 MP4 only (Safari can claim WebM support and then not play VP9/Opus). Data Saver autoplays too (owner request). `[data-video-watch]` (accent pill under the subtitle) appears whenever autoplay is refused; tapping it plays with sound, and the first touch / key anywhere also starts it. Phones: the title block is anchored 30px under the controls row.
- Phones: the trailer is no longer dropped on `lowPower` (deviceMemory ≤ 4 matched most phones); only no-GSAP / Save-Data / no playable source drop it. Playback is requested the moment `otc:curtain` fires (play() buffers by itself; the fade waits for `playing`) — measured ~6ms after the curtain on phones. If `play()` is refused (Low Power Mode etc.) the still + title show with the button on Play; a tap starts it.
- Navy start: JS adds `.hero--video.is-watching` at load (poster hidden, hero navy, title hidden). The intro fires `otc:curtain` as the loader starts to lift; the trailer starts then (once buffered) and fades in from navy over 1.8s. No poster or title in between. If it has not started 9s after load, the title returns; if the video fails, both classes are removed and the poster + title show (static mode never gets the classes). Copy returns over .9s on pause or at the end; later plays fade both together. Uses `filter: opacity()` so it stacks with the scroll-scrubbed inline opacity.
- Space bar toggles play/pause while the hero is at least half on screen; otherwise it scrolls as usual. Ignored in fields, buttons, links, summaries and with the menu open.
- Seek: `[data-video-seek]` ±10s buttons (36px), and ← / → while the hero is half on screen or the player is docked.
- Keep playing while scrolling: `[data-video-follow]` toggle. When on and the hero is <35% visible (after the first start), the `<video>` and `.hero__ctrls` move into a fixed `.hero-dock` (bottom right, 380px / 72vw phones, close ×) and keep playing; they move back when the hero returns. Moving a video between parents in one task does not pause it. `.totop` hides while docked. Space and arrows also work when docked.
- Every control has a hover/focus label (`data-tip`); on touch the follow label shows for 1.8s after a tap. Phones: controls sit centred under the video band.
- Sound prompt (`[data-sound-cue]`): once per visit (sessionStorage), 1.2s after the trailer first plays muted, a frosted-glass pill ("Tap for sound", 4-bar CSS equaliser) rises 8px / scales .96→1 above the controls (phones: below, arrow up), its arrow aimed at the sound button via `--cue-x`; the sound button gets an accent ring that breathes outwards (2s). Hides after 8s, on pause, on docking, or when sound turns on; clicking the pill turns sound on. Reduced motion: bars and ring still.
- Controls (bottom right, `.hero__ctrls`): pause/play, plus sound on/off when the `<video>` carries `data-has-audio`. Autoplay is always muted; the sound click is the user gesture that unmutes. Turning sound on while paused also resumes. Desktop social bar reserves room for two buttons via `:has()`. Both hidden in static mode.
Reference behaviour: a looping muted background video (~18s) under a 65% dark gradient. This build:

| Rule | Implementation |
|---|---|
| Layers | `.hero__zoom` → `.ph` with `<picture>` poster (desktop 16:9, mobile 9:16 via `<source media>`) → `<video>` on top |
| Loading | Sources are injected by JS only when Save-Data is off and the machine is not low-power (`deviceMemory` ≤ 4 or ≤ 2 cores). `preload` stays `metadata`. Order: WebM (VP9) then MP4 (H.264), filtered by `canPlayType`. ≤760px uses the `-mobile` pair + mobile poster |
| Reveal | Video starts at `opacity 0` and gets `.is-ready` on the first `playing` event → CSS fade 1.2s `--ease-out` (the poster is visible underneath the whole time) |
| Failure | If the last `<source>` errors, the video and toggle are removed and the poster stays |
| Pausing | Pauses when the hero is < 5% visible (IntersectionObserver), when the tab is hidden, or when the user presses the toggle. Resumes automatically unless the user paused it |
| Start | The video does not play during the loader/zoom intro. It plays only after `otc:intro-done` (dispatched when the hero zoom ends; immediately when the intro is skipped) AND `canplaythrough`, so it never stalls under the zoom. `preload='auto'` buffers it during the loader. |
| Loop | No native `loop`: the clip ends on a black title card, which hard-cut back to the opening shot. Over the last 1.2s the video loses `.is-ready` and fades to the poster; on `ended` it restarts at 0 and fades back in on `playing`. |
| Poster | `hero-poster.jpg` / `hero-mobile-poster.jpg` are the exact first frame of each clip, so poster → video is invisible. Regenerate them whenever the clips change. |
| Toggle | `button[data-video-toggle]` bottom-right, `aria-pressed`, label swaps Pause/Play (WCAG 2.2.2) |
| Static mode | No sources are ever requested. Video + toggle are removed and the poster shows |
| Scroll | Zoom wrapper moves with `.hero__media` parallax. Cue, toggle and the desktop social bar (`.hero__social`, ≥1025px, fades in with the other `[data-hero-fade]` items) fade out over the first 30% of the hero (`immediateRender:false` so they don't fight the intro) |

### Reveal map (replaying entrances; nothing scrubbed except the existing wipe/scrub headings)
All entrances use `toggleActions: 'play none none reverse'`: they play forward when the element enters going down, and reverse when it leaves below the screen going up, so the cycle restarts every pass. Card batches (`batchReveal`) fade back out on `onLeaveBack`. Count-ups count back down. The hero intro curtain still plays once per visit.
Block types added to `playReveal`: `left` (x −64), `right` (x 64), `zoom` (scale 0.86), `clip` (clip-path from bottom + y 24), `tilt` (rotationX 55, perspective 900) — all 1.3s expo.out, at `top 88%`. Within one `reveal(scope)` call items are delayed by DOM order (0.16s each, max 0.96s) so they arrive one by one.

| Section | Order of entrances |
|---|---|
| Hosts | heading decode → para left → para right → stats stagger → link zoom |
| Story | eyebrow left → heading wave (letters) → lead words → idea 01 right → 02 clip → 03 tilt |
| Topics | heading blur → hint right |
| Episodes | eyebrow left → heading drop → lead words · Instagram eyebrow right → lead words · closing links zoom / clip / tilt |
| Mission | heading wipe → para words → link zoom |
| Newsletter | heading scrub → para blur → form clip → fine print zoom |
| Book | cover tilt → eyebrow right → heading drop → subtitle clip → para words → foreword left → buttons zoom |
| Masterclass | heading blur → button zoom |

### Text effect library (each heading/sentence uses a different one)
| Type | What you see | Used on |
|---|---|---|
| flip | hero letters flip up | Hero title |
| decode | letters scramble, then settle | Hosts heading |
| sides | words from alternating sides | Hosts para 1, newsletter sentence |
| skew | words slide in leaning, then straighten | Hosts para 2 |
| spread | wide letter-spacing pulls together | small labels (story, episodes, book) |
| wave | letters ride in on a sine wave | Story heading |
| type | typewriter with a blinking caret | Story intro |
| scatter | letters fly in from random spots and spins | Topics heading |
| drop | letters fall with a bounce | Episodes heading |
| fold | words tip down like cards | Episodes intro |
| wipe | colour wipes across (scrubbed) | Mission heading |
| blur | words sharpen out of a real blur | Mission paragraph, Instagram intro |
| scrub | words rise with the scroll | Newsletter heading |
| pop | letters pop from the centre out | Book heading |
| flipchars | split-flap letters | Book subtitle, Masterclass heading |
| words | plain word cascade | Book paragraph |

### Menu jumps (navTo)
Clicking any in-page link (top bar, drawer, footer, scroll cue) does NOT play the scroll effects on the way:
- Every non-pinned ScrollTrigger is `disable(false)` (frozen where it is); pins stay live because they hold the page height.
- Trips up to 2 viewports glide (0.7–1.1s). Longer trips: `#main` dips to opacity 0 (0.2s), jumps to 45% of a viewport before the target, fades back (0.45s) and glides the last stretch (0.9s).
- On landing triggers are re-enabled with `enable(false, false)` (no per-trigger refresh: refreshing a trigger inside the pinned Topics section reverts that pin for a moment, the page shrinks and the browser clamps to the bottom; that was "The book" landing past the book on shorter screens). If the scroll moved anyway it is put back. Then every reveal is set straight to finished (trigger reached or on screen) or unrevealed (below). Card batches and the decode heading skip their animation while `navQuiet` is set.
- A newer click supersedes an unfinished jump (`navRun` token: the old dip and landing are dropped). A click mid-intro finishes the intro first. A click also counts as the user scrolling, so the late fonts/load settle can't pull the page back.
- Works with Lenis (desktop) and native scroll (phones). Manual scrolling keeps every effect.
- Pause/resume is shared (`freezeFx` / `thawFx`). The phone drawer locks the page with `position: fixed`, which reads as scrollY 0, so opening it freezes the effects too; otherwise every reveal rewound behind the drawer and replayed in one burst when a link was tapped. Closing with X / Escape thaws in place; a drawer link keeps them frozen until the jump lands. If the screen resized while frozen, thawing does one full refresh and the jump snaps to the exact target.
- The drawer remembers how it locked the page (`bodyLocked`), not whether Lenis exists now: rotating a phone with the drawer open switches Lenis on/off (761px), and the old check left the body pinned and the page unscrollable.
- If the screen resized or rotated while the drawer was open, closing it returns to the section that was in view (same offset), not the same pixel.

### Intro stillness
- `html { scrollbar-gutter: stable }` and `.lenis-stopped { overflow-y: hidden }` (not clip): the scrollbar space is always reserved, so when the intro ends and Lenis starts, the classic Windows scrollbar appearing no longer narrows the page by ~15px and shifts the hero sideways (the "jerk" during the title hold). Same for the menu stop/start.
- Loader marks (`.loader__mark`, `__rule`, `__word`) start at `opacity: 0` in CSS (decorative; the loader removes itself at 5s if JS stalls). Before, they painted, vanished when the timeline set its start state, then rose in.
- The intro timeline is created paused and plays once `document.fonts.ready` and the logo's `decode()` resolve (capped at 900ms), so no font swap or image pop happens mid-animation. Logo has width/height + preload.
- `gsap.ticker.lagSmoothing(500, 33)` during the intro (a hitch slows the motion instead of skipping it), back to `0` for Lenis when the intro completes.

### Page order
Podcast: 02 hero → 03 hosts → 04 story → 05 topics (sideways row) → 06 episodes → 07 mission → 08 newsletter. Divider: 09 marquee. Book: 10 book (`reveal`: eyebrow, word-drop heading, fade-ups) → 11 masterclass. JS blocks are created in this order.

### 01 Header (plain scroll listener, all modes)
- Transparent over the hero. It gets `.is-solid` (ink background, 96 → 80px height) after 60% of the viewport has scrolled.
- It hides with `.is-hidden` (translateY −100%) after about 48px of downward travel, and stays hidden through the little upward kick at the end of a flick. It returns only after about 140px of upward travel that starts more than 0.7s after the last downward move (0.45s `--ease-out`). It stays visible over the hero and while the menu is open.
- Layout: at ≥1025px the header is an inline top bar (links either side of the logo + Subscribe pill; links underline in `--accent` on hover, 0.5s `--ease-out`) and there is no drawer. Below 1025px the Subscribe icon + burger show and the links live in the drawer. Widening past 1025px with the drawer open closes it.
- The drawer (below 1025px) slides in from the right (0.7s) over a scrim. Lenis stops while it's open. Menu titles, groups and social links stagger in with `enter()` (y 28, 0.05 stagger, 0.15s delay, 0.9s).

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

### 04 Story (no pin)
Plain section. No pin, no background image, no wheel control. `reveal(.story__head)` (eyebrow, word-rise heading, lead fade-up); each `[data-principle]` fades up (y 32 → 0, opacity 0 → 1, 1s expo.out) at `top 88%`. Rebuilt because the 5.2×vh pin plus one-step-per-wheel-gesture control made scrolling stick.

### 04c Masterclass
- Heading `wordRise`. The booking link `fadeUp` at the default start. No pin.
- The booking button carries a CSS ring, `cta-pulse`: scale 1 → 1.12 and opacity .55 → 0, 2.8s, `--ease-out`, looping. The button itself does not move, so the hover lift stays free. The ring rests while the button is hovered or focused. Static mode turns the ring off.

### 04b Marquee (reference: continuous carousel ticker)
- `[data-marquee]` holds two identical sets. `gsap.to(row, { xPercent: −50, duration: 46, ease: 'none', repeat: −1 })` gives a seamless loop.
- ScrollTrigger on `.marquee` (`top bottom` → `bottom top`) pauses the loop off screen. The row does not skew or change speed with the wheel. Outlined type cannot be moved and restyled on the same frame without a hitch.
- The section fades up at `top 95%`. Static mode: a single wrapped set with no animation.

### 05 Topics: native sideways row (no pin)
No pin at any size: scrolling down always moves the page down. `.topics__viewport` is `overflow-x: auto` with scroll-snap (`scroll-padding-inline: gutter`, `overscroll-behavior-x: contain`), moved only by a sideways swipe, trackpad, shift+wheel or a mouse drag.
- One card per gesture, listened on the whole `.topics` section (heading, gaps, cards, progress line): a sideways swipe / shift+wheel moves exactly one card (smooth scrollTo to distinct stops); same-direction momentum is ignored until 160ms of quiet, a reversed swipe acts at once. Vertical wheel passes through. ← → arrow buttons (`[data-topics-prev/next]`, disabled at the ends, hidden on touch) step one card; the index re-syncs 140ms after any native scroll (touch, drag). Cards have `scroll-snap-stop: always` so touch swipes stop at every card.
- Mouse drag (pointerType mouse): drags `scrollLeft`, snap paused while dragging; a drag over 60px lands on the next / previous card (smooth). A drag swallows the following click so card links don't fire.
- `[data-track-bar]` follows `scrollLeft / max` (scaleX, min 0.02) on the row's scroll event.
- Desktop once: section `top 75%` → `.tcard__label`, `.tcard__meta` y 12, opacity 0 → 0/1, 0.8s, stagger 0.05. Heading `blurIn`, hint `fadeUp` ("Drag or swipe" / "Swipe").
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
| Lenis `lerp` (0.08) and `wheelMultiplier` (0.7) | setup | Lower lerp = slower travel between screens. Pins still use `scrub: true`, so they follow the eased scroll instead of lagging behind it |
| `scrub: true` on the pins, the colour wipe, and the scrubbed newsletter words | those triggers | The tween tracks the scroll. Lenis is already the ease |
| Story length `5.2 × innerHeight`, story step `scrollTo` 1.25s ease-in-out | 04 | One gesture, one step. The step eases out of one screen and into the next |
| `wordRise` stagger 0.12 / 1.55s | primitives | Faster headings = 0.06 / 1.0s |
| `yPercent 118` | wordRise | Must stay > 100 so words start fully masked |
| batch `start: 'top 92%'` | primitives | Earlier/later card reveals |
| Tilt ±4° | primitives | Increase the multiplier (8) for more drama |
| Marquee `duration: 46` | 04b | Base speed of the loop. It does not react to scroll velocity |
| Slideshow 6s + 2s | 04 slideshow | Hold / crossfade lengths (reference uses 6s / 2s) |
| Video fade 1.2s | CSS `.hero__video` | How the video appears over the poster |
