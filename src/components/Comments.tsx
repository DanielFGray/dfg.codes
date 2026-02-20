import React, { useState, useRef, useCallback, forwardRef } from 'react'
import ago from 's-ago'
import { useLocation } from 'react-router'
import {
  useSignIn,
  useAuth,
  useCreateComment,
  useLogout,
  useDeleteComment,
  useCommentFetcher,
  type Comment as TComment,
} from '@/lib/comments'
import { type Provider } from '@supabase/supabase-js'
import clsx from 'clsx'
import { StarPost } from '@/components/StarThisPost'

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  )
}

function ReplyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

const providers = [
  // { provider: 'twitter', label: 'Twitter' },
  { provider: 'github', label: 'GitHub' },
] as const

function SignInForm({ signIn }: { signIn: (provider: Provider) => void }) {
  return (
    <div className="flex flex-row justify-center gap-2">
      {providers.map(({ provider }) => (
        <button
          key={provider}
          className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          onClick={() => signIn(provider)}
        >
          sign in with {provider}
        </button>
      ))}
    </div>
  )
}

export function CommentSection() {
  const [replyId, setReplyId] = useState<null | number>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const session = useAuth()
  const signin = useSignIn()
  const pathname = useLocation().pathname
  const slug = pathname.slice(pathname.lastIndexOf('/') + 1)
  const { data: comments, error, status } = useCommentFetcher({ slug })

  const setReplyWithFocus = useCallback((id: number) => {
    inputRef.current?.focus()
    setReplyId(id)
  }, [])

  const signInMutation = useCallback((provider: Provider) => {
    signin.mutate({ provider, options: { redirectTo: `/article/${slug}` } })
  }, [])

  return (
    <article className="mt-8 flex-col gap-2 border-t border-primary-200 pt-8 text-primary-900 dark:border-primary-700 dark:text-primary-200">
      <h2 id="comment-section" className="sr-only text-center text-xl font-bold">
        Comments
      </h2>
      <div
        className={clsx(
          'flex flex-col-reverse lg:flex-row',
          session ? 'justify-between' : 'justify-evenly',
        )}
      >
        <div className={clsx('flex flex-col justify-around', session && 'flex-grow')}>
          {session ? (
            <CommentForm
              ref={inputRef}
              slug={slug}
              avatarUrl={session.user?.user_metadata.avatar_url}
              clearReplyId={() => setReplyId(null)}
              replyId={replyId}
            />
          ) : (
            <SignInForm signIn={signInMutation} />
          )}
        </div>
        <div className="text-center">
          <StarPost slug={slug} />
        </div>
      </div>
      <ul className="-m-1">
        <CommentList
          status={status}
          error={error}
          replyId={replyId}
          setReplyId={setReplyWithFocus}
          sessionUserId={session?.user.id ?? null}
          comments={comments}
          slug={slug}
        />
      </ul>
    </article>
  )
}

export function CommentList({
  comments,
  replyId,
  status,
  error,
  setReplyId,
  sessionUserId,
  slug,
}: {
  comments: undefined | null | Array<TComment>
  replyId: null | number
  status: 'error' | 'success' | 'pending'
  error: unknown
  setReplyId: (replyId: number) => void
  sessionUserId: null | string
  slug: string
}): React.JSX.Element | null {
  if (status === 'pending') {
    return <li className="text-center italic">Loading...</li>
  }
  if (error || status === 'error' || (comments && !Array.isArray(comments))) {
    console.log('comments are not an array: ', error || comments)
    return <li className="text-center italic">There was an error fetching comments</li>
  }
  if (comments == null) return null
  if (comments.length === 0)
    return <li className="pt-8 text-center italic lg:pt-0">No comments yet</li>

  return (
    <>
      {comments.map(c => (
        <CommentCard
          key={c.comment_id}
          replyId={replyId}
          setReplyId={setReplyId}
          sessionUserId={sessionUserId}
          comment={c}
          slug={slug}
        />
      ))}
    </>
  )
}

