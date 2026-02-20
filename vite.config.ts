import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import mdx from "@mdx-js/rollup";
import { remarkCodeHike, recmaCodeHike } from "codehike/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { remarkReadingTime } from "./src/plugins/remark-reading-time";
import { alphaTab } from "@coderline/alphatab-vite";
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
  return {
    name: "node-preview-entry",
    buildStart() {
      this.emitFile({
        type: "chunk",
        id: "src/node-preview-entry.ts",
        fileName: "node-preview-entry.js",
      });
    },
  };
}

function crossOriginIsolation(): Plugin {
  return {
    name: "cross-origin-isolation",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        // All pages get credentialless (allows cross-origin resources).
        // The node-preview iframe gets require-corp (stricter, needed for Firefox).
        // The parent must also have COEP for child iframes to be crossOriginIsolated.
        if (req.url?.startsWith("/node-preview")) {
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        } else {
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  server: {
    hmr: {
      overlay: false, // Disable error overlay to prevent hydration mismatch
    },
  },
  plugins: [
    tailwindcss(),
    crossOriginIsolation(),
    nodePreviewEntry(),
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
    alphaTab(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
