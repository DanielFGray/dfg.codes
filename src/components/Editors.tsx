import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { dracula } from '@codesandbox/sandpack-themes'
import type { SandpackProps } from '@codesandbox/sandpack-react'

export const Sandpack = dynamic(
  () => import('@codesandbox/sandpack-react').then(x => ({ default: x.Sandpack })),
  { suspense: true },
)

const theme = { ...dracula, font: { ...dracula.font, size: '14px' } }

export function Editor(props: SandpackProps & {children: string}) {
  return (
    <Suspense
      fallback={
        <code>
          <pre>{Object.values(props.files ?? props.file)[0] as string}</pre>
        </code>
      }
    >
      <Sandpack
        template={props.template ?? 'vanilla'}
        files={'file' in props ? { 'index.js': props.file.trim() } : props.files}
        theme={theme}
        options={{
          editorWidthPercentage: 60,
          showInlineErrors: true,
          recompileDelay: 200,
          ...props.options,
        }}
      />
    </Suspense>
  )
}

export function EditorWithConsole(props: SandpackProps) {
  return (
    <Suspense
      fallback={
        <code>
          <pre>{Object.values(props.files ?? props.file)[0] as string}</pre>
        </code>
      }
    >
      <Sandpack
        className="not-prose"
        template={props.template ?? 'vanilla'}
        files={'file' in props ? { 'index.js': props.file.trim() } : props.files}
        theme={theme}
        options={{
          layout: 'console',
          editorWidthPercentage: 60,
          showInlineErrors: true,
          recompileDelay: 200,
          ...props.options,
        }}
      />
    </Suspense>
  )
}

export function EditorWithPreview(props: SandpackProps) {
  return (
    <Suspense
      fallback={
        <code>
          <pre>{Object.values(props.files ?? props.file)[0] as string}</pre>
        </code>
      }
    >
      <Sandpack
        {...props}
        template={props.template ?? 'vanilla'}
        files={'file' in props ? { 'index.js': props.file.trim() } : props.files}
        theme={theme}
        options={{
          editorWidthPercentage: 60,
          showInlineErrors: true,
          recompileDelay: 200,
          ...props.options,
        }}
      />
    </Suspense>
  )
}
