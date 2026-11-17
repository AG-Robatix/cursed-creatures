'use strict';
/* ============================================================
   levels.js — the five chapters and every story choice.
   Much of the narration is taken straight from the original
   text adventure ("Cursed Creatures: Tales of the hunt").

   Handy tools for writing scenes:
     await narr('text')              narration
     await say('Name', 'text')       someone speaks
     const c = await choose('question', ['a', 'b'])   -> 0, 1, ...
     L.mob / L.npc / L.prop / L.zone / L.use          build the level
   ============================================================ */

function tween(obj, key, to, dur) { const from = obj[key]; let t = 0; return waitFor(dt => { t += dt; obj[key] = lerp(from, to, Math.min(1, t / dur)); return t >= dur; }); }
// Boss reveals: point the camera at something (a spot or a creature), zoom in and slide in the black bars.
function cineOn(target, zoom = 1.2) { G.focus = target; G.cineT = 1; G.zoomT = zoom; }
function cineOff() { G.focus = null; G.cineT = 0; G.zoomT = 1; }
// Move a creature across the floor during a cutscene (anim 'walk' makes it step, none makes it glide).
function glide(e, tx, speed, anim) {
  const d = sgn(tx - e.x), token = e._glide = {};
  return waitFor(dt => {
    if (e._glide !== token) return true;
    e.x += d * speed * dt; if (anim) { e.anim = anim; e.runPh += speed * dt * .06; }
    if ((tx - e.x) * d <= 0) { e.x = tx; if (anim) e.anim = 'idle'; return true; }
    return false;
  });
}
/* ---------- side contracts ----------
   A contract's flag in G.flags goes: (unset) not taken -> 1 taken -> 2 creature killed -> 3 paid.
   The creature is out there whether or not you read the board, so killing it first still earns the reward. */
const CONTRACTS = {
  c_wolf:  { title: 'Greymaw, the black wolf', where: 'down the trail of bones east of the village', claim: 'the village elder', reward: 35 },
  c_grave: { title: 'the grave-robber', where: 'in the old graveyard off the trade road, past the border', claim: 'the town guard just inside the entrance to Harrowmere', reward: 45 },
  c_rift:  { title: 'the thing under the brewery', where: 'in the old cistern beneath Harrowmere', claim: 'the innkeeper', reward: 50 },
};
async function offerContract(id, notice) {
  const F = G.flags, C = CONTRACTS[id];
  if (F[id] === 3) return narr('Where a contract was pinned there is only a nail and a torn corner of paper. Paid in full.');
  await narr(notice);
  if (F[id] === 2) return narr('That one is already done. ' + C.reward + ' coins are waiting for you with ' + C.claim + '.');
  if (F[id] === 1) return narr('You have already taken this contract.');
  if (await choose('Do you take the contract?', ['Take the contract', 'Leave it on the board']) === 0) {
    F[id] = 1; sfx('confirm'); G.toast('Side contract accepted.');
    await narr('You pull the notice from its nail and fold it into your coat.');
  }
}
async function payContract(id, who, line) {
  const F = G.flags, C = CONTRACTS[id];
  if (F[id] !== 2) return false;
  await say(who, line);
  F[id] = 3; addCoins(C.reward); saveGame(G.player.x);
  await narr('You are paid ' + C.reward + ' coins. The contract is complete.');
  return true;
}
function contractDone(id) { G.flags[id] = 2; sfx('victory'); G.toast('Contract fulfilled. Collect your reward from ' + CONTRACTS[id].claim + '.'); }
// a contract creature waits at x; walking near it starts the reveal and the fight
function contractHunt(L, o) {
  const F = G.flags;
  if (F[o.id] >= 2) return null;
  const e = L.mob(o.mob, o.x, Object.assign({ passive: true }, o.opts || {}));
  L.zone(o.x - o.near, o.x + o.near, async () => {
    const p = G.player, side = p.x < e.x ? -1 : 1;
    saveGame(p.x + side * 110);
    e.dir = side; cineOn(e, o.zoom || 1.22);
    await o.reveal(e);
    cineOff(); e.idleAnim = null; e.anim = 'idle';
    setArena(o.arena[0], o.arena[1]); startBoss(e);
    whenDead([e], async () => {
      endBoss(); clearArena();
      await o.after(e);
      contractDone(o.id); saveGame(G.player.x);
    }, 1.6);
  }, { cond: () => !(F[o.id] >= 2) });
  return e;
}
function hostile(list) { list.forEach(b => { b.passive = false; b.state = 'chase'; b.cd = rand(.3, 1.1); }); }
// after a boss dies: run the aftermath as a cutscene
function whenDead(list, fn, delay = 1.2) { run(async () => { await until(() => list.every(e => e.dead)); await wait(delay); await cut(fn); }); }

/* ------------------------------------------------------------
   CHAPTER I — THE MISTMOOR (fog and grassland)
   ------------------------------------------------------------ */
LEVELS.moor = {
  name: 'The Mistmoor', sub: 'Chapter I', theme: 'moor', width: 5600, entries: { start: 120 },
  build(L) {
    const F = G.flags;
    L.prop('sign', 340, { text: 'EAST' });
    L.hint(230, 'Move with A / D or the arrow keys. Jump with W or Space. Hold Shift to sprint; it uses stamina.', 'h_move',
      'Drag on the left side of the screen to move. Drag further to sprint; it uses stamina. Tap Jump to jump.');
    L.prop('log', 720); L.prop('rock', 1190, { s: 1.2, col: '#2f3a25' });
    L.hint(760, 'Something stirs in the fog. Strike with J (or Z, or a mouse click). Press three times to chain a combo.', 'h_atk',
      'Something stirs in the fog. Tap Attack to strike. Tap three times to chain a combo.');
    L.mob('ghoul', 1120);
    L.hint(1330, 'Roll through danger with K (or X). You cannot be hit while rolling, but it costs stamina.', 'h_roll',
      'Tap Roll to tumble through danger. You cannot be hit while rolling, but it costs stamina.');
    L.hint(1520, 'Hold S (or ↓) to block. Raise your guard just before a blow lands and you parry it: no damage, and the enemy is thrown off balance.', 'h_block',
      'Hold Block to guard. Raise your guard just before a blow lands and you parry it: no damage, and the enemy is thrown off balance.');
    L.mob('ghoul', 1700); L.mob('ghoul', 1830);
    L.hint(2020, 'Glyphs cost stamina. L casts Ember, a burst of fire. I raises a Ward that absorbs one blow.', 'h_glyph',
      'Glyphs cost stamina. Tap Ember, beside your attack buttons, for a burst of fire. Tap Ward to absorb one blow.');
    L.hint(2230, 'Hold the attack key to charge a heavy blow, then let go. Attack while in the air for a plunging strike. Attack during a roll to come out swinging.', 'h_heavy',
      'Hold Attack to charge a heavy blow, then let go. Tap Attack in the air for a plunging strike. Tap Attack during a roll to come out swinging.');
    L.mob('ghoul', 2380); L.mob('ghoul', 2480);
    L.hint(2660, 'Drink potions with 1, 2 and 3. Press E to talk to people and to examine things.', 'h_pot',
      'The red flask at the top left drinks a healing elixir. The pouch beside it holds your other potions and oils, and lets you change what the two quick buttons hold. A Use button appears when you can talk to people or examine things.');

    // the village the Voidspawn destroyed
    L.prop('ruin', 2840, { v: 0 }); L.prop('scar', 2990); L.prop('ruin', 3140, { v: 1 }); L.prop('scar', 3330); L.prop('ruin', 3440, { v: .5, flip: true });
    L.use(2990, 'Examine the scorched ground', async () => {
      F.scarSeen = 1;
      await narrs('The earth is burnt black in a spiral, yet nothing here ever caught fire.', 'The air above it tastes of iron and feels thin, as if something had been pulled out of the world.');
    }, { py: 70 });
    const sv = L.npc('survivor', 3230, { anim: F.survivor ? 'idle' : 'cower', face: !!F.survivor });
    L.use(3230, 'Talk', async () => {
      if (!F.survivor) {
        sv.anim = 'idle'; sv.face = true;
        await say('Survivor', 'Stay b... oh. You are no ghoul. A hunter?');
        await say('Survivor', 'It came at dusk. No shape to it. Just darkness, moving like smoke in water.');
        await say('Survivor', 'It put tendrils into people and they simply emptied. Then holes opened in the air and smaller things crawled out of them.');
        await say('Survivor', 'When there was nobody left to take, it drifted east. Through the Hollow Wood, toward the border and the town of Harrowmere.');
        await say('Survivor', 'Here. My wife brewed this. She has no use for it now.');
        await say('Survivor', 'One more thing, hunter. If you see a light out on the moor, do not follow it.');
        F.survivor = 1; givePotion('vit');
        objective('Contract: destroy the Voidspawn. Follow it east, through the Hollow Wood to the border.');
      } else await say('Survivor', 'East, hunter. Through the wood. And when you find it, make it hurt.');
    });
    L.campfire(3660);
    L.hint(3880, 'Press 4 to coat your blade with Gravesalt Oil. For 90 seconds your sword bites harder into the dead, and ghouls are the dead. Wolfsbane Oil (5) works on beasts and Starglass Oil (6) on void things.', 'h_oil',
      'Tap the oil drop at the top left to coat your blade. It picks the oil that suits the nearest creature: right now Gravesalt, because ghouls are the dead. For 90 seconds your sword bites harder into its kind.');
    L.hint(4010, 'Wisps spit sparks from a distance. Block them, or parry at the last moment to send a spark straight back.', 'h_wisp');
    L.mob('ghoul', 4120); L.mob('wisp', 4280); L.mob('ghoul', 4360); L.mob('wisp', 4480);
    L.prop('rock', 4600, { s: 1.5, col: '#2f3a25' });
    L.mob('brute', 4640);
    L.campfire(4760);
    // --- the Lantern Man: the light in the fog ---
    if (!F.lanternDead) {
      const lm = L.mob('lanternman', 5260, { passive: true, alpha: .22, untouchable: true });
      L.zone(4900, 5000, async () => {
        saveGame(4800);
        cineOn(lm, 1.16);
        if (!F.lanternSeen) {
          await narr('A light bobs in the fog ahead, swaying gently, like a lantern carried by someone in no hurry.');
          await narr(F.survivor ? 'The survivor\'s warning comes back to you: do not follow the light.' : 'Every marsh child knows the rule: never follow the light.');
          tween(lm, 'alpha', 1, 1.4); sfx('wail');
          await narr('It was never waiting to be followed. It was coming to you. A tall, drowned shape steps out of the mist, its lantern burning with a flame the colour of rot.');
          await narr('The Lantern Man. It has led a great many travellers off the path. You draw your silver sword.');
          F.lanternSeen = 1; saveGame(4800);
        } else { tween(lm, 'alpha', 1, .8); await narr('The light is waiting for you in the fog.'); }
        cineOff(); lm.alpha = 1; lm.untouchable = false;
        setArena(4830, 5500); startBoss(lm);
        whenDead([lm], async () => {
          endBoss(); clearArena();
          await narr('The lantern falls and gutters out. In the dark that follows, the fog is only fog.');
          await narr('You take the dead lantern as proof of your victory.');
          F.lanternDead = 1; trophy('The Lantern Man'); saveGame(G.player.x);
        }, 1.8);
      });
    }
    L.prop('sign', 5400, { text: 'WOOD' });
    L.exit(5545, 5600, 'wood', 'start');
  },
  async enter() {
    const F = G.flags;
    if (F.intro) return;
    await narr('You are {name}, a monster hunter.');
    await narr('You have been hired to destroy a Voidspawn.');
    await narr('A Voidspawn is a creature that originates from the depths of the void, a mysterious and otherworldly realm beyond the known dimensions. It is an embodiment of pure chaos and darkness.');
    await narr('Its form is ever-shifting and lacks physical features, existing as a swirling mass of shadow. It can manipulate and distort reality, warping the fabric of space and time.');
    await narr('It caused the destruction of a village. It unleashed tendrils of darkness, capable of draining the life force of its victims, while opening void rifts to summon reinforcements.');
    await narr('Its last known appearance was in a town past the border. Your road there begins here, on the Mistmoor.');
    F.intro = 1; objective('Contract: destroy the Voidspawn. It was last seen in a town past the border.');
    saveGame();
  },
};

