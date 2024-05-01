import Image from 'next/image'
import Head from 'next/head'

import { Card } from '~/components/Card'
import { SimpleLayout } from '~/components/SimpleLayout'
import { LinkIcon } from '~/components/SocialIcons'

const projects = [
  {
    logo: '',
    name: 'pg-fiddle',
    description: 'a Postgres playground that lets you run queries and see the results in real-time.',
    link: {
      href: 'https://pgfiddle.dfg.rocks',
      label: 'pgfiddle.dfg.rocks'
    },
  },
  {
    logo: '',
    name: 'tailwind-heropatterns',
    description: <>Dynamically generate tiling SVG patterns using Tailwind classes.</>,
    link: {
      href: 'https://github.com/danielfgray/tw-heropatterns',
      label: 'github.com/danielfgray/tw-heropatterns',
    },
  },
  {
    logo: '',
    name: 'doot',
    description: (
      <>
        I built reddit but instead of categorizing posts by a subreddit, posts can have multiple tags.
        It’s built on Remix, Postgres, and Tailwind.
      </>
    ),
    link: {
      href: 'https://doot.dfg.rocks',
      label: 'doot.dfg.rocks'
    },
  },
]

export default function Projects() {
  return (
    <>
      <Head>
        <title>Projects - Daniel Gray</title>
        <meta
          name="description"
          content="Things I’ve made trying to put my dent in the universe."
        />
      </Head>
      <SimpleLayout
        title="Things I’ve made trying to put my dent in the universe."
        intro="I’ve worked on tons of little projects over the years but these are the ones that I’m most proud of. Many of them are open-source, so if you see something that piques your interest, check out the code and contribute if you have ideas for how it can be improved."
      >
        <ul className="grid grid-cols-1 gap-x-12 gap-y-16 lg:grid-cols-3">
          {projects.map(project => (
            <Card as="li" key={project.name}>
              {project.logo && (
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md shadow-primary-800/5 ring-1 ring-primary-900/5 dark:border dark:border-primary-700/50 dark:bg-primary-800 dark:ring-0">
                  <Image src={project.logo} alt="" className="h-8 w-8" unoptimized />
                </div>
              )}
              <h2 className="mt-6 text-base font-semibold text-primary-800 dark:text-primary-100">
                <Card.Link href={project.link.href}>{project.name}</Card.Link>
              </h2>
              <Card.Description>{project.description}</Card.Description>
              <p className="relative z-10 mt-6 flex text-sm font-medium text-primary-800 transition group-hover:text-secondary-500 dark:text-primary-200">
                <LinkIcon className="h-6 w-6 flex-none" />
                <span className="ml-2">{project.link.label}</span>
              </p>
            </Card>
          ))}
        </ul>
      </SimpleLayout>
    </>
  )
}
