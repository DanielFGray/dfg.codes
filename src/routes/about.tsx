import { Container } from '@/components/Container'
import { SocialLinks, SocialLink } from '@/components/SocialIcons'

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M6 5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6Zm.245 2.187a.75.75 0 0 0-.99 1.126l6.25 5.5a.75.75 0 0 0 .99 0l6.25-5.5a.75.75 0 0 0-.99-1.126L12 12.251 6.245 7.187Z"
      />
    </svg>
  )
}

export default function About() {
  return (
    <Container className="mt-16 sm:mt-32">
      <div className="grid grid-cols-1 gap-y-16 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-y-12">
        <div className="lg:pl-20">
          <div className="max-w-xs px-2.5 lg:max-w-none">
            <img
              src="/portrait.jpg"
              alt=""
              className="aspect-square -rotate-3 rounded-2xl bg-primary-100 object-cover dark:bg-primary-800"
            />
          </div>
        </div>
        <div className="lg:order-first lg:row-span-2">
          <h1 className="text-4xl font-bold tracking-tight text-primary-800 dark:text-primary-100 sm:text-5xl">
            hello world!
          </h1>
          <div className="prose mt-6 space-y-7 text-base text-primary-600 dark:prose-invert dark:text-primary-400">
            <p>
              I was born in the late 80s in the UK, my parents both worked aircraft industry, and in
              the mid-90s their jobs brought us to the US.
            </p>
            <p>
              I started learning web development towards the late &lsquo;90s, writing HTML in
              Windows Notepad, I remember building my first web pages about my favorite Pokémon.
            </p>
            <p>
              I started becoming more interested in music and started learning drums and guitar
              around 11 years old, teaching myself to read guitar tabs and later drum notation after
              playing by ear for a few years.
            </p>
            <p>
              In my early teens I started experimenting with Visual Basic 6, Shockwave/Flash, and
              then later PHP.
            </p>
            <p>
              In my mid/late teens I started focusing more on learning more about web standards that
              were being established like CSS and JavaScript.
            </p>
            <p>
              In 2011 I started using Linux, and found NodeJS soon after. I tried Angular and the
              MEAN stack for a little while, but shifted my focus to ReactJS in 2015.
            </p>
            <p>
              In 2018 I started to invest more time in learning PostgreSQL and have come to really
              enjoy the power of relational databases and the declarative nature of SQL.
            </p>
          </div>
        </div>
        <div className="lg:pl-20">
          <ul className="space-y-4">
            <SocialLinks />
            <SocialLink
              href="mailto:dfg@dfg.rocks"
              icon={MailIcon}
              className="border-t border-primary-100 pt-4 dark:border-primary-700/40"
            >
              dfg@dfg.rocks
            </SocialLink>
          </ul>
        </div>
      </div>
    </Container>
  )
}
