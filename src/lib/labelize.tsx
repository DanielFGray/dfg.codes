export function labelize(
  things: Record<string, string | number>,
  {
    type = 'unit',
    lang = 'en',
  }:
    | undefined
    | {
        type?: Intl.ListFormatType
        lang?: string
      } = {},
) {
  return new Intl.ListFormat(lang, { style: 'short', type }).format(
    Object.entries(things)
      .filter(([_, n]) => n && n != '0')
      .map(([key, n]) => `${n} ${key}${n != '1' ? 's' : ''}`),
  )
}
