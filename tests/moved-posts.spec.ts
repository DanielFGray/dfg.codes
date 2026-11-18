import { expect, test } from "@playwright/test";

const COURSE_URL = "https://dfg.rocks/courses/b923f9a1-ae77-4daa-b434-67a06a8435a9";

// The two music posts became a course on dfg.rocks; their old URLs must answer a permanent redirect.
for (const slug of ["beginning-drums", "rudimental-permutations"]) {
  test(`/articles/${slug} answers 301 to the dfg.rocks course`, async ({ request }) => {
    const response = await request.get(`/articles/${slug}`, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()["location"]).toBe(COURSE_URL);
  });
}
