import { describe, expect, it } from 'vitest'
import { personMeta, personSchema } from './person-meta.js'

describe('personMeta', () => {
  const tags = personMeta({ title: 'About', description: 'Bio.', path: '/about' })

  it('points the canonical link and og:url at the name domain', () => {
    expect(tags).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://danielfgray.com/about',
    })
    expect(tags).toContainEqual({ property: 'og:url', content: 'https://danielfgray.com/about' })
  })

  it('asks for the large card with an absolute image and its size', () => {
    expect(tags).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(tags).toContainEqual({ property: 'og:image', content: 'https://danielfgray.com/og.png' })
    expect(tags).toContainEqual({ property: 'og:image:width', content: '1200' })
    expect(tags).toContainEqual({ property: 'og:image:height', content: '630' })
  })

  it('carries the Person schema', () => {
    expect(tags).toContainEqual({ 'script:ld+json': personSchema })
    expect(personSchema['@type']).toBe('Person')
  })
})
