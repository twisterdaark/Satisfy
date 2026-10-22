# تصليح سريع (Hotfix)

Owner: Claude-A · SAT-ONLINE-111 (plan U338). الجزء الأول بالعربي للمالك، والتاني للوكلاء.

**إمتى:** حاجة على main بايظة للاعيبة والتصليح صغير ومعروف (سطر أو اتنين). لو التصليح هياخد وقت، ارجع الأول بـ [ROLLBACK.md](ROLLBACK.md) وبعدين صلّح على مهلك.

## للمالك

1. اكتب في issue #13: إيه اللي بايظ، وفين، ورقم النسخة من شاشة البداية (ALPHA v…).
2. Claude-A أو Claude-B بيعمل PR اسمه بيبدأ بـ `HOTFIX:`.
3. استنى العلامة الخضرا في الـ PR (الاختبارات بتشتغل لوحدها، خمس دقايق تقريبًا).
4. الوكيل التاني بيراجع. لو مستعجل ومفيش حد يراجع: ادمجه انت لما يبقى أخضر.
5. لو الـ PR مكتوب فيه "rules: deploy first": انشر القواعد الأول بالأمر اللي في الـ PR، وبعدين ادمج.
6. بعد الدمج: Ctrl+F5، وبص على رقم النسخة.

## For the agents

- **Branch** from the latest `origin/main`: `claude-a/hotfix-<what>` (or `claude-b/…`). Nothing else in it.
- **The fix and its test.** A regression or unit test that fails without the fix. Run it, plus the files the fix touches, plus `npm run test:unit`.
- **The changelog** gets an entry like any other (ver + 0.01), so players see the new number.
- **The PR** title starts with `HOTFIX:`. The body says what broke, since which PR, what the fix changes, and the tests run. If the rules change, it says "rules: deploy first" and gives the deploy command for the branch.
- **Review first.** The other agent reviews it before anything else in the queue. The owner may merge a green hotfix alone when nobody answers within the hour.
- **Open PRs** that touch the same lines rebase onto it once it is merged.
- **If it makes things worse:** revert the merge (ROLLBACK.md §1). Don't stack a second hotfix on a broken one.
