# The Retail Read · Design B (Briefing)

Production handoff package for the bi-weekly newsletter, **Design B (editorial newspaper)** direction.

This folder ships three things:

| File | Purpose |
|---|---|
| `issue-01.email.html` | Email-safe HTML for Gmail / Outlook / Apple Mail. Tables + inline styles + responsive `@media` block. Drop-in for an HTML email export pipeline. |
| `tokens.css` | Design system reference. Colors, type scale, spacing, weights, rules. Source of truth for the spec. |
| `README.md` | This file. Font stack, responsive behavior, Outlook notes, image guidance, ESP integration. |

The mockup file `Newsletter.html` in the project root is the design canvas. The email file in this folder is what your pipeline ships.

---

## 1 · How to use the email file

The HTML in `issue-01.email.html` is **fully self-contained**: every visual style is inlined on the element. The `<style>` block in `<head>` only does two things:

1. Client resets (`mso-table-lspace`, `-webkit-text-size-adjust`, etc).
2. Responsive overrides at `@media (max-width: 480px)` that swap multi-column layouts to stacked single-column.

You do not need to run an inliner. The file is ready for your ESP.

**To produce a new issue**, copy `issue-01.email.html`, change the content, and re-export. Anything that should never change between issues is structural: the masthead bar, the section labels ("From the desk", "Use Case Spotlight", "What I'm reading", "Where I'll be"), the colophon. Anything that changes per issue is content: headline, kicker, lede, four-moves text, spotlight, reading list, events, hero image, dates, volume number.

### Per-issue content slots (in source order)

| Slot | Element | Notes |
|---|---|---|
| Vol / No / Date | top dark strip | `Vol. 01 · No. 01 · June 16, 2026` |
| Kicker | section 04 | mono uppercase, accent color |
| Headline | `<h1 class="rr-h1">` | last word in italic via `<em>` is a stylistic convention; keep it |
| Subhead | italic serif `<p>` under H1 | one sentence, max two |
| TOC items | `In this issue` table | 6 items max, page references `A1 / A2 / …` are decorative |
| Hero image | section 05 `<img>` | see §6 |
| Lede | section 06 paragraph | drop cap renders on the first letter automatically |
| Editor's note | section 07 right column | italic paragraph |
| Four moves | section 08 2x2 grid | exactly four; if you need three or five, see §3 |
| Pull quote | section 09 | one quote per issue, attributed in the colophon by default |
| Spotlight | section 10 | one customer story per issue. Image, blurb, 4 stats |
| Reading list | section 11 | exactly four links |
| Events | section 12 | up to three; below three, the cells still center cleanly |
| CTAs | section 13 | two; reply mailto and book link |
| Colophon | section 14 | byline, no-of-issue, set-in line |

### ESP merge tokens

The footer references three merge tokens:

```
%%unsubscribe%%
%%view_in_browser%%
%%forward%%
```

Replace these with the equivalent tokens for your platform:

| Platform | unsubscribe | view in browser | forward |
|---|---|---|---|
| Mailchimp | `*\|UNSUB\|*` | `*\|ARCHIVE\|*` | `*\|FORWARD\|*` |
| HubSpot | `{{ unsubscribe_link }}` | `{{ view_as_page_url }}` | `{{ forward_to_friend_url }}` |
| Iterable | `{{unsubscribeUrl}}` | `{{webVersionUrl}}` | n/a |
| Customer.io | `{{unsubscribe_url}}` | `{{view_in_browser_url}}` | n/a |
| Sendgrid | `<%asm_group_unsubscribe_raw_url%>` | n/a (build a hosted preview) | n/a |

If your platform requires a footer block with physical address and unsubscribe inside a single managed component, replace the entire bottom block (the `text-align:center` paragraph with the three links) with the platform's required snippet.

---

## 2 · Font stack and font loading

### Confirmed pairing

- **Headlines, body, pull quotes** → **Newsreader** (serif).
- **UI labels, TOC items, byline meta, masthead tagline** → **Plus Jakarta Sans** (sans, Cloudera brand font).
- **Mono labels, datelines, captions, link metadata** → **JetBrains Mono**.

### Google Fonts CDN (exact link as used in the email)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500;1,6..72,600&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Wrapped in `<!--[if !mso]><!--> … <!--<![endif]-->` in the email file so Outlook desktop doesn't even attempt the fetch.

### Fallback stacks (used in every `font-family` declaration)

- Serif: `Newsreader, "Iowan Old Style", Georgia, "Times New Roman", serif`
- Sans:  `"Plus Jakarta Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`
- Mono:  `"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`

Outlook desktop (Word engine) strips webfonts and gets **Georgia / Arial / Consolas**. The design has been laid out so the fallback is acceptable: Georgia handles the masthead and headlines, Arial handles the labels, Consolas handles the mono.

