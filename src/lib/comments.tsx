import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Effect } from "effect";
import { useRef } from "react";
import { DiscussionApi } from "#src/services/discussion-api.js";
import type { Comment, Likes } from "#src/services/discussion.js";

export type { Comment };

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
  ).current;
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const canQueryDiscussionApi = typeof window !== "undefined";

const client = Effect.runSync(
  HttpApiClient.make(DiscussionApi, {
    baseUrl: canQueryDiscussionApi ? window.location.origin : undefined,
  }).pipe(Effect.provide(FetchHttpClient.layer)),
);

export const getGitHubAuthorizationHref = (redirectTo: string) =>
  `/api/auth/github?redirect=${encodeURIComponent(redirectTo)}`;

export function useAuth() {
  return useQuery({
    queryKey: ["discussion", "session"],
    enabled: canQueryDiscussionApi,
    queryFn: () => Effect.runPromise(client.getSession()),
  });
}

export function useCommentStats() {
  return useQuery({
    queryKey: ["discussion", "stats"],
    enabled: canQueryDiscussionApi,
    queryFn: async () => {
      const data = await Effect.runPromise(client.getCommentStats());
      return data.countsBySlug;
    },
    refetchOnMount: true,
    staleTime: 60000,
  });
}

export function useCommentFetcher({ slug }: { slug: string }) {
  return useQuery({
    queryKey: ["discussion", "comments", slug],
    enabled: canQueryDiscussionApi,
    queryFn: () => Effect.runPromise(client.getThreadedComments({ query: { slug } })),
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["discussion", "new-comment"],
    mutationFn: (values: { slug: string; body: string; parent_id: number | null }) =>
      Effect.runPromise(client.createComment({ payload: values })),
    onSuccess(_data, variables) {
      queryClient.invalidateQueries({ queryKey: ["discussion", "comments", variables.slug] });
      queryClient.invalidateQueries({ queryKey: ["discussion", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["discussion", "top-posts"] });
    },
  });
}

export function useDeleteComment(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["discussion", "delete-comment", slug],
    mutationFn: (comment_id: number) =>
      Effect.runPromise(client.deleteComment({ params: { commentId: comment_id } })),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["discussion", "comments", slug] });
      queryClient.invalidateQueries({ queryKey: ["discussion", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["discussion", "top-posts"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["discussion", "logout"],
    mutationFn: () => Effect.runPromise(client.signOut()),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["discussion", "session"] });
      queryClient.invalidateQueries({ queryKey: ["discussion", "comments"] });
    },
  });
}

export function useTopPosts() {
  return useQuery({
    queryKey: ["discussion", "top-posts"],
    enabled: canQueryDiscussionApi,
    queryFn: () => Effect.runPromise(client.getTopPosts()),
    refetchOnMount: true,
    staleTime: 60000,
  });
}

export function useGetLikes(slug: string) {
  return useQuery({
    queryKey: ["discussion", "likes", slug],
    enabled: canQueryDiscussionApi,
    queryFn: () => Effect.runPromise(client.getLikes({ query: { slug } })),
  });
}

export function useSendLike(
  slug: string,
  { onSuccess }: { onSuccess?: (likes: Likes) => void } = {},
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["discussion", "like-post", slug],
    mutationFn: (clicks: number) =>
      Effect.runPromise(
        client.sendLike({
          payload: {
            post: slug,
            requested_votes: clicks,
          },
        }),
      ),
    onSuccess(data) {
      queryClient.setQueryData<Likes>(["discussion", "likes", slug], data);
      onSuccess?.(data);
    },
  });
}
