import { Stack } from "#src/components/stack/Stack.js";
import { personMeta } from "#src/lib/person-meta.js";
import { stackLoader } from "#src/lib/stack.server.js";
import { useLoaderData } from "react-router";

export const meta = () =>
  personMeta({
    title: "Uses - Daniel F. Gray",
    description: "The software, hardware and music gear Daniel F. Gray uses.",
    path: "/uses",
  });

export const loader = stackLoader;

export default function Uses() {
  return <Stack start="/uses" data={useLoaderData<typeof loader>()} />;
}
