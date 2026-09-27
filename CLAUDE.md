# Project rules: Off The Clock site

Static creator site. **No build step, no framework.** Keep it that way unless the task is an explicit port (see PROMPTS.md #2).

## Stack
- `index.html`: one `<section>` per block, with numbered comments `00 LOADER … 11 FOOTER`. Keep the numbering when adding sections.
- `css/styles.css`: `:root` tokens first, then base, primitives, sections in page order and `.static` rules last.
- `js/main.js`: basics (menu, anchors, form, quiz), then the static-mode early return, then motion blocks in DOM order, then `ScrollTrigger.sort()` + refresh.
- `js/vendor/`: GSAP 3.15, ScrollTrigger, Lenis 1.3. Vendored for offline use. Never switch to CDN links.
- `MOTION_SPEC.md` is the source of truth for motion. Update it in the same change as any animation edit.

## Motion rules
1. **Create ScrollTriggers in DOM order.** Pinned sections add spacing that shifts every later trigger. Put new blocks in the right place in `main.js` and keep `ScrollTrigger.sort()` at the end.
2. **Never hide content with CSS start states** (no `opacity:0` / `transform` in CSS for reveal targets). Set start states with `gsap.set` or `fromTo` so content stays visible when JS or GSAP fails.
3. **Use `fromTo`, not `from`**, especially when an ancestor starts hidden. `from` captures the current (hidden) state as the end value.
4. Pinned sequences need `scrub: 1`, `invalidateOnRefresh: true` and function-based values (`() => window.innerHeight * 0.8`). Size pinned focus elements relative to viewport height.
5. Reuse the primitives (`wordRise`, `fadeUp`, `reveal`, `leave`, `batchReveal`, `tilt`) before writing new tweens. Use `[data-split]` for masked headings and `[data-fade]` for fade-ups.
6. Default ease is `expo.out`. Scroll-linked tweens use `ease: 'none'`.
7. Call `ScrollTrigger.refresh()` after anything that changes layout height (accordions, quiz renders, images loading).
8. Image transforms: GSAP owns `.ph` (un-zoom, drift, parallax), CSS hover owns the `.zoom` wrapper. Never put a CSS transform on `.ph` and never `clearProps: 'transform'` on it.
9. UI that re-renders (menu, quiz, messages) animates with `enter()`, which does nothing in static mode.
10. Desktop-only motion goes through the shared `mm = gsap.matchMedia()` (`DESKTOP` query).

## Styling rules
- **Colours only via tokens** (`var(--ink)`, `--mist`, `--slate`, `--accent`, and so on). No new hex values outside `:root`. The only exceptions are the placeholder gradient vars `--g1/--g2/--g3` on `.ph` blocks and the existing `rgba(11,27,33,…)` (ink at alpha) in overlays and shadows.
- Fonts: `--f-display` (Oswald, uppercase headings), `--f-body` (Manrope 300/400/500/600). The wordmark is the logo image, not a webfont.
- Images are `.ph` blocks. Swap them with `--img:url(../assets/x.jpg)` (path relative to css/styles.css) or an inner `<img>`/`<picture>` (path relative to the page). Keep the wrapper and its `data-*` hooks.

## Hero video rules
- Sources live in `data-src-webm|mp4[-mobile]` and are injected by `main.js`. Never hard-code `<source>` tags or `autoplay` (that would download in reduced motion).
- The poster `<picture>` must always exist under the video. The video fades in only on `playing`, the one allowed CSS opacity start state, because the poster is the content.
- Keep the Pause/Play toggle, the off-screen/hidden-tab pausing and the Save-Data check.

## Static mode
`html.static` is added only when GSAP is missing. Then there is no loader, no pins, no Lenis, everything is visible, and the topics track is a native swipe row.

## Reduced motion
`html.reduce` is added when `prefers-reduced-motion: reduce`. Short fade-ups still play (hero, headings, cards, menu, quiz). No loader, pins, Lenis, parallax, marquee loop, or hero video. The story and topics use the same unpinned layout as static mode. Every new feature must stay readable in both modes.

## Testing (before calling anything done)
- Widths: **390×844** and **1280×800** (also check 1440+).
- `document.documentElement.scrollWidth - innerWidth === 0` (no horizontal scroll).
- No console errors (blocked Google Fonts in sandboxes are fine).
- Hero video: plays (`.is-ready`), pauses when scrolled away, toggle works, and no .webm/.mp4 request happens with reduced motion.
- Pinned focus elements are centred (story card centre ≈ `innerHeight/2` from 50% progress on) and text isn't clipped.
- Run once with reduced motion emulated and confirm all content shows.

## Content rules
- Health content is general education. Keep the disclaimer in the footer and never write personalised medical advice.
- No fabricated testimonials, reviews, guest names or stats. Only use facts supplied by the owners or already public (Peter Mehlape, Mahlatse Mehlape, Winning in Africa).
