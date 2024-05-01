import clsx from 'clsx'
import { SocialLinks, ArrowDownIcon, BriefcaseIcon, MailIcon } from '~/components/SocialIcons'
import { Button } from '~/components/Button'
import { TagLink, ArticleCard } from '~/components/Articles'
import { Container } from '~/components/Container'
import { generateRssFeed } from '~/lib/generateRssFeed'
import { getAllArticles, tagList } from '~/lib/getAllArticles'
import Link from 'next/link'
import { useTopPosts } from '~/lib/comments'
import { useMemo, useState } from 'react'
import Head from 'next/head'
import { Metadata } from 'next'

export async function getStaticProps() {
  await generateRssFeed()
  const articles = await getAllArticles()

  return {
    props: {
      tagList: tagList(articles),
      articles: articles.map(({ content, ...meta }) => meta),
    },
  }
}

type StaticProps<T extends (...arg0: any[]) => any> = Awaited<ReturnType<T>>['props']

const metadata: Metadata = {
  title: 'Daniel Gray',
  description: 'Software developer and drummer based in Houston, Texas.',
}

export default function Home(props: StaticProps<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
      </Head>
      <Topper />
      <Container className="py-12">
        <div className="text-xl font-semibold text-primary-700 dark:text-primary-200">
          things I write about:
        </div>
        <div className="pt-4">
          <ul className="flex flex-wrap items-baseline gap-1 text-xs">
            {props.tagList.map(t => (
              <TagLink key={t}>{t}</TagLink>
            ))}
          </ul>
        </div>
      </Container>
      <ArticleList {...props} />
    </>
  )
}

function Topper() {
  return (
    <Container className="mt-9">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-primary-800 dark:text-primary-100 sm:text-5xl">
          {metadata.title}
        </h1>
        <p className="text-base text-primary-600 dark:text-primary-400">
          {metadata.description}
        </p>
        <ul className="flex gap-0.5">
          <SocialLinks labels={false} />
        </ul>
      </div>
    </Container>
  )
}

function ArticleList({ articles }: StaticProps<typeof getStaticProps>) {
  const { data: stats } = useTopPosts()
  const [order, setOrder] = useState<'latest' | 'popular'>('latest')
  const maxList = 6
  const topPosts = useMemo(() => {
    if (! stats) return []

    return stats
      .map(s => ({ ...articles.find(a => a.slug === s.slug), ...s }))
      .sort((a, b) => {
        const aa = Math.ceil(a.comment_count * 5 + a.total_votes)
        const bb = Math.ceil(b.comment_count * 5 + b.total_votes)
        return bb - aa
      })
      .slice(0, maxList)
  }, [articles, stats])
  const filter = order === 'popular' ? topPosts : articles
  return (
    <Container>
      <div className="flex justify-around pb-12">
        <button
          className={clsx(
            'block rounded-full p-2 px-3 text-sm font-medium shadow-lg ring-1',
            'bg-primary-50/90 text-primary-800 shadow-secondary-800/5 ring-secondary-900/5 dark:bg-primary-800/90 dark:text-primary-200 dark:ring-primary-700',
            'hover:text-secondary-700 dark:hover:text-secondary-300 hover:ring-2 hover:ring-secondary-700',
          )}
          onClick={() => setOrder(order === 'latest' ? 'popular' : 'latest')}
        >
          {order} things I&apos;ve written:
        </button>
      </div>
      <div className="flex flex-col space-y-16">
        {filter.slice(0, maxList).map(article => (
          <ArticleCard key={article.slug} {...article} />
        ))}
      </div>

      <div className="mt-16 w-full flex-1">
        <Button as={Link} href="/articles" color="secondary" className="w-full rounded-xl p-4">
          Read more
        </Button>
      </div>
    </Container>
  )
}

function Newsletter() {
  return (
    <form
      action="/thank-you"
      className="rounded-2xl border border-primary-200 bg-primary-50 p-6 dark:border-primary-700/40 dark:bg-primary-900/50"
    >
      <h2 className="flex text-sm font-semibold text-primary-900 dark:text-primary-100">
        <MailIcon className="h-6 w-6 flex-none" />
        <span className="ml-3">Stay up to date</span>
      </h2>
      <p className="mt-2 text-sm text-primary-600 dark:text-primary-400">
        Get notified when I publish something new, and unsubscribe at any time.
      </p>
      <div className="mt-6 flex">
        <input
          type="email"
          placeholder="Email address"
          aria-label="Email address"
          required
          className="min-w-0 flex-auto appearance-none rounded-md border border-primary-900/10 bg-primary-50 px-3 py-[calc(theme(spacing.2)-1px)] shadow-md shadow-primary-800/5 placeholder:text-primary-400 focus:border-secondary-500 focus:outline-none focus:ring-4 focus:ring-secondary-500/10 dark:border-primary-700 dark:bg-primary-700/[0.15] dark:text-primary-200 dark:placeholder:text-primary-500 dark:focus:border-secondary-400 dark:focus:ring-secondary-400/10 sm:text-sm"
        />
        <Button type="submit" color="secondary" className="ml-4 flex-none">
          Join
        </Button>
      </div>
    </form>
  )
}

