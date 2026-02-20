'use client'
import { useState } from 'react'
import {
  type SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'
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

const backendColumnHelper = createColumnHelper<HostProvider>()

const backendColumns = [
  backendColumnHelper.accessor('name', {
    header: 'platform',
    cell: props => <a href={props.row.original.url}>{props.getValue()}</a>,
  }),
  backendColumnHelper.accessor('type', {}),
  backendColumnHelper.accessor('backend', { header: 'supported backends' }),
  backendColumnHelper.accessor('price', { header: 'cheapest plans' }),
]

export default function BackendHosting() {
  return <SortableTable data={backendPlans} columns={backendColumns} />
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortableTable({ data, columns }: { data: any[]; columns: any[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} colSpan={header.colSpan}>
                {header.isPlaceholder ? null : (
                  <div className="group">
                    <button
                      className={clsx(
                        header.column.getCanSort() && 'cursor-pointer select-none',
                        'ring-1 ring-inset ring-transparent focus-within:ring-2 focus-within:ring-secondary-600',
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: (
                          <span className="ml-2 group-hover:text-secondary-200">
                            <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ),
                        desc: (
                          <span className="ml-2 group-hover:text-secondary-200">
                            <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ),
                      }[header.column.getIsSorted() as string] ?? null}
                    </button>
                  </div>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
