import { AnnotationHandler, InnerToken, InnerPre, CustomPreProps, getPreRef } from 'codehike/code'
import {
  TokenTransitionsSnapshot,
  calculateTransitions,
  getStartingSnapshot,
} from 'codehike/utils/token-transitions'
import React from 'react'

const MAX_TRANSITION_DURATION = 900

export class SmoothPre extends React.Component<CustomPreProps> {
  ref: React.RefObject<HTMLPreElement>

  constructor(props: CustomPreProps) {
    super(props)
    this.ref = getPreRef(this.props)
  }

  render() {
    return <InnerPre merge={this.props} style={{ position: 'relative' }} />
  }

  getSnapshotBeforeUpdate() {
    return getStartingSnapshot(this.ref.current!)
  }

  componentDidUpdate(_prevProps: never, _prevState: never, snapshot: TokenTransitionsSnapshot) {
    const transitions = calculateTransitions(this.ref.current!, snapshot)
    transitions.forEach(({ element, keyframes, options }) => {
      const { translateX, translateY, ...kf } = keyframes as Record<string, unknown>
      if (translateX && translateY) {
        const tx = translateX as [number, number]
        const ty = translateY as [number, number]
        ;(kf as Record<string, unknown>).translate = [
          `${tx[0]}px ${ty[0]}px`,
          `${tx[1]}px ${ty[1]}px`,
        ]
      }
      element.animate(kf as unknown as Keyframe[], {
        duration: options.duration * MAX_TRANSITION_DURATION,
        delay: options.delay * MAX_TRANSITION_DURATION,
        easing: options.easing,
        fill: 'both',
      })
    })
  }
}

export const tokenTransitions: AnnotationHandler = {
  name: 'token-transitions',
  PreWithRef: SmoothPre,
  Token: props => <InnerToken merge={props} style={{ display: 'inline-block' }} />,
}