### Clients that load webfonts vs fall back

| Client | Newsreader | Plus Jakarta Sans | JetBrains Mono |
|---|---|---|---|
| Apple Mail (macOS / iOS) | ✓ | ✓ | ✓ |
| Gmail web | ✓ | ✓ | ✓ |
| Gmail iOS / Android app | ✓ | ✓ | ✓ |
| Outlook 365 web | ✓ | ✓ | ✓ |
| Outlook macOS | ✓ | ✓ | ✓ |
| Outlook desktop (Windows, Word engine) | ✗ → Georgia | ✗ → Arial | ✗ → Consolas |
| Yahoo / AOL | ✓ | ✓ | ✓ |
| Outlook.com web | ✓ | ✓ | ✓ |

If you want a closer-to-Newsreader Microsoft fallback, swap `Georgia` for `Cambria` in the serif stack. Cambria is a better match for Newsreader's color and width, and ships with every Windows install.

---

## 3 · Mobile responsive behavior

**Breakpoint:** `@media only screen and (max-width: 480px)`. Clients that don't honor it (Outlook desktop, some webmail) keep the 600px layout and rely on horizontal scrolling — acceptable because the desktop layout already shrinks all type for 600px.

### Section by section

| Section | Desktop (600px) | Mobile (≤ 480px) |
|---|---|---|
| **Top dark strip** | `Vol · No · Date` left, `Cloudera` mark right | Same. Inline strip stays a single line. If date string is long, the right-hand mark wraps under it. |
| **Masthead** | `The Retail Read` at 48px serif, centered, with orange dot. Tagline above, byline below. | Scales to **44px** (`.rr-mast` mobile override). Stays centered. Tagline and byline keep their sizes; this is a deliberately type-led header. |
| **Headline + In this issue** | 2-column. Headline ~360px left, TOC ~176px right, separated by a 1px faint vertical rule. | **Stacks**. Headline first, full width; TOC slides under it with the vertical rule replaced by a 1px horizontal top rule. Padding-left is dropped to align with the headline. |
| **Hero image** | Full container width (~552px). | Full container width. `width:100%; height:auto` on the `<img>` so the aspect ratio holds. |
| **Lede with drop cap** | Single-column body (the canvas mockup is 2-column; email is always single-column — see §5 Outlook). Drop cap floats left. | Same. Drop cap scales to **48px** (from 58px) so the first line still wraps cleanly on a narrow column. |
| **Editor's note** | 2-column: 110px label left, body text right. | **Stacks**. Label sits above the paragraph. Label is mono-uppercase orange, paragraph is italic serif. |
| **Four moves grid** | 2x2 with cell dividers (1px between cells, 2px top). | **Stacks to vertical**, one card per row. Cell dividers convert to a single 1px bottom border per card. Italic numerals stay 32px on desktop, 26px on mobile (`.rr-numeral`). |
| **Pull quote** | Double rule top + bottom, centered italic serif at 21px. | Italic serif scales to **18px** (`.rr-pull`). Double rules unchanged. |
| **Spotlight: image + blurb** | 2-column. Image left 256px, blurb right. | **Stacks**. Image full-width 100%, blurb beneath. Padding swaps from `padding-right:14px` to `padding-left:20px; padding-right:20px` on the blurb. |
| **Spotlight stats** | 4-column strip with thick top + bottom borders, 1px vertical dividers. | **Reflows to 2x2** via `display:inline-block; width:50%` on each stat cell. Right border drops, bottom border drops on the last row only. |
| **What I'm reading** | 4 row-cards, each: italic numeral (28px col) + title + meta + read-time. | Same single-column layout works fine at 480 and below. Title may wrap to two lines. Read-time stays right-aligned in its 46px column. |
| **Where I'll be** | 3-column. Date · Name · What · Where. Vertical dividers between. | **Stacks to vertical**, one event per row. Dividers convert to a 1px bottom border per card. |
| **CTA dark box** | 3-column inside dark box. Pitch left (46%), Reply middle (27%), Book right (27%). | **Stacks**. Each cell becomes a full-width block with 10px margin between. The orange Book button keeps its background; the bordered Reply button keeps its border. |
| **Colophon footer** | 3-column. Byline left, masthead center, set-in right. | **Stacks**, left-aligned. The middle "No. 01 · Date" line keeps its serif italic styling but loses center alignment so it reads with the byline above. |
| **Footer links** | Single centered line: `Unsubscribe · View in browser · Forward`. | Same. Mono caps at 9.5px hold fine at 480. |

### Why no 768px tablet breakpoint?

The 600px desktop column already renders correctly at 768px viewport width with comfortable side margins. Adding a tablet breakpoint introduced more layout drift than it solved. The single 480px breakpoint is the standard in commercial email design (Stratechery, Morning Brew, Platformer all use it).

