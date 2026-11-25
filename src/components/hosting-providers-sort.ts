import type { SortDirection } from 'react-aria-components'

// The hosting table's row shape and column keys, shared by the component and its
// sorting contract.
export type HostProvider = {
  name: string
  url: `https://${string}`
  price: `$${number}`
  backend: 'none' | 'serverless' | 'any'
  type: 'managed' | 'VPS'
}

export type ColumnKey = Exclude<keyof HostProvider, 'url'>

// A price like '$2.5' sorts by its number, so $2.5 lands before $10.
const priceNumber = (price: HostProvider['price']) => Number(price.slice(1))

export function comparePlans(a: HostProvider, b: HostProvider, column: ColumnKey, direction: SortDirection): number {
  const sign = direction === 'descending' ? -1 : 1
  const order = column === 'price' ? priceNumber(a.price) - priceNumber(b.price) : a[column].localeCompare(b[column])
  return sign * order
}
