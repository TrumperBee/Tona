# GCC — Design System

> Status: Phase 3. Brand assets, tokens, accessible primitives and the public,
> participant, organiser and Super Admin shells are implemented. Component APIs may be
> extended per feature, but the primitives below should not be forked or restyled ad hoc.
> This is a sports-competition product, not a generic analytics dashboard.

The live reference is the development-only route `/design-system`. It renders every
primitive, variant and state with demo content. That route is the **only** place demo
players, tournaments or counts are permitted; it returns `notFound()` when
`NODE_ENV === "production"`, is disallowed in `robots.ts` and is excluded from the
sitemap.

---

## 1. Brand assets

All assets are original GCC artwork and are regenerated from source by
`node scripts/generate-brand.mjs` (uses `sharp`). Do not edit the generated PNGs by hand.

### Mark concept — "Circuit Orbit G"

A near-complete orbit ring forms the letter **G**, crossed by a pitch crossbar, with a
single gold champion node. It deliberately contains no trophy, star, shield, starball or
UEFA-derived geometry, and no UEFA typography.

### Files

| File                                         | Use                                         |
| -------------------------------------------- | ------------------------------------------- |
| `public/brand/gcc-symbol-light.svg`          | Symbol on dark surfaces                     |
| `public/brand/gcc-symbol-dark.svg`           | Symbol on light surfaces                    |
| `public/brand/gcc-logo-horizontal-light.svg` | Symbol + wordmark + tagline, dark surfaces  |
| `public/brand/gcc-logo-horizontal-dark.svg`  | Symbol + wordmark + tagline, light surfaces |
| `public/brand/gcc-logo-compact-light.svg`    | Symbol + short wordmark, square-ish, dark   |
| `public/brand/gcc-logo-compact-dark.svg`     | Symbol + short wordmark, square-ish, light  |
| `public/brand/og-image.svg`                  | Source for the 1200×630 social image        |
| `public/og-image.png`                        | Open Graph / Twitter card image (1200×630)  |
| `public/favicon.svg`                         | Scalable favicon                            |
| `public/favicon-16.png` … `favicon-48.png`   | Raster favicons                             |
| `public/apple-touch-icon.png`                | 180×180 Apple touch icon                    |
| `public/icon-192.png`, `icon-512.png`        | PWA icons                                   |
| `public/icon-maskable-512.png`               | Maskable PWA icon with safe padding         |
| `public/manifest.webmanifest`                | Web app manifest                            |

The React wrappers live in `src/components/brand/logo.tsx`:

- `BrandMark` — `className`, `tone?: "light" | "dark"`. Decorative by default; pair with
  a labelled link when it is the home affordance.
- `BrandLockup` — `compact?: boolean`, `tone?: "light" | "dark"`, `className`. Renders the
  symbol plus wordmark and, in full form, the tagline.

Usage rules:

- Keep clear space equal to at least the height of the gold node on every side.
- Never stretch, recolour, rotate or add effects to the mark.
- On navy, use the light asset; on white, use the dark asset. Never place the light
  wordmark on gold or electric blue.
- The wordmark is set in Barlow Condensed via paths, not live text, so it renders
  identically in SVG, PNG and social cards.

### Metadata and crawl files

Root metadata (`src/app/layout.tsx`) sets `metadataBase`, title template `%s | GCC`,
description, category, keywords, icons, manifest, Open Graph and Twitter
`summary_large_image`. `robots.ts` allows public pages and disallows `/api/`,
`/dashboard`, `/organiser`, `/super-admin`, `/design-system` and account routes.
`sitemap.ts` lists public routes plus every published tournament.

---

## 2. Tokens

Tokens are defined in `tailwind.config.ts` and mirrored as CSS variables in
`src/app/globals.css`.

### Navy — primary dark surface

| Token      | Hex       | Usage                           |
| ---------- | --------- | ------------------------------- |
| `navy-950` | `#050F1F` | Page background, deep panels    |
| `navy-900` | `#0A1B33` | Header/footer surfaces, cards   |
| `navy-800` | `#132B4B` | Raised cards, table headers     |
| `navy-700` | `#1F416A` | Borders on dark, hover surfaces |
| `navy-600` | `#275183` | Strong borders, muted fills     |

### Electric Blue — interactive