/* ------------------------------------------------------------
   CHAPTER II — THE HOLLOW WOOD (forest)
   bandits and the merchant · the abandoned house · the village
   ------------------------------------------------------------ */
LEVELS.wood = {
  name: 'The Hollow Wood', sub: 'Chapter II', theme: 'wood', width: 7600, entries: { start: 100, house: 3300, east: 7460, den: 6990 },
  build(L) {
    const F = G.flags, S = G.S;

    // --- the bandits and the merchant ---
    const shopUse = () => L.use(1340, 'Trade with the merchant', async () => { await say('Merchant', 'For the one who saved my neck? Fair prices, always.'); await openShop("The Merchant's Wares", .8); });
    if (!F.banditsDone) {
      L.prop('cart', 1440);
      const merchant = L.npc('merchant', 1340, { anim: 'cower', face: false, dir: -1 });
      const gang = [L.mob('cutthroat', 1250, { passive: true, dir: 1 }), L.mob('bandit', 1190, { passive: true, dir: 1 }), L.mob('archer', 1110, { passive: true, dir: 1 })];
      L.zone(880, 1000, async () => {
        await narr('You are blocked by a group of bandits threatening a merchant.');
        await say('Bandit', 'Coin and cart, old man. I will not ask again.');
        await say('Merchant', 'Please! Somebody, help me!');
        const c = await choose('What do you do?', ['Fight the bandits', 'Ignore the bandits and keep walking']);
        if (c === 0) {
          await narr('You decide to fight the bandits. You draw your sword and charge at them.');
          setArena(760, 1560); hostile(gang);
          whenDead(gang, async () => {
            clearArena(); merchant.anim = 'idle'; merchant.face = true;
            await narr('You kill the bandits and save the merchant.');
            await say('Merchant', 'I thought I was a dead man. Thank you, hunter. Thank you!');
            addCoins(50);
            await narr('The merchant thanks you and gives you 50 coins.');
            await say('Merchant', 'I am bound for the border myself, once my hands stop shaking. If you need supplies, I sell at a friend\'s price.');
            F.banditsDone = 1; F.savedMerchant = 1; shopUse(); saveGame(G.player.x);
          });
        } else {
          await narr('You go around the bandits, keeping a large distance between you and them.');
          await fadeTo(1);
          gang.forEach(b => b.remove = true); merchant.remove = true;
          F.banditsDone = 1; F.ignoredBandits = 1;
          G.player.x = 1940; snapCamera(); await wait(.5); await fadeTo(0);
          await narr('Behind you, the merchant\'s pleading stops. You do not look back.');
          saveGame(G.player.x);
        }
      });
    } else if (F.savedMerchant) {
      L.prop('cart', 1440); L.npc('merchant', 1340); shopUse();
    } else L.prop('wreck', 1440);

    L.mob('wolf', 2300); L.mob('wolf', 2420);
    L.campfire(2880);

    // --- the abandoned house ---
    L.prop('hauntedHouse', 3300);
    L.zone(3040, 3140, async () => {
      F.houseSeen = 1;
      await narr('As you walk through the forest, you see an abandoned house.');
      sfx('scream'); shake(3);
      await narr('You hear a scream coming from inside the house.');
      const c = await choose('What do you want to do?', ['Go inside the house', 'Keep walking']);
      if (c === 0) return gotoLevel('house', 'start');
      await narr('You mind your business and keep walking through the forest.');
    }, { cond: () => !F.houseSeen && !F.wraithDead });
    L.use(3300, 'Enter the abandoned house', () => gotoLevel('house', 'start'), { cond: () => !F.wraithDead });
    L.use(3300, 'Look at the house', () => narr('The house is silent now. Whatever screamed here will not scream again.'), { cond: () => !!F.wraithDead });

    // --- the merchant's fate, if you walked past ---
    const body = L.prop('body', 4020, { hidden: !(F.ignoredBandits && F.knowsWraith) });
    L.zone(3940, 4110, async () => {
      await narr('As you walk back to the house, you see a dead body in the distance.');
      await narr('You realise that it is the merchant that was attacked by the bandits.');
      const c = await choose('Do you loot the body or not?', ['Loot', 'Ignore it and walk on']);
      if (c === 0) { await narr('You go to loot the body.'); addCoins(70); F.looted = 1; await narr('You gain 70 coins. You now have ' + S.coins + ' coins.'); }
      else await narr('You leave him where he lies.');
      F.bodyDone = 1; saveGame(G.player.x);
    }, { cond: () => F.ignoredBandits && F.knowsWraith && !F.bodyDone, once: false });

    L.mob('wolf', 4480); L.mob('wolf', 4600); L.mob('wolf', 4700);

    // --- the village ---
    L.prop('hut', 5450, { v: 0 }); L.prop('board', 5640); L.prop('hut', 5880, { v: 1 }); L.prop('barrel', 6020); L.prop('hut', 6260, { v: 0 }); L.prop('crates', 6420);
    L.zone(5300, 5400, async () => { await narr('Eventually, you reach a small village.'); await narr('You see a notice board with a few notices pinned to it.'); }, { flag: 'villageSeen' });
    L.use(5640, 'Read the notices', async () => {
      if (F.rewarded) await narr('A fresh notice has been pinned over the old one: "The wraith is dead. Bless the hunter {name}."');
      else {
        await narr('You read the notices.');
        await narr('One of the notices says that there is a monster terrorizing the village. 10 coins to whoever kills it, and a pass to cross the territory border.');
        F.readNotice = 1;
        if (!F.wraithDead) objective('Village contract: kill the monster terrorizing the village. Reward: 10 coins and a border pass.');
        else await narr('You have already dealt with it. The villagers should hear about that.');
      }
      await offerContract('c_wolf', 'A second notice, in a shakier hand: "CONTRACT. Greymaw, the black wolf that leads the pack east of the village. It has taken eleven sheep and the shepherd who went looking for them. Its den lies off the road: follow the bones. 35 coins. See the elder."');
    }, { py: 130 });
    L.npc('elder', 5760);
    L.use(5760, 'Talk to the elder', async () => {
      if (await payContract('c_wolf', 'Village Elder', 'Greymaw\'s ear. I would know that torn thing anywhere. The shepherd\'s widow will sleep tonight. Here, as promised.')) return;
      if (F.rewarded) return say('Village Elder', 'Safe roads, {name}. The border lies east.');
      if (!F.wraithDead) {
        await narr('You go to the village square and ask the villagers about the monster.');
        await say('Village Elder', 'The monster is a wraith. It has taken three of ours already.');
        await narr('You ask the villagers where the wraith is.');
        await say('Village Elder', 'In the abandoned house in the forest, west of here. At night we can hear it scream.');
        F.knowsWraith = 1; if (F.ignoredBandits) body.hidden = false;
        objective('Kill the wraith in the abandoned house, west of the village. Reward: 10 coins and a border pass.');
        return;
      }
      await narr('You tell the villagers that you have killed the wraith.');
      await say('Village Elder', 'That head... Gods. Then it is true. It is over.');
      addCoins(10); S.pass = true; F.rewarded = 1;
      await narr('The villagers are overjoyed and give you 10 coins and a pass to cross the territory border.');
      await narr('You thank the villagers and continue your journey.');
      objective('Contract: destroy the Voidspawn. Cross the border to the east.'); saveGame(G.player.x);
    });
    L.npc('woman', 6000);
    L.use(6000, 'Talk', () => say('Villager', F.wraithDead ? 'Quiet nights. I had forgotten what they sound like.' : 'My boy heard it scream from the old house again last night. Nobody sleeps here any more.'));
    L.npc('child', 6130);
    L.use(6130, 'Talk', () => say('Child', F.wraithDead ? 'Did it really have a head? Can I see it? Please?' : 'Is that a real silver sword? Have you killed a hundred monsters?'));

    // --- side contract: a trail leads off the road to Greymaw's den. Follow it or walk on ---
    L.prop('bones', 6860); L.prop('sidepath', 6990, { col: '#8a6a34' }); L.prop('bones', 7120, { flip: true });
    L.zone(6890, 7010, () => hint('A trail of bones and tufts of wool leaves the road here and heads into the thick of the wood. ' + tk('Press E', 'Tap Use') + ' to follow it, or keep to the road.', 9), { flag: 'h_den', noCut: true, cond: () => !(F.c_wolf >= 2) });
    L.use(6990, 'Follow the trail of bones', async () => {
      if (F.c_wolf >= 2) return narr('The trail is cold. Nothing drags its kills this way any more.');
      await narr('A trail of bones and tufts of wool leads off the road, into the thick of the wood. Something large has been dragging its kills this way.');
      if (await choose('Do you follow the trail?', ['Follow it', 'Stay on the road']) === 0) gotoLevel('den', 'start');
    }, { py: 110 });

    L.prop('sign', 7380, { text: 'BORDER' });
    L.exit(7545, 7600, 'road', 'start');
  },
  async enter(entry) {
    const F = G.flags;
    if (!F.woodIntro) { F.woodIntro = 1; await narr('You are currently walking in the middle of a forest, on your way to the border.'); }
  },
};

