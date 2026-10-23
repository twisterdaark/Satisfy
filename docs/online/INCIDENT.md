# لو حصل اختراق أو عبث بالداتابيز (Incident drill)

Owner: Claude-A · SAT-ONLINE-122 (plan U381). الجزء الأول بالعربي للمالك، والتاني للوكلاء. الأوامر وأسماء الزراير زي ما هي.

**إمتى:** حد بيكتب في الداتابيز حاجات مش المفروض يقدر عليها، زي حسابات بتتغير، أو دهب أو حاجات بتتضاعف، أو أدمن انت مضفتوش. أو فاتورة Firebase بتعلى من غير سبب.

**الكلمة المهمة:** الـ config اللي في `src/net/firebase-config.js` (الـ apiKey وغيره) **مش باسورد**. أي لعبة Firebase بتبعته للمتصفح، ومحدش يقدر يعمل بيه حاجة لوحده. كل قاعدة في `backend/database.rules.json` بتطلب تسجيل دخول، والاختبار `tests/unit/lockdown.test.cjs` بيتأكد من ده في كل PR.

## 1. مشكلة صغيرة: اقفل الحتة اللي فيها المشكلة بس
- **سبام في الشات:** `/mute ID ساعات` للاعب. ولو كتير: `/switch chat off سبام` (#156).
- **تبادل أو مبارزات فيها مشكلة:** `/switch trade off` أو `/switch duel off`.

## 2. مشكلة كبيرة: اقفل الداتابيز كلها
في PowerShell جوه فولدر المشروع:
```powershell
git stash
git fetch origin
git checkout --detach origin/main
npx.cmd -y firebase-tools@latest deploy --only database --project satisfy-online-8yjeix --config firebase.lockdown.json
git checkout main
git stash pop
```
(`git stash` بيشيل أي تعديلات عندك على جنب عشان الـ checkout يشتغل، و`git stash pop` بيرجّعها. لو مفيش تعديلات بيقول No local changes ومفيش مشكلة.)
- **النتيجة:** محدش يقدر يقرا أو يكتب أي حاجة، ولا حتى انت من اللعبة. اللعب أونلاين بيقف لكل الناس.
- **الداتا نفسها مبتتمسحش،** وسيفات اللاعيبة على أجهزتهم فاضلة زي ما هي.
- **من Firebase Console** تقدر تشوف وتعدّل كل حاجة (الكونسول مبيمشيش بالقواعد).

## 3. وهي مقفولة
1. **خد نسخة:** Firebase Console ← Realtime Database ← ⋮ ← **Export JSON**، واحفظها.
2. **شوف مين:** في Data دوّر على اللي اتغير. في `admins` لازم يكون حسابك انت بس، ولو فيه غيره امسحه.
3. **اقفل الحساب اللي عمل كده:** Authentication ← Users ← الحساب ← ⋮ ← **Disable account**.
4. **لو حد بيستهلك الـ apiKey من موقع تاني:** Google Cloud Console ← APIs & Services ← Credentials ← Browser key ← Application restrictions ← **Websites** ← اكتب **التلاتة دول** ← Save:
   - `twisterdaark.github.io/*` (اللعبة)
   - `satisfy-online-8yjeix.firebaseapp.com/*` (صفحة تسجيل الدخول بجوجل. **لو نسيتها محدش هيقدر يسجل دخول**)
   - `localhost/*` و`127.0.0.1/*` لو بتجرب اللعبة على جهازك بالمفتاح الحقيقي
   **متمسحش المفتاح،** اللعبة هتقف.
5. **اتأكد إن جوجل بس هو اللي شغال:** Authentication ← Sign-in method: **Google** بس يبقى Enabled. لو Anonymous أو Email/Password شغالين اقفلهم (لو شغالين، أي حد بالـ config يقدر يعمل حساب من غير جوجل).
6. **قول في issue #13** إيه اللي حصل. Claude-A أو Claude-B بيعمل PR يقفل الثغرة، معاه اختبار (HOTFIX.md).

## 4. افتح تاني
انشر القواعد العادية بالأمر المعتاد (من `origin/main`، أو من `origin/claude-a/rules-next` لو مستني قواعد جديدة):
```powershell
git stash
git fetch origin
git checkout --detach origin/main
npx.cmd -y firebase-tools@latest deploy --only database --project satisfy-online-8yjeix
git checkout main
git stash pop
```
**علامة النجاح:** تفتح اللعبة وتسجل دخول، وتلاقي اللاعيبة التانيين.

## For the agents
- **The files:**
  - `backend/lockdown.rules.json` refuses every read and write.
  - `firebase.lockdown.json` is a config that deploys it instead of the real rules (`--config`).
  - Neither is used unless the owner runs the lockdown command.
- **`tests/unit/lockdown.test.cjs` guards the plan's check, "client config alone not privileged":**
  - Every `.read` and `.write` in the real rules is `false`, `auth != null`, or `auth != null && (...)`, with no top-level `||` after it.
  - So every grant needs a signed-in account.
  - It also checks that the lockdown file refuses everything and that the lockdown config points at it.
- **"The config alone gives nothing"** holds only while Google is the only sign-in provider (an anonymous or e-mail sign-in would give anyone `auth != null`): step 3.5 checks it.
- **The browser key's website list** must keep the auth domain (`satisfy-online-8yjeix.firebaseapp.com`): Google sign-in finishes there and calls Identity Toolkit with the same key.
- **A fix for a hole:** HOTFIX.md, with a test that fails without the fix. The emulator run (`tests/emulator/rules.emu.cjs`) is the place for a denial the fake can't show.
