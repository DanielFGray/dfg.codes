# Design Migration: nextjsblog → newblog

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make newblog visually identical to nextjsblog while preserving newblog's existing interactive features (Code Hike v1, Scrollycoding, Editor, AlphaTab).

**Architecture:** Port components from the Next.js blog into the React Router blog, adapting Next.js-specific APIs (`Link`, `Image`, `usePathname`, `useRouter`, `Head`) to React Router equivalents (`Link` with `to` prop, `<img>`, `useLocation`, `<title>` via meta export). Add Supabase comments/starring, React Query, and the full Tailwind typography configuration.

**Tech Stack:** React Router v7, Tailwind CSS 3.x, @headlessui/react, @tanstack/react-query, @supabase/supabase-js, clsx

---

## Adaptation Reference

Every ported component needs these substitutions:

| Next.js | React Router |
|---------|-------------|
| `import Link from 'next/link'` | `import { Link } from 'react-router'` |
| `<Link href={x}>` | `<Link to={x}>` |
| `import { usePathname } from 'next/navigation'` | `import { useLocation } from 'react-router'` then `useLocation().pathname` |
| `import { useSearchParams } from 'next/navigation'` | `import { useSearchParams } from 'react-router'` |
| `import Image from 'next/image'` | Use `<img>` tag directly |
| `<Head><title>...` | Use React Router `meta` export on route modules |
| `import { classed } from '@tw-classed/react'` | Use `clsx` + plain components (see below) |
| `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` |
| `~/components/X` | `@/components/X` (tsconfig alias already set) |

For `@tw-classed/react` replacements, use a simple helper:

```tsx
// Instead of: export const Prose = classed('div', 'prose prose-xl dark:prose-invert')
// Use:
import clsx from 'clsx'
export function Prose({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('prose prose-xl dark:prose-invert', className)} {...props} />
}
```

---

## Phase 1: Foundation

### Task 1: Install dependencies

**Step 1:** Install new dependencies

Run:
```bash
cd /home/dan/build/newblog
bun add clsx @headlessui/react @tailwindcss/typography @tailwindcss/forms @tailwindcss/aspect-ratio @supabase/supabase-js @tanstack/react-query s-ago lodash
bun add -d @danielfgray/tw-heropatterns @types/lodash
```

**Step 2:** Verify build still works

Run: `bun run build`
Expected: Build succeeds

**Step 3:** Commit

```bash
git add package.json bun.lock
git commit -m "feat: add dependencies for design migration"
```

---

### Task 2: Update Tailwind config

Port the full Tailwind config from nextjsblog. Key changes:
- Add `primary` (zinc) and `secondary` (sky) color aliases
- Switch `darkMode` from `'media'` to `'class'`
- Add custom `fontSize` scale
- Add full `typography` plugin config for prose styling
- Add plugins: typography, forms, aspect-ratio, heropatterns
- Keep existing `editor` color tokens

**Files:**
- Modify: `tailwind.config.js`

**Step 1:** Replace tailwind.config.js

The new config must merge the nextjsblog typography config (from `/home/dan/build/nextjsblog/tailwind.config.js`) with the existing editor color tokens. Use `import` syntax (ESM) since the newblog config is already ESM (`export default`).

Key points:
- Import `colors` from `tailwindcss/colors`
- `darkMode: 'class'`
- `colors.primary: colors.zinc`, `colors.secondary: colors.sky`
- Keep `colors.editor` tokens
- Copy the entire `fontSize` object
- Copy the entire `typography` function
- Plugins: `@danielfgray/tw-heropatterns`, `@tailwindcss/aspect-ratio`, `@tailwindcss/forms`, `@tailwindcss/typography`

**Step 2:** Verify build

Run: `bun run build`
Expected: Build succeeds

**Step 3:** Commit

```bash
git add tailwind.config.js
git commit -m "feat: port Tailwind config with typography and color system"
```

---

### Task 3: Update global CSS and dark mode

**Files:**
- Modify: `src/index.css`
- Modify: `src/root.tsx`

