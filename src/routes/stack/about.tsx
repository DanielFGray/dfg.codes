import { Stack } from "#src/components/stack/Stack.js";
import { personMeta } from "#src/lib/person-meta.js";
import { stackLoader } from "#src/lib/stack.server.js";
import { useLoaderData } from "react-router";

export const meta = () =>
  personMeta({
    title: "About - Daniel F. Gray",
    description: "Software developer and music teacher based in Houston, Texas.",
    path: "/about",
  });

export const loader = stackLoader;

export default function About() {
  return <Stack start="/about" data={useLoaderData<typeof loader>()} />;
}
