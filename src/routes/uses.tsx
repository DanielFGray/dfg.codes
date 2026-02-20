import { Card } from '@/components/Card'
import { Section } from '@/components/Section'
import { SimpleLayout } from '@/components/SimpleLayout'

function ToolsSection({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  return (
    <Section title={title}>
      <ul className="space-y-16">{children}</ul>
    </Section>
  )
}

function Tool({ title, href, children }: { title: string; href?: string; children?: React.ReactNode }) {
  return (
    <Card as="li">
      <Card.Title as="h3" href={href}>{title}</Card.Title>
      <Card.Description>{children}</Card.Description>
    </Card>
  )
}

export default function Uses() {
  return (
    <SimpleLayout
      title="Software I use, gadgets I love, and other things I recommend."
      intro="I get asked a lot about the things I use to build software, stay productive, or buy to fool myself into thinking I'm being productive when I'm really just procrastinating. Here's a big list of all of my favorite stuff."
    >
      <div className="space-y-20">
        <ToolsSection title="Development tools">
          <Tool title="Linux">
            I picked up using Linux in 2011, Ubuntu 11.04 Natty Narhwal was my first distro, I
            then started the never ending quest of distro-hopping. I&apos;ve spent at least a
            couple months using Ubuntu, Debian, Fedora, CentOS, Gentoo, NetBSD, OpenBSD, and Arch
            Linux.
          </Tool>
          <Tool title="AwesomeWM">
            {'My window manager of choice is '}
            <a
              href="https://awesomewm.org/"
              className="font-bold underline hover:text-black hover:no-underline dark:hover:text-white"
            >
              awesome
            </a>
            , it&apos;s pretty awesome to use Lua to script everything.
          </Tool>
          <Tool title="NeoVim">
            The modal style of editing was very interesting to me early in my experiences with
            Linux, after I rebooted my computer to exit it for the first time.
          </Tool>
          <Tool title="zsh">
            my favorite shell because it&apos;s extremely extensible but still [mostly] POSIX
          </Tool>
        </ToolsSection>
        <ToolsSection title="Computer hardware">
          <Tool title='15.6" HP EliteBook 8570p (2012), Intel® Core™ i7-3540M @ 3GHz'>
            I got this from eBay for a little over $200, upgraded the RAM to 16GB and put in a 1TB
            SSD, and also found a matching docking station for it.
          </Tool>
          <Tool title='20" HP W2017d monitor'>
            I found this flatscreen monitor on the side of the road.
          </Tool>
          <Tool title="ZSA Moonlander">
            The Moonlander is amazing keyboard, I love being able to program custom layers of
            different key layouts and switch between them easily. The per-key LEDs are also really
            cool to highlight which keys are enabled and color coordinate their functionality.
            <br />I was fortunate to buy this second-hand from a friend at half-price.
          </Tool>
          <Tool title="Cheap off-brand touchpad">
            Something about using a touchpad with gestures makes me feel like a wizard with
            special powers. I really like feeling like a wizard with special powers.
          </Tool>
          <Tool title="Chair">
            I sit in a chair, it&apos;s a very a generic-looking office chair, more comfortable
            than it looks, probably.
          </Tool>
        </ToolsSection>
        <ToolsSection title="Musical equipment">
          <Tool title="7-piece Pearl Masters BRX, Midnight Fade">
            All the toms are &quot;squared&quot; sizes, 8x8", 10x10", 12x12", 14", 16", and 22x20"
            kick,
            <br />
            sitting on a 3-pc Pearl ICON rack,
            <br />
            with a Pearl Steve Ferrone Signature 14x6½" snare.
          </Tool>
          <Tool title="A mix of cymbals">
            Mostly Zildjian A/K Cymbals, and recently an 18" Saluda Earthworks crash. I&apos;m
            planning to try some Meinl soon.
          </Tool>
          <Tool title="Pearl Demon-Drive pedals">
            I wanted to learn how to play double-strokes with my feet, I&apos;ve loved playing
            with these pedals ever since.
          </Tool>
          <Tool title="Roland TM-2 module and RT-30K trigger">
            I like to cheat at drums and use electronics to help improve clarity and consistency
            of my sound, especially when playing metal at over 200bpm. Plus it sounds like a
            machine gun. Double bass go brrrrrrrrrrrr.
          </Tool>
          <Tool title="Zoom Q8 camera">
            I saw a good deal on this a few months before Covid and bought it on a whim and it
            helped me start up my online drum lessons really easily, the built in microphones
            don&apos;t distort in loud settings, and being able to record or stream other
            microphones or mixes is a killer feature for a camera that doubles as a webcam.
          </Tool>
          <Tool title="A mix of microphones">
            Currently I have a few Sennheisers e604s and some Audix D-series, I&apos;m looking
            forward to expanding my collection.
          </Tool>
          <Tool title="Midas MR18 digital mixer/interface">
            I got this to replace a small 12-channel Behringer Xenyx. I still barely know how to
            use this thing, and I keep hoping that one day someone will finally explain to me how
            to properly work the compressor.
          </Tool>
          <Tool title="Roland Octopad">
            One summer I was hired to play by the pool at fancy hotel in a an enclosed tent that
            was not large enough to accommadate a full size drum set as well as a couple other
            musicians and their gear, and this thing came in great to get me through the gig, as
            well as many other gigs at small clubs over the years, and been a great addition to my
            kit with all of the different sounds it has.
          </Tool>
        </ToolsSection>
      </div>
    </SimpleLayout>
  )
}
