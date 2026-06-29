// Login screen (DOM overlay, ADR-002). No auth yet — it's the title gate: a cosmetic
// "who are you" name (remembered on the device) and an Enter button that leads to the
// character-select screen. Shown over a black canvas before the world is booted.

import { getAccountName, setAccountName } from '../platform/account-store';

export class LoginScreen {
  private readonly el: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;

  /** Called when the player enters; receives the (possibly empty) account name. */
  onPlay: (accountName: string) => void = () => {};

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'login-screen';
    this.el.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'login-card';

    const title = document.createElement('div');
    title.className = 'login-title';
    title.textContent = 'Oathbound';

    const sub = document.createElement('div');
    sub.className = 'login-sub';
    sub.textContent = 'A realm bound by oaths · enter to begin';

    const field = document.createElement('label');
    field.className = 'login-field';
    const fieldLabel = document.createElement('span');
    fieldLabel.textContent = 'Name';
    this.nameInput = document.createElement('input');
    this.nameInput.className = 'login-name';
    this.nameInput.type = 'text';
    this.nameInput.maxLength = 20;
    this.nameInput.placeholder = 'Traveller';
    this.nameInput.autocomplete = 'off';
    this.nameInput.spellcheck = false;
    this.nameInput.value = getAccountName();
    field.append(fieldLabel, this.nameInput);

    const play = document.createElement('button');
    play.className = 'login-play';
    play.textContent = 'Enter';
    play.onclick = () => this.submit();

    // Enter key in the name field also submits.
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });

    const note = document.createElement('div');
    note.className = 'login-note';
    note.textContent = 'No account needed — your characters are saved on this device.';

    card.append(title, sub, field, play, note);
    this.el.appendChild(card);
    parent.appendChild(this.el);
  }

  private submit(): void {
    const name = this.nameInput.value.trim();
    setAccountName(name);
    this.onPlay(name);
  }

  show(): void {
    this.el.style.display = 'flex';
    this.nameInput.value = getAccountName();
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  dispose(): void {
    this.el.remove();
  }
}
