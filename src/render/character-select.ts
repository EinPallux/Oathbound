// Character-select screen (DOM overlay, ADR-002). Shows the account's up-to-three
// character slots; each filled slot can Enter the World or be Deleted, each empty slot
// opens an inline "create character" form (name + class). Reachable from the login
// screen and from in-game ("Character Select" / log out). The world is only booted once
// a character is chosen, so this renders over a black canvas.

import type { ClassId } from '../core/ecs/components';
import { icon } from './ui/icons';
import {
  listCharacters,
  classLabel,
  getAccountName,
  type CharacterSummary,
} from '../platform/account-store';

interface ClassChoice {
  id: ClassId;
  name: string;
  blurb: string;
  ico: string;
}

const CLASSES: ClassChoice[] = [
  { id: 'warrior', name: 'Warrior', blurb: 'Melee brawler · Fury · cleave & survive', ico: 'sword' },
  { id: 'hunter', name: 'Hunter', blurb: 'Ranged marksman · Focus · kite & trap', ico: 'bow' },
  { id: 'priest', name: 'Priest', blurb: 'Holy caster · Mana · heal, shield & Atonement', ico: 'staff' },
];

const CLASS_ICON: Record<ClassId, string> = { warrior: 'sword', hunter: 'bow', priest: 'staff' };

export class CharacterSelect {
  private readonly el: HTMLDivElement;
  private readonly sub: HTMLDivElement;
  private readonly roster: HTMLDivElement;
  private readonly listView: HTMLDivElement;
  private readonly createView: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly cards: HTMLButtonElement[] = [];

  private createSlot = -1;
  private selectedClass: ClassId | null = null;
  private deleteArmed = -1;
  private deleteTimer = 0;

  /** Enter the world with an existing character (resume). */
  onPlay: (slot: number) => void = () => {};
  /** Create a new character in `slot` and enter the world. */
  onCreate: (slot: number, name: string, classId: ClassId) => void = () => {};
  /** Delete the character in `slot` (the app deletes, then calls refresh()). */
  onDelete: (slot: number) => void = () => {};
  /** Back to the login screen. */
  onBack: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'char-select';
    this.el.style.display = 'none';

    const head = document.createElement('div');
    head.className = 'char-select-head';
    const title = document.createElement('div');
    title.className = 'char-select-title';
    title.textContent = 'Select Your Character';
    this.sub = document.createElement('div');
    this.sub.className = 'char-select-sub';
    head.append(title, this.sub);

    // ── List view (roster + back) ──
    this.listView = document.createElement('div');
    this.listView.className = 'char-list-view';
    this.roster = document.createElement('div');
    this.roster.className = 'char-roster';
    const foot = document.createElement('div');
    foot.className = 'char-select-foot';
    const back = document.createElement('button');
    back.className = 'char-btn ghost char-back';
    back.textContent = '← Back';
    back.onclick = () => this.onBack();
    foot.appendChild(back);
    this.listView.append(this.roster, foot);

    // ── Create view (name + class cards) ──
    this.createView = document.createElement('div');
    this.createView.className = 'char-create-form';
    this.createView.style.display = 'none';

    const createTitle = document.createElement('div');
    createTitle.className = 'create-title';
    createTitle.textContent = 'Create Character';

    const field = document.createElement('label');
    field.className = 'create-field';
    const fieldLabel = document.createElement('span');
    fieldLabel.textContent = 'Name';
    this.nameInput = document.createElement('input');
    this.nameInput.className = 'create-name';
    this.nameInput.type = 'text';
    this.nameInput.maxLength = 18;
    this.nameInput.placeholder = 'Name your hero';
    this.nameInput.autocomplete = 'off';
    this.nameInput.spellcheck = false;
    field.append(fieldLabel, this.nameInput);

    const row = document.createElement('div');
    row.className = 'class-row';
    for (const c of CLASSES) {
      const card = document.createElement('button');
      card.className = 'class-card';
      card.dataset.class = c.id;
      card.innerHTML = `<div class="class-ico">${icon(c.ico)}</div><div class="class-name">${c.name}</div><div class="class-blurb">${c.blurb}</div>`;
      card.onclick = () => this.selectClass(c.id);
      this.cards.push(card);
      row.appendChild(card);
    }