---

## 4 · Outlook compatibility notes

Outlook desktop on Windows uses Microsoft Word's rendering engine for HTML rendering. The engine is from 2007 and supports a small subset of modern HTML / CSS. The email file is built to render correctly there, but several visual features degrade in Outlook desktop specifically. Listed by severity.

### Will not render correctly in Outlook desktop — known degradations

| Feature | What happens | What we did about it |
|---|---|---|
| **Webfonts** | All `font-family` first-position families are stripped. Newsreader → Georgia, Plus Jakarta → Arial, JetBrains Mono → Consolas. | Stacks include high-quality Microsoft-bundled fallbacks. The serif fallback is Georgia; if you have Cambria available, swap it in. |
| **`@media` queries** | Ignored. Outlook desktop always renders the 600px desktop layout. | We sized the desktop layout for 600px directly so Outlook does not need responsive behavior. Mobile clients (Outlook mobile, Apple Mail, Gmail) honor the media query. |
| **`float:left` on the drop cap** | The `U` displays inline at 58px and pushes the rest of the first line down. The paragraph still reads but the typographic drop cap effect is lost. | Acceptable. The first letter is still visibly larger, and the paragraph still parses. If this is unacceptable, remove the drop cap span and use a smaller bold first word instead. |
| **`letter-spacing` on serif body** | Honored. |
| **`border-collapse: collapse`** | Honored when set as both attribute and CSS. |
| **`background-color` on `<td>`** | Honored when set as both `bgcolor=` attribute and inline `style="background:#…"`. Both are present on every colored cell in the file. |
| **Negative margins** | Not used anywhere. |
| **Padding on `<div>`** | Avoided; padding lives on `<td>` and uses `cellpadding` fallbacks. |
| **CSS Grid / Flex** | Not used. All layout is `<table>`. |
| **`<picture>` / responsive `srcset`** | Not used. Hero and Spotlight images use plain `<img>` with `width:100%; max-width:`. |
| **Rounded corners (`border-radius`)** | Not used in this design intentionally. The Briefing direction is square-cornered throughout, which sidesteps the Outlook hard-corner issue for free. |
| **Box shadows** | Not used. |
| **Gradients** | Not used. The dark CTA box is a solid `#15110d`. |
| **`<a>` underline color** | Outlook sometimes overrides link color. We set both `color` and `text-decoration` inline. If you see Outlook adding a blue underline to a link, wrap the inner content in another `<span>` with the same color. |

### MSO conditionals included

```html
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
```

Sets DPI to 96 so image dimensions don't get scaled up by Outlook's default 120 DPI.

```html
<!--[if mso | IE]>
<table role="presentation" align="center" width="600">…</table>
<![endif]-->
```

Wraps the inner container in an MSO-only outer table so the 600px width is enforced. (Outlook ignores `max-width` on tables.)

```html
<!--[if mso]>
<style>.rr-serif { font-family: Georgia, "Times New Roman", serif !important; } …</style>
<![endif]-->
```

Forces the serif fallback in Outlook desktop, in case the inline `font-family` chain isn't fully respected.

### Testing matrix

Before sending a real issue, run the file through:

1. **Litmus** or **Email on Acid** for Outlook 2016 / 2019 / 365 desktop on Windows. These are the only Outlook variants where the Word engine ships, and they are the only ones that will degrade.
2. **Gmail (web, iOS, Android)** for webfont rendering.
3. **Apple Mail (macOS + iOS)** for typography color and image rendering.
4. **Outlook iOS / Android** — these use WebKit, not Word, so they render closer to Apple Mail.
5. **Dark mode** in Apple Mail iOS and Outlook iOS. The meta tag `color-scheme: light only` and `[data-ogsc]` selectors force the cream background to hold. If your audience runs a lot of Outlook dark, ask QA to verify the colophon and dark CTA box do not invert.

---

## 5 · What we changed from the canvas mockup for email

Because email column width is 600px (vs the 760px design canvas) and email cannot use multi-column flow, three things changed. These are intentional and documented here so engineering and design stay in sync.

1. **The lede paragraph is single-column** in email. The canvas mockup is 2-column with a drop cap. Multi-column CSS does not work in Outlook and behaves inconsistently across Gmail clients. Single-column with a drop cap preserves the editorial feel.
2. **The 760px type scale is reduced ~22%** to fit the 600px column. The exact email values are listed in `tokens.css` (parenthetical column).
3. **The TOC sidebar collapses to a horizontal block on mobile.** On desktop it remains a right-rail; the email and canvas mockups match there.

No other layout deviates from the canvas.

---

## 6 · Image handling

### Hero image (section 05)

