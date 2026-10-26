# Legend books: one copy in the world

Owner, 2026-10-26: Mumud's Spellbook fell again for an account that had sold its copy, and the buyer became Mumud's Successor (04:37). Then (15:24): no book may fall once one has fallen or while someone has it in their bag, and when a legend deletes his character, others can take the class again.

| Book | Item key | Legend | Comes from |
|---|---|---|---|
| Mumud's Spellbook | `mumbk` | Mumud's Successor | undead (1% a kill, mages) |
| Legendary Fighter Tzudan's Diary | `tzbook` | Tzudan's Successor | the Mountain King's seat, after a great demon at 150+ |
| The Undefeated King's Old Sheath | `mdsheath` | Undefeated King's Descendant (Madra) | Red Knights (2% a kill, warriors) |

## The rule

- **One copy.** While a copy is out, no other falls or is given to anyone. A copy is out when it's in a bag or the stash, when it was read and its quest can still end in the legend, or when its legend is taken.
- **Signed in:** the copy is `world/satisfy/books/{k}` = `{uid, p, g, t}`.
  - `p` is the character holding it.
  - `g` is the copy's tag. The rules let a new copy be taken only when none exists.
  - Whoever receives the book (trade, auction, mail, pickup) takes the record over, keeping `g`.
  - Only the holder can free it.
  - Nothing is given until the record has been read, so a connection blip can't skip it.
- **Signed out:** the copy is `WS.books`, the device's world. A new game starts a new world.
- **Only the world's copy works.** Signed in, a book is read, traded, put up at the auction or put in the guild vault only by the character holding its record (a copy with no record claims one first). Any other copy is inert: one from before this update, or one found signed out while the world's was out. It can't be read or passed on, and only a merchant (or the bin) takes it. So a copy that changes hands is always the real one, and its record follows it, retried until it does.
- **The copy can't vanish.** Selling it to a merchant, Destroy and Drop are refused. So is the offline auction, whose simulated buyers would make it disappear. It can be traded, put up at the auction between players (online) or read.
- **Back to the world:**
  - The holder's character is deleted (Delete in the account's characters), if its save shows the copy (bag, stash, or its quest still able to end in the legend). A copy it left in an auction listing or the guild vault stays out for whoever gets it. The world is read fresh first; if the legend can't be freed, the character isn't deleted.
  - A legend's character is deleted: its legend record goes too, unless another of the account's characters has the same class.
  - A give that was cut off (the page closed while the world's answer was coming) finishes on the next load, and a free that couldn't run yet runs once the world is read.
  - Madra's trial fails.
  - "Delete my online data": every legend and copy the account holds.
- **Old saves** count what they show: the book in the bag or the stash, its class, or its quest still able to end in the legend. A character whose Mumud path ended because someone else held the legend starts that path over.

## By hand

If a legend or a copy is held by a character that no longer exists (deleted before this update, or on a lost device), delete `world/satisfy/legends/<legend>` and `world/satisfy/books/<item key>` in the Firebase console. The world gives it again.

Code: `index.html`, "One copy in the world" (`uqFree`, `uqGive`, `bkTake`, `bkFree`, `bkTick`, `legDel`). Tests: `tests/regression/uniqbooks.test.cjs`, `tests/unit/rules.test.cjs`.
