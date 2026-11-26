// Social card and Person schema for the pages that are about the person.
// Canonical URLs use the name domain, which serves this app.
const SITE = 'https://danielfgray.com'
const SITE_NAME = 'Daniel F. Gray'

// A search engine attaches the Person schema to the page it finds. The `sameAs` list
// ties the name domain to the other places the same person appears.
export const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Daniel F. Gray',
  url: `${SITE}/`,
  image: `${SITE}/portrait.jpg`,
  jobTitle: 'Software developer and music teacher',
  knowsAbout: ['Music', 'Web development', 'PostgreSQL', 'TypeScript'],
  sameAs: [
    'https://github.com/danielfgray',
    'https://twitter.com/danielfgray',
    'https://instagram.com/ukdrummerintx',
    'https://blog.danielfgray.com',
    'https://dfg.rocks',
  ],
}

// The social card is public/og.png, built by scripts/build-og-image.sh.
const CARD = { path: '/og.png', width: 1200, height: 630 }

type PersonMetaInput = {
  title: string
  description: string
  /** The route's path, such as `/` or `/about`. */
  path: string
}

/**
 * The `meta` export for a route about the person: title, description, canonical link,
 * Open Graph and Twitter card tags, and the Person JSON-LD.
 *
 * Use: `export const meta = () => personMeta({ title, description, path: '/about' })`.
 */
export function personMeta({ title, description, path }: PersonMetaInput) {
  const url = new URL(path, SITE).href
  const image = new URL(CARD.path, SITE).href
  return [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: url },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: String(CARD.width) },
    { property: 'og:image:height', content: String(CARD.height) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { 'script:ld+json': personSchema },
  ]
}
