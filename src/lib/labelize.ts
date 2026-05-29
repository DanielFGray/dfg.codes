type ListFormatType = 'conjunction' | 'disjunction' | 'unit'

export function labelize(
  things: Record<string, string | number>,
  {
    type = 'unit',
    lang = 'en',
  }: {
    type?: ListFormatType
    lang?: string
  } = {},
) {
  const items = Object.entries(things)
    .filter(([_, n]) => n && n != '0')
    .map(([key, n]) => `${n} ${key}${n != '1' ? 's' : ''}`)

  const ListFormat = (
    Intl as typeof Intl & {
      ListFormat?: new (
        locales?: string | string[],
        options?: { style?: 'long' | 'short' | 'narrow'; type?: ListFormatType },
      ) => { format(list: readonly string[]): string }
    }
  ).ListFormat

  return ListFormat ? new ListFormat(lang, { style: 'short', type }).format(items) : items.join(', ')
}
