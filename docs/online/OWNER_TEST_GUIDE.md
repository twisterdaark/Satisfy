# Online test guide for the owner (Twister)

Owner: Claude-A · covers SAT-ONLINE-001 … 023 · دليل اختبار الأونلاين — خطوة بخطوة

## 0. Deploy the database rules once (after pulling the top branch)

```powershell
git fetch origin
git checkout claude-a/sat-online-023-party-rejoin
npx.cmd -y firebase-tools@latest deploy --only database --project satisfy-online-8yjeix
```
This one deploy covers presence (with its indexes on `x` and `party`), party/duel/raid/chat messages, profiles, cloud saves and session leases.
It's safe before the PRs are merged, because `main` has no online code yet.
Expected output: `rules syntax for database satisfy-online-8yjeix-default-rtdb is valid` and `Deploy complete!`.

## 1. Open the game online

`https://twisterdaark.github.io/Satisfy/?net=online` (after the merges; before them, test from a local
checkout of the top branch with any static server). Use two **different** Google accounts on two
devices (PC + phone), or two browsers.

| Step | Do | Expect |
|---|---|---|
| Sign in | Title screen → **Play online (Google)** | The button shows your name; **Cloud saves** appears under it |
| Phone controls | On the phone, start or continue a game | A stick bottom-left moves you; **Attack** and **Guard** work while held, **Dodge** and **Use** tap; the key hints bottom-right (Inventory, Status, Map, …) are buttons; online, a row with **Party · Duel · Yes · No · Chat**. On a PC add `&touch=1` to the address to see them |
| Presence | New game or Continue on both | Badge top-centre: `Online · players: 2 · Safe zone`; you see each other walk |
| Link | Hover the badge | `Link: NN ms · sent … · received … · dropped …` |
| Party | Stand close, press **P**; the other presses **Y** | Party panel under the minimap; green names |
| Player card | Click (or tap) the other player | A card with their name, level and class, and **Invite to party · Duel · Block**; Esc closes it |
| Rejoin | In a party, one of you presses **F5** and continues | Within a few seconds: `Back in …'s party`, no invite prompt |
| Emote | Press **V** (phone: **Emote**) and pick **Dance** | You both see the dance for 3 s |
| Party HP + ping | In a party, get hit; then **Alt+click** a spot (phone: **Ping**) | Each member's health bar in the party panel moves; a yellow ring appears at the spot on both screens and on the minimap |
| Chat | In the party, press **Enter**, type, **Enter** | The line shows under the party panel on both devices; **Esc** closes without sending; letters typed there don't move you or open menus |
| Block | Click **⊘** next to the other member | `… is blocked`; their chat lines stop showing; after leaving the party their invites no longer pop up. **Cloud saves → Unblock all** undoes it |
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
