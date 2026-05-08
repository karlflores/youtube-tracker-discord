import { randomUUID } from "node:crypto";
import net from "node:net";
import type { PlaybackUpdateMessage } from "@youtube-discord-presence/shared";

type DiscordConnectionState = "connected" | "disconnected";

interface DiscordRpcFrame {
  cmd?: string;
  evt?: string;
  nonce?: string;
  data?: unknown;
}

export interface DiscordActivity {
  name?: string;
  type: 3;
  details: string;
  details_url?: string;
  state?: string;
  state_url?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    large_url?: string;
  };
}

export class DiscordPresenceClient {
  private socket: net.Socket | undefined;
  private clientId: string;
  private state: DiscordConnectionState = "disconnected";
  private buffer = Buffer.alloc(0);
  private pending = new Map<string, (frame: DiscordRpcFrame) => void>();

  constructor(clientId = process.env.DISCORD_CLIENT_ID ?? "") {
    this.clientId = clientId;
  }

  get connectionState(): DiscordConnectionState {
    return this.state;
  }

  async setPlayback(update: PlaybackUpdateMessage): Promise<void> {
    await this.ensureConnected();
    await this.sendCommand("SET_ACTIVITY", {
      pid: process.pid,
      activity: mapPlaybackToActivity(update)
    });
  }

  async clear(): Promise<void> {
    if (this.state !== "connected") return;
    await this.sendCommand("SET_ACTIVITY", {
      pid: process.pid,
      activity: null
    });
  }

  async disconnect(): Promise<void> {
    await this.clear().catch(() => undefined);
    this.socket?.destroy();
    this.socket = undefined;
    this.state = "disconnected";
  }

  private async ensureConnected(): Promise<void> {
    if (!this.clientId) {
      throw new Error("DISCORD_CLIENT_ID is required.");
    }
    if (this.state === "connected" && this.socket && !this.socket.destroyed) return;

    let lastError: unknown;
    for (const path of discordIpcPaths()) {
      try {
        await this.connectAndHandshake(path);
        return;
      } catch (error) {
        lastError = error;
        this.resetConnection();
      }
    }

    const message = lastError instanceof Error ? lastError.message : "Could not connect to Discord IPC.";
    throw new Error(`Discord RPC handshake failed. ${message}`);
  }

  private async connectAndHandshake(path: string): Promise<void> {
    const socket = await connectDiscordSocket(path);
    this.socket = socket;
    this.state = "disconnected";
    socket.on("data", (chunk) => this.handleData(chunk));
    socket.on("close", () => {
      this.state = "disconnected";
      this.socket = undefined;
      for (const resolve of this.pending.values()) resolve({ evt: "DISCONNECTED" });
      this.pending.clear();
    });

    const ready = this.waitForReady(path);
    writeDiscordFrame(socket, 0, { v: 1, client_id: this.clientId });
    await ready;
    this.state = "connected";
  }

  private resetConnection(): void {
    this.socket?.destroy();
    this.socket = undefined;
    this.pending.clear();
    this.frameListeners.clear();
    this.buffer = Buffer.alloc(0);
    this.state = "disconnected";
  }