/* --- inside the abandoned house --- */
LEVELS.house = {
  name: 'The Abandoned House', theme: 'house', width: 1500, entries: { start: 170 },
  build(L) {
    const F = G.flags;
    L.prop('door', 90, { col: '#2a1c12' }); L.prop('table', 360); L.prop('tapestry', 500, { v: 0 }); L.prop('fireplace', 700);
    L.prop('door', 930); L.prop('moonWindow', 1090, { light: 260, ly: 150, lx: 90, sx: 170 }); L.prop('tapestry', 1220, { v: 1 }); L.prop('door', 1360);
    L.use(90, 'Leave the house', () => gotoLevel('wood', 'house'), { py: 130 });
    L.use(930, 'Open the left door', async () => {
      sfx('door');
      await narr('You go through the door to your left.');
      if (F.wraithDead) return narr('The dusty library is still. The passage behind the bookshelf stands open, and nothing waits below any more.');
      await narr('You enter a dusty library. There is a bookshelf in the middle of the room.');
      await narr('You go to the bookshelf and see a secret lever.');
      const c = await choose('Do you pull the lever?', ['Yes', 'No']);
      if (c === 1) return narr('You decide not to pull the lever. You leave the library and step back into the hallway.');
      sfx('lever'); shake(3);
      await narr('You pull the lever.');
      await narr('The bookshelf slides to the side, revealing a secret passage!');
      await narr('You descend through the secret passage.');
      gotoLevel('cellar', 'start');
    }, { py: 130 });
    L.use(1360, 'Open the right door', async () => {
      sfx('door');
      await narr('You go through the door to your right.');
      await narr('You enter a spooky laboratory.');
      await narr('Cracked alembics and jars of things best left unnamed line the shelves. A journal lies open on the bench, written in a careful hand.');
      await say('The Journal', '"The wraith fears flame. Fire forces it to take form. Strike it then, and strike hard."');
      await say('The Journal', '"Gravesalt on the blade for all the restless dead. Wolfsbane for anything with fur. I leave what I have."');
      if (!F.labLoot) { F.labLoot = 1; givePotion('tem'); G.S.oil.dead++; await narr('Beside the journal stand two stoppered vials: a Tempest Tonic and a flask of Gravesalt Oil. Their owner will not be needing them.'); }
    }, { py: 130 });
  },
  async enter() {
    const F = G.flags;
    if (F.houseIntro) return; F.houseIntro = 1; F.houseSeen = 1;
    await narr('You enter the house.');
    await narr('The inside of the house is sparse, with only a few pieces of furniture still intact, including a rickety table and a handful of chairs.');
    await narr('The air hangs heavy with the smell of rotting wood, mold and a scent of decay.');
    await narr('The walls are adorned with faded tapestries and paintings of long-forgotten landscapes, and the remnants of a fireplace stand in the corner, with blackened stones and ash covering the floor.');
    await narr('You go upstairs to investigate the scream. You are in a dark hallway. There are scratches and blood splatters against the walls.');
    await narr('You see a door to your left and a door to your right.');
  },
};

/* --- the cellar: the Wraith --- */
LEVELS.cellar = {
  name: 'The Secret Passage', theme: 'cellar', width: 1040, entries: { start: 170 },
  build(L) {
    const F = G.flags;
    this.shelf = L.prop('bookshelf', 80, { slide: F.wraithDead ? 110 : 0 });
    L.prop('moonWindow', 620, { light: 300, ly: 130, lx: 110, sx: 200 }); L.prop('junk', 420); L.prop('barrel', 930); L.prop('crates', 300);
    this.wraith = F.wraithDead ? null : L.mob('wraith', 800, { passive: true, alpha: 0, untouchable: true });
    L.use(110, 'Climb back up and leave the house', () => gotoLevel('wood', 'house'), { cond: () => !!F.wraithDead, py: 130 });
    if (!F.wraithDead) G.darkMul = 1.08;
  },
  async enter() {
    const F = G.flags, w = this.wraith; if (!w) return;
    if (!F.cellarIntro) {
      await narr('The room is pitch black except for a stream of moonlight coming from a small window.');
      sfx('potion'); G.owlEye = true; tween(G, 'darkMul', .84, 1.2); tween(G, 'lightMul', 1.5, 1.2);
      await narr('You consume an Owl-eye draught to see in the dark.');
      sfx('lever'); shake(4);
      await narr('Suddenly, the bookshelf slides back into place, blocking the passage.');
      await narr('You are trapped!');
      sfx('scream'); cineOn(w, 1.18);
      await narr('You hear a scream coming from the other side of the room.');
      // it flickers into being in the moonbeam
      let flick = true, ft = 0;
      waitFor(dt => { ft += dt; w.alpha = clamp(ft / 1.2, 0, 1) * (.6 + .4 * Math.sin(ft * 31) * Math.sin(ft * 7.3)); return !flick; }).catch(() => { });
      await narr('You turn around and see a ghostly form flickering in the moonlight.');
      flick = false; w.alpha = 1;
      glide(w, 590, 60);
      await narr('The wraith glides across the stone floor towards you. It is a creature of darkness, forever bound to the mortal realm by a curse.');
      w.anim = 'wail'; sfx('wail'); shake(6); ringFx(w.x, GROUND - 80, 'rgba(170,255,240,.8)', 150, .7);
      await narr('The wraith lets out a haunting wail that echoes through the air. The sound is enough to make anyone\'s blood run cold, for it is the cry of a wraith. A harbinger of doom.');
      w.anim = 'idle'; w._glide = null; cineOff();
      await narr('You draw your silver sword and prepare to fight.');
      F.cellarIntro = 1; saveGame();
    } else {
      G.owlEye = true; G.darkMul = .84; G.lightMul = 1.5; w.alpha = 1; cineOn(w, 1.18);
      await narr('The wraith is waiting for you in the dark.');
      cineOff();
    }
    w.alpha = 1; w.untouchable = false;
    setArena(40, 1000); startBoss(w);
    run(async () => { await wait(16); if (!w.dead && !G.player.usedEmber) hint('Steel alone barely bites a wraith. Fire forces it to take form: ' + tk('cast Ember with L', 'tap Ember') + ', then strike.', 9); });
    whenDead([w], async () => {
      endBoss();
      await narr('The wail thins to nothing. The cold drains out of the room.');
      await narr('You collect the wraith\'s head as proof of your victory.');
      F.wraithDead = 1; trophy('The Wraith');
      sfx('lever'); shake(3); tween(this.shelf, 'slide', 110, 1.2);
      await narr('Behind you, the bookshelf grinds open again.');
      clearArena();
      objective(F.rewarded ? '' : (F.knowsWraith || F.readNotice) ? 'Tell the village elder that the wraith is dead.' : 'Contract: destroy the Voidspawn. Continue east, toward the border.');
      saveGame(G.player.x);
    }, 1.8);
  },
};