export function Comment({
  commentId,
  body,
  replyId,
  user,
  date,
  sessionUserId,
  setReplyId,
  deleteComment,
}: {
  commentId: number
  body: string
  replyId: number | null
  user: { avatar_url: string; username: string; user_id: string }
  date: Date
  sessionUserId: null | string
  setReplyId(a: number): void
  deleteComment: { isPending: boolean; isSuccess: boolean; mutate(id: number): void }
}): React.JSX.Element {
  return (
    <div
      className={clsx(
        'group rounded border-2 border-transparent p-1 transition-all duration-500',
        commentId < 0 || deleteComment.isPending || deleteComment.isSuccess
          ? 'opacity-50'
          : 'opacity-100',
        commentId === replyId && 'border-primary-300 dark:border-primary-600',
      )}
    >
      <div className="flex flex-row gap-4 pr-2">
        <Avatar avatar_url={user.avatar_url} />
        <div className="flex flex-col justify-center text-primary-700 dark:text-primary-300">
          <a href={`https://github.com/${user.username}`} className="font-medium tracking-wide">
            {user.username}
          </a>
          <time className="cursor-help font-extralight tracking-tight">
            <a title={date.toLocaleString()}>{ago(date)}</a>
          </time>
        </div>
        {sessionUserId && commentId > 0 && (
          <div className="ml-auto flex flex-row gap-2 lg:opacity-0 lg:group-hover:opacity-100">
            {sessionUserId === user.user_id && (
              <button
                onClick={ev => {
                  if (ev.shiftKey || confirm('Are you sure you want to delete your comment?')) {
                    deleteComment.mutate(commentId)
                  }
                }}
              >
                <TrashIcon
                  className="h-4 w-4 text-primary-400 hover:text-red-600 dark:hover:text-red-400"
                  aria-hidden="true"
                />
              </button>
            )}
            <button onClick={() => setReplyId(commentId)}>
              <ReplyIcon
                className="h-4 w-4 text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </div>
      <div className="prose-p:primary-800 prose max-w-none whitespace-pre-wrap pt-2 text-primary-700 dark:prose-invert dark:text-primary-200 dark:prose-p:text-primary-100 ">
        {body}
      </div>
    </div>
  )
}

export function CommentCard({
  depth = 0,
  sessionUserId,
  replyId,
  setReplyId,
  slug,
  comment: { comment_id: commentId, user, created_at, body, children },
}: {
  comment: TComment
  slug: string
  depth?: number
  sessionUserId: string | null
  replyId: number | null
  setReplyId: (id: number) => void
}) {
  const date = new Date(created_at)
  const deleteComment = useDeleteComment(slug)

  return (
    <li
      key={commentId}
      id={`comment_${commentId}`}
      className={clsx('mt-4 rounded-l-lg', depth > 0 && 'ml-4')}
    >
      <section>
        <Comment
          commentId={commentId}
          user={user}
          body={body}
          sessionUserId={sessionUserId}
          replyId={replyId}
          setReplyId={setReplyId}
          date={date}
          deleteComment={deleteComment}
        />
        {children.length > 0 && (
          <ul>
            {children.map(c => (
              <CommentCard
                key={c.comment_id}
                comment={c}
                depth={depth + 1}
                replyId={replyId}
                setReplyId={setReplyId}
                sessionUserId={sessionUserId}
                slug={slug}
              />
            ))}
          </ul>
        )}
      </section>
    </li>
  )
}

const CommentForm = forwardRef(function CommentForm(
  {
    avatarUrl,
    replyId,
    slug,
    clearReplyId,
  }: {
    avatarUrl: string
    replyId: null | number
    slug: string
    clearReplyId: () => void
  },
  inputRef: React.ForwardedRef<HTMLTextAreaElement>,
) {
  const formref = useRef<HTMLFormElement | null>(null)
  const newcomment = useCreateComment()
  const logout = useLogout()

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    try {
      const formData = new FormData(ev.currentTarget)
      const values = Object.fromEntries(formData.entries())
      if (typeof values.comment !== 'string' || typeof slug !== 'string') return
      newcomment.mutate(
        {
          slug,
          body: values.comment.trim().replace(/\n\n+/, '\n\n'),
          parent_id: replyId,
        },
        {
          onSuccess() {
            formref.current?.reset()
          },
        },
      )
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <form ref={formref} onReset={clearReplyId} onSubmit={handleSubmit}>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <Avatar avatar_url={avatarUrl} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="border-b border-primary-200 focus-within:border-primary-600 dark:border-primary-700">
            <label htmlFor="comment" className="text-xs font-light text-primary-500">
              {replyId ? `responding to #${replyId}:` : 'add your comment:'}
            </label>
            <textarea
              rows={3}
              ref={inputRef}
              name="comment"
              id="comment"
              className="block w-full resize-none border-0 border-b border-transparent bg-transparent p-0 pb-2 focus:border-primary-600 focus:ring-0 disabled:opacity-50 dark:text-primary-200 sm:text-sm"
              placeholder="Say something nice!"
              defaultValue=""
              disabled={newcomment.isPending}
            />
          </div>
          <div className="flex justify-between pt-2">
            <div className="flex items-center space-x-2">
              <div className="flow-root">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 dark:ring-offset-primary-800"
                  disabled={newcomment.isPending}
                >
                  {newcomment.isPending ? 'sending...' : 'post'}
                </button>
              </div>
              <div className="flow-root">
                <button
                  type="reset"
                  onClick={() => formref.current?.reset()}
                  className="inline-flex items-center rounded-md border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-primary-700 shadow-sm outline outline-1 outline-primary-200 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:text-white dark:outline-primary-700 dark:ring-offset-primary-800 dark:hover:bg-primary-700"
                >
                  clear
                </button>
              </div>
            </div>
            <div className="flex-shrink-0">
              <button
                type="reset"
                onClick={() => {
                  if (confirm('Are you sure you want to log out?')) {
                    logout.mutate()
                  }
                }}
                className="ml-auto inline-flex items-center rounded-md border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-primary-700 shadow-sm outline outline-1 outline-red-200 hover:bg-red-600 hover:text-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:text-white dark:outline-red-900 dark:ring-offset-primary-800 dark:hover:outline-red-500"
              >
                log out
              </button>
            </div>
          </div>
        </div>
      </div>
      {replyId && <input type="hidden" name="parent_id" value={replyId} />}
    </form>
  )
})

export function Avatar({ avatar_url }: { avatar_url: string }) {
  return (
    <span className="relative inline-block">
      <img src={avatar_url} className="h-10 w-10 rounded-md" alt="" />
      <span className="absolute bottom-0 right-0 block translate-x-1/4 translate-y-1/4 transform rounded-full">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 496 512"
          className="block h-5 w-5 rounded-full bg-primary-50 fill-current text-primary-900 dark:bg-primary-900 dark:text-primary-50"
        >
          <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
        </svg>
      </span>
    </span>
  )
}
