import { Stack } from "#src/components/stack/Stack.js";
import { personMeta } from "#src/lib/person-meta.js";
import { stackLoader } from "#src/lib/stack.server.js";
import { useLoaderData } from "react-router";

export const meta = () =>
  personMeta({
    title: "Daniel F. Gray",
    description: "Software developer and music teacher based in Houston, Texas.",
    path: "/",
  });

export const loader = stackLoader;

export default function Home() {
  return <Stack start="/" data={useLoaderData<typeof loader>()} />;
}
