// The Oathbound Online wire protocol — the single, isomorphic definition of every message
// that crosses between client and server. Imported by BOTH the browser client and the Node
// server, so it must stay free of three.js, the DOM, and Node APIs (only `zod` is allowed).
// Every message is validated with zod on receipt in both directions: a hostile or buggy peer
// can only ever send well-formed messages, which is the foundation of the server-authoritative
// security model (docs/technical/MMO_ARCHITECTURE.md §7).
//
// M0 scope: just the handshake (hello → welcome) and a latency ping (ping → pong). Later
// phases extend the unions with `input`, `snapshot`, `events`, `cmd`, `chat`, … — additively.

import { z } from 'zod';

/** Bumped on any breaking change to the message shapes. Client & server must agree. */
export const PROTOCOL_VERSION = 1;

// ── Client → Server ────────────────────────────────────────────────────────────────────────

/** First message a client sends: announce protocol version + optional display name. */
export const HelloMessage = z.object({
  t: z.literal('hello'),
  protocol: z.number().int(),
  name: z.string().min(1).max(24).optional(),
});

/** Latency probe: `time` is the client's clock (ms) and is echoed back untouched. */
export const PingMessage = z.object({
  t: z.literal('ping'),
  time: z.number(),
});

export const ClientMessage = z.discriminatedUnion('t', [HelloMessage, PingMessage]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ── Server → Client ──────────────────────────────────────────────────────────────────────

/** Accept a hello: hand the client its player entity id and the world/timing parameters. */
export const WelcomeMessage = z.object({
  t: z.literal('welcome'),
  protocol: z.number().int(),
  entityId: z.number().int(),
  map: z.string(),
  tick: z.number().int(),
  tickHz: z.number(),
  snapshotHz: z.number(),
  players: z.number().int(),
});

/** Answer a ping: echo the client `time` and include the server's current tick. */
export const PongMessage = z.object({
  t: z.literal('pong'),
  time: z.number(),
  serverTick: z.number().int(),
});

/** Reject/inform: a coded error (e.g. bad protocol version, malformed message). */
export const ErrorMessage = z.object({
  t: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

export const ServerMessage = z.discriminatedUnion('t', [WelcomeMessage, PongMessage, ErrorMessage]);
export type ServerMessage = z.infer<typeof ServerMessage>;

// ── (de)serialization helpers ────────────────────────────────────────────────────────────

/** Serialize any protocol message to a string frame. */
export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export type DecodeResult<T> = { ok: true; msg: T } | { ok: false; error: string };

function decode<T>(schema: z.ZodType<T>, raw: string): DecodeResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  return { ok: true, msg: parsed.data };
}

/** Parse + validate a frame as a client→server message (used by the server). */
export function decodeClientMessage(raw: string): DecodeResult<ClientMessage> {
  return decode(ClientMessage, raw);
}

/** Parse + validate a frame as a server→client message (used by the client). */
export function decodeServerMessage(raw: string): DecodeResult<ServerMessage> {
  return decode(ServerMessage, raw);
}