| Spec | Value |
|---|---|
| Native size | 1200 × 500 px (2× of displayed 600 × 250) |
| Aspect ratio | 12 : 5 (cinematic strip) |
| Format | PNG for charts / diagrams / type; JPG for photographic |
| Treatment | 1px `#c6bba8` border, no rounding, no drop shadow |
| Alt text | A descriptive sentence (`Indexed inference cost, January 2025 to June 2026, illustrative`) |
| `<img>` attrs | `width="552"`, `style="width:100%; max-width:552px; height:auto; display:block;"` |
| Compression | Target < 120 KB to avoid Gmail clipping at 102 KB body size + image overhead |
| Dark mode | Bake the cream background into the asset so it doesn't invert |

Per editorial direction, **no stock photography**. Acceptable hero content:

- Data visualization (cost curve, market structure chart, before/after)
- System diagram (architecture, router pattern, agent flow)
- Branded typography (a single number or phrase at large scale on cream)
- Editorial illustration commissioned for the issue

### Use Case Spotlight image (section 10)

| Spec | Value |
|---|---|
| Native size | 1280 × 720 px (2× of displayed 256 × 144 desktop, full-width mobile) |
| Aspect ratio | 16 : 9 |
| Format | PNG (screenshot) or JPG (photographic) |
| Treatment | 1px `#c6bba8` border, no rounding, no drop shadow |
| Position | Left column on desktop (256px wide), full-width on mobile (100%) |
| Caption | Use the `alt` attribute. There is no visible caption beneath the spotlight image in this layout — the surrounding label row and stat strip provide the context. |

If you have a screenshot of a real product UI for the spotlight, redact PII before publishing. If the spotlight is conceptual rather than a real product surface, commission a system diagram in the cream / ink palette to keep the visual language consistent.

### Image hosting

Host images on your own CDN or your ESP's image hosting (Mailchimp, HubSpot, Iterable all auto-host uploaded images). Avoid base64-inlining images — Gmail clips messages over 102 KB.

**Do not** use `placehold.co` (the URL in the template) in production. It is a placeholder service and will appear as a gray box if rate-limited.

### Image alt text policy

Every `<img>` in the file has an `alt`. In production:

- Hero alt: describe what is shown, not "Hero image for Issue 01".
- Spotlight alt: name the customer (if disclosable) and the product surface.
- Decorative dots and orange marks should be `<span>` elements with background colors, not `<img>` tags. The file already does this.

---

## 7 · Variations between issues

The template is intentionally tight on per-issue decisions. To keep the bi-weekly cadence sustainable:

- The **kicker text** is the only place the editorial voice should vary, since it telegraphs the issue theme. ("The cost wall" in issue 01.)
- The **pull quote** is always pulled from the editor's note or feature body, never invented for the pull quote position. Drop one sentence into the quote and a single phrase from it usually becomes the pull.
- The **four moves** structure is a soft constraint, not a hard one. If a topic is naturally three or five, it is fine to ship 1x3 or 1x5; the grid will adapt if you change the cells. If you change cell count, also update the TOC and the H2.
- **Cloudera orange** is the accent. Do not introduce a second accent for emphasis. If a color is needed for a chart, use the ink (`#15110d`) or paper-edge (`#ece6d8`).
- **Em-dashes are not used in body copy.** This is the published voice constraint. Use commas, periods, parens, or semicolons instead.

---

## 8 · Open questions for engineering

When you wire this up, the following decisions need real values:

1. **Cloudera mark.** The template renders the wordmark as plain type plus a dot. Replace with your approved SVG / PNG logo asset if you have one. The asset should sit in the top dark strip and the colophon at 14px and 12px tall respectively.
2. **Booking URL.** The CTA links to `https://calendar.example.com/neelabh-pant/30min`. Replace with the real Chili Piper / Calendly / SavvyCal / Cal.com link.
3. **Reply mailto subject line.** Currently `Re: The Retail Read · Issue 01`. Consider templating this per issue so reply threading stays clean.
4. **Reading list URLs.** All four are placeholder hostnames. Update per issue.
5. **Real `mailto:` for the byline.** `neelabh.pant@cloudera.com` is the placeholder used; confirm it routes to the inbox you actually monitor for replies.
6. **Unsubscribe + view-in-browser + forward** merge tokens — see §1 for platform-specific syntax.
7. **Issue archive page.** Most ESPs auto-generate a hosted web view. Confirm the URL is what `%%view_in_browser%%` resolves to.

---

## 9 · File map recap

```
/handoff
├── issue-01.email.html   ← drop-in HTML, 600px, responsive, MSO-conditional
├── tokens.css            ← design system reference (colors, type, spacing)
└── README.md             ← this file
```

Source design lives in `/Newsletter.html` at the project root. That is the canvas / Figma equivalent; this folder is the production export.
