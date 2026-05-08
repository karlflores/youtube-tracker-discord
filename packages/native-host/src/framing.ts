import { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";

export class NativeMessageReader extends EventEmitter {
  private buffer = Buffer.alloc(0);

  constructor(stream: Readable) {
    super();
    stream.on("data", (chunk: Buffer) => this.push(chunk));
    stream.on("end", () => this.emit("end"));
    stream.on("error", (error) => this.emit("error", error));
  }

  private push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const size = this.buffer.readUInt32LE(0);
      if (this.buffer.length < size + 4) return;
      const body = this.buffer.subarray(4, size + 4);
      this.buffer = this.buffer.subarray(size + 4);
      try {
        this.emit("message", JSON.parse(body.toString("utf8")));
      } catch (error) {
        this.emit("error", error);
      }
    }
  }
}

export function writeNativeMessage(stream: Writable, message: unknown): void {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  stream.write(Buffer.concat([header, body]));
}
