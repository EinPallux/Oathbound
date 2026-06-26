// New-character class picker (DOM overlay). Shown only when there is no save; the
// choice is applied to the player and persisted. ADR-002 DOM UI overlay.

import type { ClassId } from '../core/ecs/components';

interface ClassCard {
  id: ClassId;
  name: string;
  blurb: string;
}

const CARDS: ClassCard[] = [
  { id: 'warrior', name: 'Warrior', blurb: 'Melee brawler · Fury · cleave & survive' },
  { id: 'hunter', name: 'Hunter', blurb: 'Ranged marksman · Focus · kite & trap' },
];

export class ClassSelect {
  private readonly el: HTMLDivElement;
  onChoose: (id: ClassId) => void = () => {};

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'class-select';
    this.el.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'class-title';
    title.textContent = 'Choose your class';
    this.el.appendChild(title);

    const row = document.createElement('div');
    row.className = 'class-row';
    for (const c of CARDS) {
      const card = document.createElement('button');
      card.className = 'class-card';
      card.innerHTML = `<div class="class-name">${c.name}</div><div class="class-blurb">${c.blurb}</div>`;
      card.onclick = () => {
        this.hide();
        this.onChoose(c.id);
      };
      row.appendChild(card);
    }
    this.el.appendChild(row);
    parent.appendChild(this.el);
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
