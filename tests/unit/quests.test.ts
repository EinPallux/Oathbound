import { describe, it, expect } from 'vitest';
import { QuestLog } from '../../src/game/quests';
import type { MapQuest } from '../../src/world/map-format';

const KILL_QUEST: MapQuest = {
  id: 'cull',
  name: 'Cull the Bloomhusks',
  description: 'Slay three bloomhusks, then report back.',
  giver: 'npc-1',
  turnIn: 'npc-2',
  objective: { type: 'kill', enemyId: 'bloomhusk', count: 3 },
  reward: { gold: 50, xp: 120, item: { kind: 'gear', slot: 'weapon', rarity: 'uncommon', ilvl: 4, primaryStat: 'STR' } },
};

const TALK_QUEST: MapQuest = {
  id: 'word',
  name: 'A Word with the Elder',
  description: 'Carry word to the elder.',
  giver: 'npc-2',
  turnIn: 'npc-3',
  objective: { type: 'talk', npcId: 'npc-3' },
  reward: { gold: 15, xp: 60 },
};

// A follow-up that only unlocks once TALK_QUEST is turned in (a questline link).
const FOLLOWUP_QUEST: MapQuest = {
  id: 'errand',
  name: "The Elder's Errand",
  description: 'Carry word back to Mara.',
  giver: 'npc-3',
  turnIn: 'npc-3',
  requires: ['word'],
  objective: { type: 'talk', npcId: 'npc-1' },
  reward: { gold: 40, xp: 90 },
};

describe('QuestLog — kill objective', () => {
  it('accepts, advances on matching kills, and completes only when the count is met', () => {
    const ql = new QuestLog([KILL_QUEST]);
    let changes = 0;
    ql.onChange = () => changes++;

    ql.accept('cull');
    expect(ql.isActive('cull')).toBe(true);
    expect(ql.objectiveDone(KILL_QUEST)).toBe(false);
    expect(ql.complete('cull')).toBeNull(); // not done yet

    ql.onKill('bloomhusk');
    ql.onKill('reaver'); // wrong template — ignored
    expect(ql.progress('cull')).toBe(1);
    ql.onKill('bloomhusk');
    ql.onKill('bloomhusk');
    expect(ql.progress('cull')).toBe(3);
    expect(ql.objectiveDone(KILL_QUEST)).toBe(true);

    // Over-kill doesn't push progress past the count.
    ql.onKill('bloomhusk');
    expect(ql.progress('cull')).toBe(3);

    const done = ql.complete('cull');
    expect(done?.reward.gold).toBe(50);
    // The item-reward spec is carried on the quest for the bootstrap to roll + grant.
    expect(done?.reward.item).toEqual({ kind: 'gear', slot: 'weapon', rarity: 'uncommon', ilvl: 4, primaryStat: 'STR' });
    expect(ql.isActive('cull')).toBe(false);
    expect(ql.isCompleted('cull')).toBe(true);
    expect(changes).toBeGreaterThan(0);
  });

  it('ignores a second accept and refuses unknown ids', () => {
    const ql = new QuestLog([KILL_QUEST]);
    ql.accept('cull');
    ql.onKill('bloomhusk');
    ql.accept('cull'); // no-op — must not reset progress
    expect(ql.progress('cull')).toBe(1);
    ql.accept('does-not-exist');
    expect(ql.isActive('does-not-exist')).toBe(false);
  });
});

describe('QuestLog — talk objective', () => {
  it('advances when the target NPC is talked to', () => {
    const ql = new QuestLog([TALK_QUEST]);
    ql.accept('word');
    expect(ql.objectiveDone(TALK_QUEST)).toBe(false);
    ql.onTalk('npc-1'); // wrong NPC — ignored
    expect(ql.objectiveDone(TALK_QUEST)).toBe(false);
    ql.onTalk('npc-3');
    expect(ql.objectiveDone(TALK_QUEST)).toBe(true);
    expect(ql.complete('word')?.reward.xp).toBe(60);
    expect(ql.isCompleted('word')).toBe(true);
  });
});

