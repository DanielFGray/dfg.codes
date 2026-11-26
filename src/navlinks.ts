/**
 * The site's header links. `covers` lists the path prefixes a link stands for, so the
 * link shows as current on those pages too: the article pages belong to Blog.
 */
export const navlinks: ReadonlyArray<{ href: string; label: string; covers?: readonly string[] }> = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/projects', label: 'Projects' },
  { href: '/uses', label: 'Uses' },
  { href: '/blog', label: 'Blog', covers: ['/articles'] },
]

/** Whether `pathname` is the link's own page or one of the pages it covers. */
export const isCurrent = (link: (typeof navlinks)[number], pathname: string): boolean =>
  pathname === link.href ||
  (link.covers ?? []).some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