/* ------------------------------------------------------------
   CHAPTER III — THE TRADE ROAD (trading paths)
   the border guards · the ambush or the merchant · the Werewolf
   ------------------------------------------------------------ */
LEVELS.road = {
  name: 'The Trade Road', sub: 'Chapter III', theme: 'road', width: 8300, entries: { start: 100, east: 8160, graveyard: 5390 },
  wall() { if (!G.flags.crossed) G.bounds.r = 1610; },
  tick() { G.nightAmt = clamp((G.cam.x - 2600) / 3000, 0, 1); },
  build(L) {
    const F = G.flags, S = G.S, me = this;
    me.wall();

    // --- the border ---
    const gate = L.prop('gate', 1700, { open: !!F.crossed });
    L.npc('guard', 1570); L.npc('guard', 1800, { face: false, dir: -1 });
    const jail = async () => {
      await narr('You try to sneak past the guards.');
      await narr('The guards catch you and throw you in jail.');
      gameOver('jail', 'Game Over.', ['You spend the rest of your life in jail.']);
    };
    const goBack = async (line) => {
      await narr(line || (F.wraithDead ? 'You go back to the village to claim your reward.' : 'You go back to the abandoned house to kill the wraith.'));
      gotoLevel('wood', 'east');
    };
    const cross = async () => {
      F.crossed = 1; gate.open = true; sfx('door'); G.bounds.r = me.width - 14;
      await narr('You are on the other side of the border.');
      objective('Contract: destroy the Voidspawn. Follow the trade road to the town of Harrowmere.');
      saveGame(G.player.x);
    };
    const bribe = async () => {
      await narr('You try to bribe the guards with 10 coins.');
      await say('Border Guard', 'Ten? Do I look like a beggar? Fifty, and I never saw you.');
      await narr('The guards say they will let you pass if you give them 50 coins. You have ' + S.coins + ' coins.');
      const c = await choose('What will be your choice?', ['Give the guards 50 coins', 'Refuse and try to sneak past the guards', 'Refuse and try to lie to the guards about killing the wraith', 'Refuse and go back to the abandoned house to kill the wraith']);
      if (c === 0) {
        if (S.coins < 50) {
          await say('Border Guard', 'Nice try.');
          await narr('You don\'t have enough coins.');
          await narr('The guards catch you and throw you in jail.');
          return gameOver('jail', 'Game Over.', ['You spend the rest of your life in jail.']);
        }
        S.coins -= 50; sfx('coin'); F.bribed = 1;
        await narr('The guard snatches the coins from your hand and lets you pass.');
        return cross();
      }
      if (c === 1) return jail();
      if (c === 2) return lie();
      return goBack();
    };
    const lie = async () => {
      await narr('You tell the guards that you killed the wraith that was terrorising the village.');
      await say('Border Guard', 'Did you, now. Prove it.');
      if (F.wraithDead) {
        await narr('You pull the wraith\'s head from your pack and hold it up to the torchlight.');
        await say('Border Guard', 'Gods above! Put it away. Go on, go, before the captain sees that thing.');
        F.showedHead = 1; return cross();
      }
      const c = await choose('The guards ask you to prove it. Which do you choose?', ['Go back to the abandoned house and kill the wraith', 'Try to sneak past the guards', 'Try to bribe the guards']);
      if (c === 0) return goBack('You say you need a second. You run back to the abandoned house to kill the wraith.');
      if (c === 1) return jail();
      return bribe();
    };
    const guardScene = async () => {
      if (F.crossed) return say('Border Guard', 'Move along, hunter.');
      await narr('You reach a territory border.');
      await say('Border Guard', 'Halt. Nobody enters the territory without a pass.');
      if (S.pass) { await narr('You show the guard your pass and he lets you through.'); return cross(); }
      await narr('The guards say that you cannot enter the territory without a pass.');
      const c = await choose('What will your next action be?', [F.wraithDead ? 'Go back to the village and claim your pass' : 'Go back to the abandoned house and kill the wraith', 'Try to sneak past the guards', 'Try to lie to the guards', 'Try to bribe the guards']);
      if (c === 0) return goBack();
      if (c === 1) return jail();
      if (c === 2) return lie();
      return bribe();
    };
    L.zone(1400, 1500, guardScene, { cond: () => !F.crossed });
    L.use(1570, 'Talk to the guard', guardScene);

    L.prop('board', 1960);
    L.use(1960, 'Read the notices', async () => {
      await narr('A board for travellers, nailed up on the far side of the border.');
      await narr('"Bandits on the road. Travel in company."');
      await offerContract('c_grave', 'Under a guild seal: "CONTRACT. The old graveyard off the trade road is being dug up, and whatever digs there is no man. Look for the track past the toppled headstone. 45 coins from the Merchants\' Guild for the thing responsible. Payment from the town guard, just inside the entrance to Harrowmere."');
    }, { py: 130 });
    L.campfire(2150);
    L.mob('wolf', 2800); L.mob('wolf', 2930);

    // --- past the border: the merchant's camp, or the bandits' revenge ---
    if (F.savedMerchant) {
      L.prop('cart', 3780); L.npc('merchant', 3680); L.prop('lamp', 3880);
      L.use(3680, 'Trade with the merchant', async () => {
        if (!F.merchantGift) { F.merchantGift = 1; await say('Merchant', 'You again! The roads are safer for your blade, hunter. Here, for the road. No charge.'); givePotion('vit'); G.S.oil.beast++; await say('Merchant', 'And wolfsbane for your blade. They say something worse than wolves hunts this road after dark.'); }
        else await say('Merchant', 'Back for more? Friend\'s prices, as promised.');
        await openShop("The Merchant's Wares", .8);
      });
    } else if (!F.ambushDone) {
      L.zone(3560, 3680, async () => {
        const px = G.player.x;
        saveGame(px - 120);
        await narr('Suddenly, a group of bandits appear and block your path.');
        const gang = [L.mob('cutthroat', px + 250, { passive: true }), L.mob('bandit', px + 320, { passive: true }), L.mob('cutthroat', px + 390, { passive: true }), L.mob('archer', px + 480, { passive: true })];
        await say('Bandit', 'Remember us? You walked right past us in the wood. Very polite. The old man\'s purse was heavy, and now we will have yours.');
        const sneak = L.mob('bandit', px - 170, { passive: true, dir: 1 }); gang.push(sneak);
        await narr('A hidden bandit attempts to attack you from behind.');
        await narr('Your reflexes allow you to deflect the attack. As the bandits close in, their malicious grins betray their anticipation of an easy victory.');
        setArena(px - 430, px + 560); hostile(gang);
        whenDead(gang, async () => {
          clearArena(); me.wall();
          await narr('In the end, the bandits lie defeated, their reign of terror brought to a swift and merciless end.');
          addCoins(40);
          await narr('Among their loot you find the merchant\'s purse. 40 coins.');
          F.ambushDone = 1; saveGame(G.player.x);
        });
      });
    }

    L.mob('wolf', 4700); L.mob('wolf', 4840); L.mob('wolf', 4960);
    // --- side contract: an overgrown track leads off the road to the old graveyard. Take it or walk on ---
    L.prop('graves', 5270); L.prop('sidepath', 5390, { col: '#6a5560' });
    L.zone(5290, 5410, () => hint('An overgrown track leaves the road here, past a toppled headstone, toward an old graveyard. ' + tk('Press E', 'Tap Use') + ' to take it, or keep to the road.', 9), { flag: 'h_graveyard', noCut: true, cond: () => !(F.c_grave >= 2) });
    L.use(5390, 'Take the track to the graveyard', async () => {
      if (F.c_grave >= 2) return narr('The graveyard is quiet. The dead there are only dead.');
      await narr('An overgrown track leads away from the road, toward a low wall and a rusted gate. The earth along it has been freshly turned.');
      if (await choose('Do you take the track?', ['Take it', 'Stay on the road']) === 0) gotoLevel('graveyard', 'start');
    }, { py: 110 });
    L.campfire(5750);

    // --- the Werewolf ---
    if (!F.werewolfDead) {
      L.prop('wreck', 6720);
      const man = L.npc('traveler', 6640, { anim: 'cower', face: false, dir: -1 });
      L.zone(6280, 6400, async () => {
        saveGame(6180);
        cineOn(man, 1.22); sfx('growl');
        if (!F.wolfSeen) {
          await narr('You can hear a low growl coming from further down the road.');
          await say('Wounded Traveler', 'Stay back! It bit me, three nights ago... I can feel it coming. Run, you fool, RUN—');
          man.anim = 'hurt'; shake(4); sfx('growl');
          await narr('Suddenly, the growl grows louder. His form shifts and contorts as bones snap and fur sprouts from his skin.');
        } else await narr('The traveler is already changing.');
        man.remove = true; G.flashWhite = .25; shake(8);
        const w = L.mob('werewolf', 6640, { passive: true });
        burst(6640, GROUND - 60, 30, '#4a3a2a', { speed: 260 }); sfx('thud'); cineOn(w, 1.26);
        if (!F.wolfSeen) {
          await narr('Its eyes glint with a feral hunger as it bares its razor-sharp teeth, saliva dripping from its jaws. Its fur is mottled, sickly brown, tangled and clumped with gore and filth.');
          w.anim = 'howl'; sfx('howl'); shake(5);
          await narr('The werewolf lets out a blood-curdling howl and charges at you.');
          w.anim = 'crouch'; cineOff();
          await narr('You draw your silver sword and prepare to fight.');
          F.wolfSeen = 1; saveGame(6180);
        } else {
          w.anim = 'howl'; sfx('howl'); shake(5);
          await narr('The werewolf throws back its head and howls.');
          cineOff();
        }
        w.anim = 'idle';
        setArena(6080, 7040); startBoss(w);
        whenDead([w], async () => {
          endBoss(); clearArena();
          await narr('The werewolf finally collapses. For a moment a man\'s face looks up at you from the fur. Then nothing does.');
          await narr('You collect the werewolf\'s head as proof of your victory.');
          F.werewolfDead = 1; trophy('The Werewolf'); saveGame(G.player.x);
        }, 1.8);
      });
    } else L.prop('wreck', 6720);

    L.prop('sign', 8040, { text: 'TOWN' });
    L.exit(8245, 8300, 'town', 'start');
  },
  async enter() {
    const F = G.flags;
    if (!F.roadIntro) { F.roadIntro = 1; await narr('The forest thins. Ahead lies the trade road, and across it, the territory border.'); }
  },
};

