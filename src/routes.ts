import {
  type RouteConfig,
  route,
  index,
  layout,
} from "@react-router/dev/routes";

export default [
  // Layout wrapper for all routes
  layout("./layouts/main.tsx", [
    index("./routes/home.tsx"),
    route("articles", "./routes/articles.tsx"),
    route("articles/:slug", "./routes/article.tsx"),
    route("about", "./routes/about.tsx"),
    route("projects", "./routes/projects.tsx"),
    route("uses", "./routes/uses.tsx"),
  ]),
] satisfies RouteConfig;