| Token          | Hex       | Usage                         |
| -------------- | --------- | ----------------------------- |
| `electric-500` | `#2E9BFF` | Primary buttons, active links |
| `electric-400` | `#56B8FF` | Hover, focus rings, icons     |
| `electric-300` | `#8FD2FF` | Emphasised text on navy       |
| `electric-200` | `#BFE3FF` | Subtle highlights             |
| `electric-900` | `#154276` | Tinted interactive surfaces   |

### Gold — championship only

| Token      | Hex       | Usage                                       |
| ---------- | --------- | ------------------------------------------- |
| `gold-400` | `#F5C443` | Trophies, winners, qualification highlights |
| `gold-300` | `#FCD34D` | Emphasis on dark                            |
| `gold-600` | `#C08A1B` | Gold text on light surfaces                 |
| `gold-950` | `#3B2707` | Deep gold-tinted background                 |

Gold is used sparingly. It never styles ordinary navigation, primary buttons or body
links. If everything is gold, nothing is a championship.

### Neutrals and semantics

| Token      | Hex       | Usage                                        |
| ---------- | --------- | -------------------------------------------- |
| `grey-50`  | `#F8FAFC` | Light surfaces (rare; product is dark-first) |
| `grey-100` | `#F1F5F9` | Primary text on dark                         |
| `grey-300` | `#CBD5E1` | Secondary text                               |
| `grey-400` | `#94A3B8` | Muted labels and metadata                    |
| `grey-500` | `#64748B` | Disabled and low-emphasis text               |
| `grey-700` | `#334155` | Borders on light surfaces                    |
| `success`  | `#22C55E` | Confirmed, qualified, won                    |
| `warning`  | `#F59E0B` | Pending, awaiting review                     |
| `danger`   | `#EF4444` | Rejected, eliminated, errors                 |
| `white`    | `#FFFFFF` | Headings and high-emphasis text              |

Success, warning and danger each include `soft` (badge background) and `strong` (text on
light) variants.

### Effects and motion tokens

- Shadows: `shadow-card`, `shadow-dialog`, `shadow-glow` (restrained; no neon stacks).
- Backgrounds: `bg-pitch-grid`, `bg-hero-glow`, `bg-grid` for pitch/hero texture.
- Easing: `ease-out-brand`, `ease-in-out-brand`.
- Animations: `animate-fade-in`, `animate-scale-in`, `animate-slide-up`,
  `animate-pulse-node`. Durations stay in the 150–260ms range except deliberate ambient
  pulses.

---

## 3. Typography

- **Display:** Barlow Condensed (500/600/700) via `next/font`. Uppercase for section
  titles, tournament names and scoreboards; tight tracking (`tracking-display`), generous
  size. It reads athletic and editorial rather than software-dashboard.
- **Body:** Inter via `next/font`. Clear at small sizes for tables, forms and long copy.
- Eyebrows/labels: 11–12px, uppercase, `tracking-eyebrow` (0.14em), muted grey.

Type scale: 12 / 14 / 16 / 18 / 24 / 32 / 40 / 56 / 72px. Headings use the display face;
body copy never drops below 14px except metadata.

---

## 4. Layout, spacing and shape