/* ------------------------------------------------------------
   CHAPTER IV — HARROWMERE (the town past the border)
   the inn · the apothecary · the chapel crypt and the Elder Vampire
   ------------------------------------------------------------ */
LEVELS.town = {
  name: 'Harrowmere', sub: 'Chapter IV', theme: 'town', width: 5200, entries: { start: 100, crypt: 3350, cistern: 3000 },
  build(L) {
    const F = G.flags, S = G.S;
    L.prop('townhouse', 300, { v: 0 }); L.prop('lamp', 540); L.prop('board', 720); L.prop('barrel', 860);
    L.prop('inn', 1250); L.prop('lamp', 1520); L.prop('townhouse', 1760, { v: 1 }); L.prop('crates', 1930);
    L.prop('shop', 2180); L.prop('lamp', 2440); L.prop('townhouse', 2720, { v: 2 }); L.prop('chapel', 3350); L.prop('lamp', 3720);
    L.prop('townhouse', 4020, { v: 0 }); L.prop('forge', 4250); L.prop('townhouse', 4480, { v: 1 }); L.prop('northGate', 5010);

    L.use(720, 'Read the notices', async () => {
      await narr('Notices, most of them old.');
      await narr('"MISSING: every candle in town. Reward for any explanation."');
      await narr('"WANTED: whatever whispers under the chapel. Reward: the gratitude of the parish. (The parish is broke.)"');
      await narr('"BOUNTY: the beast that hunts the trade road. 60 coins on proof, paid by the town guard."');
      await narr('"SMITH, NORTH END, BY THE GATE: blades honed, armour mended, coin up front."');
      await offerContract('c_rift', 'And one in fresh ink: "CONTRACT. Since the shadow passed over, something moves in the old cistern under the brewery. Two men went down. 50 coins from the Brewers. Ask the innkeeper. The hatch is in the street before the chapel."');
    }, { py: 130 });
    L.npc('guard', 440);
    L.use(440, 'Talk to the town guard', async () => {
      let paid = false;
      // the werewolf's head is worth something here
      if (S.trophies.includes('The Werewolf') && !F.bountyPaid) {
        await say('Town Guard', 'Hold on. Is that... the beast from the trade road? You took its head?');
        await say('Town Guard', 'Three caravans it tore apart. The bounty is yours, hunter, and gladly paid.');
        F.bountyPaid = 1; addCoins(60); saveGame(G.player.x);
        await narr('The guard counts 60 coins into your hand.');
        paid = true;
      }
      if (await payContract('c_grave', 'Town Guard', 'Finger bones on a string. So that is what was in the graves. The Guild left a purse here for whoever brought proof.')) paid = true;
      if (paid) return say('Town Guard', 'If you mean to spend it, the smith by the north gate does honest work.');
      await say('Town Guard', 'Keep your blade sheathed inside the walls, hunter. We have had enough dark things this week.');
    });
    L.npc('child', 960);
    L.use(960, 'Talk', () => say('Child', 'Are you a real monster hunter? The dark thing ate all our candles. Mother says it went north to eat the snow.'));
    L.npc('woman', 1640);
    L.use(1640, 'Talk', () => say('Townswoman', 'It passed right over my house. The milk went black in the jug and the dog has not barked since.'));

    L.use(1250, 'Enter the inn', async () => {
      sfx('door');
      await payContract('c_rift', 'Innkeeper', 'The cistern is quiet? You closed it? Then the Brewers owe you, and I hold their purse. Drink is on the house as well.');
      if (!F.innSeen) { F.innSeen = 1; await narr('You ask around about the Voidspawn in the inn.'); }
      for (;;) {
        const c = await choose('What will it be, stranger?', ['Ask about the Voidspawn', 'Ask about the whispers under the chapel', 'Rest for the night (10 coins)', 'Leave'], 'Innkeeper');
        if (c === 0) {
          await say('Innkeeper', 'The shadow? Aye. Three nights back, every candle in Harrowmere went out at once.');
          await say('Innkeeper', 'It hung over the square like a hole in the sky. Then it drifted north, up the Frostfang Pass.');
          await say('Innkeeper', 'The apothecary swears starglass oil cuts shadow. Mind you, she would. She sells it.');
          await say('Innkeeper', 'Nothing comes down from there now but cold. The north gate is at the far end of town, if you are that tired of living.');
          F.knowsPass = 1; objective('Contract: destroy the Voidspawn. Take the north gate to the Frostfang Pass.');
        } else if (c === 1) {
          await say('Innkeeper', 'Something whispers beneath the old chapel. Has done since my grandmother was a girl.');
          await say('Innkeeper', 'The priests say it asks riddles. Nobody who went down ever came back up to argue the point.');
          F.knowsCrypt = 1;
        } else if (c === 2) {
          if (S.coins < 10) { await say('Innkeeper', 'Ten coins a bed. You are short, friend.'); continue; }
          S.coins -= 10; sfx('coin'); await fadeTo(1, .6); S.hp = S.maxHp; S.sta = S.maxSta; await wait(.6); await fadeTo(0, .6);
          saveGame(G.player.x);
          await narr('You sleep without dreams. Your health is restored.');
        } else return;
      }
    }, { py: 130 });

    L.npc('apothecary', 2100);
    L.use(2100, 'Trade with the apothecary', async () => {
      await say('Apothecary', 'Hunter. You look like you bleed for a living. I can help with that.');
      await openShop('The Apothecary');
    });

    // --- side contract: the hatch down to the old cistern ---
    L.prop('hatch', 3000);
    L.use(3000, 'Climb down into the old cistern', async () => {
      if (F.c_rift >= 2) return narr('The cistern below is quiet. Whatever was torn open down there is closed.');
      sfx('door');
      gotoLevel('cistern', 'start');
    }, { py: 70 });

    // --- the blacksmith: upgrades for coins ---
    L.npc('blacksmith', 4170);
    L.use(4170, 'Talk to the blacksmith', async () => {
      if (!F.smithMet) {
        F.smithMet = 1;
        await say('Blacksmith', 'A hunter. I can tell by the state of that blade. What have you been cutting with it, gravestones?');
        await say('Blacksmith', 'I can put a proper edge on it, and see to that armour while I am at it. Good work costs good coin.');
      } else await say('Blacksmith', 'Back again? Let us see what else I can do for you.');
      await openShop("The Blacksmith's Forge", upgradeItems());
      saveGame(G.player.x);
    });

    L.use(3350, 'Descend into the chapel crypt', async () => {
      if (F.vampDone) return narr('The crypt below the chapel is silent now.');
      if (!F.cryptSeen) { F.cryptSeen = 1; await narr('The chapel is empty. Behind the altar, worn steps lead down into the dark, and from the dark comes a faint whispering.'); }
      gotoLevel('crypt', 'start');
    }, { py: 130 });

    L.zone(4900, 5000, async () => {
      const c = await choose('A bitter wind blows through the north gate. Beyond it lies the Frostfang Pass, where the Voidspawn went. There is no turning back once you leave. Are you ready?', ['Enter the Frostfang Pass', 'Not yet']);
      if (c === 0) return gotoLevel('pass', 'start');
      G.player.x = 4850; G.player.dir = -1;
    }, { once: false });
  },
  async enter() {
    const F = G.flags;
    if (!F.townIntro) {
      F.townIntro = 1;
      await narr('You carry on with your journey.');
      await narr('You arrive at the town where the Voidspawn was last seen.');
      objective('Contract: destroy the Voidspawn. Ask around Harrowmere. The inn is a good place to start.');
    }
  },
};

