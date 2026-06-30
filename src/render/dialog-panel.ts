// NPC dialog box (render/UI only). Opens when the player clicks or interacts with a
// custom-map NPC: shows the NPC's title + lines, and any quests this NPC offers (Accept)
// or takes in (Turn in). Reads quest state from the QuestLog; the bootstrap grants rewards.

import type { MapNpc, MapQuest, QuestReward } from '../world/map-format';
import type { QuestLog } from '../game/quests';

export interface DialogContext {
  quests: MapQuest[];
  questLog: QuestLog;
  npcName: (id: string) => string;
  onAccept: (questId: string) => void;
  onTurnIn: (questId: string) => void;
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** Short payout summary for the Turn-in button (the rolled gear name shows on grant). */
function rewardLabel(r: QuestReward): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`+${r.gold}g`);
  if (r.xp) parts.push(`+${r.xp} XP`);
  if (r.item) parts.push(r.item.kind === 'relic' ? '+Relic' : `+${r.item.rarity} ${r.item.slot}`);
  return parts.join(', ') || 'reward';
}

export class DialogPanel {
  private readonly root: HTMLElement;
  isOpen = false;
  private npc: MapNpc | null = null;
  private ctx: DialogContext | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'dialog-panel hidden');
    parent.appendChild(this.root);
  }

  open(npc: MapNpc, ctx: DialogContext): void {
    this.npc = npc;
    this.ctx = ctx;
    this.isOpen = true;
    this.render();
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.isOpen = false;
    this.npc = null;
    this.ctx = null;
    this.root.classList.add('hidden');
  }

  private render(): void {
    const npc = this.npc;
    const ctx = this.ctx;
    if (!npc || !ctx) return;
    this.root.replaceChildren();

    const header = el('div', 'dlg-header');
    header.append(el('span', 'dlg-name', npc.name));
    if (npc.title) header.append(el('span', 'dlg-title', npc.title));
    const closeBtn = el('button', 'dlg-close', '✕');
    closeBtn.onclick = () => this.close();
    header.append(closeBtn);
    this.root.append(header);

    const body = el('div', 'dlg-body');
    for (const line of npc.dialog ?? []) body.append(el('p', 'dlg-line', line));
    if (!(npc.dialog && npc.dialog.length)) body.append(el('p', 'dlg-line dim', `“…”`));
    this.root.append(body);

    const id = npc.id ?? '';
    const ql = ctx.questLog;
    for (const q of ctx.quests) {
      const isGiver = q.giver === id;
      const isTurnIn = q.turnIn === id;
      if (!isGiver && !isTurnIn) continue;

      // Offer (not yet accepted / completed).
      if (isGiver && !ql.isActive(q.id) && !ql.isCompleted(q.id)) {
        this.root.append(this.questBlock(q, q.offerText ?? q.description, 'Accept', () => {
          ctx.onAccept(q.id);
          this.render();
        }));
        continue;
      }
      // Turn-in (active + objective met, this NPC takes it).
      if (isTurnIn && ql.isActive(q.id) && ql.objectiveDone(q)) {
        this.root.append(this.questBlock(q, q.completeText ?? `“Well done — here's your reward.”`, `Turn in (${rewardLabel(q.reward)})`, () => {
          ctx.onTurnIn(q.id);
          this.render();
        }));
        continue;
      }
      // In progress (accepted, not yet done) — shown by giver or turn-in NPC.
      if (ql.isActive(q.id) && !ql.objectiveDone(q)) {
        this.root.append(this.questBlock(q, q.progressText ?? this.progressSummary(q, ctx), null, null));
      }
    }
  }

  private progressSummary(q: MapQuest, ctx: DialogContext): string {
    const p = ctx.questLog.progress(q.id);
    if (q.objective.type === 'kill') return `Progress: ${Math.min(p, q.objective.count)} / ${q.objective.count} ${q.objective.enemyId} slain.`;
    return `Go talk to ${ctx.npcName(q.objective.npcId)}.`;
  }

  private questBlock(q: MapQuest, text: string, action: string | null, onClick: (() => void) | null): HTMLElement {
    const block = el('div', 'dlg-quest');
    block.append(el('div', 'dlg-quest-name', `✦ ${q.name}`));
    if (text) block.append(el('p', 'dlg-quest-text', text));
    if (action && onClick) {
      const btn = el('button', 'dlg-btn', action);
      btn.onclick = onClick;
      block.append(btn);
    }
    return block;
  }
}