describe('QuestLog — persistence', () => {
  it('round-trips active progress and completed quests through toSave/load', () => {
    const ql = new QuestLog([KILL_QUEST, TALK_QUEST]);
    ql.accept('cull');
    ql.onKill('bloomhusk');
    ql.onKill('bloomhusk');
    ql.accept('word');
    ql.onTalk('npc-3');
    ql.complete('word');

    const saved = ql.toSave();
    expect(saved.active).toEqual([{ id: 'cull', progress: 2 }]);
    expect(saved.completed).toEqual(['word']);

    const restored = new QuestLog([KILL_QUEST, TALK_QUEST]);
    restored.load(saved);
    expect(restored.progress('cull')).toBe(2);
    expect(restored.isCompleted('word')).toBe(true);
    // Resume the in-flight kill quest to completion.
    restored.onKill('bloomhusk');
    expect(restored.objectiveDone(KILL_QUEST)).toBe(true);
    expect(restored.complete('cull')?.reward.gold).toBe(50);
  });

  it('drops save entries for quests no longer present in the map', () => {
    const ql = new QuestLog([KILL_QUEST]);
    ql.load({ active: [{ id: 'ghost', progress: 2 }], completed: ['phantom'] });
    expect(ql.isActive('ghost')).toBe(false);
    // Completed ids are kept even if not in the map (harmless history).
    expect(ql.isCompleted('phantom')).toBe(true);
  });
});

describe('QuestLog — prerequisites / questlines', () => {
  it('only offers a follow-up once its prerequisite is turned in', () => {
    const ql = new QuestLog([TALK_QUEST, FOLLOWUP_QUEST]);
    // Locked at the start — prereq not done, so the giver can't offer it.
    expect(ql.prereqsMet(FOLLOWUP_QUEST)).toBe(false);
    expect(ql.canOffer(FOLLOWUP_QUEST, 'npc-3')).toBe(false);
    // The prerequisite itself is freely available.
    expect(ql.canOffer(TALK_QUEST, 'npc-2')).toBe(true);

    // Do + turn in the prerequisite.
    ql.accept('word');
    ql.onTalk('npc-3');
    ql.complete('word');

    // Now the follow-up unlocks at its giver.
    expect(ql.prereqsMet(FOLLOWUP_QUEST)).toBe(true);
    expect(ql.canOffer(FOLLOWUP_QUEST, 'npc-3')).toBe(true);
    // ...but not from the wrong NPC.
    expect(ql.canOffer(FOLLOWUP_QUEST, 'npc-1')).toBe(false);
  });
});

describe('QuestLog — NPC quest markers', () => {
  it('shows "!" on an available giver, "?dim" on a pending turn-in, "?" when ready', () => {
    const ql = new QuestLog([KILL_QUEST]); // clean giver(npc-1) / turn-in(npc-2) split
    expect(ql.markerFor('npc-1')).toBe('!'); // giver, available
    expect(ql.markerFor('npc-2')).toBeNull(); // turn-in, but nothing accepted yet

    ql.accept('cull');
    expect(ql.markerFor('npc-1')).toBeNull(); // no longer offers it
    expect(ql.markerFor('npc-2')).toBe('?dim'); // pending turn-in, objective unfinished

    ql.onKill('bloomhusk');
    ql.onKill('bloomhusk');
    ql.onKill('bloomhusk');
    expect(ql.markerFor('npc-2')).toBe('?'); // ready to hand in
  });

  it('lights up a follow-up giver only after the prerequisite is turned in', () => {
    const ql = new QuestLog([TALK_QUEST, FOLLOWUP_QUEST]);
    // npc-3 gives only the locked follow-up (and takes `word`, not yet active) → nothing.
    expect(ql.markerFor('npc-3')).toBeNull();
    ql.accept('word');
    ql.onTalk('npc-3');
    ql.complete('word');
    expect(ql.markerFor('npc-3')).toBe('!'); // the follow-up is now offered here
  });
});
