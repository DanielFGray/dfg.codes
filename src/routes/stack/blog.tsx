import { Stack } from "#src/components/stack/Stack.js";
import { personMeta } from "#src/lib/person-meta.js";
import { stackLoader } from "#src/lib/stack.server.js";
import { useLoaderData } from "react-router";

export const meta = () =>
  personMeta({
    title: "Blog - Daniel F. Gray",
    description: "Writing on software development, and a few posts on music, by Daniel F. Gray.",
    path: "/blog",
  });

export const loader = stackLoader;

export default function Blog() {
  return <Stack start="/blog" data={useLoaderData<typeof loader>()} />;
}
