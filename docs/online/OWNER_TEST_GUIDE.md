# Online test guide for the owner (Twister)

Owner: Claude-A · covers SAT-ONLINE-001 … 031 · دليل اختبار الأونلاين — خطوة بخطوة

## 0. Deploy the database rules once (after pulling the top branch)

```powershell
git fetch origin
git checkout claude-a/sat-online-031-mobs
npx.cmd -y firebase-tools@latest deploy --only database --project satisfy-online-8yjeix
```
This one deploy covers presence (with its indexes on `x` and `party`), party/duel/raid/chat messages, profiles, cloud saves and session leases,
and since 026–031: world chat (`world`), the player list (`online`), player names (`handles`, `accounts`) and shared monsters (`mobs`).
Deploy from this branch only (not from #58): the rules must match the build you test.
It's safe before the PRs are merged, because `main` has no online code yet.
Expected output: `rules syntax for database satisfy-online-8yjeix-default-rtdb is valid` and `Deploy complete!`.

## 1. Open the game online

`https://twisterdaark.github.io/Satisfy/?net=online` (after the merges; before them, test from a local
checkout of the top branch with any static server). Use two **different** Google accounts on two
devices (PC + phone), or two browsers.

| Step | Do | Expect |
|---|---|---|
| Sign in | Title screen → **Play online (Google)** | A box asks for your **player name** (3–16 letters A–Z, digits or _) → **Take this name**; the button then says **Online as <name>** (never your Google name); **Cloud saves** appears under it |
| Name taken | The second account tries the same name (any upper/lower case) | `Someone already has this name`; pick another |
| F5 | Press F5 on the title screen | The button says `Signing in as <name>…`, then `Online as <name>`, with no new sign-in |
| Account panel | Click **Online as <name>** | The account panel: Sign out · Delete my online data · Change my name · Hide my level from others |
| Online-only | Add `&only=1` to the address | No *New game* / *Continue*: just **Play** (after the name). Flip `Satisfy.netOnlineOnly = true` in `src/net/firebase-config.js` to make it the default |
| Phone controls | On the phone, start or continue a game | A stick bottom-left moves you; **Attack** and **Guard** work while held, **Dodge** and **Use** tap; the key hints bottom-right (Inventory, Status, Map, …) are buttons; online, a row with **Party · Duel · Yes · No · Chat**. On a PC add `&touch=1` to the address to see them |
| Presence | New game or Continue on both | Badge top-centre: `Online · players: 2 · Safe zone`; you see each other walk |
| Link | Hover the badge | `Link: NN ms · sent … · received … · dropped …` |
| Party | Stand close, press **P**; the other presses **Y** | Party panel under the minimap; green names |
| Player card | **Right-click** the other player (phone: press and hold) | A card with their name, level and class, and **Invite to party · Duel · Block**; Esc closes it. A normal click attacks and never opens it |
| Party role | In the party panel click the **＋** next to your name | It becomes 🛡 (tank), then ✚, ⚔, ✦ and back; the other member sees your badge |
| New leader | Three in a party; the leader closes the tab | After about 15 s: `… leads the party now`; the other two stay in one party |
| Rejoin | In a party, one of you presses **F5** and continues | Within a few seconds: `Back in …'s party`, no invite prompt |
| Emote | Press **V** (phone: **Emote**) and pick **Dance** | You both see the dance for 3 s |
| Party HP + ping | In a party, get hit; then **Alt+click** a spot (phone: **Ping**) | Each member's health bar in the party panel moves; a yellow ring appears at the spot on both screens and on the minimap |
| Chat | In the party, press **Enter**, type, **Enter** | The line shows in the chat box (bottom corner, tabs **Party · World**) on both devices; **Esc** closes without sending; letters typed there don't move you or open menus |
| World chat | Not in a party (or click the **World** tab), **Enter**, type, **Enter** | Everyone online sees it, even far away on the map |
| World notice | Do something the whole world hears (take a legendary class, win the day's tournament, kill a world boss) | The other player gets the same banner with 🌐, in their own language |
| Player list | Press **O** (phone: **Players**) | Who is online, with level and zone; Esc closes it |
| Hide my level | Account panel → **Hide my level from others** | The other player's card for you shows `Lv ?` |
| Big map | In a party, press **M** | Each party member is on the map with their name, far ones too |
| Background window | In a party, cover or minimise one window for a minute, then come back | Still in the party; no `left the party` toast |
| Effects | Swing, dodge (Space) and use a skill next to the other player | They see your swing, the dust of your dodge and your skill's effect and name |
| Shared monsters | Stand together near the same monsters | Same monsters at the same places on both screens; one of you kills one: it dies on both, and only the one who hit it gets the XP and drops |
| Block | Right-click the other player → **Block** | `… is blocked`; their chat lines stop showing; their invites no longer pop up (the party invite and panel have no Block button any more). **Account panel → Unblock all** undoes it |
| Duel | Walk out of town together (no "Safe zone" in the badge), press **K**; the other presses **Y** (accept), then both **Y** (ready) | 3-2-1 countdown, a dashed ring, HP bars at the top; hits take duel HP only; **Yield** button |
| Spectate | A third player nearby | Sees a small HP bar over each duelist and a ring |
| Distance | Not in a party: one player walks or rides far east (two to three screens, 800–1200 px) | The count in the badge goes to `players: 1`; walking back brings them back within a second |
| Party far apart | In a party, one walks far away | The count stays `players: 2` and the party panel keeps both names |
| Raid | In a party, go to the Goblin Chief (Goblin Canyon) and both hit it | Both see the same boss HP; it dies once; each gets the kill rewards once (`Your party killed the boss!`) |
| Cloud save | Back on the title screen → **Cloud saves** → **Upload** (click twice) | `… uploaded to your account` |
| Second device | Same Google account on the other device → **Cloud saves** → **Download** (click twice) → **Continue** | Your character, same level and gold; the replaced save is kept as a backup |
| Same account twice | The same Google account in two tabs | The older tab says *Your account is now playing on another device or tab* with **Play here** |
| Sign out | Title screen → **Cloud saves** → **Sign out** | `Signed out`; the button says **Play online (Google)** again; the other device stops seeing you |
| Delete my data | **Cloud saves** → **Delete my online data** (click twice) | `Your online data is deleted (N records)`; in the Firebase console nothing under your uid is left in `profiles`, `cloudIndex`, `cloudSaves`, `sessions`, `presence`; **Continue** still loads this device's save |

## 2. If something looks wrong

- Hover the badge and note the link numbers; open the console (F12) for red errors.
- Post a comment on issue #1 starting with `[Owner]`. Say what you did, what you saw, and the device/browser.
- Nothing online can damage the offline save: the game backs up a save before any download or
  migration (`satisfy_proto_v4.backup.*` in localStorage).