const shortResumeList: Array<{
  company: string
  title: string
  logo?: any
  start: string | { label: string; dateTime: string }
  end: string | { label: string; dateTime: string }
}> = [
  {
    company: 'Planetaria',
    title: 'CEO',
    // logo: logoPlanetaria,
    start: '2019',
    end: {
      label: 'Present',
      dateTime: `${new Date().getFullYear()}`,
    },
  },
  {
    company: 'Airbnb',
    title: 'Product Designer',
    // logo: logoAirbnb,
    start: '2014',
    end: '2019',
  },
  {
    company: 'Facebook',
    title: 'iOS Software Engineer',
    // logo: logoFacebook,
    start: '2011',
    end: '2014',
  },
]

function Resume() {
  return (
    <div className="rounded-2xl border border-primary-200 bg-primary-50 p-6 dark:border-primary-700/40 dark:bg-primary-900/50">
      <h2 className="flex text-sm font-semibold text-primary-900 dark:text-primary-100">
        <BriefcaseIcon className="h-6 w-6 flex-none" />
        <span className="ml-3">Work</span>
      </h2>
      <ol className="mt-6 space-y-4">
        {shortResumeList.map((role, roleIndex) => (
          <li key={roleIndex} className="flex gap-4">
            {role.logo && (
              <div className="relative mt-1 flex h-10 w-10 flex-none items-center justify-center rounded-full shadow-md shadow-primary-800/5 ring-1 ring-primary-900/5 dark:border dark:border-primary-700/50 dark:bg-primary-800 dark:ring-0">
                <img src={role.logo} alt="" className="h-7 w-7" />
              </div>
            )}
            <dl className="flex flex-auto flex-wrap gap-x-2">
              <dt className="sr-only">Company</dt>
              <dd className="w-full flex-none text-sm font-medium text-primary-900 dark:text-primary-100">
                {role.company}
              </dd>
              <dt className="sr-only">Role</dt>
              <dd className="text-xs text-primary-500 dark:text-primary-400">{role.title}</dd>
              <dt className="sr-only">Date</dt>
              <dd
                className="ml-auto text-xs text-primary-400 dark:text-primary-500"
                aria-label={`${
                  typeof role.start === 'string' ? role.start : role.start.label
                } until ${typeof role.end === 'string' ? role.end : role.end.label}`}
              >
                <time dateTime={typeof role.start === 'string' ? role.start : role.start.dateTime}>
                  {typeof role.start === 'string' ? role.start : role.start.label}
                </time>{' '}
                <span aria-hidden="true">—</span>{' '}
                <time dateTime={typeof role.end === 'string' ? role.end : role.end.dateTime}>
                  {typeof role.end === 'string' ? role.end : role.end.label}
                </time>
              </dd>
            </dl>
          </li>
        ))}
      </ol>
      <Button as={Link} href="#" color="secondary" className="group mt-6 w-full">
        Download CV
        <ArrowDownIcon className="h-4 w-4 stroke-primary-400 transition group-active:stroke-primary-600 dark:group-hover:stroke-primary-50 dark:group-active:stroke-primary-50" />
      </Button>
    </div>
  )
}

function Photos() {
  return (
    <div className="mt-16 sm:mt-20">
      <div className="-my-4 flex justify-center gap-5 overflow-hidden py-4 sm:gap-8">
        {[].map((image, imageIndex) => (
          <div
            key={image}
            className={clsx(
              'relative aspect-[9/10] w-44 flex-none overflow-hidden rounded-xl bg-primary-100 dark:bg-primary-800 sm:w-72 sm:rounded-2xl',
              imageIndex % 2 === 0 ? '-rotate-2' : 'rotate-2',
            )}
          >
            <img
              src={image}
              alt=""
              sizes="(min-width: 640px) 18rem, 11rem"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