/* --- side contract: Greymaw's den, down the trail of bones --- */
LEVELS.den = {
  name: "Greymaw's Den", theme: 'wood', width: 2000, entries: { start: 160 },
  build(L) {
    const F = G.flags;
    L.prop('sidepath', 70, { col: '#8a6a34' });
    L.use(70, 'Go back to the road', () => gotoLevel('wood', 'den'), { py: 110 });
    L.prop('bones', 430); L.prop('rock', 640, { s: 1.3, col: '#1c2311' }); L.prop('bones', 900, { flip: true });
    if (!(F.c_wolf >= 2)) { L.mob('wolf', 720); L.mob('wolf', 860); }
    L.prop('rock', 1340, { s: 1.5, col: '#1c2311' }); L.prop('bones', 1410); L.prop('rock', 1560, { s: 1.9, col: '#1a200f' }); L.prop('bones', 1640, { flip: true });
    contractHunt(L, {
      id: 'c_wolf', mob: 'greymaw', x: 1480, near: 260, arena: [1040, 1900], opts: { anim: 'crouch', idleAnim: 'crouch' },
      async reveal(e) {
        sfx('growl');
        await narr('Bones crack under your boots. Sheep, mostly. Not all of them.');
        e.idleAnim = null; e.anim = 'idle'; sfx('growl'); shake(3);
        await narr('Greymaw rises from behind the rocks: twice the size of any wolf in this wood, black as a burnt log, one ear long since torn away.');
        e.anim = 'crouch';
        await narr('It does not snarl. It lowers its head and looks at you the way it looked at the shepherd.');
      },
      async after() {
        await narr('Greymaw falls and does not get up. The wood goes very quiet.');
        await narr('You cut away what is left of its torn ear as proof.');
      },
    });
  },
  async enter() {
    const F = G.flags;
    if (F.denIntro || F.c_wolf >= 2) return; F.denIntro = 1;
    await narr('The trees close in. The trail of bones grows thicker the further you go.');
  },
};

/* --- side contract: the old graveyard, off the trade road --- */
LEVELS.graveyard = {
  name: 'The Old Graveyard', theme: 'road', width: 2000, entries: { start: 160 },
  tick() { G.nightAmt = .85; },
  build(L) {
    const F = G.flags;
    L.prop('sidepath', 70, { col: '#6a5560' });
    L.use(70, 'Go back to the road', () => gotoLevel('road', 'graveyard'), { py: 110 });
    L.prop('graves', 480); L.prop('graves', 800, { flip: true });
    if (!(F.c_grave >= 2)) { L.mob('ghoul', 700); L.mob('ghoul', 880); }
    L.prop('graves', 1250); L.prop('graves', 1400, { flip: true }); L.prop('graves', 1550);
    contractHunt(L, {
      id: 'c_grave', mob: 'gravemother', x: 1400, near: 260, arena: [960, 1900], zoom: 1.2, opts: { anim: 'crouch', idleAnim: 'crouch', graves: [1250, 1550] },
      async reveal(e) {
        await narr('The graves here have been torn open, one after another, like a row of pulled teeth.');
        await narr('Something is crouched in the last of them. It is eating.');
        e.idleAnim = null; e.anim = 'idle'; sfx('growl');
        await narr('It unfolds itself: a ghoul grown huge and old on a hundred burials, a string of finger bones rattling at its throat.');
        e.anim = 'howl'; sfx('scream'); shake(5);
        await narr('The Gravemother shrieks, and somewhere under your feet the earth begins to stir.');
      },
      async after() {
        await narr('The Gravemother folds into the grave she was robbing. It fits her well enough.');
        await narr('You take the string of finger bones as proof.');
      },
    });
  },
  async enter() {
    const F = G.flags;
    if (F.graveIntro || F.c_grave >= 2) return; F.graveIntro = 1;
    await narr('Beyond the rusted gate the headstones lean like drunks. No one has tended this place in a long time. Something has been visiting it all the same.');
  },
};

/* --- side contract: the old cistern and the Void Wound --- */
LEVELS.cistern = {
  name: 'The Old Cistern', theme: 'cellar', width: 1700, entries: { start: 150 },
  build(L) {
    const F = G.flags;
    G.darkMul = .86; G.lightMul = 1.25;
    L.prop('door', 70, { col: '#1e2230' }); L.prop('barrel', 320); L.prop('crates', 520); L.prop('junk', 760); L.prop('scar', 930, { light: 190, ly: 14, ls: .5 }); L.prop('barrel', 1180);
    L.use(70, 'Climb back up to the street', () => gotoLevel('town', 'cistern'), { py: 130 });
    if (F.c_rift >= 2) return;
    L.mob('voidling', 640); L.mob('voidling', 820);
    contractHunt(L, {
      id: 'c_rift', mob: 'wound', x: 1440, near: 330, arena: [960, 1660], zoom: 1.12,
      async reveal(e) {
        await narr('The air tastes of iron. Your breath hangs in front of you and does not drift.');
        sfx('void'); shake(4);
        await narr('A wound hangs in the dark where the Voidspawn passed over: a tear in the air itself, its edges fluttering like burnt paper.');
        await narr('Through it you can see stars. They are not yours. Something on the other side has noticed you.');
      },
      async after() {
        await narr('The tear pulls shut like a held breath let go. The dark down here is only dark again.');
        await narr('There is nothing to carry back as proof. The quiet will have to do.');
      },
    });
  },
  async enter() {
    const F = G.flags;
    if (F.cisternIntro || F.c_rift >= 2) return; F.cisternIntro = 1;
    await narr('The hatch opens on a stair slick with moss. The cistern has been dry for years.');
    await narr('The darkness down here is the wrong colour.');
  },
};

