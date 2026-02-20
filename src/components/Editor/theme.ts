import { EditorView } from 'codemirror'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/**
 * CodeMirror theme driven by CSS custom properties.
 * Light/dark switching happens via the CSS vars — no JS toggle needed.
 */
const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-text)',
  },
  '.cm-content': {
    caretColor: 'var(--editor-cursor)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--editor-cursor)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    {
      backgroundColor: 'var(--editor-selection)',
    },
  '.cm-activeLine': {
    backgroundColor: 'var(--editor-active-line)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-text-muted)',
    border: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line)',
  },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--editor-selection)',
  },
})

const editorHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: tags.bool, color: 'var(--syntax-number)' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: 'var(--syntax-fn)' },
  { tag: tags.variableName, color: 'var(--syntax-variable)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--syntax-type)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--syntax-comment)' },
  { tag: [tags.operator, tags.compareOperator, tags.logicOperator], color: 'var(--syntax-operator)' },
  { tag: [tags.punctuation, tags.bracket, tags.separator], color: 'var(--syntax-punctuation)' },
  { tag: tags.propertyName, color: 'var(--syntax-fn)' },
  { tag: tags.definition(tags.variableName), color: 'var(--syntax-fn)' },
  { tag: tags.atom, color: 'var(--syntax-number)' },
  { tag: tags.null, color: 'var(--editor-text-muted)' },
])

export const editorExtension = [editorTheme, syntaxHighlighting(editorHighlight)]

/**
 * react-inspector theme driven by CSS custom properties.
 * One static object — CSS vars auto-switch for light/dark.
 */
export const inspectorTheme = {
  BASE_FONT_FAMILY: 'inherit',
  BASE_FONT_SIZE: '12px',
  BASE_LINE_HEIGHT: '1.4',
  BASE_BACKGROUND_COLOR: 'transparent',
  BASE_COLOR: 'var(--editor-text)',

  OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 5,

  OBJECT_NAME_COLOR: 'var(--syntax-variable)',
  OBJECT_VALUE_STRING_COLOR: 'var(--syntax-string)',
  OBJECT_VALUE_NUMBER_COLOR: 'var(--syntax-number)',
  OBJECT_VALUE_BOOLEAN_COLOR: 'var(--syntax-number)',
  OBJECT_VALUE_NULL_COLOR: 'var(--editor-text-muted)',
  OBJECT_VALUE_UNDEFINED_COLOR: 'var(--editor-text-muted)',
  OBJECT_VALUE_REGEXP_COLOR: 'var(--syntax-variable)',
  OBJECT_VALUE_SYMBOL_COLOR: 'var(--syntax-variable)',
  OBJECT_VALUE_FUNCTION_PREFIX_COLOR: 'var(--syntax-fn)',

  ARROW_COLOR: 'var(--editor-text-faint)',
  ARROW_MARGIN_RIGHT: 3,
  ARROW_FONT_SIZE: 12,
  ARROW_ANIMATION_DURATION: '0',

  TREENODE_FONT_FAMILY: 'inherit',
  TREENODE_FONT_SIZE: '12px',
  TREENODE_LINE_HEIGHT: '1.4',
  TREENODE_PADDING_LEFT: 12,

  TABLE_BORDER_COLOR: 'var(--editor-border)',
  TABLE_TH_BACKGROUND_COLOR: 'var(--editor-bg-subtle)',
  TABLE_TH_HOVER_COLOR: 'var(--editor-bg-subtle)',
  TABLE_SORT_ICON_COLOR: 'var(--editor-text-faint)',
  TABLE_DATA_BACKGROUND_IMAGE: 'none',
  TABLE_DATA_BACKGROUND_SIZE: '0',

  HTML_TAG_COLOR: 'var(--syntax-keyword)',
  HTML_TAGNAME_COLOR: 'var(--syntax-keyword)',
  HTML_TAGNAME_TEXT_TRANSFORM: 'lowercase',
  HTML_ATTRIBUTE_NAME_COLOR: 'var(--syntax-fn)',
  HTML_ATTRIBUTE_VALUE_COLOR: 'var(--syntax-string)',
  HTML_COMMENT_COLOR: 'var(--syntax-comment)',
  HTML_DOCTYPE_COLOR: 'var(--syntax-comment)',
}