**Step 1:** Update `src/index.css`

Change the dark mode CSS custom properties from `@media (prefers-color-scheme: dark)` to `.dark` class selector, so they work with the class-based toggle. Keep all existing editor/syntax/terminal tokens. Also add the `.article-layout` grid styles from the nextjsblog's `tailwind.css`.

Add these additional styles from nextjsblog's `tailwind.css`:
- `.article-layout` grid (centered 112ch column)
- `.ping` and `.spin` keyframe animations
- Prose heading hover link icon styles
- Code Hike overrides (`.ch-*` classes)

**Step 2:** Add dark mode initialization script to `src/root.tsx`

Add an inline `<script>` in the `<head>` of the `Layout` component that:
1. Checks `window.localStorage.isDarkMode`
2. Falls back to `matchMedia('(prefers-color-scheme: dark)')`
3. Adds/removes `dark` class on `<html>`

```tsx
// In root.tsx Layout, add before <Meta />:
<script dangerouslySetInnerHTML={{ __html: `
  let isDarkMode = window.localStorage.isDarkMode === 'true' ||
    (window.localStorage.isDarkMode == null && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDarkMode)
` }} />
```

Also add `className="antialiased"` to the `<body>` tag and `suppressHydrationWarning` on `<html>` (since the script modifies classnames before hydration).

**Step 3:** Verify dark mode toggle works in dev

Run: `bun run dev`
Check: Page loads, inspect `<html>` element has `dark` class when system is dark mode

**Step 4:** Commit

```bash
git add src/index.css src/root.tsx
git commit -m "feat: switch to class-based dark mode with init script"
```

---

## Phase 2: Layout Shell

### Task 4: Create Container component

**Files:**
- Create: `src/components/Container.tsx`

Port from `/home/dan/build/nextjsblog/src/components/Container.tsx`.

Adaptations:
- Replace `import clsx from 'clsx'` (same)
- No Next.js-specific APIs used here
- Change path alias from `~` to `@` if needed (check tsconfig)

The component is three parts:
- `OuterContainer`: `sm:px-8` wrapper with `max-w-7xl`
- `InnerContainer`: `px-4 sm:px-8 lg:px-12` with `max-w-2xl lg:max-w-5xl`
- `Container`: combines both, with `.Outer` and `.Inner` static properties

**Step 1:** Create `src/components/Container.tsx` - direct port

**Step 2:** Verify it compiles

Run: `bun run build`

**Step 3:** Commit

```bash
git add src/components/Container.tsx
git commit -m "feat: add Container component"
```

---

### Task 5: Create navlinks config

**Files:**
- Create: `src/navlinks.ts`