/* --- the crypt: the Elder Vampire and his riddles --- */
const RIDDLES = [
  { q: 'I speak without a mouth and hear without ears. I have no body, but I come alive in tunnels. What am I?', a: ['A ghost', 'An echo', 'A shadow', 'A whisper'], ok: 1, yes: 'Correct. Next question.' },
  { q: 'I can be cracked, made, told, and played. What am I?', a: ['A joke', 'A song', 'A riddle', 'A story'], ok: 0, yes: 'Impressive. Let\'s continue.' },
  { q: 'I am a box that holds keys without locks, yet they can unlock your soul. What am I?', a: ['An accordion', 'A book', 'A treasure chest', 'A piano'], ok: 3, yes: 'Well done. One more question.' },
  { q: 'The more you take, the more you leave behind. What am I?', a: ['Money', 'A trail', 'A footprint', 'A legacy'], ok: 2, yes: null },
];
LEVELS.crypt = {
  name: 'Beneath the Chapel', theme: 'crypt', width: 2700, entries: { start: 130 },
  build(L) {
    const F = G.flags, S = G.S, V = 'The Figure';
    L.prop('door', 80, { col: '#1e2230' }); L.prop('statue', 430); L.prop('junk', 600); L.prop('statue', 930, { broken: true }); L.prop('junk', 1090); L.prop('statue', 1560);
    const ped = L.prop('pedestal', 2140, { taken: !!S.crystal, light: S.crystal ? 0 : 380, ly: 100 });
    L.prop('throne', 2460);
    L.use(80, 'Climb back up to the chapel', () => gotoLevel('town', 'crypt'), { py: 130 });
    L.mob('ghoul', 780); L.mob('boneguard', 1100); L.mob('boneguard', 1260);
    if (F.vampDone) return;

    // first visit: he sits on his throne; after that he is already on his feet
    const vamp = L.mob('vampire', F.vampSeen ? 2330 : 2463, F.vampSeen ? { passive: true } : { passive: true, anim: 'sit', idleAnim: 'sit' });
    const takeCrystal = async () => {
      G.player.walkTo = 2110; await until(() => G.player.walkTo === null);
      await narr('You walk over to the pedestal and pick up the crystal.');
      ped.taken = true; ped.light = 0; sfx('crystal'); G.flashWhite = .35; burst(2140, GROUND - 100, 30, '#bfe0ff', { glow: '120,170,255', speed: 240, g: 0 });
      await narr('As you hold the crystal in your hands, you feel a surge of energy course through your body.');
      S.crystal = true; S.maxHp += 20; S.hp = S.maxHp;
      await narr('You feel stronger, faster, and more powerful than ever before.');
    };
    const fight = async (line) => {
      if (line) await say('The Elder Vampire', line);
      await narr('With lightning speed, the vampire lunges towards you, its eyes gleaming with a hunger for blood.');
      await narr('The air crackles with energy as the battle begins. You brace yourself, steeling your resolve to face this formidable opponent.');
      setArena(1700, 2610); startBoss(vamp);
      whenDead([vamp], async () => {
        endBoss(); clearArena();
        await narr('The elder vampire staggers, astonished, and crumbles into ash. Thousands of years end in a single breath.');
        await narr('You collect the vampire\'s signet ring as proof of your victory.');
        trophy('The Elder Vampire');
        await takeCrystal();
        F.vampDone = 1; F.vampDead = 1; saveGame(G.player.x);
      }, 1.8);
    };
    const exitScene = async () => {
      await narr('The vampire steps aside and gestures towards the pedestal.');
      await say('The Elder Vampire', 'Take the crystal and leave this place.');
      await takeCrystal();
      cineOn(vamp, 1.22);
      await narr('The vampire looks at you with a look of relief.');
      await say('The Elder Vampire', 'You have done well, mortal.');
      await say('The Elder Vampire', 'That crystal is the source of my power, and the lock upon my prison. While it rested there, I could not leave.');
      await say('The Elder Vampire', 'I have been trapped in this dungeon for thousands of years, unable to escape. I was exiled here by my own kind, for I was too powerful and too dangerous to be allowed to live.');
      await say('The Elder Vampire', 'I have been waiting for someone like you to come along and free me from this prison. I am eternally grateful to you, mortal.');
      await say('The Elder Vampire', 'I will now return to my home, and I will never bother you again. Leave this place and never return.');
      vamp.untouchable = true; vamp.passive = true; vamp.dir = 1; glide(vamp, 2660, 70, 'walk'); tween(vamp, 'alpha', 0, 2.4);
      await narr('The vampire turns around and walks away. You watch as he disappears into the darkness.');
      vamp.remove = true; cineOff(); F.vampDone = 1; F.vampFreed = 1; saveGame(G.player.x);
    };
    const riddles = async () => {
      await say(V, 'Very well. I will allow you to pass. But first, you must answer correctly a series of riddles.');
      if (await choose('Do you accept my challenge?', ['Yes', 'No'], V) === 1) return fight('Then you are merely a trespasser. And I am so very hungry.');
      await say(V, 'Very well. Let us begin.');
      for (const r of RIDDLES) {
        const c = await choose(r.q, r.a, V);
        if (c !== r.ok) return fight('Wrong. A pity. I had such hopes for you.');
        if (r.yes) await say(V, r.yes);
      }
      await narr('You can see a sense of fascination and frustration in the being\'s eyes and face.');
      await say(V, 'You have answered all my riddles correctly. I am impressed.');
      await say(V, 'Out of all the mortals that have come here in my thousands of years, you are the first to answer all my riddles correctly.');
      await say(V, 'I will allow you to pass. But first, I must ask you one final question.');
      if (await choose('Do you know what I am?', ['Yes', 'No'], V) === 0) {
        await narr('You look at the being and say, "You are an elder vampire."');
        await say('The Elder Vampire', 'Very well. You may pass.');
      } else {
        await say(V, 'Very well. I will tell you. I am a vampire.');
        await say('The Elder Vampire', 'I have lived for thousands of years, and I have seen many things. I have seen the rise and fall of empires, the birth and death of kings, and the creation and destruction of worlds.');
        await say('The Elder Vampire', 'The sun\'s rays are forever barred to me, a reminder of a life lost long ago. The touch of loved ones, a memory that haunts me in the silent hours of the night.');
        await say('The Elder Vampire', 'But such is the curse of immortality: a bittersweet existence where shadows reign supreme.');
      }
      return exitScene();
    };
    L.zone(1380, 1470, async () => {
      F.lightSeen = 1;
      await narr('You hear a faint whispering sound coming from the darkness ahead. With each step, the whispering grows louder and louder.');
      await narr('As you round the corner, you see a faint glimmer of light in the distance.');
      if (await choose('Do you walk towards the light?', ['Yes', 'No']) === 0) await narr('You quicken your pace and walk towards the light. The light grows brighter and brighter as you approach it.');
      else await narr('You stop. The whispering does not.');
    }, { cond: () => !F.lightSeen });
    L.zone(1820, 1920, async () => {
      G.player.walkTo = 2010;
      if (!F.vampSeen) {
        cineOn(ped.x, 1.12);
        await narr('You finally step into a large chamber bathed in an eerie, blue glow.');
        await narr('In the centre of the chamber, you see a stone pedestal with a shimmering crystal resting on top. The crystal pulses with a strange, otherworldly energy.');
        cineOn(vamp, 1.28);
        await narr('As you approach the pedestal, you notice a figure sitting on a stone throne in the corner.');
        vamp.idleAnim = null; vamp.anim = 'idle';
        await narr('The figure stands up, draped in a long, flowing cloak.');
        await narr('Its skin is as pale as the moon, and its eyes are deep, dark pools of darkness that seem to draw you in. You can see its fangs glistening in the faint light.');
        const step = glide(vamp, 2330, 62, 'walk');
        await narr('The figure moves with a fluid grace, every step deliberate and precise. Its movements are almost hypnotic, and you find yourself unable to look away.');
        await step;
        await say(V, 'Welcome, mortal.');
        F.vampSeen = 1; saveGame(1740);
      } else { cineOn(vamp, 1.28); await say(V, 'You return. Persistent, for a mortal.'); }
      await say(V, 'What brings you to my domain?');
      await narr('The nocturnal entity looks at you with a predatory smile.');
      cineOff();
      const c = await choose('How will you respond?', ['"I hunt the Voidspawn. The whispers led me down here."', 'Say nothing.', '[ATTACK]', '[RUN AWAY]']);
      if (c === 0) { await say(V, 'A hunter of the void. How very novel.'); return riddles(); }
      if (c === 1) { await narr('You hold his gaze and say nothing.'); await say(V, 'Silence. So rare in the living. I find I rather like you.'); return riddles(); }
      if (c === 2) return fight(null);
      await narr('You hurriedly turn around and run, trying to find a way out of the dungeon.');
      await narr('You see an open door and run towards it. Suddenly, you hear a loud roar behind you.');
      await narr('You run faster and faster, but the figure is gaining on you. You reach the door and slam it shut behind you.');
      await narr('You hear the figure slam into the door.');
      F.vampFled = 1;
      gotoLevel('town', 'crypt');
    });
  },
  async enter() {
    const F = G.flags;
    if (F.cryptIntro) return; F.cryptIntro = 1;
    await narr('As you walk through the dungeon, you hear the distant sound of water dripping and the occasional scurrying of small rodents, but otherwise the dungeon is silent and still.');
    await narr('The air grows colder and mustier. You see rusted swords, broken shields, and crumbling statues of long-forgotten heroes scattered across the dungeon.');
    await narr('Your senses are assaulted by the stench of rotting flesh. Something else is down here with you.');
  },
};

/* ------------------------------------------------------------
   CHAPTER V — THE FROSTFANG PASS (winter)
   the Voidspawn
   ------------------------------------------------------------ */
