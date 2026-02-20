import * as React from 'react'
import debounce from 'lodash/debounce'
import clsx from 'clsx'
import { useGetLikes, useSendLike } from '@/lib/comments'

// left click to increase
// right click to decrease

let MAX_CLICKS = 10

const colors = ['text-yellow-200', 'text-yellow-300', 'text-yellow-400', 'text-yellow-500']

const getColor = (clicks: number) =>
  colors[Math.floor(lerp(clicks, 0, MAX_CLICKS, 0, colors.length - 1))]

export function StarPost({ slug }: { slug: string }) {
  const fetchLikes = useGetLikes(slug)
  const [clicks, setClicks] = React.useState(0)
  const starRef = React.useRef<SVGUseElement>(null)

  React.useEffect(() => {
    if (fetchLikes.data) {
      MAX_CLICKS = fetchLikes.data?.max
    }
  }, [fetchLikes.data?.max])
  React.useEffect(() => {
    if (fetchLikes.data) {
      setClicks(fetchLikes.data.max - fetchLikes.data.available)
    }
  }, [fetchLikes.data])

  const sendLike = useSendLike(slug, {
    onSuccess(data) {
      setClicks(data.max - data.available)
    },
  })

  const sendClicks = React.useRef(debounce((clicks: number) => sendLike.mutate(clicks), 1000))

  function decFill() {
    if (clicks > 0) {
      setClicks(c => {
        sendClicks.current(c - 1)
        return c - 1
      })
    }
  }
  function incFill() {
    if (fetchLikes.data && clicks < fetchLikes.data.max) {
      starRef.current?.classList.add('ping')
      setClicks(c => {
        sendClicks.current(c + 1)
        return c + 1
      })
    }
  }

  return (
    <button
      className="starButton border-0 bg-transparent outline-0 focus:outline-1 focus:outline-primary-500"
      onClick={ev => {
        if (ev.shiftKey) decFill()
        else incFill()
      }}
      onContextMenu={ev => {
        ev.preventDefault()
        decFill()
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="250"
        width="250"
        viewBox="0 0 24 24"
        className={clsx('drop-shadow', getColor(clicks), clicks == MAX_CLICKS && 'spin')}
      >
        <defs>
          <path
            id="starShape"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </defs>
        <g>
          <use
            id="starFill"
            xlinkHref="#starShape"
            fill="currentColor"
            strokeWidth="2"
            className="transition-all duration-300 ease-out"
            style={{
              clipPath: `inset(${100 - lerp(clicks, 0, MAX_CLICKS, 0, 100)}% 0% 0% 0%)`,
            }}
          />
          <use xlinkHref="#starShape" strokeWidth="0.2" fill="none" stroke="currentColor" />
          <use
            ref={starRef}
            xlinkHref="#starShape"
            strokeWidth="0.2"
            fill="none"
            stroke="currentColor"
            onAnimationEnd={() => starRef.current?.classList.remove('ping')}
          />
          <text
            x="50%"
            y="55%"
            fontSize="5"
            textAnchor="middle"
            stroke="black"
            strokeWidth="0.1"
            fontWeight="bold"
            fill="white"
          >
            {fetchLikes.data
              ? fetchLikes.data.total - (fetchLikes.data.max - fetchLikes.data.available) + clicks
              : ''}
            <span className="sr-only"> stars</span>
          </text>
        </g>
      </svg>
    </button>
  )
}

function lerp(
  number: number,
  currentScaleMin: number,
  currentScaleMax: number,
  newScaleMin = 0,
  newScaleMax = 1,
) {
  // normalize the value between 0 and 1
  const standardNormalization = (number - currentScaleMin) / (currentScaleMax - currentScaleMin)
  // transpose that value to the desired scale
  return (newScaleMax - newScaleMin) * standardNormalization + newScaleMin
}
