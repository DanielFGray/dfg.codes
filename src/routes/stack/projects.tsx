import { Stack } from "#src/components/stack/Stack.js";
import { personMeta } from "#src/lib/person-meta.js";
import { stackLoader } from "#src/lib/stack.server.js";
import { useLoaderData } from "react-router";

export const meta = () =>
  personMeta({
    title: "Projects - Daniel F. Gray",
    description: "Things Daniel F. Gray has made, and where they are running.",
    path: "/projects",
  });

export const loader = stackLoader;

export default function Projects() {
  return <Stack start="/projects" data={useLoaderData<typeof loader>()} />;
}