    const actions = document.createElement('div');
    actions.className = 'create-actions';
    this.confirmBtn = document.createElement('button');
    this.confirmBtn.className = 'char-btn char-create-confirm create-confirm';
    this.confirmBtn.textContent = 'Create & Enter World';
    this.confirmBtn.disabled = true;
    this.confirmBtn.onclick = () => this.confirmCreate();
    const cancel = document.createElement('button');
    cancel.className = 'char-btn ghost create-cancel';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => this.showList();
    actions.append(this.confirmBtn, cancel);

    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.selectedClass) {
        e.preventDefault();
        this.confirmCreate();
      }
    });

    this.createView.append(createTitle, field, row, actions);

    this.el.append(head, this.listView, this.createView);
    parent.appendChild(this.el);
  }

  private selectClass(id: ClassId): void {
    this.selectedClass = id;
    for (const card of this.cards) card.classList.toggle('selected', card.dataset.class === id);
    this.confirmBtn.disabled = false;
  }

  private confirmCreate(): void {
    if (this.createSlot < 0 || !this.selectedClass) return;
    const name = this.nameInput.value.trim() || classLabel(this.selectedClass);
    this.onCreate(this.createSlot, name, this.selectedClass);
  }

  private openCreate(slot: number): void {
    this.createSlot = slot;
    this.selectedClass = null;
    this.nameInput.value = '';
    this.confirmBtn.disabled = true;
    for (const card of this.cards) card.classList.remove('selected');
    this.listView.style.display = 'none';
    this.createView.style.display = 'flex';
    this.nameInput.focus();
  }

  private showList(): void {
    this.createView.style.display = 'none';
    this.listView.style.display = 'flex';
  }

  private armDelete(slot: number, btn: HTMLButtonElement): void {
    if (this.deleteArmed === slot) {
      // Second click → confirm.
      window.clearTimeout(this.deleteTimer);
      this.deleteArmed = -1;
      this.onDelete(slot);
      return;
    }
    this.deleteArmed = slot;
    btn.textContent = 'Confirm?';
    btn.classList.add('confirm');
    window.clearTimeout(this.deleteTimer);
    this.deleteTimer = window.setTimeout(() => {
      this.deleteArmed = -1;
      btn.textContent = 'Delete';
      btn.classList.remove('confirm');
    }, 3000);
  }

  private renderRoster(chars: (CharacterSummary | null)[]): void {
    this.deleteArmed = -1;
    window.clearTimeout(this.deleteTimer);
    this.roster.replaceChildren();
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (!c) {
        const empty = document.createElement('button');
        empty.className = 'char-slot empty char-create';
        empty.innerHTML = `<div class="char-slot-plus">+</div><div class="char-slot-meta">Create Character</div>`;
        empty.onclick = () => this.openCreate(i);
        this.roster.appendChild(empty);
        continue;
      }
      const slot = document.createElement('div');
      slot.className = 'char-slot filled';
      const ico = document.createElement('div');
      ico.className = 'char-slot-ico';
      ico.innerHTML = icon(CLASS_ICON[c.classId] ?? 'sword');
      const name = document.createElement('div');
      name.className = 'char-slot-name';
      name.textContent = c.name;
      const meta = document.createElement('div');
      meta.className = 'char-slot-meta';
      meta.textContent = `Level ${c.level} · ${classLabel(c.classId)}`;
      const actions = document.createElement('div');
      actions.className = 'char-slot-actions';
      const play = document.createElement('button');
      play.className = 'char-btn char-play';
      play.textContent = 'Enter World';
      play.onclick = () => this.onPlay(c.slot);
      const del = document.createElement('button');
      del.className = 'char-btn ghost danger char-delete';
      del.textContent = 'Delete';
      del.onclick = () => this.armDelete(c.slot, del);
      actions.append(play, del);
      slot.append(ico, name, meta, actions);
      this.roster.appendChild(slot);
    }
  }

  /** Reload the roster from storage and render. */
  async refresh(): Promise<void> {
    const acct = getAccountName();
    this.sub.textContent = acct ? `Welcome back, ${acct}` : 'Choose a hero to enter the realm';
    const chars = await listCharacters();
    this.renderRoster(chars);
  }

  show(): void {
    this.el.style.display = 'flex';
    this.showList();
    void this.refresh();
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  dispose(): void {
    window.clearTimeout(this.deleteTimer);
    this.el.remove();
  }
}
