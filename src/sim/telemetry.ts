// Telemetry counters: a balance/health dashboard fed by sim events, used to validate
// the SOLO_BALANCE_RULES bands during playtests and to surface obvious regressions.
// Pure: subscribes to the event bus; advances its clock via a system.

import type { World, Entity, System } from '../core/ecs/world';
import {
  CombatEvent,
  type DamageEvent,
  type DeathEvent,
  type PlayerDiedEvent,
  type XpGainedEvent,
  type GoldGainedEvent,
  type LootPickedEvent,
  type ItemSalvagedEvent,
} from './combat/events';

export interface TelemetrySnapshot {
  sessionSeconds: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  xpGained: number;
  goldGained: number;
  itemsLooted: number;
  itemsSalvaged: number;
  /** Mean time from first hit to kill (s). */
  avgTtk: number;
  /** Mean gap between a kill and re-engaging (s). */
  avgDowntime: number;
}

export class Telemetry {
  sessionSeconds = 0;
  kills = 0;
  deaths = 0;
  damageDealt = 0;
  damageTaken = 0;
  xpGained = 0;
  goldGained = 0;
  itemsLooted = 0;
  itemsSalvaged = 0;

  private readonly firstHit = new Map<Entity, number>();
  private ttkTotal = 0;
  private ttkCount = 0;
  private lastKillAt = -1;
  private downtimeTotal = 0;
  private downtimeCount = 0;
  private readonly unsubs: (() => void)[] = [];

  /** Subscribe to sim events for the given player. */
  attach(world: World, player: Entity): void {
    const bus = world.events;
    this.unsubs.push(
      bus.on<DamageEvent>(CombatEvent.Damage, (ev) => {
        if (ev.source === player) {
          this.damageDealt += ev.amount;
          if (!this.firstHit.has(ev.target)) this.firstHit.set(ev.target, this.sessionSeconds);
          if (this.lastKillAt >= 0) {
            this.downtimeTotal += this.sessionSeconds - this.lastKillAt;
            this.downtimeCount += 1;
            this.lastKillAt = -1;
          }
        }
        if (ev.target === player) this.damageTaken += ev.amount;
      }),
      bus.on<DeathEvent>(CombatEvent.Death, (ev) => {
        if (ev.killer !== player) return;
        this.kills += 1;
        const fh = this.firstHit.get(ev.entity);
        if (fh !== undefined) {
          this.ttkTotal += this.sessionSeconds - fh;
          this.ttkCount += 1;
          this.firstHit.delete(ev.entity);
        }
        this.lastKillAt = this.sessionSeconds;
      }),
      bus.on<PlayerDiedEvent>(CombatEvent.PlayerDied, () => {
        this.deaths += 1;
      }),
      bus.on<XpGainedEvent>(CombatEvent.XpGained, (ev) => {
        this.xpGained += ev.amount;
      }),
      bus.on<GoldGainedEvent>(CombatEvent.GoldGained, (ev) => {
        this.goldGained += ev.amount;
      }),
      bus.on<LootPickedEvent>(CombatEvent.LootPicked, () => {
        this.itemsLooted += 1;
      }),
      bus.on<ItemSalvagedEvent>(CombatEvent.ItemSalvaged, () => {
        this.itemsSalvaged += 1;
      }),
    );
  }

  detach(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }

  tick(dt: number): void {
    this.sessionSeconds += dt;
  }

  snapshot(): TelemetrySnapshot {
    return {
      sessionSeconds: this.sessionSeconds,
      kills: this.kills,
      deaths: this.deaths,
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
      xpGained: this.xpGained,
      goldGained: this.goldGained,
      itemsLooted: this.itemsLooted,
      itemsSalvaged: this.itemsSalvaged,
      avgTtk: this.ttkCount ? this.ttkTotal / this.ttkCount : 0,
      avgDowntime: this.downtimeCount ? this.downtimeTotal / this.downtimeCount : 0,
    };
  }
}

/** Advances the telemetry session clock each sim tick. */
export function createTelemetrySystem(telemetry: Telemetry): System {
  return {
    name: 'telemetry',
    update(_world: World, dt: number): void {
      telemetry.tick(dt);
    },
  };
}
