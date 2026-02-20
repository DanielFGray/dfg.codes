import { useEffect, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient, type Session, type SignInWithOAuthCredentials } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export interface Comment {
  comment_id: number
  user: {
    username: string
    avatar_url: string
    user_id: string
  }
  body: string
  created_at: string
  children: ReadonlyArray<Comment>
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useRef(
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: 0,
          refetchOnMount: false,
          refetchOnWindowFocus: true,
          staleTime: Infinity,
        },
      },
    }),
  ).current
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
)

export function useAuth(): Session | null {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    try {
      ; (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setSession(session)
      })()
    } catch (e) {
      console.error('error fetching session:', e)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  return session
}

export function useSignIn() {
  return useMutation({
    mutationKey: ['sign_in'],
    mutationFn: async function signIn({
      provider,
      options: { redirectTo, ...options },
    }: SignInWithOAuthCredentials) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          ...options,
          redirectTo: (import.meta.env.VITE_PUBLIC_URL ?? '').concat(redirectTo ?? '/'),
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useCommentStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('comments_stats')
      if (error) throw error
      return data as unknown as Record<string, `${number}`>
    },
    refetchOnMount: true,
    staleTime: 60000,
  })
}

export function useCommentFetcher({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  useEffect(() => {
    const subscription = supabase
      .channel('any')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['comments', slug] })
        queryClient.invalidateQueries({ queryKey: ['recent_comments'] })
        queryClient.invalidateQueries({ queryKey: ['stats'] })
      })
      .subscribe()
    return () => {
      subscription.unsubscribe()
    }
  }, [slug, queryClient])
  return useQuery({
    queryKey: ['comments', slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('threaded_comments', { slug })
      if (error) throw error
      return data
    },
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation(
    {
      mutationKey: ['new_comment'],
      mutationFn: async (values: { slug: string; body: string; parent_id: number | null }) => {
        const { data, error } = await supabase.from('comments').insert(values)
        if (error) throw error
        return data
      },
      async onMutate(variables) {
        const prevState = queryClient.getQueryData<Comment[]>(['comments', variables.slug])
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) throw new Error('not logged in!')
        const user = {
          user_id: session.user.id,
          avatar_url: session.user.user_metadata.avatar_url,
          username: session.user.user_metadata.preferred_username,
          date: new Date(),
        }
        const newState: Comment = {
          comment_id: -1,
          body: variables.body,
          user,
          children: [],
          created_at: new Date().toUTCString(),
        }
        queryClient.setQueryData<Comment[]>(['comments', variables.slug], old =>
          [newState].concat(old ? old : []),
        )
        return { prevState }
      },
      onError(err, newState, context) {
        console.error(err)
        queryClient.setQueryData(['comments', newState.slug], context?.prevState)
      },
    },
  )
}

export function useLogout() {
  return useMutation(
    {
      mutationKey: ['logout'],
      mutationFn: async () => {
        await supabase.auth.signOut()
      },
    }
  )
}

export function useDeleteComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation(
    {
      mutationKey: ['delete_comment'],
      mutationFn: async (comment_id: number) => {
        const { data, error } = await supabase.from('comments').delete().eq('comment_id', comment_id)
        if (error) throw error
        return data
      },
      onSuccess() {
        queryClient.invalidateQueries()
        queryClient.invalidateQueries({ queryKey: ['comments', slug] })
      },
    },
  )
}

interface Likes {
  total: number
  available: number
  max: number
}

interface TopPosts {
  slug: string
  comment_count: number
  total_votes: number
  latest_comment?: {
    comment_id: number
    user: {
      username: string
      avatarUrl: string
    }
    replying_to: {
      username: string
      avatarUrl: string
    }
    slug: string
    body: string
    created_at: string
    updated_at: string
  }
}

export function useTopPosts() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('top_posts')
      if (error) throw error
      return data as TopPosts[]
    },
    refetchOnMount: true,
    staleTime: 60000,
  })
}

export function useGetLikes(slug: string) {
  return useQuery({
    queryKey: ['get_likes', slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_likes', { slug })
      if (error) throw error
      return data as unknown as Likes
    },
  })
}

export function useSendLike(
  slug: string,
  { onSuccess }: { onSuccess?: (likes: Likes) => void } = {},
) {
  const queryClient = useQueryClient()
  return useMutation(
    {
      mutationKey: ['like_post', slug],
      mutationFn: async (clicks: number) => {
        const { data, error } = await supabase.rpc('like_post', {
          post: slug,
          requested_votes: clicks,
        })
        if (error) throw error
        return data as unknown as Likes
      },
      onSuccess(data) {
        queryClient.setQueryData<Likes>(['get_likes', slug], data)
        onSuccess?.(data)
      },
    },
  )
}
