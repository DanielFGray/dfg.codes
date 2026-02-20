import { Card } from '@/components/Card'
import { SimpleLayout } from '@/components/SimpleLayout'
import { LinkIcon } from '@/components/SocialIcons'

const projects = [
  {
    name: 'Postgres Garden',
    description: 'A browser-based IDE that lets you run Postgres queries and see the results in real-time.',
    link: { href: 'https://postgres.garden', label: 'postgres.garden' },
  },
  {
    name: 'pg-sourcerer',
    description: 'A plugin-based codegen tool that generates queries, TypeScript types, validation schemas, http routes, and more from your Postgres database schema.',
    link: { href: 'https://github.com/DanielFGray/pg-sourcerer', label: 'github.com/DanielFGray/pg-sourcerer' },
  },
  {
    name: 'fibrae',
    description: 'Effect-first JSX renderer with reactivity, routing, and SSR.',
    link: { href: 'https://github.com/DanielFGray/fibrae', label: 'github.com/DanielFGray/fibrae' },
  },
]

export default function Projects() {
  return (
    <SimpleLayout
      title="Things I've made trying to put my dent in the universe."
      intro="I've worked on tons of little projects over the years but these are the ones that I'm most proud of. Many of them are open-source, so if you see something that piques your interest, check out the code and contribute if you have ideas for how it can be improved."
    >
      <ul className="grid grid-cols-1 gap-x-12 gap-y-16 lg:grid-cols-3">
        {projects.map(project => (
          <Card as="li" key={project.name}>
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
  )
}
