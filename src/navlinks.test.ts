import { describe, expect, it } from 'vitest'
import { isCurrent, navlinks } from './navlinks.js'

const link = (label: string) => navlinks.find(l => l.label === label)!

describe('isCurrent', () => {
  it('marks a link current on its own page', () => {
    expect(isCurrent(link('About'), '/about')).toBe(true)
    expect(isCurrent(link('About'), '/uses')).toBe(false)
  })

  it('marks Blog current on the article index and on an article', () => {
    expect(isCurrent(link('Blog'), '/articles')).toBe(true)
    expect(isCurrent(link('Blog'), '/articles/some-post')).toBe(true)
  })

  it('does not treat a shared prefix as a covered path', () => {
    expect(isCurrent(link('Blog'), '/articlesque')).toBe(false)
    expect(isCurrent(link('Home'), '/about')).toBe(false)
  })
})