  private async sendCommand(cmd: string, args: unknown): Promise<DiscordRpcFrame> {
    const socket = this.socket;
    if (!socket) throw new Error("Discord socket is not connected.");
    const nonce = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(nonce);
        reject(new Error(`Discord RPC command timed out: ${cmd}`));
      }, 5000);
      this.pending.set(nonce, (frame) => {
        clearTimeout(timeout);
        if (frame.evt === "ERROR") reject(new Error(JSON.stringify(frame.data)));
        else resolve(frame);
      });
      writeDiscordFrame(socket, 1, { cmd, args, nonce });
    });
  }

  private waitForReady(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const listener = (frame: DiscordRpcFrame) => {
        if (frame.evt === "READY") {
          clearTimeout(timeout);
          this.offFrame(listener);
          resolve();
          return;
        }
        if (frame.evt === "ERROR") {
          clearTimeout(timeout);
          this.offFrame(listener);
          reject(new Error(`Discord rejected the RPC handshake on ${path}: ${JSON.stringify(frame.data)}`));
          return;
        }
        if (frame.evt === "DISCONNECTED") {
          clearTimeout(timeout);
          this.offFrame(listener);
          reject(new Error(`Discord IPC disconnected during handshake on ${path}.`));
        }
      };
      const timeout = setTimeout(() => {
        this.offFrame(listener);
        reject(new Error(`Timed out waiting for Discord READY on ${path}.`));
      }, 5000);
      this.onFrame(listener);
    });
  }

  private frameListeners = new Set<(frame: DiscordRpcFrame) => void>();

  private onFrame(listener: (frame: DiscordRpcFrame) => void): void {
    this.frameListeners.add(listener);
  }

  private offFrame(listener: (frame: DiscordRpcFrame) => void): void {
    this.frameListeners.delete(listener);
  }

  private handleData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 8) {
      const op = this.buffer.readInt32LE(0);
      const length = this.buffer.readInt32LE(4);
      if (this.buffer.length < 8 + length) return;
      const body = this.buffer.subarray(8, 8 + length).toString("utf8");
      this.buffer = this.buffer.subarray(8 + length);
      if (op === 3 && this.socket) {
        writeDiscordRawFrame(this.socket, 4, body);
        continue;
      }
      if (op === 1 || op === 0) {
        let frame: DiscordRpcFrame;
        try {
          frame = JSON.parse(body) as DiscordRpcFrame;
        } catch {
          continue;
        }
        if (frame.nonce && this.pending.has(frame.nonce)) {
          const resolve = this.pending.get(frame.nonce);
          this.pending.delete(frame.nonce);
          resolve?.(frame);
        }
        for (const listener of this.frameListeners) listener(frame);
      }
    }
  }
}

export function mapPlaybackToActivity(update: PlaybackUpdateMessage): DiscordActivity {
  const now = Date.now();
  const currentMs = Math.max(0, Math.floor(update.currentTime * 1000));
  const durationMs = update.duration && Number.isFinite(update.duration) ? Math.floor(update.duration * 1000) : undefined;
  const start = now - currentMs;
  const end = durationMs && durationMs > currentMs && !update.isLive ? start + durationMs : undefined;

  return {
    name: "YouTube",
    type: 3,
    details: truncate(update.title, 128),
    details_url: update.url,
    state: update.channel ? truncate(update.channel, 128) : undefined,
    state_url: update.url,
    timestamps: { start, end },
    assets: update.channelAvatarUrl
      ? {
          large_image: update.channelAvatarUrl,
          large_text: update.channel ? truncate(update.channel, 128) : "YouTube channel",
          large_url: update.url
        }
      : undefined
  };
}

function writeDiscordFrame(socket: net.Socket, op: number, payload: unknown): void {
  writeDiscordRawFrame(socket, op, JSON.stringify(payload));
}

function writeDiscordRawFrame(socket: net.Socket, op: number, payload: string): void {
  const body = Buffer.from(payload, "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(body.length, 4);
  socket.write(Buffer.concat([header, body]));
}

function discordIpcPaths(): string[] {
  return Array.from({ length: 10 }, (_, index) => discordIpcPath(index));
}

function connectDiscordSocket(path: string): Promise<net.Socket> {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection(path);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function discordIpcPath(index: number): string {
  if (process.platform === "win32") return `\\\\?\\pipe\\discord-ipc-${index}`;
  const base = process.env.XDG_RUNTIME_DIR ?? process.env.TMPDIR ?? process.env.TMP ?? process.env.TEMP ?? `/tmp`;
  return `${base.replace(/\/$/, "")}/discord-ipc-${index}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
