// Minimal typed event bus. The simulation emits events; rendering/UI/audio/telemetry
// subscribe. Keeping events out of the sim core is what lets UI/render stay decoupled.
// See docs/technical/ARCHITECTURE_PLAN.md

export type Handler<T> = (payload: T) => void;

export class EventBus {
  private map = new Map<string, Set<Handler<unknown>>>();

  on<T>(type: string, handler: Handler<T>): () => void {
    let set = this.map.get(type);
    if (!set) {
      set = new Set();
      this.map.set(type, set);
    }
    set.add(handler as Handler<unknown>);
    return () => {
      this.map.get(type)?.delete(handler as Handler<unknown>);
    };
  }

  emit<T>(type: string, payload: T): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  clear(): void {
    this.map.clear();
  }
}