- Container: centred, 1200px maximum, responsive padding (16 / 24 / 32px).
- Spacing follows a 4px base scale (Tailwind's default scale).
- Corners: `rounded-md` for controls, `rounded-lg`/`rounded-xl` for panels. Avoid
  excessive pill shapes.
- Surfaces: navy layers with 1px white/10 borders; shadows are deep and subtle
  (`shadow-card`), never glow-heavy.
- Density: comfortable but information-dense for tables and fixtures. Competition data
  should scan quickly.
- Breakpoints: design at **360px** first, then 768px, 1024px and 1440px. Nothing may
  require horizontal scrolling except explicitly scrollable tab strips, which hide their
  scrollbar with `no-scrollbar` but remain keyboard reachable.

### Responsive patterns

- Public navigation collapses into a header drawer below `lg`.
- Participant workspaces use a desktop sidebar at `lg` and a bottom bar plus drawer below
  it.
- Organiser and Super Admin use the same workspace shell with role-specific navigation.
- Tables become stacked cards below `md`; each card repeats its column header as a label.
- Page headers stack actions under the title on small screens.
- Legal pages show the table of contents above the document on small screens and as a
  sticky sidebar at `lg`.

---

## 5. Colour usage rules

1. Navy carries the structure.
2. Electric blue indicates something interactive or live.
3. Gold indicates a championship outcome or a rare highlight.
4. Semantic colours are reserved for their meaning.
5. Never rely on colour alone: pair it with text, icon or shape.
6. Minimum contrast: WCAG AA (4.5:1 for body text, 3:1 for large text and UI boundaries).

---

## 6. Focus, motion and accessibility

- Visible focus rings: 2px electric blue with a navy offset (`focus-visible`).
- All interactive elements are keyboard reachable and have accessible names.
- Icon-only controls must pass `label`; it becomes the accessible name.
- The public shell includes a skip link and semantic landmarks.
- Reduced motion is respected globally via the `prefers-reduced-motion` rule; ambient
  pulses and transforms stop.
- Tables use real headers; status is communicated with text, not colour alone.
- Touch targets are at least 44×44px on touch layouts; compact desktop controls keep a
  36px minimum.
- Errors are announced through `aria-describedby`/`aria-invalid`, never colour alone.
- Live regions are polite and are not used for fast-changing values (the countdown is
  `aria-live="off"` with a static screen-reader summary).

---

## 7. Component catalogue

All primitives live in `src/components/ui/` and are re-exported from
`src/components/ui/index.ts`. Most are client components because they hold state or
handlers. Two deliberate splits keep server pages simple:

- **`button-styles.ts`** — pure class recipe. Server pages style `<Link>` as a button with
  `buttonStyles()` instead of importing the client `Button`.
- **`data-display.tsx`** is server-safe (no `"use client"`), because server pages pass
  Lucide icon components into `EmptyState`, `StatCard` and `Avatar`. The interactive
  `Countdown` lives in `countdown.tsx`.

### 7.1 Button

`src/components/ui/button.tsx` — client. `ButtonProps` extends
`ButtonHTMLAttributes<HTMLButtonElement>`.

| Prop           | Type                                              | Default     |
| -------------- | ------------------------------------------------- | ----------- |
| `variant`      | `primary \| secondary \| ghost \| danger \| gold` | `primary`   |
| `size`         | `sm \| md \| lg`                                  | `md`        |
| `loading`      | `boolean`                                         | `false`     |
| `loadingLabel` | `string`                                          | `"Working"` |
| `leftIcon`     | `ReactNode`                                       | —           |
| `rightIcon`    | `ReactNode`                                       | —           |

- `type` defaults to `button` to avoid accidental form submission.
- `loading` disables the button, swaps the icon for a spinner and sets `aria-busy`.
- Variants are semantic: one primary action per view; `danger` is destructive; `gold` is
  reserved for championship actions.
- Never nest a link inside a button. Use `buttonStyles()` on the link.

`buttonStyles({ variant, size, className })` returns the same classes for `<Link>`/`<a>`.

### 7.2 IconButton

`src/components/ui/icon-button.tsx` — client.

| Prop       | Type                                  | Default |
| ---------- | ------------------------------------- | ------- |
| `label`    | `string` (required)                   | —       |
| `variant`  | `ghost \| outline \| solid \| danger` | `ghost` |
| `size`     | `sm \| md \| lg`                      | `md`    |
| `children` | `ReactNode` (the icon)                | —       |

`label` is applied with `aria-label`; the icon should also be `aria-hidden`. There is no
tooltip by default — wrap in `Tooltip` only when the meaning is not obvious.

### 7.3 Input, Textarea, Select

`src/components/ui/input.tsx` — client, forward-ref.

| Prop      | Type      | Default |
| --------- | --------- | ------- |
| `invalid` | `boolean` | `false` |

They forward all native attributes. Always pair with `FormField` so a visible label,
hint and error exist. `invalid` sets `aria-invalid` and the danger border; it does not
replace an error message.

### 7.4 FormField

`src/components/ui/form-field.tsx` — client. Provides label, hint, error and required
semantics through context.

| Prop             | Type        | Default |
| ---------------- | ----------- | ------- |
| `htmlFor`        | `string`    | —       |
| `label`          | `ReactNode` | —       |
| `children`       | `ReactNode` | —       |
| `hint`           | `ReactNode` | —       |
| `error`          | `ReactNode` | —       |
| `required`       | `boolean`   | `false` |
| `optional`       | `boolean`   | `false` |
| `hideLabel`      | `boolean`   | `false` |
| `className`      | `string`    | —       |
| `labelClassName` | `string`    | —       |

`useFieldControl()` exposes `{ id, describedBy, invalid, required }` to a custom control.
Rules: one label per control; hint and error share `aria-describedby`; an error replaces
the hint visually but both IDs remain wired.

### 7.5 Checkbox and Switch

`src/components/ui/checkbox.tsx` — client, forward-ref.

| Prop          | Type        | Default |
| ------------- | ----------- | ------- |
| `label`       | `ReactNode` | —       |
| `description` | `ReactNode` | —       |
| `invalid`     | `boolean`   | `false` |

`Switch` adds `onCheckedChange?: (checked: boolean) => void` and accepts
`checked`/`defaultChecked`. It uses a native checkbox with `role="switch"` so keyboard and
form behaviour stay native. Both render a visible focus ring and describe themselves with
the optional description.

### 7.6 Card family

`src/components/ui/card.tsx` — server-safe presentational components.

| Component         | Notes                                              |
| ----------------- | -------------------------------------------------- |
| `Card`            | `variant?: default \| elevated \| outline \| gold` |
| `CardHeader`      | padded top block                                   |
| `CardTitle`       | display-face heading                               |
| `CardDescription` | muted secondary line                               |
| `CardContent`     | main body                                          |
| `CardFooter`      | actions / metadata strip                           |

Cards are content containers, not decoration. `gold` is reserved for championship or
irreversible context.

### 7.7 Badge and StatusPill

`src/components/ui/card.tsx`.

| Prop    | Type                                                      | Default   |
| ------- | --------------------------------------------------------- | --------- |
| `tone`  | `neutral \| info \| success \| warning \| danger \| gold` | `neutral` |
| `pulse` | `boolean` (`StatusPill` only)                             | `false`   |

`StatusPill` requires `children` and always pairs colour with a text label. `pulse` is
used only for genuinely live states; it stops under reduced motion.

### 7.8 Tabs

`src/components/ui/tabs.tsx` — client.

| Prop             | Type                   | Default |
| ---------------- | ---------------------- | ------- |
| `items`          | `TabItem[]`            | —       |
| `defaultValue`   | `string`               | first   |
| `value`          | `string`               | —       |
| `onValueChange`  | `(id: string) => void` | —       |
| `ariaLabel`      | `string`               | —       |
| `listClassName`  | `string`               | —       |
| `panelClassName` | `string`               | —       |

`TabItem = { id, label, content, disabled? }`. Implements the WAI-ARIA tabs pattern:
`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, roving `tabIndex`,
Arrow keys, `Home`/`End`. Disabled tabs are skipped and announced as unavailable.

### 7.9 Dialog, Modal and Drawer

`src/components/ui/dialog.tsx` — client. `Modal` is an alias of `Dialog`.

`DialogProps`:

| Prop           | Type                      | Default |
| -------------- | ------------------------- | ------- |
| `open`         | `boolean`                 | —       |
| `onOpenChange` | `(open: boolean) => void` | —       |
| `title`        | `ReactNode`               | —       |
| `description`  | `ReactNode`               | —       |
| `children`     | `ReactNode`               | —       |
| `footer`       | `ReactNode`               | —       |
| `size`         | `sm \| md \| lg`          | `md`    |
| `closeLabel`   | `string`                  | Close   |

`DrawerProps` adds `side?: "right" | "left" | "bottom"` and requires `children`.

Behaviour:

- Rendered through a portal after mount (never in server HTML).
- `role="dialog"`, `aria-modal="true"`, labelled by the title and described by the
  description when present.
- Escape closes; backdrop click closes; Tab is trapped inside the panel; body scroll is
  locked; focus returns to the trigger on close.
- Close button is a labelled `IconButton`.

Use `Dialog` for focused decisions, `Drawer` for navigation or long contextual panels, and
`ConfirmDialog` for destructive confirmation.

### 7.10 Tooltip

`src/components/ui/tooltip.tsx` — client.

| Prop       | Type                                 | Default |
| ---------- | ------------------------------------ | ------- |
| `content`  | `ReactNode`                          | —       |
| `children` | single element with aria-describedby | —       |
| `side`     | `top \| bottom \| left \| right`     | `top`   |

Shows on hover **and** keyboard focus, hides on Escape, and wires
`aria-describedby`. Never put essential information in a tooltip only.

### 7.11 Dropdown menu

`src/components/ui/dropdown-menu.tsx` — client.

| Prop            | Type                 | Default |
| --------------- | -------------------- | ------- |
| `label`         | `string`             | —       |
| `trigger`       | `ReactNode`          | —       |
| `items`         | `DropdownMenuItem[]` | —       |
| `align`         | `start \| end`       | `end`   |
| `menuClassName` | `string`             | —       |

`DropdownMenuItem = { label, href?, onSelect?, icon?, disabled?, danger?,
separatorBefore? }`.

Keyboard: Enter/Space opens and focuses the first enabled item; ArrowUp/Down, Home/End
move with wraparound; Escape closes and returns focus; Tab closes. Pointer-down outside
closes. Disabled items are removed from the roving order. `href` items are real links.

### 7.12 Toast

`src/components/ui/toast.tsx` — client.

- Wrap the tree in `ToastProvider`.
- `const { toast, dismiss } = useToast()`.
- `toast({ title, description?, tone?: info | success | warning | danger, duration? })`.
- Rendered in a polite live region, dismissible, auto-expiring (default duration in the
  implementation), and never used for critical errors that need a persistent message.

### 7.13 Table

`src/components/ui/table.tsx` — server-safe.

`TableColumn<T> = { key, header, render(row), className?, headerClassName?,
align?: left | center | right, hideOnMobile? }`.

`TableProps<T> = { columns, rows, getRowKey, caption?, emptyState?, stickyHeader?,
className? }`.

- Desktop: semantic `<table>` with `<caption>`, `<thead>`, `<th scope="col">`.
- Below `md`: each row becomes a card and each cell shows its column header as a label.
- `emptyState` is rendered instead of the body when `rows` is empty; it should explain
  what will appear, never show sample rows.
- Numeric cells use `tabular-nums`.

### 7.14 Pagination

`src/components/ui/pagination.tsx` — client.

| Prop           | Type                       | Default    |
| -------------- | -------------------------- | ---------- |
| `page`         | `number`                   | —          |
| `pageCount`    | `number`                   | —          |
| `onPageChange` | `(page: number) => void`   | —          |
| `hrefForPage`  | `(page: number) => string` | —          |
| `ariaLabel`    | `string`                   | Pagination |

Renders either buttons or links. Current page has `aria-current="page"`; previous/next
are disabled at the ends. Use `hrefForPage` when pagination must work without JavaScript.

### 7.15 Spinner and Skeleton

`src/components/ui/feedback.tsx` — server-safe.

- `Spinner`: `size?: sm | md | lg`, `label?: string`. Decorative unless `label` is given,
  in which case it exposes a status role.
- `Skeleton`: `variant?: line | block | circle`, `className`. Always `aria-hidden`; pair
  with a visually hidden loading message or a live region on the container.

### 7.16 EmptyState

`src/components/ui/data-display.tsx` — server-safe.

| Prop              | Type             | Default |
| ----------------- | ---------------- | ------- |
| `icon`            | `LucideIcon`     | `Clock` |
| `eyebrow`         | `string`         | —       |
| `title`           | `string`         | —       |
| `description`     | `ReactNode`      | —       |
| `action`          | `ReactNode`      | —       |
| `secondaryAction` | `ReactNode`      | —       |
| `size`            | `sm \| md \| lg` | `md`    |

Every empty state must say what will appear and why it is empty. Actions must be real
destinations, not decorative buttons.

### 7.17 Avatar

`src/components/ui/data-display.tsx` — server-safe.

| Prop   | Type                         | Default |
| ------ | ---------------------------- | ------- |
| `name` | `string`                     | —       |
| `src`  | `string \| null`             | —       |
| `size` | `xs \| sm \| md \| lg \| xl` | `md`    |

Uses `next/image` when `src` is present; otherwise shows initials with the full name in a
screen-reader-only span. `initialsFor(name)` is exported for reuse.

### 7.18 Countdown

`src/components/ui/countdown.tsx` — client.

| Prop            | Type                       | Default          |
| --------------- | -------------------------- | ---------------- |
| `target`        | `Date \| string \| number` | —                |
| `label`         | `string`                   | —                |
| `completeLabel` | `string`                   | `"Starting now"` |
| `size`          | `sm \| md`                 | `md`             |

Renders days/hours/minutes/seconds with `role="timer"` and `aria-live="off"`. A static
screen-reader summary describes the remaining time so it is not announced every second.
Hydration-safe: shows `--` until mounted.

### 7.19 StatCard

`src/components/ui/data-display.tsx` — server-safe.

| Prop    | Type         | Default |
| ------- | ------------ | ------- |
| `label` | `string`     | —       |
| `value` | `ReactNode`  | —       |
| `hint`  | `ReactNode`  | —       |
| `icon`  | `LucideIcon` | —       |

Never use a stat card to display a fabricated or estimated number.

### 7.20 Breadcrumbs

`src/components/ui/data-display.tsx` — server-safe.

| Prop    | Type                 | Default |
| ------- | -------------------- | ------- |
| `items` | `{ label, href? }[]` | —       |

`<nav aria-label="Breadcrumb">` with an ordered list; the final item has
`aria-current="page"` and is not a link.

### 7.21 ConfirmDialog

`src/components/ui/confirm-dialog.tsx` — client.

| Prop           | Type                      | Default     |
| -------------- | ------------------------- | ----------- |
| `open`         | `boolean`                 | —           |
| `onOpenChange` | `(open: boolean) => void` | —           |
| `title`        | `string`                  | —           |
| `description`  | `ReactNode`               | —           |
| `confirmLabel` | `string`                  | `"Confirm"` |
| `cancelLabel`  | `string`                  | `"Cancel"`  |
| `tone`         | `danger \| primary`       | `danger`    |
| `loading`      | `boolean`                 | `false`     |
| `onConfirm`    | `() => void`              | —           |

Builds on `Dialog`: focus starts on Cancel for destructive actions, Escape cancels and
the confirm button exposes a busy state while `loading`. The description must state the
exact consequence; never use a vague "Are you sure?".

---

## 8. Shared patterns

### 8.1 Page headers

`src/components/shared/page-header.tsx`:

- `PageHeader` — `eyebrow?`, `title`, `description?`, `actions?`, `breadcrumbs?`,
  `className?`. Used at the top of every page; breadcrumbs render first when present.
- `SectionHeading` — `eyebrow?`, `title`, `description?`, `action?`,
  `align?: left | center`, `className?`. Used between major page sections.

### 8.2 Feature notices (protected routes)

`src/components/shared/feature-notice.tsx` composes `PageHeader` + `EmptyState`:

```tsx
<FeatureNotice
  eyebrow="Player dashboard"
  title="Your dashboard"
  description="…"
  availabilityTitle="No competitions on your account yet"
  availabilityDescription="…"
  icon={LayoutDashboard}
  action={<Link …>…</Link>}
  secondaryAction={<Link …>…</Link>}
  breadcrumbs={[…]}   // optional
  note="…"            // optional small print
/>
```

Every protected page uses this instead of a mock table or disabled form. The copy must
be specific about what will appear and when.

### 8.3 Auth notices

`src/components/auth/auth-notice.tsx` renders the account-route explanation: lock icon,
eyebrow, title, description, “No form is open” badge, optional details and two real
destinations. Auth routes are real; they intentionally do not render login, registration
or reset forms before authentication is implemented.

### 8.4 Legal pages

`src/components/shared/legal-page.tsx` renders:

- `PageHeader` with breadcrumbs.
- “Last updated” line.
- A numbered table of contents that links to in-page anchors.
- Numbered `<section>` elements with `aria-labelledby`, sticky TOC at `lg`, and a final
  highlighted contact note.

`LegalSection = { id, heading, body: ReactNode }`. IDs are stable because they are
linkable.

### 8.5 Tournament presentation

- `src/lib/config/tournament-status.ts` is the single source for status labels, badge
  tones, descriptions and whether a status is live.
- `src/components/tournament/tournament-card.tsx` renders real server data only: game,
  season, status, start date and registration count.
- `src/components/tournament/format-explainer.tsx` builds the 36-team explainer from
  `src/lib/config/formats.ts`. Never hard-code format numbers in a page.

### 8.6 eHubMarket promo

`src/components/marketplace/ehubmarket-promo.tsx`:

- Exact copy: **“LOOKING FOR AN eFOOTBALL ACCOUNT?”** and **“EXPLORE MARKETPLACE”**.
- Opens `https://ehubmarket.me/` in a new tab with `rel="noopener noreferrer"`.
- The destination is configurable through `NEXT_PUBLIC_EHUBMARKET_URL`.
- It is a link, not a button, and appears on the home page, About, tournament detail and
  the footer.

---

## 9. Shells

Navigation data lives in `src/lib/config/navigation.ts`; shells never hard-code routes.

### 9.1 Public shell

`src/app/(public)/layout.tsx` reads the session with `getCurrentUser()` and passes a
serialisable viewer to the client header. `site-header.tsx` provides:

- Skip link to `#main`.
- Sticky header with `BrandLockup`.
- Desktop nav: Tournaments, Rankings, Hall of Fame, Archives, About.
- Auth area reflecting real session state: signed out shows Sign in / Create account;
  signed in shows the dashboard link, role shell link and sign-out.
- Mobile drawer using the `Drawer` primitive with the same links and auth actions.
- Notification bell is **not** in the public header.

`site-footer.tsx` provides competition, community and legal link groups, the eHubMarket
link, the tagline and the independence notice.

### 9.2 Participant dashboard shell

`src/app/(dashboard)/layout.tsx` calls the Phase 2 server guard through
`src/lib/auth/page-access.ts` before rendering. `dashboard-shell.tsx` provides a desktop
sidebar, a mobile bottom bar and a drawer, a notification bell wired to
`/dashboard/notifications` (a real empty inbox), and account actions.

### 9.3 Organiser workspace

`src/app/(organiser)/layout.tsx` uses `requireRole("organiser")` semantics through the
page-access helper. `workspace-shell.tsx` renders:

- Organiser navigation: Overview, Tournaments, New tournament.
- A tournament sub-navigation when the path contains an id: Overview, Registrations,
  Pots and draw, Fixtures, Results, Knockout, Result reports, Announcements, Graphics,
  Settings.

Every route above exists in the app tree. The overall accent is electric blue.

### 9.4 Super Admin console

`src/app/(super-admin)/layout.tsx` requires `super_admin`. The same `workspace-shell.tsx`
renders a visually distinguishable console (gold-tinted rail) with: Overview, Users,
Applications, Tournaments, Result reports, Announcements, Analytics, Audit log, Settings.

### 9.5 Access rules

All shell layouts call the server guard and force dynamic rendering. Redirect behaviour:

| Situation     | Destination                  |
| ------------- | ---------------------------- |
| Not signed in | `/login?next=<current path>` |
| Wrong role    | the user's own workspace     |

There is no email-verification redirect: the product does not verify addresses
(ADR-046).

Role checks happen on the server. A hidden link is never treated as access control.

---

## 10. Global states

- `src/app/not-found.tsx` — branded 404 with orbit rings, home and tournament actions.
  It does not claim data was lost.
- `src/app/error.tsx` — client error boundary; neutral copy, optional digest reference,
  retry and home actions. Sensitive error details are never rendered.
- `src/app/loading.tsx` — skeleton page with a polite status announcement.
- Empty states across the product follow the same rule: name the missing data, explain
  what will create it, and offer a real next step.

---

## 11. Content and honesty rules

- No fake players, tournaments, scores, standings, counts or notifications anywhere
  outside `/design-system`.
- No decorative buttons or links. Every control has a real destination or action.
- No UEFA logos, trophy shapes, starballs, competition names or typography. The 36-team
  structure is described as a format, not as an official competition.
- Do not implement registration or login logic until the authentication phase. Auth
  routes explain availability instead.
- When Firestore is unavailable, public pages show an honest empty list; they never fall
  back to sample content.
- Contact channels are environment-driven. If unset, Contact shows an unconfigured state
  rather than inventing an address or rendering a non-functional form.

---

## 12. Showcase notes

`/design-system` (development only) renders:

- Brand marks on light and dark, palette swatches, type scale, focus and motion notes.
- Buttons: every variant, size, loading, disabled and icon state; icon-button variants
  and sizes.
- Forms: input with hint/required, error state, select, disabled input, textarea,
  checkbox and switch states.
- Surfaces: every card variant, every badge tone, status pills including live pulse.
- Navigation: tabs with keyboard behaviour, dropdown menu, breadcrumbs, pagination.
- Overlays: dialog, drawer, tooltip and confirm dialog, all focus-trapped.
- Data display: table with rows, table empty state, stat cards, avatars, countdown.
- Feedback: spinners, skeletons, a full empty state and the demo-data warning.

When adding a primitive or variant, add it to the showcase in the same change. Keep demo
content clearly labelled so it cannot be mistaken for production data.
