# Playing against the local emulators (plan U022)

Owner: Claude-A · SAT-ONLINE-120 · بالعربي للمالك. الأوامر وأسماء الزراير زي ما هي.

**ده إيه:** تقدر تلعب أونلاين على جهازك من غير ما تلمس الداتابيز الحقيقية. Firebase بيدّي "محاكي" (emulator) بيشتغل على جهازك: داتابيز وتسجيل دخول وهميين، بنفس القواعد اللي في `backend/database.rules.json`. ينفع تجرّب فيه حاجة جديدة أو قواعد قبل ما تنشرها، أو تلعب بكذا حساب وهمي.

**ليه آمن:** اللعبة بتروح للمحاكي بس لو الصفحة نفسها شغالة من جهازك (`localhost`) وفي الرابط `?emu`. على الموقع الحقيقي (github.io) الـ `?emu` ملوش أي تأثير، فمفيش لاعب ممكن يتوصل لداتابيز تجربة. الاختبار `tests/unit/firebase-load` بيتأكد من ده.

## مرة واحدة
- نزّل Java 21 (مثلًا Temurin من adoptium.net) وسطّبه.

## كل مرة
1. افتح PowerShell جوه فولدر المشروع وشغّل المحاكي، وسيبه شغال:
   ```powershell
   npx.cmd -y firebase-tools@latest emulators:start --only database,auth --project satisfy-online-8yjeix
   ```
2. افتح PowerShell تاني في نفس الفولدر وشغّل الصفحة على جهازك، وسيبه شغال:
   ```powershell
   npx.cmd -y http-server -p 8080 -c-1
   ```
3. افتح في المتصفح: `http://localhost:8080/?net=online&emu`
4. دوس **Play online**. هيظهرلك شباك تسجيل دخول وهمي: دوس **Add new account** واكتب أي اسم وأي إيميل.
5. فوق في نص الشاشة هتلاقي **EMULATOR (test data)**. معناها إنك على المحاكي.

**تشوف الداتا:** افتح `http://localhost:4000`، وبعدها Realtime Database. تقدر تعدّل فيها أو تمسحها براحتك.

**حسابين مع بعض:** افتح تاب تاني بنفس الرابط وزوّد عليه `&slot=b`، وسجّل بحساب وهمي تاني.

**لما تخلص:** اقفل الـ PowerShell الاتنين (Ctrl+C). كل داتا المحاكي بتتمسح.

## For the agents
- **The switch:** `Satisfy.firebaseEmulator` (`src/net/firebase-config.js`) is set only on `localhost`, `127.0.0.1` or `::1`, with `?emu` (127.0.0.1) or `?emu=<host>`. In that case `Satisfy.firebase.load()` calls `connectDatabaseEmulator(db, host, 9000)` and `connectAuthEmulator(auth, 'http://host:9099')`. The result carries `emulator: true`, and the net badge says so.
- **The rules:** the emulator reads them from `firebase.json` (`backend/database.rules.json`) and reloads them when the file changes.
- **CI:** CI runs the rules on the emulator separately: `tests/emulator/rules.emu.cjs` (SAT-ONLINE-116).