```tsx
export const navlinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/articles', label: 'Articles' },
  { href: '/projects', label: 'Projects' },
  { href: '/uses', label: 'Uses' },
]
```

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/navlinks.ts
git commit -m "feat: add navlinks config"
```

---

### Task 6: Create SocialIcons component

**Files:**
- Create: `src/components/SocialIcons.tsx`

Port from `/home/dan/build/nextjsblog/src/components/SocialIcons.tsx`.

Adaptations:
- `import Link from 'next/link'` → `import { Link } from 'react-router'`
- All `href={x}` props on `<Link>` → `to={x}`
- For external links (social URLs), use `<a>` tags instead of `<Link>` since React Router `Link` is for internal routes

Contains: `SocialLink`, `SocialLinks`, `TwitterIcon`, `InstagramIcon`, `GitHubIcon`, `LinkedInIcon`, `ArrowDownIcon`, `MailIcon`, `BriefcaseIcon`, `CloseIcon`, `ChevronDownIcon`, `SunIcon`, `MoonIcon`, `LinkIcon`

**Step 1:** Create file
**Step 2:** Verify build
**Step 3:** Commit

```bash
git add src/components/SocialIcons.tsx
git commit -m "feat: add social icons and SVG icon components"
```

---

### Task 7: Create Header component

**Files:**
- Create: `src/components/Header.tsx`
- Copy: `nextjsblog/src/images/avatar.jpg` → `newblog/public/avatar.jpg`

Port from `/home/dan/build/nextjsblog/src/components/Header.tsx`.

Adaptations:
- `import Link from 'next/link'` → `import { Link } from 'react-router'`
- `import { usePathname } from 'next/navigation'` → `import { useLocation } from 'react-router'`, then `useLocation().pathname`
- `<Link href={x}>` → `<Link to={x}>`
- `import Image from 'next/image'` → use `<img>` directly
- `<Image src={avatarImage} alt="" sizes={...} className={...} />` → `<img src="/avatar.jpg" alt="" className={...} />`
- `import { Popover, Transition } from '@headlessui/react'` → same (now installed)
- `import { Container } from '~/components/Container'` → `import { Container } from '@/components/Container'`
- `import { navlinks } from '~/navlinks'` → `import { navlinks } from '@/navlinks'`
- `import { ChevronDownIcon, CloseIcon, MoonIcon, SunIcon } from './SocialIcons'`
- `Popover.Button as={Link}` needs `as={Link}` but the `href` prop → `to` prop

Contains: `MobileNavItem`, `MobileNavigation`, `NavItem`, `DesktopNavigation`, `ModeToggle`, `AvatarContainer`, `Avatar`, `Header`

The `ModeToggle` component handles dark mode toggling via class manipulation + localStorage. Port as-is.

The `Header` component has complex scroll-based avatar animations. Port as-is.

**Step 1:** Copy avatar image

```bash
cp /home/dan/build/nextjsblog/src/images/avatar.jpg /home/dan/build/newblog/public/avatar.jpg
```

**Step 2:** Create `src/components/Header.tsx` - adapt all Next.js APIs

**Step 3:** Verify it compiles: `bun run build`

**Step 4:** Commit

```bash
git add src/components/Header.tsx public/avatar.jpg
git commit -m "feat: add Header with nav, avatar, and dark mode toggle"
```

---

### Task 8: Create Footer component

**Files:**
- Create: `src/components/Footer.tsx`

Port from `/home/dan/build/nextjsblog/src/components/Footer.tsx`.

Adaptations:
- Replace `@tw-classed/react` NavLink with a plain component using `clsx`:
  ```tsx
  function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
    return <Link to={to} className="transition hover:text-secondary-500 dark:hover:text-secondary-400">{children}</Link>
  }
  ```
- `<Link href={x}>` → `<Link to={x}>`
- Update Container import path

**Step 1:** Create file
**Step 2:** Verify build
**Step 3:** Commit

```bash
git add src/components/Footer.tsx
git commit -m "feat: add Footer component"
```

---

### Task 9: Update main layout

**Files:**
- Modify: `src/layouts/main.tsx`

Replace the current basic layout with the nextjsblog layout structure:

```tsx
import { Outlet } from 'react-router'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function MainLayout() {
  return (
    <div className="fixed inset-0 flex justify-center sm:px-8">
      <div className="flex w-full max-w-7xl lg:px-8">
        <div className="w-full bg-white ring-1 ring-primary-100 dark:bg-primary-900 dark:ring-primary-300/20" />
      </div>
    </div>
    <div className="relative">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
```

Note: The nextjsblog uses a fixed background panel behind the content to create a centered card effect. Replicate this.

**Step 1:** Update layout
**Step 2:** Verify in dev: `bun run dev` - check header, footer, nav all render
**Step 3:** Commit

```bash
git add src/layouts/main.tsx
git commit -m "feat: update main layout with Header/Footer"
```

---

## Phase 3: Shared Components

### Task 10: Create Card component

**Files:**
- Create: `src/components/Card.tsx`

Port from `/home/dan/build/nextjsblog/src/components/Card.tsx`.

Adaptations:
- Replace `@tw-classed/react`: the base `Card` is `classed('div', 'group relative flex flex-col items-start')`. Replace with:
  ```tsx
  export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={clsx('group relative flex flex-col items-start', className)} {...props} />
  }
  ```
- Then assign `Card.Link`, `Card.Title`, `Card.Description`, `Card.Cta`, `Card.Eyebrow` as static methods
- `Link` from next → `Link` from react-router with `to` instead of `href`
- `Card.Link` wraps a React Router `<Link>` (change `href` to `to`)
- `Card.Title` accepts an optional `href` prop → rename to `to` internally

**Step 1:** Create file
**Step 2:** Verify build
**Step 3:** Commit

```bash
git add src/components/Card.tsx
git commit -m "feat: add Card component system"
```

---

### Task 11: Create Button component

**Files:**
- Create: `src/components/Button.tsx`

Port from `/home/dan/build/nextjsblog/src/components/Button.tsx`.

Replace the `@tw-classed/react` variant system with a plain component:

```tsx
import clsx from 'clsx'

const colorStyles = {
  primary: 'bg-primary-800 font-semibold text-primary-100 hover:bg-primary-700 active:bg-primary-800 active:text-primary-100/70 dark:bg-primary-700 dark:hover:bg-primary-600 dark:active:bg-primary-700 dark:active:text-primary-100/70',
  secondary: 'bg-primary-50 font-medium text-primary-900 hover:bg-primary-100 active:bg-primary-100 active:text-primary-900/60 dark:bg-primary-800/50 dark:text-primary-300 dark:hover:bg-primary-800 dark:hover:text-primary-50 dark:active:bg-primary-800/50 dark:active:text-primary-50/70',
}

export function Button({ color = 'primary', className, as: Component = 'button', ...props }) {
  return <Component className={clsx(colorStyles[color], className)} {...props} />
}
```

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/components/Button.tsx
git commit -m "feat: add Button component with color variants"
```

---

### Task 12: Update Prose component

**Files:**
- Modify: `src/components/Prose.tsx`

The existing Prose component in newblog may already exist. Update it to match the nextjsblog's version - a simple wrapper div with prose classes. Also include the `Callout` component.

```tsx
import clsx from 'clsx'

export function Prose({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('prose prose-xl dark:prose-invert', className)} {...props} />
}
```

Port the `Callout` component from nextjsblog's Prose.tsx as-is.

**Step 1:** Update file
**Step 2:** Commit

```bash
git add src/components/Prose.tsx
git commit -m "feat: update Prose component and add Callout"
```

---

### Task 13: Create SimpleLayout component

**Files:**
- Create: `src/components/SimpleLayout.tsx`

Port from `/home/dan/build/nextjsblog/src/components/SimpleLayout.tsx`. Uses Container. No Next.js-specific APIs.

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/components/SimpleLayout.tsx
git commit -m "feat: add SimpleLayout component"
```

---

### Task 14: Create Section component

**Files:**
- Create: `src/components/Section.tsx`

Port from `/home/dan/build/nextjsblog/src/components/Section.tsx`. No Next.js-specific APIs (just uses `useId` from React).

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/components/Section.tsx
git commit -m "feat: add Section component"
```

---

### Task 15: Add labelize utility

**Files:**
- Create: `src/lib/labelize.ts`

Port from `/home/dan/build/nextjsblog/src/lib/labelize.tsx`. Pure utility, no framework dependencies.

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/lib/labelize.ts
git commit -m "feat: add labelize utility"
```

---

### Task 16: Create Articles components (ArticleCard, TagLink, ArticleLayout)

**Files:**
- Create: `src/components/Articles.tsx`
- Modify: `src/components/ArticleLayout.tsx`

Port `ArticleCard`, `TagLink`, and `Pill` from `/home/dan/build/nextjsblog/src/components/Articles.tsx`.

Adaptations:
- Replace `@tw-classed/react` `Pill` with a plain component using `clsx`
- `Link` from next → `Link` from react-router
- `TagLink` uses `Link` with query params. In React Router: `<Link to={{ pathname: '/articles', search: new URLSearchParams(...).toString() }}>` or use `useSearchParams`
- Import `formatDate` from `@/lib/articles` (already exists in newblog)
- Import `labelize` from `@/lib/labelize`
- Import `Card` from `@/components/Card`
- The `ArticleLayout` in nextjsblog includes `<Head>` for SEO, `<Prose>`, and `<CommentSection>`. For now, port without the comment section (add in Phase 5). Add the header styling with title, date, tags, reading time.

Update the existing `src/components/ArticleLayout.tsx` to match the nextjsblog design:
- Use `Container` for layout
- Add the styled header with date bar indicator
- Use `Prose` wrapper with `article-layout` class
- Use `primary`/`secondary` color tokens instead of raw gray/blue

**Step 1:** Create `src/components/Articles.tsx`
**Step 2:** Update `src/components/ArticleLayout.tsx`
**Step 3:** Verify build
**Step 4:** Commit

```bash
git add src/components/Articles.tsx src/components/ArticleLayout.tsx
git commit -m "feat: add ArticleCard, TagLink, update ArticleLayout"
```

---

## Phase 4: Page Redesigns

### Task 17: Update routes config

**Files:**
- Modify: `src/routes.ts`

Add routes for about, projects, uses. Keep existing music/scrolly/sandpack routes (they just won't be in the nav).

```ts
import { type RouteConfig, route, index, layout } from '@react-router/dev/routes'

export default [
  layout('./layouts/main.tsx', [
    index('./routes/home.tsx'),
    route('about', './routes/about.tsx'),
    route('articles', './routes/articles.tsx'),
    route('articles/:slug', './routes/article.tsx'),
    route('projects', './routes/projects.tsx'),
    route('uses', './routes/uses.tsx'),
    route('music', './routes/music.tsx'),
    route('scrolly', './routes/scrolly.tsx'),
    route('sandpack', './routes/sandpack.tsx'),
  ]),
] satisfies RouteConfig
```

**Step 1:** Update routes.ts
**Step 2:** Commit (routes will 404 until pages exist, that's fine)

```bash
git add src/routes.ts
git commit -m "feat: add about, projects, uses routes"
```

---

### Task 18: Redesign homepage

**Files:**
- Modify: `src/routes/home.tsx`

Port the design from `/home/dan/build/nextjsblog/src/pages/index.tsx`.

Structure:
1. `Topper` section: title "Daniel Gray", description, social links
2. Tag cloud: "things I write about:" with tag pills
3. Article list: latest 6 articles using `ArticleCard`
4. "Read more" button linking to /articles

Adaptations:
- `getStaticProps` → React Router `loader` function
- `useTopPosts` → port later in Phase 5, skip for now (just show articles without popularity sort)
- Use `Container` for layout sections
- Use `ArticleCard` from new Articles component
- Use `SocialLinks` from SocialIcons
- Use `Button` component with `as={Link}` for "Read more"
- Import `Link` from react-router

Also need to get tag list from articles. Add a `tagList` helper to `src/lib/articles.ts`:
```ts
export function tagList(articles: ArticleMeta[]): string[] {
  const tags = new Set<string>()
  articles.forEach(a => a.tags?.forEach(t => tags.add(t)))
  return [...tags].sort()
}
```

**Step 1:** Add `tagList` to `src/lib/articles.ts`
**Step 2:** Rewrite `src/routes/home.tsx`
**Step 3:** Verify in dev
**Step 4:** Commit

```bash
git add src/routes/home.tsx src/lib/articles.ts
git commit -m "feat: redesign homepage to match nextjsblog"
```

---

### Task 19: Redesign articles page

**Files:**
- Modify: `src/routes/articles.tsx`

Port from `/home/dan/build/nextjsblog/src/pages/articles/index.tsx`.

Structure:
- `SimpleLayout` with title "Writing on software development."
- Tag filter bar with `TagLink` components
- Article list with `ArticleCard` components
- Tag-based filtering via URL search params

Adaptations:
- `useSearchParams` from next/navigation → `useSearchParams` from react-router
- `params.getAll('tag')` → same API in React Router
- Use loader to fetch articles and tagList

**Step 1:** Rewrite articles page
**Step 2:** Verify tag filtering works
**Step 3:** Commit

```bash
git add src/routes/articles.tsx
git commit -m "feat: redesign articles page with tag filtering"
```

---

### Task 20: Create about page

**Files:**
- Create: `src/routes/about.tsx`
- Copy: `nextjsblog/src/images/portrait.jpg` → `newblog/public/portrait.jpg`

Port from `/home/dan/build/nextjsblog/src/pages/about.tsx`.

Adaptations:
- `Image` → `<img src="/portrait.jpg" ...>`
- Use `Container`, `SocialLinks`, `SocialLink` from new components
- Use React Router `meta` export for page title/description

**Step 1:** Copy portrait image
```bash
cp /home/dan/build/nextjsblog/src/images/portrait.jpg /home/dan/build/newblog/public/portrait.jpg
```

**Step 2:** Create about.tsx
**Step 3:** Verify in dev
**Step 4:** Commit

```bash
git add src/routes/about.tsx public/portrait.jpg
git commit -m "feat: add about page"
```

---

### Task 21: Create projects page

**Files:**
- Create: `src/routes/projects.tsx`

Port from `/home/dan/build/nextjsblog/src/pages/projects.tsx`.

Uses `SimpleLayout`, `Card` system, `LinkIcon`. Replace `Image` with `<img>`. Note that project logos are empty strings in the source, so no images needed yet.

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/routes/projects.tsx
git commit -m "feat: add projects page"
```

---

### Task 22: Create uses page

**Files:**
- Create: `src/routes/uses.tsx`

Port from `/home/dan/build/nextjsblog/src/pages/uses.tsx`.

Uses `SimpleLayout`, `Card`, `Section`. Replace `Link` from next with `<a>` for external links.

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/routes/uses.tsx
git commit -m "feat: add uses page"
```

---

### Task 23: Update pre-render config

**Files:**
- Modify: `react-router.config.ts`

Add the new routes to the pre-render list:

```ts
async prerender() {
  return [
    '/',
    '/about',
    '/articles',
    '/projects',
    '/uses',
    '/music',
    '/scrolly',
    '/sandpack',
    ...slugs.map(slug => `/articles/${slug}`),
  ]
}
```

**Step 1:** Update config
**Step 2:** Verify full build: `bun run build`
**Step 3:** Commit

```bash
git add react-router.config.ts
git commit -m "feat: add new routes to pre-render config"
```

---

## Phase 5: Interactive Features (Supabase)

### Task 24: Port Supabase comments library

**Files:**
- Create: `src/lib/comments.tsx`
- Create: `.env.example`

Port from `/home/dan/build/nextjsblog/src/lib/comments.tsx`.

Adaptations:
- `process.env.NEXT_PUBLIC_SUPABASE_URL` → `import.meta.env.VITE_SUPABASE_URL`
- `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` → `import.meta.env.VITE_SUPABASE_ANON_KEY`
- `process.env.NEXT_PUBLIC_URL` → `import.meta.env.VITE_PUBLIC_URL`
- All React Query hooks stay the same (same API)
- `QueryProvider` stays the same

Create `.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_URL=
```

Also copy the actual `.env` values from nextjsblog if they exist (check `/home/dan/build/nextjsblog/.env`).

**Step 1:** Create comments lib
**Step 2:** Create .env.example
**Step 3:** Copy env values if available
**Step 4:** Commit

```bash
git add src/lib/comments.tsx .env.example
git commit -m "feat: port Supabase comments library"
```

---

### Task 25: Port CommentSection component

**Files:**
- Create: `src/components/Comments.tsx`

Port from `/home/dan/build/nextjsblog/src/components/Comments.tsx`.

Adaptations:
- `Link` from next → use `<a>` for external GitHub profile links
- `import { usePathname } from 'next/navigation'` → `import { useLocation } from 'react-router'`
- `usePathname()` → `useLocation().pathname`
- `TrashIcon`, `ReplyIcon` from `@heroicons/react/solid` → inline SVGs (don't add heroicons as dep, just inline the 2 icons)
- `Transition` from `@headlessui/react` → same (already installed)
- Import from `@/lib/comments` instead of `~/lib/comments`

**Step 1:** Create file
**Step 2:** Verify build
**Step 3:** Commit

```bash
git add src/components/Comments.tsx
git commit -m "feat: port CommentSection component"
```

---

### Task 26: Port StarThisPost component

**Files:**
- Create: `src/components/StarThisPost.tsx`

Port from `/home/dan/build/nextjsblog/src/components/StarThisPost.tsx`.

Adaptations:
- `import debounce from 'lodash/debounce'` → same (lodash installed)
- `import clsx from 'clsx'` → same
- Import from `@/lib/comments` instead of `~/lib/comments`
- Everything else is framework-agnostic React

**Step 1:** Create file
**Step 2:** Commit

```bash
git add src/components/StarThisPost.tsx
git commit -m "feat: port StarThisPost component"
```

---

### Task 27: Wire comments into ArticleLayout

**Files:**
- Modify: `src/components/ArticleLayout.tsx`
- Modify: `src/routes/article.tsx` (if needed to wrap with QueryProvider)

Add `CommentSection` and `QueryProvider` to the article layout:
- Wrap article content with `QueryProvider`
- Add `CommentSection` below the prose content
- Add `StarPost` component

Check `/home/dan/build/newblog/src/routes/article.tsx` for how articles are currently rendered, and ensure the QueryProvider wraps at the right level.

**Step 1:** Update ArticleLayout to include comments
**Step 2:** Verify in dev with a real article
**Step 3:** Commit

```bash
git add src/components/ArticleLayout.tsx src/routes/article.tsx
git commit -m "feat: wire comments and starring into articles"
```

---

## Phase 6: Final Polish

### Task 28: Full build and visual verification

**Step 1:** Run full build

```bash
bun run build
```

Expected: All pages pre-render successfully

**Step 2:** Preview the built site

```bash
bun run preview
```

**Step 3:** Visually verify each page:
- `/` - Homepage with avatar, nav, tag cloud, article cards, footer
- `/about` - Bio with portrait, social links
- `/articles` - Tag filter, article cards with dates
- `/articles/[any-slug]` - Article with prose styling, comments
- `/projects` - Project cards
- `/uses` - Tool sections
- `/music`, `/scrolly`, `/sandpack` - Still functional

**Step 4:** Fix any visual discrepancies

**Step 5:** Final commit

```bash
git add -A
git commit -m "fix: polish visual details from migration"
```

---

## Dependency Summary

New dependencies to add:
- `clsx` - class name utility
- `@headlessui/react` - mobile nav popover, transitions
- `@tailwindcss/typography` - prose styling
- `@tailwindcss/forms` - form element styling
- `@tailwindcss/aspect-ratio` - aspect ratio utilities
- `@supabase/supabase-js` - comments backend
- `@tanstack/react-query` - server state for comments
- `s-ago` - time ago formatting
- `lodash` - debounce for star post

Dev dependencies:
- `@danielfgray/tw-heropatterns` - Tailwind plugin for patterns

## Files NOT to touch

These newblog files should remain untouched (they contain the interactive features unique to the new blog):
- `src/components/Code.tsx`
- `src/components/Scrollycoding.tsx`
- `src/components/Editor/`
- `src/components/AlphaTab/`
- `src/components/CodeWithTabs.tsx`
- `src/components/focus.tsx`
- `src/components/mark.tsx`
- `src/components/bg.tsx`
- `src/components/token-transitions.tsx`
- `src/routes/music.tsx`
- `src/routes/scrolly.tsx`
- `src/routes/sandpack.tsx`
- `src/routes/article.tsx` (modify minimally - only to add QueryProvider/CommentSection wrapping)
- `vite.config.ts`
