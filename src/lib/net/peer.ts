import type { Mon } from "../types";

/**
 * Thin wrapper around PeerJS for room-code based P2P sessions.
 * The free public PeerJS cloud broker is only used for the handshake;
 * battle/trade traffic flows directly between browsers over WebRTC.
 */

import type { BattleAction } from "../game/battle";

export type NetMsg =
  | { type: "hello"; name: string }
  | { type: "mode"; mode: "battle" | "trade" }
  | { type: "team"; mons: Mon[] }
  | { type: "seed"; seed: number }
  | { type: "action"; turn: number; act: BattleAction }
  | { type: "replace"; side: "host" | "guest"; idx: number }
  | { type: "trade-offer"; mon: Mon }
  | { type: "trade-confirm" }
  | { type: "surrender" }
  | { type: "bye" };

type Handler = (msg: NetMsg) => void;

const PREFIX = "pokeverse-room-";

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class NetRoom {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private peer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private conn: any = null;
  isHost = false;
  code = "";
  private handlers = new Set<Handler>();
  private statusCb: (s: "open" | "connected" | "closed" | "error", err?: string) => void;

  constructor(statusCb: NetRoom["statusCb"]) {
    this.statusCb = statusCb;
  }

  async host(): Promise<string> {
    const { default: Peer } = await import("peerjs");
    this.isHost = true;
    this.code = randomCode();
    this.peer = new Peer(PREFIX + this.code);
    return new Promise((resolve, reject) => {
      this.peer.on("open", () => {
        this.statusCb("open");
        resolve(this.code);
      });
      this.peer.on("error", (e: Error & { type?: string }) => {
        // id collision → retry once with a new code
        if (e.type === "unavailable-id") {
          this.code = randomCode();
          this.peer.destroy();
          void this.host().then(resolve, reject);
          return;
        }
        this.statusCb("error", e.message);
        reject(e);
      });
      this.peer.on("connection", (conn: unknown) => {
        this.attach(conn);
      });
    });
  }

  async join(code: string): Promise<void> {
    const { default: Peer } = await import("peerjs");
    this.isHost = false;
    this.code = code.trim().toUpperCase();
    this.peer = new Peer();
    return new Promise((resolve, reject) => {
      // settle-once guard: the 12s timer, conn events and peer errors race,
      // and a promise must not reject after it already resolved
      let settled = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const fail = (e: Error) => { if (!settled) { settled = true; reject(e); } };
      this.peer.on("open", () => {
        const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
        const timer = setTimeout(() => {
          if (!this.conn) { this.statusCb("error", "timeout"); fail(new Error("timeout")); }
        }, 12000);
        conn.on("open", () => {
          clearTimeout(timer);
          this.attach(conn);
          ok();
        });
        conn.on("error", (e: Error) => { clearTimeout(timer); this.statusCb("error", e.message); fail(e); });
      });
      this.peer.on("error", (e: Error) => { this.statusCb("error", e.message); fail(e); });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private attach(conn: any) {
    this.conn = conn;
    conn.on("data", (data: unknown) => {
      for (const h of this.handlers) h(data as NetMsg);
    });
    conn.on("close", () => this.statusCb("closed"));
    conn.on("error", (e: Error) => this.statusCb("error", e.message));
    if (conn.open) this.statusCb("connected");
    else conn.on("open", () => this.statusCb("connected"));
  }

  send(msg: NetMsg) {
    this.conn?.send(msg);
  }

  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  close() {
    try { this.conn?.close(); this.peer?.destroy(); } catch {}
    this.conn = null;
    this.peer = null;
  }
}
