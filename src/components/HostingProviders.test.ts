import { expect, test } from 'vitest'
import { comparePlans, type HostProvider } from './HostingProviders'

// The article's published plans top out at $5, so the page's own sorting never
// separates a price whose textual and numeric order differ ($2.5 vs $10). The
// shipped comparator owns that contract.
const vultr: HostProvider = { name: 'Vultr', url: 'https://vultr.com', price: '$2.5', backend: 'any', type: 'VPS' }
const hobby: HostProvider = { name: 'Hobby', url: 'https://hobby.dev', price: '$10', backend: 'any', type: 'VPS' }

// Listed string-first, the way the old text comparison would order them.
const listed = [hobby, vultr]

test('ascending price sorts $2.5 before $10', () => {
  expect(comparePlans(vultr, hobby, 'price', 'ascending')).toBeLessThan(0)
  expect([...listed].sort((a, b) => comparePlans(a, b, 'price', 'ascending')).map(plan => plan.price)).toEqual(['$2.5', '$10'])
})

test('descending price reverses the numeric order', () => {
  expect(comparePlans(hobby, vultr, 'price', 'descending')).toBeLessThan(0)
  expect([...listed].sort((a, b) => comparePlans(a, b, 'price', 'descending')).map(plan => plan.price)).toEqual(['$10', '$2.5'])
})
