# Cursed Creatures: Tales of the Hunt

A 2D side-scrolling action-adventure, grown out of the text adventure
(`main2.0.py`) and the Pygame side-scroller idea (five level folders).

A game by AGRobatix. Code, art and sound created with Claude.

## How to play

Double-click `index.html`. It opens in your browser; nothing to install.

| Keys | Action |
| --- | --- |
| A / D or ← → | Move |
| W / Space / ↑ | Jump |
| J / Z / mouse click | Sword attack (press again to chain three strikes) |
| Hold J / Z | Charge a heavy blow: knocks enemies down and staggers bosses |
| Attack in the air | Plunging strike that hits everything around you |
| S / ↓ (hold) | Block. Block just before a hit lands to parry it |
| K / X | Dodge-roll (you cannot be hit while rolling). Attack during a roll to come out with the finishing strike |
| Shift (hold) | Sprint. Uses stamina |
| 4 5 6 | Coat your blade with an oil: 4 Gravesalt (the dead), 5 Wolfsbane (beasts), 6 Starglass (void things) |
| L / C | Ember glyph: a burst of fire |
| I / V | Ward glyph: absorbs the next blow |
| 1 2 3 | Drink a potion |
| E | Talk, examine, rest at campfires |
| Esc / P | Pause · M mutes sound · F fullscreen |

The game saves by itself when you enter a new area, rest at a campfire and
before each boss. "Continue" on the title screen loads the last save.

## The five chapters

1. **The Mistmoor** (fog / grassland): the contract, the ruined village, the Lantern Man
2. **The Hollow Wood** (forest): the bandits and the merchant, the abandoned house and the Wraith, the village
3. **The Trade Road** (trading paths): the border guards, the ambush or the merchant's camp, the Werewolf
4. **Harrowmere** (the town past the border): inn, apothecary, the blacksmith (upgrades for coins), the Elder Vampire and his riddles
5. **The Frostfang Pass** (winter): the Voidspawn

## Other ways to play

- **Gamepad:** stick or d-pad to move, A jump, X attack (hold to charge), B roll, Y talk/use, LB block,
  RB Ember, LT Ward, RT sprint, d-pad up heals, d-pad down applies the right oil, Start pauses.
- **Touch screen:** drag on the left side to move (drag further to sprint). Attack, Roll, Jump, Block and the
  two glyphs are by your right thumb. At the top left are Heal, Oil (applies the oil that suits the nearest
  creature) and the Pouch, which pauses the fight and shows every potion and oil as a large button.
- **Difficulty:** Story, Hunter or Nightmare, chosen when a hunt starts and changeable from the pause menu.

## New Hunt +

Finishing the game adds "New Hunt +" to the title screen. It starts the story again at once, on the
difficulty you finished with, keeping your attack, defense, health, stamina, blacksmith upgrades, potions,
oils and coins, against creatures with 60% more health and 30% more attack. Each further completion makes
them tougher again.

## Moving a save to another device

"Save code" on the title screen turns your save into a block of letters and digits (about a thousand characters
late in the game). Copy it, send it to yourself, and on the other device choose Save code and paste it in.
There is no account and nothing is sent anywhere: the code *is* the save. It carries the hunt in progress, the
New Hunt + record and the list of things found. Loading a code replaces the hunt on that device (the game asks
first); the New Hunt + record is never lowered.

## The numbers page

After the epilogue, the game shows how much of it that hunt uncovered: story paths, secrets, side contracts,
great creatures and kinds of creature, as counts only. A fainter bar shows what has been found across every
hunt played in that browser. Some story paths exclude each other, so one hunt can never reach 100%.

## Side contracts

Three notice boards offer an optional hunt each. Each creature lives off the main road, down a side path you can choose to follow. Kill it, then collect the reward.

| Board | Creature | Where | Reward | Paid by |
| --- | --- | --- | --- | --- |
| Village in the Hollow Wood | Greymaw, the black wolf | Down the trail of bones that leaves the road east of the village | 35 coins | The village elder |
| Border post on the Trade Road | The Gravemother | The old graveyard, down the track by the toppled headstone | 45 coins | The town guard just inside the entrance to Harrowmere |
| Harrowmere | The Void Wound | The old cistern (hatch in the street before the chapel) | 50 coins | The innkeeper |

## Running smoothly everywhere

Safari on a Mac draws large stretched pictures much more slowly than Chrome. If the game notices it is running
slowly for a few seconds, it helps itself: first it keeps the scenery at exact screen size so nothing has to be
stretched ("stamping", in `js/art.js`), and if that is not enough it lowers the drawing resolution a little
(`watchSpeed` in `js/core.js`). Fast browsers and phones never switch either on.

## Where things live

| File | What is in it |
| --- | --- |
| `js/levels.js` | The story: every chapter, scene, line of dialogue and choice. Start here to change or add story. |
| `js/entities.js` | The hunter, ordinary enemies and their stats |
| `js/bosses.js` | Wraith, Werewolf, Elder Vampire, Voidspawn, and the three contract creatures |
| `js/art.js` | All pictures, drawn in code: scenery, props, characters |
| `js/game.js` | Dialogue boxes, shops, potion and upgrade prices (`POTIONS`, `UPGRADES`), HUD, saving, level loading |
| `js/main.js` | Title screen, menus, game over, ending |
| `js/transfer.js` | The Save code screen: packing a save into a code and reading one back |
| `js/core.js` | Keyboard, saving, small helpers |
| `js/controls.js` | Gamepad, touch-screen buttons, fullscreen |
| `js/audio.js` | All sound and music, synthesised in code: instruments, ambience, effects, the chord progressions for each chapter |

Writing a scene in `levels.js` looks like this:

```js
await narr('You see an abandoned house.');
await say('Merchant', 'Please! Somebody, help me!');
const c = await choose('What do you do?', ['Fight the bandits', 'Keep walking']);
if (c === 0) { /* first option */ }
```
