import type { ClearPresenceMessage, PlaybackUpdateMessage } from "@youtube-discord-presence/shared";
import { browserApi } from "./browser";

let lastKey = "";
let lastSentAt = 0;
let lastUrl = location.href;
const boundVideos = new WeakSet<HTMLVideoElement>();

const observer = new MutationObserver(() => {
  bindVideos();
  if (lastUrl !== location.href) {
    lastUrl = location.href;
    sendClear("navigation");
    scheduleUpdate(250);
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("beforeunload", () => sendClear("tab_closed"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleUpdate(0);
});

setInterval(() => scheduleUpdate(0), 15000);
bindVideos();
scheduleUpdate(250);

function bindVideos(): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
  if (videos.length === 0) {
    setTimeout(bindVideos, 500);
    return;
  }
  for (const video of videos) {
    if (boundVideos.has(video)) continue;
    boundVideos.add(video);
    for (const event of ["play", "pause", "ended", "timeupdate", "durationchange", "seeked"]) {
      video.addEventListener(event, () => scheduleUpdate(event === "timeupdate" ? 1000 : 0));
    }
  }
}

function scheduleUpdate(delay: number): void {
  window.setTimeout(sendPlaybackState, delay);
}

function sendPlaybackState(): void {
  const video = getVideo();
  const videoId = getVideoId();
  if (!video || !videoId) {
    sendClear("no_active_playback");
    return;
  }

  if (video.paused || video.ended) {
    sendClear(video.ended ? "ended" : "paused");
    return;
  }

  const title = getTitle();
  const currentTime = Math.max(0, video.currentTime || 0);
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
  const isLive = duration == null || video.duration === Infinity;
  const key = `${videoId}:${Math.floor(currentTime / 5)}:${title}`;
  const now = Date.now();
  if (key === lastKey && now - lastSentAt < 10000) return;
  lastKey = key;
  lastSentAt = now;

  const message: PlaybackUpdateMessage = {
    type: "playback_update",
    source: "youtube",
    videoId,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    title,
    channel: getChannel(),
    channelAvatarUrl: getChannelAvatarUrl(),
    currentTime,
    duration,
    isLive,
    updatedAt: now
  };
  browserApi.runtime.sendMessage(message);
}

function sendClear(reason: ClearPresenceMessage["reason"]): void {
  lastKey = "";
  const message: ClearPresenceMessage = { type: "clear_presence", reason, updatedAt: Date.now() };
  browserApi.runtime.sendMessage(message);
}

function getVideo(): HTMLVideoElement | undefined {
  return document.querySelector<HTMLVideoElement>("video.html5-main-video") ?? document.querySelector<HTMLVideoElement>("video") ?? undefined;
}

function getVideoId(): string | undefined {
  const url = new URL(location.href);
  const id = url.searchParams.get("v");
  if (id) return id;
  const shortMatch = url.pathname.match(/^\/shorts\/([^/?]+)/);
  return shortMatch?.[1];
}

function getTitle(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content;
  const heading = document.querySelector<HTMLElement>("h1 yt-formatted-string")?.innerText;
  return (heading || meta || document.title.replace(/ - YouTube$/, "") || "YouTube video").trim();
}

function getChannel(): string | undefined {
  const owner = document.querySelector<HTMLElement>("#owner #channel-name a")?.innerText;
  const meta = document.querySelector<HTMLMetaElement>('link[itemprop="name"]')?.content;
  return (owner || meta || "").trim() || undefined;
}

function getChannelAvatarUrl(): string | undefined {
  const image = document.querySelector<HTMLImageElement>("#owner #avatar img")
    ?? document.querySelector<HTMLImageElement>("ytd-video-owner-renderer #avatar img")
    ?? document.querySelector<HTMLImageElement>("#upload-info img");
  const src = image?.currentSrc || image?.src;
  if (!src) return undefined;
  try {
    return new URL(src, location.href).toString();
  } catch {
    return undefined;
  }
}
