// A small on-screen tracker of the player's active quests + objective progress. Render-only;
// refreshed whenever the QuestLog changes.

import type { QuestLog } from '../game/quests';

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export class QuestTracker {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'quest-tracker hidden');
    parent.appendChild(this.root);
  }

  update(ql: QuestLog, npcName: (id: string) => string): void {
    const list = ql.activeList();
    if (!list.length) {
      this.root.classList.add('hidden');
      return;
    }
    this.root.classList.remove('hidden');
    this.root.replaceChildren(el('div', 'qt-head', 'Quests'));
    for (const { quest, progress, done } of list) {
      const item = el('div', 'qt-item');
      item.append(el('div', 'qt-name', quest.name));
      const obj =
        quest.objective.type === 'kill'
          ? `${quest.objective.enemyId}  ${Math.min(progress, quest.objective.count)}/${quest.objective.count}`
          : `Talk to ${npcName(quest.objective.npcId)}`;
      item.append(el('div', `qt-obj${done ? ' done' : ''}`, done ? `✓ ${obj} — return to turn in` : obj));
      this.root.append(item);
    }
  }
}
