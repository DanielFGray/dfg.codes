export type UsesItem = {
  title: string;
  body: string;
  /** Links the title, when the thing has a home page. */
  href?: string;
};

export type UsesGroup = { title: string; items: readonly UsesItem[] };

export const uses: readonly UsesGroup[] = [
  {
    title: "Development tools",
    items: [
      {
        title: "Linux",
        body: "I picked up using Linux in 2011, Ubuntu 11.04 Natty Narwhal was my first distro, I then started the never ending quest of distro-hopping. I've spent at least a couple months using Ubuntu, Debian, Fedora, CentOS, Gentoo, NetBSD, OpenBSD, and Arch Linux.",
      },
      {
        title: "AwesomeWM",
        href: "https://awesomewm.org/",
        body: "My window manager of choice is awesome, it's pretty awesome to use Lua to script everything.",
      },
      {
        title: "NeoVim",
        body: "The modal style of editing was very interesting to me early in my experiences with Linux, after I rebooted my computer to exit it for the first time.",
      },
      {
        title: "zsh",
        body: "My favorite shell because it's extremely extensible but still [mostly] POSIX.",
      },
    ],
  },
  {
    title: "Computer hardware",
    items: [
      {
        title: '15.6" HP EliteBook 8570p (2012), Intel® Core™ i7-3540M @ 3GHz',
        body: "I got this from eBay for a little over $200, upgraded the RAM to 16GB and put in a 1TB SSD, and also found a matching docking station for it.",
      },
      {
        title: '20" HP W2017d monitor',
        body: "I found this flatscreen monitor on the side of the road.",
      },
      {
        title: "ZSA Moonlander",
        body: "The Moonlander is an amazing keyboard, I love being able to program custom layers of different key layouts and switch between them easily. The per-key LEDs are also really cool to highlight which keys are enabled and color coordinate their functionality. I was fortunate to buy this second-hand from a friend at half-price.",
      },
      {
        title: "Cheap off-brand touchpad",
        body: "Something about using a touchpad with gestures makes me feel like a wizard with special powers. I really like feeling like a wizard with special powers.",
      },
      {
        title: "Chair",
        body: "I sit in a chair, it's a very generic-looking office chair, more comfortable than it looks, probably.",
      },
    ],
  },
  {
    title: "Musical equipment",
    items: [
      {
        title: "7-piece Pearl Masters BRX, Midnight Fade",
        body: 'All the toms are "squared" sizes, 8x8", 10x10", 12x12", 14", 16", and 22x20" kick, sitting on a 3-pc Pearl ICON rack, with a Pearl Steve Ferrone Signature 14x6½" snare.',
      },
      {
        title: "A mix of cymbals",
        body: 'Mostly Zildjian A/K Cymbals, and recently an 18" Saluda Earthworks crash. I\'m planning to try some Meinl soon.',
      },
      {
        title: "Pearl Demon-Drive pedals",
        body: "I wanted to learn how to play double-strokes with my feet, I've loved playing with these pedals ever since.",
      },
      {
        title: "Roland TM-2 module and RT-30K trigger",
        body: "I like to cheat at drums and use electronics to help improve clarity and consistency of my sound, especially when playing metal at over 200bpm. Plus it sounds like a machine gun. Double bass go brrrrrrrrrrrr.",
      },
      {
        title: "Zoom Q8 camera",
        body: "I saw a good deal on this a few months before Covid and bought it on a whim and it helped me start up my online drum lessons really easily, the built in microphones don't distort in loud settings, and being able to record or stream other microphones or mixes is a killer feature for a camera that doubles as a webcam.",
      },
      {
        title: "A mix of microphones",
        body: "Currently I have a few Sennheisers e604s and some Audix D-series, I'm looking forward to expanding my collection.",
      },
      {
        title: "Midas MR18 digital mixer/interface",
        body: "I got this to replace a small 12-channel Behringer Xenyx. I still barely know how to use this thing, and I keep hoping that one day someone will finally explain to me how to properly work the compressor.",
      },
      {
        title: "Roland Octopad",
        body: "One summer I was hired to play by the pool at fancy hotel in an enclosed tent that was not large enough to accommodate a full size drum set as well as a couple other musicians and their gear, and this thing came in great to get me through the gig, as well as many other gigs at small clubs over the years, and been a great addition to my kit with all of the different sounds it has.",
      },
    ],
  },
];
