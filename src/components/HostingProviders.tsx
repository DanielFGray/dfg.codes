'use client'
import { useMemo, useState } from 'react'
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  type SortDescriptor,
  type SortDirection,
} from 'react-aria-components'
import clsx from 'clsx'

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 11.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

type HostProvider = {
  name: string
  url: `https://${string}`
  price: `$${number}`
  backend: 'none' | 'serverless' | 'any'
  type: 'managed' | 'VPS'
}

const backendPlans: Array<HostProvider> = [
  { name: 'CloudFlare', url: 'https://cloudflare.com', price: '$0', backend: 'serverless', type: 'managed' },
  { name: 'DigitalOcean', url: 'https://digitalocean.com', price: '$5', backend: 'any', type: 'VPS' },
  { name: 'Fly.io', url: 'https://fly.io', price: '$0', backend: 'any', type: 'managed' },
  { name: 'GitHub Pages', url: 'https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site', price: '$0', backend: 'none', type: 'managed' },
  { name: 'GitLab Pages', url: 'https://about.gitlab.com/blog/2016/04/07/gitlab-pages-setup/', price: '$0', backend: 'none', type: 'managed' },
  { name: 'Linode', url: 'https://linode.com', price: '$5', backend: 'any', type: 'VPS' },
  { name: 'Netlify', url: 'https://netlify.com', price: '$0', backend: 'serverless', type: 'managed' },
  { name: 'Render', url: 'https://render.com', price: '$0', backend: 'any', type: 'managed' },
  { name: 'Vercel', url: 'https://vercel.app', price: '$0', backend: 'serverless', type: 'managed' },
  { name: 'Vultr', url: 'https://vultr.com', price: '$2.5', backend: 'any', type: 'VPS' },
]

type ColumnKey = Exclude<keyof HostProvider, 'url'>

const columns: ReadonlyArray<ColumnKey> = ['name', 'type', 'backend', 'price']

const columnLabels: Record<ColumnKey, string> = {
  name: 'platform',
  type: 'Type',
  backend: 'supported backends',
  price: 'cheapest plans',
}

// A price like '$2.5' sorts by its number, so $2.5 lands before $10.
const priceNumber = (price: HostProvider['price']) => Number(price.slice(1))

function comparePlans(a: HostProvider, b: HostProvider, column: ColumnKey, direction: SortDirection): number {
  const sign = direction === 'descending' ? -1 : 1
  const order = column === 'price' ? priceNumber(a.price) - priceNumber(b.price) : a[column].localeCompare(b[column])
  return sign * order
}

export default function BackendHosting() {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: 'name', direction: 'ascending' })
  const column = columns.find(id => id === sortDescriptor.column) ?? 'name'
  const sortedPlans = useMemo(
    () => [...backendPlans].sort((a, b) => comparePlans(a, b, column, sortDescriptor.direction ?? 'ascending')),
    [column, sortDescriptor.direction],
  )
  return (
    <Table aria-label="Backend hosting providers" sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor}>
      <TableHeader>
        {columns.map(id => (
          <Column key={id} id={id} isRowHeader={id === 'name'} allowsSorting
            className={({ isFocusVisible }) => clsx('cursor-pointer select-none', isFocusVisible && 'rounded outline-2 outline-offset-2 outline-secondary-600')}
          >
            {({ sortDirection }) => (
              <span className="inline-flex items-center gap-2">
                {columnLabels[id]}
                {sortDirection && (
                  <span aria-hidden="true">
                    {sortDirection === 'ascending' ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                  </span>
                )}
              </span>
            )}
          </Column>
        ))}
      </TableHeader>
      <TableBody items={sortedPlans}>
        {item => (
          <Row id={item.name} columns={columns}>
            {columnKey => (
              <Cell>
                {columnKey === 'name' ? <a href={item.url}>{item.name}</a> : item[columnKey as ColumnKey]}
              </Cell>
            )}
          </Row>
        )}
      </TableBody>
    </Table>
  )
}