LEVELS.pass = {
  name: 'The Frostfang Pass', sub: 'Chapter V', theme: 'winter', width: 5700, entries: { start: 100 },
  build(L) {
    const F = G.flags;
    L.prop('rock', 420, { s: 1.3, col: '#0a3549' }); L.prop('scar', 900);
    // the frozen dead of the pass break out of the ice when you come close
    const thaw = x => { const pr = L.prop('frozen', x); L.zone(x - 150, x + 150, () => { pr.hidden = true; sfx('wardBreak'); shake(4); burst(x, GROUND - 50, 22, '#cfeefa', { speed: 220 }); const m = L.mob('rimebound', x); m.state = 'chase'; m.cd = .6; }, { noCut: true }); };
    L.mob('voidling', 1050); L.mob('voidling', 1180); L.mob('rimewolf', 1330); L.mob('rimewolf', 1440);
    L.prop('tent', 1560); thaw(1680);
    L.use(1560, 'Search the camp', async () => {
      await narr('Another hunter\'s camp. The fire has been cold for days.');
      await narr('Whatever they were hunting found them first.');
      if (!F.campLoot) { F.campLoot = 1; givePotion('vit'); G.S.pot.foc++; G.S.oil.void++; await narr('You find an Elixir of Avian Vitality, a Focus-fire Draught and a flask of Starglass Oil in the pack. They will not be missed.'); }
    });
    L.mob('voidling', 2050); L.mob('voidling', 2180); L.mob('stalker', 2380);
    L.prop('scar', 2500); thaw(2700); L.prop('rock', 2860, { s: 1.6, col: '#0a3549' });
    L.mob('voidling', 3050); L.mob('stalker', 3200); L.mob('rimewolf', 3330); L.mob('voidling', 3430);
    L.prop('scar', 3600);
    L.campfire(3900);
    thaw(4300); L.prop('scar', 4480);

    const boss = L.mob('voidspawn', 5200, { passive: true, alpha: 0, untouchable: true });
    L.zone(4620, 4720, async () => {
      saveGame(4520);
      G.ambFreeze = true;   // the snow hangs in the air until the Voidspawn is dead
      if (!F.voidSeen) {
        await narr('The snow stops falling. It does not land. Each flake simply hangs in the air.');
        cineOn(boss.x, 1.0);
        await narr('The shadows of the dead trees bend the wrong way, all of them, toward a single point ahead.');
      }
      cineOn(boss, 1.1); sfx('void'); shake(7); tween(boss, 'alpha', 1, 1.8);
      if (!F.voidSeen) {
        await narr('A swirling mass of shadow, ever-shifting, without face or form. It has nothing to look at you with. It looks at you anyway.');
        cineOff();
        await narr('You draw your silver sword. This is the contract.');
        F.voidSeen = 1; saveGame(4520);
      } else { await narr('The Voidspawn is waiting.'); cineOff(); }
      boss.alpha = 1; boss.untouchable = false;
      setArena(4560, 5640); startBoss(boss);

      // the vampire keeps his word... mostly
      if (F.vampFreed) run(async () => {
        await until(() => boss.hp < boss.maxHp * .5 || boss.dead);
        if (boss.dead) return;
        await cut(async () => {
          await say('A Familiar Voice', 'I told you I would never bother you again, mortal.');
          const v = L.npc('vampire', clamp(boss.x - sgn(boss.x - G.player.x) * 150, 4600, 5600), { alpha: 0, face: false });
          v.dir = sgn(boss.x - v.x); await tween(v, 'alpha', 1, .5);
          await say('The Elder Vampire', 'I lied. A little.');
          v.anim = 'attack'; v.atkKind = 2; tween(v, 'ap', 1, .4);
          sfx('heavy'); sfx('void'); G.flashWhite = .4; shake(14);
          for (let i = 0; i < 5; i++) burst(boss.x + rand(-50, 50), GROUND - rand(60, 200), 16, '#ff5a6a', { glow: '255,80,100', speed: 300 });
          boss.hp = Math.max(1, boss.hp - boss.maxHp * .18); boss.stun = 5; boss.flash = .3; boss.state = 'drift'; boss.cd = 5.5;
          for (const x of G.ents) if (x.hazard || x.proj) x.remove = true;
          await wait(.6); v.anim = 'idle';
          await say('The Elder Vampire', 'Consider my debt paid. Its core is open. Finish it.');
          await tween(v, 'alpha', 0, .8); v.remove = true; F.vampHelped = 1;
        });
      });

      whenDead([boss], async () => {
        endBoss(); Music.set(null);
        await narr('The mass collapses inward, folding smaller and smaller, until nothing is left but a sound like a held breath finally let go.');
        G.ambFreeze = false;
        await narr('The snow begins to fall again.');
        F.voidDead = 1; G.S.trophies.push('The Voidspawn'); startEnding();
      }, 3.2);
    });
  },
  async enter() {
    const F = G.flags;
    if (F.passIntro) return; F.passIntro = 1;
    await narr('The cold bites deeper with every step. Snow swallows the road behind you.');
    await narr('Here and there the ground is scorched in black spirals. You are close.');
    objective('Contract: destroy the Voidspawn.');
  },
};

/* ---------- the ending: what became of your choices ---------- */
function endingLines() {
  const F = G.flags, S = G.S, out = [];
  out.push('The Voidspawn is destroyed. The contract is complete.');
  if (F.lanternDead) out.push('On the Mistmoor, no light bobs in the fog any more.');
  if (F.savedMerchant) out.push('The merchant you saved in the Hollow Wood still tells the story to anyone who will listen. He adds a few more bandits every time.');
  else if (F.looted) out.push('The merchant you walked past was found dead in the forest. His purse was never found. You know where it went.');
  else out.push('The merchant you walked past was found dead in the forest. Some nights you still hear him calling for help.');
  if (F.wraithDead) out.push('The village sleeps soundly now that the wraith is gone.');
  else out.push('In the Hollow Wood, something still screams in the abandoned house at night.');
  if (F.bribed) out.push('At the border, two guards are fifty coins richer and none the wiser.');
  else if (F.showedHead) out.push('At the border, two guards still flinch whenever a traveler opens a pack.');
  out.push('On the trade road, a stranger\'s curse ended beneath a full moon.');
  if (F.vampHelped) out.push('Somewhere, an elder vampire walks free for the first time in thousands of years. He kept his word. Mostly.');
  else if (F.vampFreed) out.push('Somewhere, an elder vampire walks free for the first time in thousands of years.');
  else if (F.vampDead) out.push('Beneath the chapel of Harrowmere, a throne sits empty under a film of ash.');
  else out.push('Beneath the chapel of Harrowmere, something still whispers riddles to the dark.');
  const done = Object.keys(CONTRACTS).filter(id => F[id] >= 2).length;
  if (done === 3) out.push('Three notice boards are a little emptier for your passing, and three places sleep easier.');
  else if (done > 0) out.push('You left ' + (done === 1 ? 'one notice board' : 'two notice boards') + ' a little emptier than you found ' + (done === 1 ? 'it' : 'them') + '.');
  out.push('You continue your journey until the next contract.');
  return out;
}
/* ---------- how much of the game a hunt uncovered ----------
   The ending shows these only as counts ("4 of 9"), never as a list, so nothing is given away. */
function huntFound() {
  const F = G.flags, S = G.S, out = [], add = (cat, id, ok) => { if (ok) out.push(cat + ':' + id); };
  // story paths: outcomes of the choices. Several exclude each other, so one hunt can never see them all
  add('path', 'saved', F.savedMerchant); add('path', 'ignored', F.ignoredBandits); add('path', 'looted', F.looted); add('path', 'leftBody', F.bodyDone && !F.looted);
  add('path', 'pass', F.crossed && !F.bribed && !F.showedHead); add('path', 'bribed', F.bribed); add('path', 'showedHead', F.showedHead);
  add('path', 'riddles', F.vampFreed); add('path', 'slewVampire', F.vampDead); add('path', 'fledVampire', F.vampFled); add('path', 'ambush', F.ambushDone); add('path', 'leftHouse', !F.wraithDead);
  // secrets: things off to the side that nobody makes you do
  add('secret', 'survivor', F.survivor); add('secret', 'scar', F.scarSeen); add('secret', 'lab', F.labLoot); add('secret', 'notice', F.readNotice); add('secret', 'rumour', F.knowsCrypt);
  add('secret', 'bounty', F.bountyPaid); add('secret', 'smith', F.smithMet); add('secret', 'camp', F.campLoot); add('secret', 'gift', F.merchantGift);
  for (const id in CONTRACTS) add('contract', id, F[id] >= 2);
  add('boss', 'lantern', F.lanternDead); add('boss', 'wraith', F.wraithDead); add('boss', 'werewolf', F.werewolfDead); add('boss', 'vampire', F.vampDead); add('boss', 'voidspawn', F.voidDead);
  for (const k in (S.slain || {})) if (MOBS[k] && k !== 'bat' && k !== 'rift') add('kind', k, true);
  return out;
}
const HUNT_CATS = [['path', 'Story paths taken', 13], ['secret', 'Secrets found', 9], ['contract', 'Side contracts', 3], ['boss', 'Great creatures slain', 5], ['kind', 'Kinds of creature slain', 0]];
function huntSummary() {
  const run = huntFound(); addFound(run);
  const all = readFound().concat(run), count = (list, cat) => new Set(list.filter(x => x.startsWith(cat + ':'))).size;
  const kinds = Object.keys(MOBS).filter(k => k !== 'bat' && k !== 'rift').length;
  const cats = HUNT_CATS.map(([cat, label, total]) => ({ label, total: total || kinds, n: count(run, cat), all: count(all, cat) }));
  const sum = k => cats.reduce((a, c) => a + Math.min(c[k], c.total), 0), total = cats.reduce((a, c) => a + c.total, 0);
  return { cats, pct: Math.round(sum('n') / total * 100), allPct: Math.round(sum('all') / total * 100) };
}
function startEnding() {
  const S = G.S, m = Math.floor(S.time / 60), s = Math.floor(S.time % 60);
  const sv = Save.read();
  G.ending = { lines: endingLines(), i: 0, t: 0, stats: ['Time: ' + m + 'm ' + (s < 10 ? '0' : '') + s + 's', 'Creatures slain: ' + (S.kills || 0), 'Deaths: ' + ((sv && sv.S.deaths) || 0), 'Coins: ' + S.coins, 'Side contracts: ' + Object.keys(CONTRACTS).filter(id => G.flags[id] >= 2).length + ' of 3', 'Trophies: ' + (S.trophies.join(', ') || 'none')] };
  G.ending.found = huntSummary();
  // finishing the game opens a harder hunt that keeps your strength
  writePlus({ name: S.name, atk: S.atk, def: S.def, maxHp: S.maxHp - (S.crystal ? 20 : 0), maxSta: S.maxSta, up: S.up || {}, pot: S.pot, oil: S.oil, coins: S.coins, diff: S.diff, plus: (S.plus || 0) + 1 });
  G.state = 'ending'; Music.set('title'); sfx('victory'); Save.clear();
}
