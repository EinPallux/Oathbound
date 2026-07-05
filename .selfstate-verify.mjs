// Verify the snapshot now carries per-client self-state + entity names.
import WebSocket from 'ws';
const URL = process.env.URL ?? 'ws://127.0.0.1:8094/ws';
const P = 1;
const ws = new WebSocket(URL);
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
let self = null, sawName = false;
ws.on('open', () => send({ t: 'register', protocol: P, username: 'hud', password: 'secret123' }));
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.t === 'authOk') send({ t: 'charList' });
  else if (m.t === 'error' && m.code === 'username_taken') send({ t: 'login', protocol: P, username: 'hud', password: 'secret123' });
  else if (m.t === 'charList') {
    const has = (m.chars ?? []).some((c) => c.slot === 0);
    send(has ? { t: 'selectChar', slot: 0 } : { t: 'createChar', slot: 0, name: 'HudHero', classId: 'warrior' });
  } else if (m.t === 'welcome') {
    // drive a bit so an enemy might aggro + cooldowns/xp populate
    setInterval(() => send({ t: 'input', seq: Date.now() % 100000, forward: true, back: false, left: false, right: false, yaw: 0, jump: false, ability: Math.random() < 0.2 ? 0 : null, interact: false, cycle: false }), 33);
  } else if (m.t === 'snapshot') {
    if (m.self) self = m.self;
    if (m.ents?.some((e) => e.k === 'player' && e.name)) sawName = true;
    const enemyNamed = m.ents?.some((e) => (e.k === 'enemy' || e.k === 'boss') && e.name);
    if (enemyNamed) sawName = sawName; // enemies named too
  }
});
setTimeout(() => {
  ok(!!self, `snapshot carries self-state`);
  if (self) {
    ok(self.cls === 'warrior', `self.cls = ${self.cls}`);
    ok(typeof self.hp === 'number' && typeof self.mhp === 'number' && self.mhp > 0, `self hp ${self.hp}/${self.mhp}`);
    ok(typeof self.res === 'number' && typeof self.mres === 'number', `self res ${self.res}/${self.mres}`);
    ok(typeof self.lvl === 'number' && self.lvl >= 1, `self level ${self.lvl}`);
    ok(Array.isArray(self.cds), `self cooldowns array (len ${self.cds?.length})`);
    ok(Array.isArray(self.st), `self statuses array (len ${self.st?.length})`);
    ok('tgt' in self, `self has target field (${self.tgt ? self.tgt.name : 'null'})`);
    ok(typeof self.gold === 'number', `self gold ${self.gold}`);
  }
  ok(sawName, `player entity carries a name`);
  console.log(`\n[selfstate-verify] ${pass} passed, ${fail} failed`);
  ws.close();
  process.exit(fail === 0 ? 0 : 1);
}, 2500);
