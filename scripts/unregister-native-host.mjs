import { execFileSync } from "node:child_process";

const hostName = "com.youtube_discord_presence.native";

if (process.platform !== "win32") {
  throw new Error("This uninstaller only supports Windows v1.");
}

execFileSync("reg", [
  "delete",
  `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${hostName}`,
  "/f"
], { stdio: "inherit" });

console.log(`Unregistered ${hostName}`);
