import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hostName = "com.youtube_discord_presence.native";
const extensionId = "youtube-discord-presence@example.local";
const manifestPath = resolve(repoRoot, "packages/native-host/dist/native-host-manifest.json");
const hostEntry = resolve(repoRoot, "packages/native-host/dist/index.js");
const hostLauncher = resolve(repoRoot, "packages/native-host/dist/youtube-discord-presence-native.bat");
const configPath = resolve(repoRoot, "packages/native-host/dist/config.json");

if (process.platform !== "win32") {
  throw new Error("This installer only supports Windows v1.");
}

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(
  hostLauncher,
  `@echo off\r\n"${process.execPath}" "${hostEntry}"\r\n`
);
try {
  await writeFile(
    configPath,
    `${JSON.stringify({ discordClientId: process.env.DISCORD_CLIENT_ID ?? "" }, null, 2)}\n`,
    { flag: "wx" }
  );
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
}
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      name: hostName,
      description: "YouTube Discord Rich Presence native host",
      path: hostLauncher,
      type: "stdio",
      allowed_extensions: [extensionId]
    },
    null,
    2
  )}\n`
);

execFileSync("reg", [
  "add",
  `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${hostName}`,
  "/ve",
  "/t",
  "REG_SZ",
  "/d",
  manifestPath,
  "/f"
], { stdio: "inherit" });

console.log(`Registered ${hostName}`);
console.log(manifestPath);
