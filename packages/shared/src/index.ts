export const NATIVE_HOST_NAME = "com.youtube_discord_presence.native";
export const FIREFOX_EXTENSION_ID = "youtube-discord-presence@example.local";

export type ClearReason = "paused" | "ended" | "tab_closed" | "navigation" | "no_active_playback" | "shutdown";

export interface PlaybackUpdateMessage {
  type: "playback_update";
  source: "youtube";
  tabId?: number;
  videoId: string;
  url: string;
  title: string;
  channel?: string;
  channelAvatarUrl?: string;
  currentTime: number;
  duration?: number;
  isLive?: boolean;
  updatedAt: number;
}

export interface ClearPresenceMessage {
  type: "clear_presence";
  tabId?: number;
  reason: ClearReason;
  updatedAt: number;
}

export interface StatusRequestMessage {
  type: "status_request";
  updatedAt: number;
}

export type ExtensionToHostMessage = PlaybackUpdateMessage | ClearPresenceMessage | StatusRequestMessage;

export interface HostStatusMessage {
  type: "host_status";
  nativeHost: "connected";
  discord: "connected" | "disconnected";
  activeVideoId?: string;
  error?: string;
  updatedAt: number;
}

export interface HostErrorMessage {
  type: "host_error";
  code: string;
  message: string;
  updatedAt: number;
}

export type HostToExtensionMessage = HostStatusMessage | HostErrorMessage;

export function validateExtensionMessage(value: unknown): ExtensionToHostMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Message must be an object with a type.");
  }

  if (value.type === "playback_update") {
    requireString(value.source, "source");
    if (value.source !== "youtube") throw new Error("source must be youtube.");
    const videoId = requireString(value.videoId, "videoId").trim();
    const url = requireString(value.url, "url");
    const title = requireString(value.title, "title").trim();
    const currentTime = requireFiniteNumber(value.currentTime, "currentTime");
    const updatedAt = requireFiniteNumber(value.updatedAt, "updatedAt");
    const duration = optionalFiniteNumber(value.duration, "duration");
    assertYouTubeUrl(url);
    if (!videoId) throw new Error("videoId is required.");
    if (!title) throw new Error("title is required.");
    return {
      type: "playback_update",
      source: "youtube",
      tabId: optionalInteger(value.tabId, "tabId"),
      videoId,
      url,
      title,
      channel: optionalString(value.channel, "channel"),
      channelAvatarUrl: optionalHttpUrl(value.channelAvatarUrl, "channelAvatarUrl"),
      currentTime: Math.max(0, currentTime),
      duration: duration == null ? undefined : Math.max(0, duration),
      isLive: typeof value.isLive === "boolean" ? value.isLive : undefined,
      updatedAt
    };
  }

  if (value.type === "clear_presence") {
    const reason = requireString(value.reason, "reason") as ClearReason;
    if (!["paused", "ended", "tab_closed", "navigation", "no_active_playback", "shutdown"].includes(reason)) {
      throw new Error(`Unsupported clear reason: ${reason}`);
    }
    return {
      type: "clear_presence",
      tabId: optionalInteger(value.tabId, "tabId"),
      reason,
      updatedAt: requireFiniteNumber(value.updatedAt, "updatedAt")
    };
  }

  if (value.type === "status_request") {
    return { type: "status_request", updatedAt: requireFiniteNumber(value.updatedAt, "updatedAt") };
  }

  throw new Error(`Unknown message type: ${value.type}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  return requireString(value, field);
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a finite number.`);
  return value;
}

function optionalFiniteNumber(value: unknown, field: string): number | undefined {
  if (value == null) return undefined;
  return requireFiniteNumber(value, field);
}

function optionalInteger(value: unknown, field: string): number | undefined {
  if (value == null) return undefined;
  const numberValue = requireFiniteNumber(value, field);
  if (!Number.isInteger(numberValue)) throw new Error(`${field} must be an integer.`);
  return numberValue;
}

function optionalHttpUrl(value: unknown, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  const stringValue = requireString(value, field);
  let url: URL;
  try {
    url = new URL(stringValue);
  } catch {
    throw new Error(`${field} must be a valid URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${field} must be an HTTP(S) URL.`);
  }
  return url.toString();
}

function assertYouTubeUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("url must be a valid URL.");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    throw new Error("url must be a YouTube HTTPS URL.");
  }
}
