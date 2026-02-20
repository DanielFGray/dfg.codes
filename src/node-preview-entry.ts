import { WebContainer } from '@webcontainer/api'

let wc: WebContainer | null = null
let serverProcess: { kill: () => void } | null = null
let serverReadyUnsub: (() => void) | null = null
let silent = false // suppress relay during warmup

// Serialize operations so warmup and run don't overlap
let opQueue: Promise<void> = Promise.resolve()
function enqueue(fn: () => Promise<void>): Promise<void> {
  opQueue = opQueue.then(fn, fn)
  return opQueue
}

// Relay status/output to parent so it can render the UI
function relay(msg: Record<string, unknown>) {
  window.parent.postMessage(msg, '*')
}

// Strip ANSI escape sequences (colors, cursor movement, etc.)
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(\x07|\x1b\\)/g, '')
}

function setStatus(text: string) {
  if (!silent) relay({ type: 'wc-status', text })
}

function addLine(text: string, lineType: 'stdout' | 'stderr' | 'system' = 'stdout') {
  // Handle \r (carriage return): only keep the last segment, like a real terminal
  const afterCR = text.includes('\r') ? text.split('\r').pop()! : text
  const clean = stripAnsi(afterCR).trim()
  if (!clean) return
  // Skip spinner-only lines (npm progress: \ | / -)
  if (/^[\\|/\-\s]+$/.test(clean)) return
  if (!silent) relay({ type: 'wc-terminal', text: clean, lineType })
}

async function boot(): Promise<WebContainer> {
  if (wc) return wc
  setStatus('Booting WebContainer...')
  addLine('Booting WebContainer...', 'system')
  wc = await WebContainer.boot()
  return wc
}

/**
 * Pre-install common packages so first "Run" click is fast.
 * Runs silently — no status/terminal messages relayed to parent.
 */
async function warmup() {
  return enqueue(async () => {
    silent = true
    try {
      const instance = await boot()

      const basePkg = {
        name: 'sandbox',
        private: true,
        scripts: { dev: 'vite' },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          express: 'latest',
        },
        devDependencies: {
          vite: '^5.0.0',
          '@vitejs/plugin-react': '^4.2.0',
          typescript: '^5.3.0',
        },
      }

      await instance.mount({
        'package.json': { file: { contents: JSON.stringify(basePkg, null, 2) } },
      })

      const install = await instance.spawn('npm', ['install'])
      install.output.pipeTo(new WritableStream({ write() {} }))
      await install.exit

      relay({ type: 'wc-warmed' })
    } finally {
      silent = false
    }
  })
}

/**
 * Remove all files except node_modules and .vite cache (to preserve
 * installed packages and Vite's dep pre-bundling cache).
 */
async function cleanWorkspace(instance: WebContainer) {
  const entries = await instance.fs.readdir('/')
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.npm') continue
    try {
      await instance.fs.rm('/' + entry, { recursive: true })
    } catch {
      /* ignore errors on cleanup */
    }
  }
}

/**
 * Build scaffolding files and start command for each template type.
 */
function getScaffolding(
  template: string,
  userFiles: Record<string, string>,
  extraDeps: Record<string, string>,
): {
  files: Record<string, string>
  startCmd: string[]
  startLabel: string
} {
  // --- Node template: auto-detect deps, run node directly ---
  if (template === 'node') {
    const deps: Record<string, string> = { ...extraDeps }

    for (const code of Object.values(userFiles)) {
      for (const m of code.matchAll(/require\(['"]([^./][^'"]*)['"]\)/g)) {
        const pkg = m[1].split('/')[0]
        if (!deps[pkg]) deps[pkg] = 'latest'
      }
      for (const m of code.matchAll(/from\s+['"]([^./][^'"]*)['"]/g)) {
        const pkg = m[1].split('/')[0]
        if (!deps[pkg]) deps[pkg] = 'latest'
      }
    }

    const entryPath = Object.keys(userFiles).find(f => /\/index\.(js|ts)$/.test(f))
    const entryName = entryPath
      ? entryPath.startsWith('/')
        ? entryPath.slice(1)
        : entryPath
      : 'index.js'

    return {
      files: {
        'package.json': JSON.stringify({ name: 'sandbox', dependencies: deps }, null, 2),
      },
      startCmd: ['node', entryName],
      startLabel: `$ node ${entryName}`,
    }
  }

  // --- React / React-TS template: Vite + React ---
  if (template === 'react' || template === 'react-ts') {
    const isTs = template === 'react-ts'
    const ext = isTs ? 'tsx' : 'jsx'

    const appFile = Object.keys(userFiles).find(f =>
      /\/(App|app)\.(js|jsx|ts|tsx)$/.test(f),
    )
    const appBaseName = appFile
      ? (appFile.startsWith('/') ? appFile.slice(1) : appFile).replace(/\.(js|jsx|ts|tsx)$/, '')
      : 'App'

    const deps: Record<string, string> = {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      ...extraDeps,
    }
    const devDeps: Record<string, string> = {
      vite: '^5.0.0',
      '@vitejs/plugin-react': '^4.2.0',
      ...(isTs ? { typescript: '^5.3.0' } : {}),
    }

    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react({ include: /\\.(js|jsx|ts|tsx)$/ })],
})`

    const mainFile = `import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './${appBaseName}'

