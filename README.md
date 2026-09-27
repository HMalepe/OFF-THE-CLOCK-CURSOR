# Off The Clock — leadership & wellbeing podcast

Static one-page site for **Off The Clock**, the leadership and wellbeing podcast from Peter Mehlape and Mahlatse Mehlape: studio hero, hosts, pinned story, marquee, topic gallery, episodes, a short myth-or-fact, mission, conversations, FAQ, newsletter, footer and a back-to-top progress button.

HTML + CSS + vanilla JS. Motion: **GSAP 3.15 + ScrollTrigger + Lenis 1.3**, vendored locally, so it runs offline with no build step.

## Run it

```bash
npx serve .          # or: python3 -m http.server 8000
```

Open the URL it prints. Don't double-click `index.html`, because some browsers restrict `file://` pages.

## Structure

```
index.html            one <section> per block, numbered comments (00 loader … 11 footer)
css/styles.css        :root tokens → base → primitives → sections in page order → .static
js/main.js            basics → static-mode return → motion in DOM order → ScrollTrigger.sort()
js/vendor/            gsap.min.js, ScrollTrigger.min.js, lenis.min.js
assets/               hero video (desktop + mobile WebM/MP4 + posters), logos, studio and book photos
MOTION_SPEC.md        every animation, source of truth for ports
CLAUDE.md / .cursorrules   rules for AI IDEs
PROMPTS.md            paste-ready follow-up prompts
```

## Hero video

The hero plays the Winning in Africa film. Sources are injected by `js/main.js` from the `data-src-*` attributes on the `<video>` in section 02. There are no `<source>` tags in the HTML.

| File | Spec |
|---|---|
| `hero.webm` + `hero.mp4` | Desktop, 16:9, 1280×720, silent, under 3 MB |
| `hero-mobile.webm` + `hero-mobile.mp4` | Phone (≤760px), 9:16 centre crop, 720×1280, under 1.5 MB |
| `hero-poster.jpg` / `hero-mobile-poster.jpg` | First clear frame of each. Shown instantly, in reduced motion, and if the video fails |

Export commands (ffmpeg):
```bash
ffmpeg -i source.mov -an -vf "scale=1920:-2" -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 hero.webm
ffmpeg -i source.mov -an -vf "scale=1920:-2" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart hero.mp4
ffmpeg -i hero.mp4 -frames:v 1 -q:v 3 hero-poster.jpg
```
How it behaves:
- Loads only when motion is allowed and the visitor isn't on Save-Data. Phones get the mobile pair.
- Fades in over the poster once it's actually playing.
- Pauses off screen and in background tabs.
- Has a pause/play button for accessibility.
- Remove the `data-src-*` attributes to go poster-only. Delete the two `-mobile` attributes to use the desktop clip everywhere.

## Swapping in real photos

Every image is a `.ph` placeholder block (gradient + film grain). Look for `<!-- PHOTO: ... -->` comments.

**Option A (quickest):** set the CSS variable on the block. The path is **relative to `css/styles.css`**, so it starts with `../`.
```html
<div class="ph" style="--img:url(../assets/story-1.jpg)"></div>
```
(A `url()` inside a CSS variable resolves against the stylesheet in Chrome/Safari. `main.js` normalises it so Firefox matches.)
**Option B (better for SEO/perf):** put an `<img>` inside the same block.
```html
<div class="ph"><img src="assets/post-1.jpg" alt="Serum bottles on a pharmacy shelf" loading="lazy" width="1600" height="1000"></div>
```
- Keep the `.ph` wrapper, the `.zoom` wrapper around card images and any `data-*` attribute (`data-hero-img`, `data-slide`, `data-drift`), because the motion targets them.
- Story slideshow: add or remove `<div class="ph story__slide" data-slide>` blocks (1–5). A single slide just shows it statically.
- To remove the grain, delete the `.ph::after` rule.
- Suggested sizes: hero/story/mission 2400×1500, topic cards 1800×1200, quiz/journal cards 1200×750. Export WebP/AVIF at 70–80% quality.

## Pre-launch checklist

- [ ] Real contact: the drawer and footer use Peter's public LinkedIn. Add an email when there is one.
- [ ] Newsletter: set `SIGNUP_ENDPOINT` in `js/main.js` (PROMPTS.md #3). Until then the form says sign-ups are not open yet.
- [x] Hero film in `assets/` (desktop + mobile WebM/MP4 + posters).
- [x] Host stats: 2 hosts, 8 moves in the book. Do not invent follower counts.
- [ ] Direct YouTube URLs for the Jedd Myers, Bruce Strong, and Khaleed Hamid episodes. The buttons search YouTube until those exist.
- [ ] FAQ answers reviewed by Peter and Mahlatse.
- [ ] Privacy page once the newsletter actually collects addresses (POPIA).
- [ ] Absolute `og:url` and `og:image` once the site has a public domain. The image tag currently points at `assets/hero-poster.jpg`.
- [ ] Test on a real phone (iOS Safari + Android Chrome).

## Accessibility and fallbacks

- `prefers-reduced-motion: reduce` → `html.reduce`: short fade-ups still play. No loader, pins, smooth-scroll library, parallax or hero video. Topics become a native swipe row.
- If GSAP fails to load, `html.static` freezes motion and shows everything. Content is never hidden by CSS. Start states are only set by JS (`gsap.set` / `fromTo`).
- The loader has a CSS safety timeout and hides itself after 5 s even if JS stalls.
- Hero video: never downloads in reduced-motion or Save-Data mode, is `aria-hidden`, has a visible Pause/Play control, and pauses off screen.
- Decorative marquee is `aria-hidden` (its words already appear in the topics section).
- Split headings keep an `aria-label` with the full text, and the word spans are `aria-hidden`.
- The drawer is `inert` when closed, Escape closes it and focus returns to the burger. Menu groups and FAQ use native `<details>`.

## Deploy

**Vercel:** `npx vercel` in this folder (framework: *Other*, no build command, output dir `.`), or import the Git repo.
**Netlify:** drag the folder onto app.netlify.com/drop, or `npx netlify deploy --prod --dir .`.
Then point the domain's DNS at the host and add HTTPS (automatic on both).

## Credits

Design language inspired by a reference site's layout rhythm (dark ink + mist palette, display caps, full-bleed imagery with a white card, big-card gallery, rounded article grid, centred crest footer). All copy, code and artwork here are original.
