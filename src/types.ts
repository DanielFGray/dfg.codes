export interface Article {
  slug: string
  title: string
  date: string
  description: string
  words: number
  time: number
  tags: Array<string>
  category: string
  image?: string
}