createRoot(document.getElementById('root')).render(<App />)`

    const indexHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body>
  <div id="root"></div>
  <script type="module" src="/main.${ext}"></script>
</body>
</html>`

    return {
      files: {
        'package.json': JSON.stringify(
          {
            name: 'sandbox',
            private: true,
            scripts: { dev: 'vite' },
            dependencies: deps,
            devDependencies: devDeps,
          },
          null,
          2,
        ),
        'vite.config.js': viteConfig,
        'index.html': indexHtml,
        [`main.${ext}`]: mainFile,
      },
      startCmd: ['npm', 'run', 'dev'],
      startLabel: '$ npm run dev',
    }
  }

  // --- Vanilla-TS template: Vite + TypeScript ---
  if (template === 'vanilla-ts') {
    const entryFile = Object.keys(userFiles).find(f => /\/index\.(ts|js)$/.test(f))
    const entrySrc = entryFile
      ? '/' + (entryFile.startsWith('/') ? entryFile.slice(1) : entryFile)
      : '/index.ts'

    const indexHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body>
  <div id="app"></div>
  <script type="module" src="${entrySrc}"></script>
</body>
</html>`

    return {
      files: {
        'package.json': JSON.stringify(
          {
            name: 'sandbox',
            private: true,
            scripts: { dev: 'vite' },
            devDependencies: { vite: '^5.0.0', typescript: '^5.3.0', ...extraDeps },
          },
          null,
          2,
        ),
        'index.html': indexHtml,
      },
      startCmd: ['npm', 'run', 'dev'],
      startLabel: '$ npm run dev',
    }
  }

  // --- Fallback: vanilla JS with Vite ---
  const entryFile = Object.keys(userFiles).find(f => /\/index\.(js|ts)$/.test(f)) || '/index.js'
  const entrySrc = entryFile.startsWith('/') ? entryFile : '/' + entryFile

  const indexHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body>
  <div id="app"></div>
  <script type="module" src="${entrySrc}"></script>
</body>
</html>`

  return {
    files: {
      'package.json': JSON.stringify(
        {
          name: 'sandbox',
          private: true,
          scripts: { dev: 'vite' },
          devDependencies: { vite: '^5.0.0', ...extraDeps },
        },
        null,
        2,
      ),
      'index.html': indexHtml,
    },
    startCmd: ['npm', 'run', 'dev'],
    startLabel: '$ npm run dev',
  }
}

async function run(
  userFiles: Record<string, string>,
  template: string = 'node',
  dependencies: Record<string, string> = {},
) {
  return enqueue(async () => {
    silent = false
    try {
      const instance = await boot()

      // Kill previous server process
      if (serverProcess) {
        serverProcess.kill()
        serverProcess = null
      }

      // Unsubscribe previous server-ready listener
      if (serverReadyUnsub) {
        serverReadyUnsub()
        serverReadyUnsub = null
      }

      // Clean old files (keep node_modules + .vite cache for speed)
      setStatus('Preparing...')
      addLine('Cleaning workspace...', 'system')
      await cleanWorkspace(instance)

      // Get scaffolding for this template
      const scaffolding = getScaffolding(template, userFiles, dependencies)

      // Build filesystem tree: user files first, then scaffolding overwrites
      const tree: Record<string, { file: { contents: string } }> = {}

      // For React templates, rename .js → .jsx so Vite handles JSX syntax
      const isReact = template === 'react' || template === 'react-ts'

      for (const [filePath, code] of Object.entries(userFiles)) {
        let name = filePath.startsWith('/') ? filePath.slice(1) : filePath
        if (isReact && name.endsWith('.js')) {
          name = name.replace(/\.js$/, '.jsx')
        }
        tree[name] = { file: { contents: code } }
      }

      for (const [path, contents] of Object.entries(scaffolding.files)) {
        tree[path] = { file: { contents } }
      }

      setStatus('Mounting files...')
      addLine('Mounting files...', 'system')
      await instance.mount(tree)

      // Install dependencies (fast if warmup pre-installed common packages)
      setStatus('Installing dependencies...')
      addLine('$ npm install', 'system')
      const install = await instance.spawn('npm', ['install'])
      install.output.pipeTo(
        new WritableStream({
          write(data) {
            addLine(data)
          },
        }),
      )

      const exitCode = await install.exit
      if (exitCode !== 0) {
        addLine(`npm install failed (exit ${exitCode})`, 'stderr')
        setStatus('Install failed')
        return
      }

      // Listen for server ready
      serverReadyUnsub = instance.on('server-ready', (_port: number, url: string) => {
        addLine(`Server ready at ${url}`, 'system')
        relay({ type: 'wc-server-ready', url })
      })

      // Start the dev server / node process
      setStatus('Starting...')
      addLine(scaffolding.startLabel, 'system')
      serverProcess = await instance.spawn(scaffolding.startCmd[0], scaffolding.startCmd.slice(1))

      serverProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addLine(data)
          },
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLine(`Error: ${msg}`, 'stderr')
      setStatus('Error')
    }
  })
}

// Listen for messages from parent
window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'mount') {
    run(event.data.files, event.data.template, event.data.dependencies)
  } else if (event.data?.type === 'warmup') {
    warmup()
  }
})

// Signal ready to parent
window.parent.postMessage({ type: 'ready' }, '*')
