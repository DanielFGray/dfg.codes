import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";

export default [
  // The home stack: one page, one route per section. It has its own look, so it sits
  // outside the main layout (no blog header or footer).
  index("./routes/stack/index.tsx"),
  route("about", "./routes/stack/about.tsx"),
  route("projects", "./routes/stack/projects.tsx"),
  route("uses", "./routes/stack/uses.tsx"),
  route("blog", "./routes/stack/blog.tsx"),

  layout("./layouts/main.tsx", [
    route("articles", "./routes/articles.tsx"),
    route("articles/:slug", "./routes/article.tsx"),
  ]),
] satisfies RouteConfig;
