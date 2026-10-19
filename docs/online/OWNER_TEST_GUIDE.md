# Online test guide for the owner (Twister)

Owner: Claude-A · covers SAT-ONLINE-001 … 014 · دليل اختبار الأونلاين — خطوة بخطوة

## 0. Deploy the database rules once (after pulling the top branch)

```powershell
git fetch origin
git checkout claude-a/sat-online-014-interest
npx.cmd -y firebase-tools@latest deploy --only database --project satisfy-online-8yjeix
```
This one deploy covers presence (with its index on `x`), party/duel/raid messages, profiles, cloud saves and session leases.
It's safe before the PRs are merged, because `main` has no online code yet.
Expected output: `rules syntax for database satisfy-online-8yjeix-default-rtdb is valid` and `Deploy complete!`.

## 1. Open the game online

`https://twisterdaark.github.io/Satisfy/?net=online` (after the merges; before them, test from a local
checkout of the top branch with any static server). Use two **different** Google accounts on two
devices (PC + phone), or two browsers.

| Step | Do | Expect |
|---|---|---|
| Sign in | Title screen → **Play online (Google)** | The button shows your name; **Cloud saves** appears under it |
| Presence | New game or Continue on both | Badge top-centre: `Online · players: 2 · Safe zone`; you see each other walk |
| Link | Hover the badge | `Link: NN ms · sent … · received … · dropped …` |
| Party | Stand close, press **P**; the other presses **Y** | Party panel under the minimap; green names |
| Duel | Walk out of town together (no "Safe zone" in the badge), press **K**; the other presses **Y** (accept), then both **Y** (ready) | 3-2-1 countdown, a dashed ring, HP bars at the top; hits take duel HP only; **Yield** button |
| Spectate | A third player nearby | Sees a small HP bar over each duelist and a ring |
| Distance | Not in a party: one player walks or rides far east (two to three screens, 800–1200 px) | The count in the badge goes to `players: 1`; walking back brings them back within a second |
| Party far apart | In a party, one walks far away | The count stays `players: 2` and the party panel keeps both names |
| Raid | In a party, go to the Goblin Chief (Goblin Canyon) and both hit it | Both see the same boss HP; it dies once; each gets the kill rewards once (`Your party killed the boss!`) |
| Cloud save | Back on the title screen → **Cloud saves** → **Upload** (click twice) | `… uploaded to your account` |
| Second device | Same Google account on the other device → **Cloud saves** → **Download** (click twice) → **Continue** | Your character, same level and gold; the replaced save is kept as a backup |
| Same account twice | The same Google account in two tabs | The older tab says *Your account is now playing on another device or tab* with **Play here** |

## 2. If something looks wrong

- Hover the badge and note the link numbers; open the console (F12) for red errors.
- Post a comment on issue #1 starting with `[Owner]`. Say what you did, what you saw, and the device/browser.
- Nothing online can damage the offline save: the game backs up a save before any download or
  migration (`satisfy_proto_v4.backup.*` in localStorage).
