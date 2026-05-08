#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExtensionMessage, type ExtensionToHostMessage, type HostToExtensionMessage } from "@youtube-discord-presence/shared";
import { DiscordPresenceClient } from "./discord.js";
import { NativeMessageReader, writeNativeMessage } from "./framing.js";

const discord = new DiscordPresenceClient(loadDiscordClientId());
let activeVideoId: string | undefined;

const reader = new NativeMessageReader(process.stdin);

reader.on("message", async (raw: unknown) => {
  let message: ExtensionToHostMessage;
  try {
    message = validateExtensionMessage(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown native host error.";
    process.stderr.write(`${message}\n`);
    send({ type: "host_error", code: "invalid_message", message, updatedAt: Date.now() });
    return;
  }

  try {
    await handleMessage(message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown native host error.";
    process.stderr.write(`${errorMessage}\n`);
    send({ type: "host_error", code: "host_failure", message: errorMessage, updatedAt: Date.now() });
  }
});

reader.on("error", (error) => {
  const message = error instanceof Error ? error.message : "Unknown framing error.";
  process.stderr.write(`${message}\n`);
  send({ type: "host_error", code: "framing_error", message, updatedAt: Date.now() });
});

reader.on("end", () => {
  void shutdown();
});

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

async function handleMessage(message: ExtensionToHostMessage): Promise<void> {
  if (message.type === "status_request") {
    sendStatus();
    return;
  }

  if (message.type === "clear_presence") {
    activeVideoId = undefined;
    await discord.clear();
    sendStatus();
    return;
  }

  activeVideoId = message.videoId;
  await discord.setPlayback(message);
  sendStatus();
}

function sendStatus(): void {
  send({
    type: "host_status",
    nativeHost: "connected",
    discord: discord.connectionState,
    activeVideoId,
    updatedAt: Date.now()
  });
}

function send(message: HostToExtensionMessage): void {
  writeNativeMessage(process.stdout, message);
}

async function shutdown(): Promise<void> {
  activeVideoId = undefined;
  await discord.disconnect();
  process.exit(0);
}

function loadDiscordClientId(): string {
  if (process.env.DISCORD_CLIENT_ID) return process.env.DISCORD_CLIENT_ID;
  const configPath = resolve(dirname(fileURLToPath(import.meta.url)), "config.json");
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as { discordClientId?: unknown };
    return typeof config.discordClientId === "string" ? config.discordClientId.trim() : "";
  } catch {
    return "";
  }
}
