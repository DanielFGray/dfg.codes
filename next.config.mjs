import { remarkCodeHike } from '@code-hike/mdx'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'

// import autolinkHeadings from 'rehype-autolink-headings'
// import slugify from 'rehype-slug'
import theme from 'shiki/themes/dracula.json' assert { type: 'json' }

/** @type {import('next').NextConfig} */

export default {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'export',
  pageExtensions: ['tsx', 'jsx', 'mdx'],
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
  images: {
    unoptimized: true,
  },
  webpack(config, options) {
    config.module.rules.push({
      test: /\.mdx$/,
      use: [
        // The default `babel-loader` used by Next:
        options.defaultLoaders.babel,
        {
          loader: '@mdx-js/loader',
          /** @type {import('@mdx-js/loader').Options} */
          options: {
            // rehypePlugins: [slugify, [autolinkHeadings, { behavior: 'append' }]],
            remarkPlugins: [
              // [remarkMdxFrontmatter, { name: 'meta' }],
              [remarkCodeHike, { theme, showCopyButton: true }],
            ],
          },
        },
      ],
    })
    return config
  },
}
