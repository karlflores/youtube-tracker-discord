import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await mkdir(dist, { recursive: true });
await esbuild.build({
  entryPoints: {
    background: resolve(root, "src/background.ts"),
    content: resolve(root, "src/content.ts"),
    popup: resolve(root, "src/popup.ts")
  },
  bundle: true,
  format: "iife",
  target: "firefox109",
  outdir: dist,
  sourcemap: true
});

await cp(resolve(root, "public/popup.html"), resolve(dist, "popup.html"));
await cp(resolve(root, "public/popup.css"), resolve(dist, "popup.css"));
await writeFile(
  resolve(dist, "manifest.json"),
  `${JSON.stringify(
    {
      manifest_version: 2,
      name: "YouTube Discord Presence",
      version: "0.1.0",
      description: "Shows the currently playing YouTube video in Discord Rich Presence.",
      browser_specific_settings: {
        gecko: {
          id: "youtube-discord-presence@example.local",
          strict_min_version: "109.0"
        }
      },
      permissions: ["nativeMessaging", "tabs", "*://*.youtube.com/*"],
      background: {
        scripts: ["background.js"],
        persistent: true
      },
      content_scripts: [
        {
          matches: ["*://*.youtube.com/*"],
          js: ["content.js"],
          run_at: "document_idle"
        }
      ],
      browser_action: {
        default_title: "YouTube Discord Presence",
        default_popup: "popup.html"
      }
    },
    null,
    2
  )}\n`
);
