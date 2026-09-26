# Follow-up prompts (paste into Claude Code or Cursor)

Each prompt assumes the AI has read `CLAUDE.md` and `MOTION_SPEC.md`. Start the session with: *"Read CLAUDE.md and MOTION_SPEC.md first."*

---

## 1 · Real photos
```
I've added photos to /assets: [list filenames + what each shows].
Swap every .ph placeholder for the matching photo using an inner <img> (not --img), with descriptive alt text,
width/height attributes, loading="lazy" on everything below the hero, and fetchpriority="high" on the hero.
Keep each .ph wrapper and its data-* hooks. Convert to WebP if they're JPG/PNG larger than 400 KB.
If I've added hero footage, re-encode it with the ffmpeg commands in README ("Hero video") into desktop + mobile WebM/MP4 + posters,
replace hero.webm, hero.mp4, the mobile pair, and both posters (or update the data-src-* attributes), and verify it still plays, pauses off-screen and is skipped in reduced motion.
For the story slideshow, use my 3 best landscape shots as data-slide backgrounds (--img:url(../assets/...)).
Remove the film-grain overlay only on real photos. Then run the 390 and 1280 checks from CLAUDE.md.
```

## 2 · Next.js port (App Router + useGSAP)
```
Port this site to Next.js 15 App Router + TypeScript, keeping it visually and behaviourally identical.
- MOTION_SPEC.md is the source of truth: every tween, trigger, start/end, scrub and step table must match.
- Use @gsap/react useGSAP (scoped refs, automatic cleanup) in one client component per section.
- Create a <LenisProvider> (lenis/react) that drives gsap.ticker and calls ScrollTrigger.update on scroll.
- Keep DOM-order trigger creation: sections mount in order, and a final effect in page.tsx calls ScrollTrigger.sort() + refresh() after fonts load.
- Tokens become CSS variables in globals.css (same names). Use next/font for Oswald and Manrope. The wordmark is the logo image, not a webfont.
- Keep the static mode: a useReducedMotion hook that skips all GSAP and renders everything visible.
- Port the hero <HeroVideo> exactly per MOTION_SPEC "Hero video" (injected sources, poster <picture>, Save-Data check, IntersectionObserver + visibility pause, accessible toggle).
- Port the story slideshow, velocity marquee, back-to-top progress ring and drawer stagger as their own components.
- Split headings with my own splitter (port split() from main.js) — don't add SplitText.
Deliver it runnable with `npm run dev` and list anything that couldn't match 1:1.
```

## 3 · Newsletter + forms wiring
```
Wire the newsletter form to [Buttondown / Mailchimp / ConvertKit / Resend audience].
- Put the endpoint/API key handling in a serverless function (Vercel /api/subscribe or Netlify function) — never expose keys in main.js.
- Set SIGNUP_ENDPOINT to that function. Handle success, already-subscribed, and error states in [data-signup-msg].
- Add a honeypot field and basic rate limiting.
- Add a one-line POPIA consent note under the form linking to /privacy, and create a simple privacy.html in the same design.
```

## 4 · Quizzes: the main feature
```
Turn the quiz section into a real quiz system:
- Store quizzes as JSON in /data/quizzes/*.json (id, title, tier: "free" | "members", questions[{q, options[], answerIndex, why, source}]).
- Build quiz.html?id=... that plays any quiz (one question per screen, progress bar, explanation after each answer, final score + share card).
- Free quizzes play for everyone. Members quizzes show the first question, then a paywall card that links to [Paystack / Payfast / Gumroad / Patreon] checkout.
- Save best scores in localStorage (wrapped in try/catch).
- Keep the site's tokens and motion primitives (wordRise, fadeUp) and add the new page's motion to MOTION_SPEC.md.
- All health content is education only: every question needs a "why" and a source field.
```

## 5 · Blog from Markdown
```
Add a journal powered by Markdown files in /posts/*.md (front matter: title, category, date, cover, excerpt).
Use a tiny Node build script (no framework) that renders posts to /journal/<slug>.html with the same header/footer,
generates /journal/index.html, feeds the latest 4 posts into the homepage journal cards, and outputs rss.xml + sitemap.xml.
Post pages: masked word-rise title, cover image clip reveal, readable 68ch body, "Sources" block, related posts.
Add `npm run build` and update README + CLAUDE.md with the new workflow.
```

## 6 · Tune the motion feel
```
Make the motion feel [calmer and more luxurious / snappier and more energetic].
Only change the values in the "Tuning knobs" table of MOTION_SPEC.md (Lenis lerp, scrub, pin lengths, wordRise duration/stagger, batch start, tilt).
Show me a before/after table of the values you changed, update MOTION_SPEC.md, and re-verify both pinned sequences at 390 and 1280.
```

## 7 · Performance pass
```
Do a performance pass targeting Lighthouse mobile ≥ 90:
- Preload the hero image, lazy-load the rest, and use responsive srcset for all photos.
- Self-host the three fonts (woff2, font-display: swap) and drop the Google Fonts request.
- Load vendor scripts with defer. Pause the Lenis RAF and topic-card parallax when the tab is hidden.
- Add will-change only during active tweens. Check for layout shift from split headings.
Report the before/after Lighthouse numbers and anything you couldn't fix.
```

## 8 · SEO + social meta
```
Add complete SEO and social meta: canonical URL [https://yourdomain], og:image (build a 1200x630 image in the site's style into /assets/og.jpg),
Twitter card tags, favicon set + apple-touch-icon, a web manifest, JSON-LD Person schema (name, jobTitle "Pharmacist", sameAs Instagram + TikTok),
descriptive <title>/description per page, robots.txt and sitemap.xml. Check that heading order stays h1 → h2 → h3.
```
