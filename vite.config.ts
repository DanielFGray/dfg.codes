import { defineConfig, loadEnv, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import mdx from "@mdx-js/rollup";
import { remarkCodeHike, recmaCodeHike } from "codehike/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { remarkReadingTime } from "./src/plugins/remark-reading-time";
import { alphaTabAssets } from "gigbag.js/vite";
import { articleMeta } from "./src/plugins/article-meta";
import { applyCrossOriginHeaders } from "./server/cross-origin";
import path from "path";

const chConfig = {
  components: { code: "Code" },
  syntaxHighlighting: {
    theme: "github-from-css",
  },
};

// WebContainers requires crossOriginIsolated (SharedArrayBuffer).
// COOP: same-origin on all pages (harmless — only affects popups, not iframes).
// COEP: credentialless on all pages (allows cross-origin resources).
//       require-corp on /node-preview* (stricter, needed by WebContainers).
// The parent page MUST have COEP for child iframes to be crossOriginIsolated.
// Build node-preview-entry.ts as a separate chunk so the static
// node-preview.html in public/ can reference the bundled JS.
function nodePreviewEntry(): Plugin {
  const publicPath = "/node-preview-entry.js";
  let command: "build" | "serve" = "serve";
  let isSsr = false;
  return {
    name: "node-preview-entry",
    configResolved(config) {
      command = config.command;
      isSsr = Boolean(config.build?.ssr);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.url?.split("?")[0] ?? "") !== publicPath) {
          next();
          return;
        }

        const transformed = await server.transformRequest("/src/node-preview-entry.ts");
        if (!transformed) {
          res.statusCode = 404;
          res.end();
          return;
        }

        res.setHeader("Content-Type", "application/javascript");
        res.end(transformed.code);
      });
    },
    buildStart() {
      if (command !== "build" || isSsr) return;
      this.emitFile({
        type: "chunk",
        id: "src/node-preview-entry.ts",
        fileName: publicPath.slice(1),
      });
    },
  };
}

function crossOriginIsolation(): Plugin {
  return {
    name: "cross-origin-isolation",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        applyCrossOriginHeaders((name, value) => res.setHeader(name, value), req.url);
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const discussionApiPort = env.DISCUSSION_API_PORT ?? "3001";
  const appPort = Number(env.PORT || "3000");

  return {
    server: {
      port: appPort,
      strictPort: true,
      hmr: {
        overlay: false, // Disable error overlay to prevent hydration mismatch
      },
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${discussionApiPort}`,
          changeOrigin: false,
          secure: false,
          xfwd: true,
        },
      },
    },
    plugins: [
      tailwindcss(),
      crossOriginIsolation(),
      nodePreviewEntry(),
      articleMeta(),
      mdx({
        remarkPlugins: [
          remarkFrontmatter,
          remarkMdxFrontmatter,
          remarkReadingTime,
          [remarkCodeHike, chConfig],
        ],
        recmaPlugins: [[recmaCodeHike, chConfig]],
      }),
      reactRouter(),
      alphaTabAssets(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "~": path.resolve(__dirname, "./src"),
      },
    },
  };
});
