import { AnnotationHandler, InnerLine } from 'codehike/code'

const defaultColor = 'rgb(14 165 233)' // sky-500

export const bg: AnnotationHandler = {
  name: 'bg',
  Line: ({ annotation, ...props }) => {
    const color = annotation?.query || defaultColor
    return (
      <InnerLine
        merge={props}
        style={{
          backgroundColor: `rgb(from ${color} r g b / 0.1)`,
        }}
      />
    )
  },
}
