import { visit } from 'unist-util-visit'
import readingTime from 'reading-time'
import type { Root } from 'mdast'

export function remarkReadingTime() {
  return (tree: Root) => {
    // Extract text from all text nodes
    let textContent = ''
    visit(tree, 'text', (node: { value: string }) => {
      textContent += node.value + ' '
    })

    // Calculate reading time
    const stats = readingTime(textContent)

    // Inject as exports via estree AST
    tree.children.unshift({
      type: 'mdxjsEsm',
      value: '',
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            createExportDeclaration('readingTime', Math.ceil(stats.minutes)),
            createExportDeclaration('wordCount', stats.words),
          ],
        },
      },
    } as unknown as Root['children'][0])
  }
}

function createExportDeclaration(name: string, value: number) {
  return {
    type: 'ExportNamedDeclaration',
    declaration: {
      type: 'VariableDeclaration',
      kind: 'const' as const,
      declarations: [
        {
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name },
          init: { type: 'Literal', value, raw: String(value) },
        },
      ],
    },
    specifiers: [],
    source: null,
  }
}
