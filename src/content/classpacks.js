/* Satisfy — class packs (SAT-ONLINE-147): classes as data, installed by the game at load (index.html, cpInstall).
 *
 * Each pack: {id, n: {en, ar}, root: the base class it grows from ('warrior', 'archer', 'mage', 'thief', 'priest',
 * 'smith', 'gknight'), from: [classes that may take the trial], by: the trainer who gives it ('tw', 'ta', 'tm', 'tk',
 * 'cassus', 'hood'), lv, mst: [weapon kind, mastery], obj: the trial's objective (the quest engine's: {t: 'kill', it,
 * n, wk?}, ...), xp, gold, q: {n, o, w, d}: the trial's name, offer, waiting and done lines ({en, ar} each), col, and
 * skills: [{id, n, d, lv, mp, cd, need?, col?, kind, ...}] (the kinds and their fields are listed by cpFn in index.html).
 * A pack never replaces a class, a skill or a quest that exists.
 */
(function (root) {
  'use strict';
  var ns = root.Satisfy = root.Satisfy || {};
  var L = ns.classPacks = ns.classPacks || [];
  // The classes of the novel's players and NPCs that the game lacked (legends/wiki-combat-classes.md). What the novel names
  // (chapter in the comment) is kept; where it names nothing, the skill fits the class's description. Hidden Sword is
  // Peak Sword's class under its other name, so it is the Quick Draw Swordsman's.
  var sk = function (id, en, ar, den, dar, lv, kind, o) { var s = { id: id, n: { en: en, ar: ar }, d: { en: den, ar: dar }, lv: lv, kind: kind }; for (var k in o) s[k === 'n' ? 'cnt' : k] = o[k]; return s; }; // n is the name, so a count is cnt
  var q = function (n, o, w, d) { return { n: { en: n[0], ar: n[1] }, o: { en: o[0], ar: o[1] }, w: { en: w[0], ar: w[1] }, d: { en: d[0], ar: d[1] } }; };
  L.push(
    // Regas (ch10, 171, 229): Force Palm, the lightning-wrapped kicks, and the Asura's Sura Charge
    { id: 'martial', n: { en: 'Martial Artist', ar: 'فنان قتال' }, root: 'warrior', from: ['warrior', 'berserker'], by: 'tw', lv: 40, mst: ['melee', 4], col: '#ffd24a',
      obj: { t: 'kill', it: 'hwolf', n: 25 }, xp: 20000, gold: 800,
      q: q(['The Way of the Fist', 'طريق القبضة'], ['Weapons make you lazy. Put down twenty-five hill wolves and feel every blow land.', 'السلاح بيكسّلك. اقتل خمسة وعشرين ذيب تلال وحس بكل ضربة.'], ['Your hands still hesitate.', 'إيديك لسه مترددة.'], ['Your body is the weapon now. You are a Martial Artist.', 'جسمك بقى هو السلاح. انت دلوقتي فنان قتال.']),
      skills: [
        sk('mapalm', 'Force Palm', 'كف القوة', 'A close palm strike that stuns.', 'ضربة كف من قريب بتشلّ الخصم.', 40, 'line', { r: 40, mul: 2.6, stun: 0.5, mp: 14, cd: 6 }),
        sk('makick', 'Lightning Aura Kicks', 'ركلات هالة البرق', 'Kicks wrapped in golden lightning sweep what is in front and knock it down.', 'ركلات ملفوفة ببرق دهبي بتكنس اللي قدامك وتوقعه.', 50, 'cone', { r: 55, mul: 1.8, stun: 0.8, mp: 18, cd: 9, col: '#fff4a0' }),
        sk('mashift', 'Shifting Strikes', 'ضربات متقلبة', 'Fists and feet change their path mid-blow: +10% critical chance.', 'القبضة والرجل بيغيروا طريقهم وسط الضربة: +10% فرصة كريتيكال.', 40, 'pas', { stat: 'crit', pct: 0.1 }),
        sk('mabody', 'Trained Body', 'جسم متدرب', '+10% damage.', '+10% ضرر.', 80, 'pas', { stat: 'atk', pct: 0.1 }),
        sk('masura', 'Sura Charge', 'اندفاعة الأسورا', 'The Asura\'s charge: dash through every foe on the way.', 'اندفاعة الأسورا: تندفع وتضرب كل اللي في سكتك.', 120, 'dash', { r: 90, mul: 3, stun: 0.6, mp: 30, cd: 14 })
      ] },
    // Med (ch171): the temple of Boris; Reverse Origin and Origin Opportunity; a club and cloth
    { id: 'monk', n: { en: 'Monk', ar: 'راهب' }, root: 'priest', from: ['priest'], by: 'cassus', lv: 40, mst: ['melee', 2], col: '#e8c890',
      obj: { t: 'pray', it: 'altar', n: 8 }, xp: 20000, gold: 800,
      q: q(['The Temple of Boris', 'معبد بوريس'], ['A small god, Boris, has a ruined temple no one tends. Pray at eight altars and his way will open to you.', 'فيه إله صغير اسمه بوريس معبده خربان ومحدش بيخدمه. صلّي عند تمن مذابح وطريقه هيتفتحلك.'], ['The road of suffering is long.', 'طريق المعاناة طويل.'], ['Boris accepts you. You are a Monk: no heavy armour, no swordsmanship, only the body.', 'بوريس قبلك. انت دلوقتي راهب: لا دروع تقيلة ولا مبارزة، جسمك وبس.']),
      skills: [
        sk('mkstrike', 'Club Strike', 'ضربة العصا', 'A heavy blow with the club.', 'ضربة تقيلة بالعصا.', 40, 'line', { r: 45, mul: 2, mp: 10, cd: 4 }),
        sk('mkrev', 'Reverse Origin', 'عكس الأصل', 'The body returns to its origin: health fully restored.', 'الجسم بيرجع لأصله: الصحة بترجع كاملة.', 40, 'heal', { pct: 1, mp: 40, cd: 120 }),
        sk('mkopp', 'Origin Opportunity', 'فرصة الأصل', 'Pour the other stats into one: +80% damage, -40% defence for 15 s.', 'تصب باقي الإحصائيات في واحدة: +80% ضرر و-40% دفاع لمدة 15 ثانية.', 40, 'buff', { stat: 'atk', pct: 0.8, dur: 15, also: [{ stat: 'def', pct: -0.4 }], mp: 30, cd: 60 }),
        sk('mkiron', 'Iron Body', 'جسم حديد', '+20% defence.', '+20% دفاع.', 40, 'pas', { stat: 'def', pct: 0.2 }),
        sk('mkpath', 'Path of Suffering', 'طريق المعاناة', '+10% damage.', '+10% ضرر.', 60, 'pas', { stat: 'atk', pct: 0.1 })
      ] },
    // Lauel (ch110): first of the qigong masters; Deny Reason, the spheres that stop missiles (ch654)
    { id: 'qigong', n: { en: 'Qigong Master', ar: 'سيد التشي' }, root: 'mage', from: ['mage'], by: 'tm', lv: 40, mst: ['staff', 4], col: '#a8f0d0',
      obj: { t: 'kill', it: 'gshaman', n: 20, wk: 'staff' }, xp: 20000, gold: 800,
      q: q(['The Inner Breath', 'النَفَس الداخلي'], ['Mana is not only in books. Feel it in your breath: twenty goblin shamans, with your staff.', 'المانا مش في الكتب بس. حسها في نفسك: عشرين شامان جوبلن بعصايتك.'], ['Breathe slower.', 'خد نفسك أبطأ.'], ['Your ki answers you. You are a Qigong Master.', 'التشي بتاعك بيرد عليك. انت دلوقتي سيد التشي.']),
      skills: [
        sk('qgblast', 'Ki Blast', 'قذيفة التشي', 'A shot of ki.', 'قذيفة من التشي.', 40, 'proj', { proj: 'magic', mul: 2.2, mp: 12, cd: 3 }),
        sk('qgcirc', 'Inner Circulation', 'الدورة الداخلية', '+10% health.', '+10% صحة.', 40, 'pas', { stat: 'hp', pct: 0.1 }),
        sk('qgburst', 'Ki Burst', 'انفجار التشي', 'Ki bursts out on every side.', 'التشي بينفجر من كل ناحية.', 60, 'nova', { r: 50, mul: 1.6, mp: 20, cd: 8, vfx: 'mana' }),
        sk('qgdeny', 'Deny Reason', 'إنكار المنطق', 'Spheres of ki stop what flies at you: +60% defence for 8 s.', 'كرات تشي بتوقف اللي جاي عليك: +60% دفاع لمدة 8 ثواني.', 80, 'buff', { stat: 'def', pct: 0.6, dur: 8, mp: 30, cd: 30 })
      ] },
    // ch414: a hidden class; rifles outrange a bow and hit hardest, with little health and almost no evasion
    { id: 'gunman', n: { en: 'Gunman', ar: 'حامل البندقية' }, root: 'archer', from: ['archer', 'ranger', 'sniper', 'bowmaster'], by: 'ta', lv: 80, mst: ['bow', 6], col: '#c8c0a8',
      obj: { t: 'kill', it: 'kobold', n: 30, wk: 'bow' }, xp: 80000, gold: 3000,
      q: q(['The First Rifle', 'أول بندقية'], ['A dwarf left me a strange weapon that throws iron. Prove your aim on thirty kobolds and it is yours.', 'قزم ساب عندي سلاح غريب بيرمي حديد. أثبت نيشانك على تلاتين كوبولد وهو بتاعك.'], ['Your hand still shakes.', 'إيدك لسه بتترعش.'], ['A hidden class: Gunman. Nothing hits harder from afar, and nothing dies faster up close.', 'كلاس مخفي: حامل البندقية. مفيش حاجة بتضرب أقوى من بعيد، ومفيش حاجة بتموت أسرع من قريب.']),
      skills: [
        sk('gnaim', 'Aimed Shot', 'طلقة مُصوَّبة', 'A slow, far, heavy shot.', 'طلقة بطيئة وبعيدة وتقيلة.', 80, 'proj', { proj: 'arrow', mul: 4, range: 1.1, mp: 20, cd: 8 }),
        sk('gnpierce', 'Piercing Round', 'رصاصة خارقة', 'A round that goes through everything in a line.', 'رصاصة بتخترق كل اللي في الخط.', 80, 'proj', { proj: 'arrow', mul: 2.2, pierce: 1, mp: 16, cd: 5 }),
        sk('gnball', 'Ballistics', 'المقذوفات', '+25% damage, -15% defence: the strongest shooter, the frailest body.', '+25% ضرر و-15% دفاع: أقوى رامي وأضعف جسم.', 80, 'pas', { stat: 'atk', pct: 0.25, also: [{ stat: 'def', pct: -0.15 }] }),
        sk('gnrel', 'Reload Discipline', 'انضباط التعمير', '+15% critical chance.', '+15% فرصة كريتيكال.', 100, 'pas', { stat: 'crit', pct: 0.15 })
      ] },
    // Rigal (ch784): the empire's air cavalry on griffons and wyverns
    { id: 'rider', n: { en: 'Rider', ar: 'خيّال' }, root: 'warrior', from: ['warrior', 'lancer', 'knight'], by: 'tw', lv: 60, mst: ['spear', 4], col: '#d8b880',
      obj: { t: 'kill', it: 'rboar', n: 20 }, xp: 40000, gold: 1500,
      q: q(['The Saddle', 'السرج'], ['A rider fights with his mount, not on it. Run down twenty razorback boars.', 'الخيّال بيحارب مع حصانه مش فوقه. اجري ورا عشرين خنزير بري واقتلهم.'], ['You still sit like a sack.', 'لسه قاعد زي الشوال.'], ['You and the mount are one. You are a Rider.', 'انت والحصان بقيتوا واحد. انت دلوقتي خيّال.']),
      skills: [
        sk('rdmount', 'Mounted Mastery', 'إتقان الركوب', 'While riding: +30% damage, +20% defence.', 'وانت راكب: +30% ضرر و+20% دفاع.', 60, 'pas', { stat: 'atk', pct: 0.3, also: [{ stat: 'def', pct: 0.2 }], cond: 'ride' }),
        sk('rdcharge', 'Aerial Charge', 'الانقضاض', 'Dive through the foes in front.', 'تنقض على الأعداء اللي قدامك.', 60, 'dash', { r: 110, mul: 2.6, stun: 0.6, mp: 20, cd: 10 }),
        sk('rdbond', 'Saddle Bond', 'رباط السرج', '+10% defence.', '+10% دفاع.', 70, 'pas', { stat: 'def', pct: 0.1 }),
        sk('rdcmd', 'Squadron Command', 'قيادة السرب', '+20% damage for 30 s.', '+20% ضرر لمدة 30 ثانية.', 90, 'buff', { stat: 'atk', pct: 0.2, dur: 30, mp: 30, cd: 60 })
      ] },
    // ch1390: the soldier career that starts the road to War Commander
    { id: 'soldier', n: { en: 'Soldier', ar: 'جندي' }, root: 'warrior', from: ['warrior'], by: 'tw', lv: 20, mst: ['melee', 2], col: '#a8b0a0',
      obj: { t: 'kill', it: 'outlaw', n: 12 }, xp: 4000, gold: 200,
      q: q(['Enlistment', 'التجنيد'], ['The kingdom needs soldiers. Clear twelve outlaws off the roads and you are enlisted.', 'المملكة محتاجة جنود. نضّف الطرق من اتناشر قاطع طريق وتبقى متجند.'], ['Not yet, recruit.', 'لسه يا مستجد.'], ['You serve the kingdom now: a Soldier. Serve long and well and you may lead armies.', 'انت بتخدم المملكة دلوقتي: جندي. اخدم كويس ومدة طويلة ويمكن تقود جيوش.']),
      skills: [
        sk('sdform', 'Formation Strike', 'ضربة التشكيل', 'A drilled thrust.', 'طعنة متدرب عليها.', 20, 'line', { r: 60, mul: 2, mp: 10, cd: 5 }),
        sk('sddrill', 'Drill', 'التدريب', '+10% defence.', '+10% دفاع.', 20, 'pas', { stat: 'def', pct: 0.1 }),
        sk('sdration', 'Field Ration', 'تعيين الميدان', 'Eat in the field: 20% health back.', 'تاكل في الميدان: يرجعلك 20% صحة.', 30, 'heal', { pct: 0.2, mp: 10, cd: 90 })
      ] },
    // Havis (ch1390): captain of tens, hundreds, thousands, general; Orders that raise the army; Insight (ch156)
    { id: 'warcmd', n: { en: 'War Commander', ar: 'قائد الحرب' }, root: 'warrior', from: ['soldier'], by: 'tw', lv: 120, mst: ['melee', 6], col: '#c83a3a',
      obj: { t: 'kill', it: 'sknight', n: 40 }, xp: 300000, gold: 10000,
      q: q(['Years of Service', 'سنين الخدمة'], ['Rank comes from service and from deeds. Break forty skeleton knights and the army will follow you.', 'الرتبة بتيجي من الخدمة والأفعال. اكسر أربعين فارس هيكل عظمي والجيش هيمشي وراك.'], ['The men do not trust you yet.', 'الرجالة لسه مش واثقين فيك.'], ['Captain of tens, of hundreds, of thousands, and now general: you are a War Commander.', 'قائد عشرة، وميّة، وألف، ودلوقتي جنرال: انت قائد الحرب.']),
      skills: [
        sk('wcorder', 'Order', 'الأمر', 'An order to the army: +25% damage, +15% defence for 20 s.', 'أمر للجيش: +25% ضرر و+15% دفاع لمدة 20 ثانية.', 120, 'buff', { stat: 'atk', pct: 0.25, dur: 20, also: [{ stat: 'def', pct: 0.15 }], mp: 30, cd: 45 }),
        sk('wcinsight', 'Insight', 'البصيرة', 'The commander sees the field: +8% critical chance.', 'القائد شايف الميدان: +8% فرصة كريتيكال.', 120, 'pas', { stat: 'crit', pct: 0.08 }),
        sk('wcarmy', 'Army Capacity', 'سعة الجيش', '+15% health.', '+15% صحة.', 120, 'pas', { stat: 'hp', pct: 0.15 }),
        sk('wcsweep', 'Commander\'s Sweep', 'كنسة القائد', 'A wide cut in front.', 'ضربة عريضة قدامك.', 130, 'cone', { r: 65, mul: 2.2, mp: 18, cd: 7 }),
        sk('wchold', 'Hold the Line', 'اثبتوا', '+30% defence for 15 s.', '+30% دفاع لمدة 15 ثانية.', 150, 'buff', { stat: 'def', pct: 0.3, dur: 15, mp: 24, cd: 40 })
      ] },
    // Katz (ch181, 421, 470): the epic Blood Warrior; Blood-Sucking, Blood of One Thousand People, more blood more power
    { id: 'bloodw', n: { en: 'Blood Warrior', ar: 'محارب الدم' }, root: 'warrior', from: ['warrior', 'berserker', 'knight'], by: 'tw', lv: 150, mst: ['sword', 6], col: '#b0102a',
      obj: { t: 'kill', it: 'cultist', n: 25, wk: 'sword' }, xp: 500000, gold: 20000,
      q: q(['The Blood Rite', 'طقس الدم'], ['There is an old way of the blood. Spill the blood of twenty-five cultists with your sword and it may choose you.', 'فيه طريق قديم للدم. اسفك دم خمسة وعشرين من المتعصبين بسيفك ويمكن يختارك.'], ['The blood is not answering.', 'الدم مش بيرد.'], ['An epic hidden class: Blood Warrior. Your blade drinks now.', 'كلاس مخفي إيبك: محارب الدم. سيفك بقى بيشرب.']),
      skills: [
        sk('bwsuck', 'Blood-Sucking', 'مص الدم', 'Your weapon grows veins: 8% of the damage dealt comes back as health.', 'سلاحك بيطلع عروق: 8% من الضرر بيرجعلك صحة.', 150, 'pas', { stat: 'ls', pct: 0.08 }),
        sk('bwblade', 'Blood Blade', 'نصل الدم', 'A thrust that stuns.', 'طعنة بتشلّ.', 150, 'line', { r: 70, mul: 2.6, stun: 1, mp: 20, cd: 8 }),
        sk('bwaff', 'Blood Affinity', 'ألفة الدم', 'The more blood around you, the stronger: +15% damage with three foes or more close by.', 'كل ما الدم حواليك يكتر تقوى: +15% ضرر لما يبقى حواليك تلات أعداء أو أكتر.', 160, 'pas', { stat: 'atk', pct: 0.15, cond: 'crowd' }),
        sk('bwthou', 'Blood of One Thousand People', 'دم ألف شخص', 'A pillar of blood around you that slows all it touches.', 'عمود دم حواليك بيبطّأ كل اللي يلمسه.', 180, 'nova', { r: 70, mul: 3, slow: 2, mp: 40, cd: 30, vfx: 'blood' })
      ] },
    // Bondre (ch181): restraint and defence; Water Affinity, Ice Spider Web, Ice Barrier, Ice Field, Absolute Zero
    { id: 'icemys', n: { en: 'Ice Mystic', ar: 'متصوّف الجليد' }, root: 'mage', from: ['mage'], by: 'tm', lv: 40, mst: ['staff', 4], col: '#9fe0ff',
      obj: { t: 'kill', it: 'merman', n: 25, wk: 'staff' }, xp: 20000, gold: 800,
      q: q(['Still Water', 'الميّه الراكدة'], ['Ice is water that has learned patience. Freeze twenty-five mermen with your staff.', 'التلج ميّه اتعلمت الصبر. جمّد خمسة وعشرين رجل سمكة بعصايتك.'], ['Your water still runs.', 'الميّه بتاعتك لسه بتجري.'], ['You bind and you shield. You are an Ice Mystic.', 'انت بتقيّد وبتحمي. انت دلوقتي متصوّف الجليد.']),
      skills: [
        sk('imaff', 'Water Affinity', 'ألفة الميّه', 'Near water: +20% damage.', 'جنب الميّه: +20% ضرر.', 40, 'pas', { stat: 'atk', pct: 0.2, cond: 'water' }),
        sk('imweb', 'Ice Spider Web', 'شبكة عنكبوت الجليد', 'Webs of ice from four sides hold everything around you.', 'شبك تلج من أربع نواحي بيمسك كل اللي حواليك.', 40, 'nova', { r: 70, mul: 1, stun: 1.5, mp: 18, cd: 12 }),
        sk('imbar', 'Ice Barrier', 'حاجز الجليد', 'The strongest shield against blows: +100% defence for 4 s.', 'أقوى درع ضد الضرب: +100% دفاع لمدة 4 ثواني.', 40, 'buff', { stat: 'def', pct: 1, dur: 4, mp: 20, cd: 18 }),
        sk('imfield', 'Ice Field', 'حقل الجليد', 'The ground freezes far around you and every foe slows.', 'الأرض بتتجمد لمسافة بعيدة حواليك وكل عدو بيبطأ.', 60, 'nova', { r: 110, mul: 0.8, slow: 3, mp: 24, cd: 15 }),
        sk('imzero', 'Absolute Zero', 'الصفر المطلق', 'A bolt of utter cold that freezes its target.', 'شعاع برد تام بيجمّد هدفه.', 100, 'proj', { proj: 'magic', mul: 3, stun: 3, mp: 40, cd: 30, col: '#e8f8ff' })
      ] },
    // Laella (ch475): first of the fire magicians; Fire Shield, five fire arrows at once; Fire Wall (ch414)
    { id: 'firemag', n: { en: 'Fire Magician', ar: 'ساحر النار' }, root: 'mage', from: ['mage'], by: 'tm', lv: 40, mst: ['staff', 4], col: '#ff7a3a',
      obj: { t: 'kill', it: 'cgob', n: 25, wk: 'staff' }, xp: 20000, gold: 800,
      q: q(['The First Flame', 'أول لهب'], ['Choose fire and fire must accept you. Burn twenty-five cave goblins with your staff.', 'اختار النار والنار لازم تقبلك. احرق خمسة وعشرين جوبلن كهوف بعصايتك.'], ['Your fire is still a candle.', 'نارك لسه شمعة.'], ['Fire answers you. You are a Fire Magician.', 'النار بترد عليك. انت دلوقتي ساحر النار.']),
      skills: [
        sk('fmarrows', 'Fire Arrows', 'أسهم النار', 'Five arrows of fire at once.', 'خمس أسهم نار مرة واحدة.', 40, 'proj', { proj: 'fire', n: 5, mul: 1.1, mp: 16, cd: 5 }),
        sk('fmshield', 'Fire Shield', 'درع النار', '+40% defence for 10 s.', '+40% دفاع لمدة 10 ثواني.', 40, 'buff', { stat: 'def', pct: 0.4, dur: 10, mp: 18, cd: 25 }),
        sk('fmmast', 'Fire Mastery', 'إتقان النار', '+15% damage.', '+15% ضرر.', 50, 'pas', { stat: 'atk', pct: 0.15 }),
        sk('fmwall', 'Fire Wall', 'جدار النار', 'Fire rises all around you.', 'النار بتطلع من كل حواليك.', 60, 'nova', { r: 60, mul: 1.8, mp: 24, cd: 10, vfx: 'fire' })
      ] },
    // Black (ch465, 470): illusions with bodies, a fighter who keeps coming back
    { id: 'illus', n: { en: 'Illusionist', ar: 'ساحر الأوهام' }, root: 'mage', from: ['mage', 'bmage', 'warlock'], by: 'tm', lv: 100, mst: ['staff', 6], col: '#c89aff',
      obj: { t: 'kill', it: 'wraith', n: 20, wk: 'staff' }, xp: 150000, gold: 6000,
      q: q(['Real Shadows', 'ضلال حقيقية'], ['An illusion that cannot hurt is a trick. Put down twenty wraiths, the illusions of the dead.', 'الوهم اللي مبيأذيش ده خدعة. اقتل عشرين شبح، أوهام الموتى.'], ['They still see through you.', 'لسه شايفينك على حقيقتك.'], ['A hidden class: Illusionist. Your illusions have bodies now.', 'كلاس مخفي: ساحر الأوهام. أوهامك بقى ليها أجسام.']),
      skills: [
        sk('ilembody', 'Embodied Illusion', 'الوهم المتجسد', 'Illusions with bodies strike everything around you.', 'أوهام ليها أجسام بتضرب كل اللي حواليك.', 100, 'nova', { r: 80, mul: 2, mp: 30, cd: 12, vfx: 'shadow' }),
        sk('ilmirror', 'Mirror Self', 'نسخة المراية', 'Decoys draw the blows: +50% evasion for 10 s.', 'نسخ وهمية بتشد الضرب: +50% تفادي لمدة 10 ثواني.', 100, 'buff', { stat: 'eva', pct: 0.5, dur: 10, mp: 24, cd: 35 }),
        sk('ilhall', 'Hallucination', 'الهلوسة', 'Foes in front lose their minds for a moment.', 'الأعداء اللي قدامك بيتوهوا لحظة.', 110, 'cone', { r: 70, mul: 0.8, stun: 2, mp: 20, cd: 14 }),
        sk('ilveil', 'Veil of Illusion', 'ستار الوهم', '+10% evasion.', '+10% تفادي.', 120, 'pas', { stat: 'eva', pct: 0.1 })
      ] },
    // Ma Bongshik (ch756): a spear enchanted with spells; Severe Cold Spear and its Chill
    { id: 'magspear', n: { en: 'Magic Spearman', ar: 'الرمّاح السحري' }, root: 'warrior', from: ['warrior', 'lancer'], by: 'tw', lv: 60, mst: ['spear', 5], col: '#8ac8ff',
      obj: { t: 'kill', it: 'mgolem', n: 20, wk: 'spear' }, xp: 40000, gold: 1500,
      q: q(['A Spear That Casts', 'رمح بيعمل سحر'], ['Magic golems drink spells. Break twenty with your spear and it will learn to hold them.', 'جولم السحر بيشربوا التعاويذ. اكسر عشرين برمحك وهو هيتعلم يشيلها.'], ['Your spear is still only iron.', 'رمحك لسه حديد وبس.'], ['Your spear carries spells. You are a Magic Spearman.', 'رمحك شايل تعاويذ. انت دلوقتي الرمّاح السحري.']),
      skills: [
        sk('msench', 'Spear Enchant', 'تعويذة الرمح', '+10% damage.', '+10% ضرر.', 60, 'pas', { stat: 'atk', pct: 0.1 }),
        sk('mscold', 'Severe Cold Spear', 'رمح البرد القارس', 'A thrust of cold that chills and slows.', 'طعنة برد بتجمّد وتبطّأ.', 60, 'line', { r: 80, mul: 2, slow: 3, mp: 16, cd: 6, col: '#cfeaff' }),
        sk('msthrust', 'Spell Thrust', 'طعنة التعويذة', 'A thrust carrying the spell on the spear.', 'طعنة شايلة التعويذة اللي على الرمح.', 80, 'line', { r: 70, mul: 2.6, mp: 20, cd: 8 })
      ] },
    // Bubat (ch172, 414): the rare hidden Crusher, made to shatter formations; Unconditional; heavy blows erode health
    { id: 'crusher', n: { en: 'Crusher', ar: 'المحطِّم' }, root: 'warrior', from: ['gknight', 'knight', 'warrior', 'berserker'], by: 'tk', lv: 80, mst: ['melee', 5], col: '#a87a4a',
      obj: { t: 'kill', it: 'gsold', n: 30 }, xp: 80000, gold: 3000,
      q: q(['Break the Line', 'اكسر الصف'], ['Goblin soldiers fight in formation. Break thirty of them and the formation breaks with them.', 'جنود الجوبلن بيحاربوا في تشكيل. اكسر تلاتين منهم والتشكيل هيتكسر معاهم.'], ['The line still holds.', 'الصف لسه ثابت.'], ['A rare hidden class: Crusher. Formations shatter before you.', 'كلاس مخفي نادر: المحطِّم. التشكيلات بتتكسر قدامك.']),
      skills: [
        sk('crunc', 'Unconditional', 'غير مشروط', 'Rush at the foe and stun everything on the way.', 'تندفع على العدو وتشلّ كل اللي في سكتك.', 80, 'dash', { r: 100, mul: 1.8, stun: 1.2, mp: 20, cd: 10 }),
        sk('crero', 'Heavy Blow Erosion', 'تآكل الضربة التقيلة', 'Each skill also takes 2% of the foe\'s most health (a tenth of that on bosses).', 'كل سكيل بياخد كمان 2% من أقصى صحة العدو (عُشرها على الزعماء).', 80, 'pas', { stat: 'mhp', pct: 0.02 }),
        sk('crjugg', 'Juggernaut', 'الكاسح', '+20% health.', '+20% صحة.', 90, 'pas', { stat: 'hp', pct: 0.2 }),
        sk('crshat', 'Shatter Formation', 'تحطيم التشكيل', 'A blow that stuns everything around you.', 'ضربة بتشلّ كل اللي حواليك.', 100, 'nova', { r: 70, mul: 1.6, stun: 1.5, mp: 28, cd: 16, vfx: 'dust' })
      ] },
    // Zephyr (ch430): Acrobat's Laugh, Beast's Ring, Clone, the exploding balls, Clown's Tears and its evasion
    { id: 'acrobat', n: { en: 'Acrobat', ar: 'البهلوان' }, root: 'thief', from: ['thief'], by: 'hood', lv: 40, mst: ['dagger', 4], col: '#ff8ac8',
      obj: { t: 'kill', it: 'cgob', n: 20, wk: 'dagger' }, xp: 20000, gold: 800,
      q: q(['The Circus', 'السيرك'], ['A circus is in town and it needs a star. Dance among twenty cave goblins, dagger in hand.', 'فيه سيرك في البلد ومحتاج نجم. ارقص وسط عشرين جوبلن كهوف والخنجر في إيدك.'], ['The crowd is not laughing yet.', 'الجمهور لسه مش بيضحك.'], ['The crowd roars. You are an Acrobat.', 'الجمهور بيهلل. انت دلوقتي البهلوان.']),
      skills: [
        sk('aclaugh', 'Acrobat\'s Laugh', 'ضحكة البهلوان', 'A laugh that deafens and dazes everyone around.', 'ضحكة بتطرش وتدوّخ كل اللي حواليك.', 40, 'nova', { r: 70, mul: 0.6, stun: 1.5, mp: 16, cd: 14, vfx: 'stun' }),
        sk('acballs', 'Exploding Balls', 'الكور المتفجرة', 'Six juggled balls that burst where they land.', 'ست كور بتتنطط وتنفجر مكان ما توقع.', 40, 'proj', { proj: 'fire', n: 6, mul: 0.9, boom: 1, mp: 18, cd: 6 }),
        sk('acring', 'Beast\'s Ring', 'حلقة الوحش', 'A ring of fire around you bursts.', 'حلقة نار حواليك بتنفجر.', 50, 'nova', { r: 55, mul: 2, mp: 20, cd: 9, vfx: 'fire' }),
        sk('acclone', 'Clone', 'النسخة', 'A clone takes the blows: +30% evasion for 6 s.', 'نسخة بتاخد الضرب: +30% تفادي لمدة 6 ثواني.', 60, 'buff', { stat: 'eva', pct: 0.3, dur: 6, mp: 14, cd: 20 }),
        sk('actears', 'Clown\'s Tears', 'دموع المهرج', 'A haze of tricks around you: +60% evasion for 8 s.', 'ضباب حيل حواليك: +60% تفادي لمدة 8 ثواني.', 80, 'buff', { stat: 'eva', pct: 0.6, dur: 8, mp: 30, cd: 45 })
      ] },
    // Box (ch128): links magic to things and joins them into shapes that raise or lower
    { id: 'linker', n: { en: 'Linker', ar: 'الرابط' }, root: 'mage', from: ['mage'], by: 'tm', lv: 60, mst: ['staff', 5], col: '#8af0ff',
      obj: { t: 'kill', it: 'mgolem', n: 20, wk: 'staff' }, xp: 40000, gold: 1500,
      q: q(['The Threads', 'الخيوط'], ['Everything is joined by threads of mana. Cut the threads of twenty magic golems with your staff.', 'كل حاجة مربوطة بخيوط مانا. اقطع خيوط عشرين جولم سحر بعصايتك.'], ['You cannot see the threads yet.', 'لسه مش شايف الخيوط.'], ['You see the threads and you tie them. You are a Linker.', 'شايف الخيوط وبتربطها. انت دلوقتي الرابط.']),
      skills: [
        sk('lnlink', 'Link', 'الربط', 'Link to your gear: +20% damage and defence for 15 s.', 'تربط نفسك بعدتك: +20% ضرر ودفاع لمدة 15 ثانية.', 60, 'buff', { stat: 'atk', pct: 0.2, dur: 15, also: [{ stat: 'def', pct: 0.2 }], mp: 24, cd: 40 }),
        sk('lnform', 'Magic Formation', 'التشكيل السحري', 'A shape of mana around you hurts and slows.', 'شكل من المانا حواليك بيأذي ويبطّأ.', 60, 'nova', { r: 90, mul: 1.2, slow: 2, mp: 20, cd: 10, vfx: 'mana' }),
        sk('lnobj', 'Object Control', 'التحكم في الأشياء', 'Throw a linked object that bursts.', 'ترمي حاجة مربوطة بتنفجر.', 70, 'proj', { proj: 'magic', mul: 2.4, boom: 1, mp: 18, cd: 6 }),
        sk('lnamp', 'Amplifier', 'المضخّم', '+10% damage.', '+10% ضرر.', 80, 'pas', { stat: 'atk', pct: 0.1 })
      ] },
    // Euphemina (ch201, 654): the first epic hidden class; Skill Observation and Duplication, nothing above epic; a frail body
    { id: 'dupl', n: { en: 'Duplicator', ar: 'الناسخ' }, root: 'mage', from: ['mage', 'bmage', 'warlock', 'necro', 'esorc'], by: 'tm', lv: 120, mst: ['staff', 6], col: '#e0c8ff',
      obj: { t: 'kill', it: 'mimic', n: 30, wk: 'staff' }, xp: 300000, gold: 10000,
      q: q(['The Copy', 'النسخة'], ['Mimics copy what they see. Kill thirty and learn the trick from them.', 'الميميك بيقلدوا اللي بيشوفوه. اقتل تلاتين واتعلم منهم الحيلة.'], ['You still only watch.', 'لسه بتتفرج وبس.'], ['An epic hidden class: Duplicator. What you see, you can do; nothing above epic.', 'كلاس مخفي إيبك: الناسخ. اللي بتشوفه بتقدر تعمله، بس مفيش حاجة فوق الإيبك.']),
      skills: [
        sk('dpobs', 'Skill Observation', 'مراقبة السكيل', 'Read the foe: +15% damage for 20 s.', 'تقرا العدو: +15% ضرر لمدة 20 ثانية.', 120, 'buff', { stat: 'atk', pct: 0.15, dur: 20, mp: 16, cd: 30 }),
        sk('dpdup', 'Duplication', 'النسخ', 'Cast a skill of another class you have seen, at once and without a chant.', 'تعمل سكيل من كلاس تاني شفته، في ساعتها ومن غير تعويذة.', 120, 'dup', { mp: 30, cd: 20 }),
        sk('dpbody', 'Frail Body', 'جسم ضعيف', 'A magician\'s body: -10% health.', 'جسم ساحر: -10% صحة.', 120, 'pas', { stat: 'hp', pct: -0.1 }),
        sk('dpbliz', 'Copied Blizzard', 'العاصفة الثلجية المنسوخة', 'The great magic Blizzard, copied: everything around freezes and slows.', 'السحر العظيم العاصفة الثلجية، منسوخ: كل اللي حواليك بيتجمد ويبطأ.', 150, 'nova', { r: 120, mul: 2.4, slow: 3, mp: 50, cd: 40 })
      ] },
    // Peak Sword (ch288 "Hidden Sword", ch414 and 470): Draw Sword: Annihilate; a weak Sword Mastery; the sheath matters
    { id: 'qdraw', n: { en: 'Quick Draw Swordsman', ar: 'سيّاف السحب السريع' }, root: 'warrior', from: ['warrior', 'knight'], by: 'tw', lv: 60, mst: ['sword', 5], col: '#e8eef8',
      obj: { t: 'kill', it: 'deserter', n: 20, wk: 'sword' }, xp: 40000, gold: 1500,
      q: q(['From the Sheath', 'من الجراب'], ['The fastest cut is the one that leaves the sheath. Twenty deserters, sword in hand.', 'أسرع ضربة هي اللي بتطلع من الجراب. عشرين هارب من الجيش والسيف في إيدك.'], ['Too slow.', 'بطيء أوي.'], ['The Hidden Sword: a Quick Draw Swordsman. Everything in the draw.', 'السيف الخفي: سيّاف السحب السريع. كل حاجة في السحبة.']),
      skills: [
        sk('qdcut', 'Draw Cut', 'ضربة السحب', 'A quick cut out of the sheath.', 'ضربة سريعة طالعة من الجراب.', 60, 'line', { r: 60, mul: 2, mp: 10, cd: 4 }),
        sk('qdsheath', 'Sheath Draw', 'سحبة الجراب', '+15% critical chance.', '+15% فرصة كريتيكال.', 60, 'pas', { stat: 'crit', pct: 0.15 }),
        sk('qdweak', 'Weak Sword Mastery', 'إتقان سيف ضعيف', 'Not a normal swordsman: -10% damage outside the draw.', 'مش سيّاف عادي: -10% ضرر بره السحبة.', 60, 'pas', { stat: 'atk', pct: -0.1 }),
        sk('qdann', 'Draw Sword: Annihilate', 'سحب السيف: الإبادة', 'One draw cuts down everything in front. Costly and slow to return.', 'سحبة واحدة بتقطع كل اللي قدامك. غالية وبتتأخر ترجع.', 70, 'cone', { r: 75, mul: 4, mp: 50, cd: 25 })
      ] },
    // Jishuka (ch288, 470): Dancing Arrows, Hawk Eyes, arrows that turn in the air; before she became the Bow Saint
    { id: 'redflame', n: { en: 'Red Flame Archer', ar: 'رامي اللهب الأحمر' }, root: 'archer', from: ['ranger', 'sniper', 'bowmaster'], by: 'ta', lv: 100, mst: ['bow', 6], col: '#ff4a2a',
      obj: { t: 'kill', it: 'wolf', n: 40, wk: 'bow' }, xp: 150000, gold: 6000,
      q: q(['Red Flame', 'اللهب الأحمر'], ['Your arrows fly true; now make them burn. Forty wolves, bow in hand.', 'أسهمك بتصيب؛ دلوقتي خليها تولّع. أربعين ذيب والقوس في إيدك.'], ['The flame is still yellow.', 'اللهب لسه أصفر.'], ['Your arrows dance and burn. You are a Red Flame Archer.', 'أسهمك بترقص وبتولّع. انت دلوقتي رامي اللهب الأحمر.']),
      skills: [
        sk('rfdance', 'Dancing Arrows', 'الأسهم الراقصة', 'Seven arrows at once that pierce as they fly.', 'سبع أسهم مرة واحدة بتخترق وهي طايرة.', 100, 'proj', { proj: 'arrow', n: 7, mul: 1, pierce: 1, mp: 24, cd: 7 }),
        sk('rfhawk', 'Hawk Eyes', 'عيون الصقر', 'You see far and in the dark: +10% critical chance.', 'بتشوف بعيد وفي الضلمة: +10% فرصة كريتيكال.', 100, 'pas', { stat: 'crit', pct: 0.1 }),
        sk('rfturn', 'Free-Turning Arrows', 'الأسهم الحرة', 'Arrows turn in the air: +10% damage.', 'الأسهم بتلف في الهوا: +10% ضرر.', 110, 'pas', { stat: 'atk', pct: 0.1 }),
        sk('rfshot', 'Red Flame Shot', 'طلقة اللهب الأحمر', 'An arrow of red flame that bursts.', 'سهم لهب أحمر بينفجر.', 120, 'proj', { proj: 'fire', mul: 3, boom: 1, mp: 30, cd: 10 })
      ] },
    // the Saintess' Knight (wiki: epic; low stats and plain actives, strong passives; courage to sacrifice for the Saintess)
    { id: 'saintkn', n: { en: 'Saintess\' Knight', ar: 'فارس القديسة' }, root: 'gknight', from: ['knight', 'gknight', 'paladin'], by: 'tk', lv: 150, mst: ['sword', 6], col: '#fff0c0',
      obj: { t: 'block', it: 'guard', n: 100 }, xp: 500000, gold: 20000,
      q: q(['The Shield of the Saintess', 'درع القديسة'], ['The Saintess needs one who takes the blow meant for her. Turn a hundred blows with your guard.', 'القديسة محتاجة حد ياخد الضربة اللي جاية عليها. صدّ مية ضربة بدرعك.'], ['Not every blow yet.', 'لسه مش كل ضربة.'], ['An epic hidden class: Saintess\' Knight. You stand between her and harm.', 'كلاس مخفي إيبك: فارس القديسة. انت واقف بينها وبين الأذى.']),
      skills: [
        sk('skslash', 'Holy Slash', 'الضربة المقدسة', 'A cut of light.', 'ضربة نور.', 150, 'line', { r: 60, mul: 2.2, mp: 14, cd: 5, col: '#fff4c0' }),
        sk('skguard', 'Saintess\' Guard', 'حارس القديسة', '+15% defence, +10% health.', '+15% دفاع و+10% صحة.', 150, 'pas', { stat: 'def', pct: 0.15, also: [{ stat: 'hp', pct: 0.1 }] }),
        sk('sktaunt', 'Taunt Shield', 'درع الاستفزاز', 'Draw every blow to your shield: +50% defence for 5 s.', 'تشد كل الضرب على درعك: +50% دفاع لمدة 5 ثواني.', 160, 'buff', { stat: 'def', pct: 0.5, dur: 5, mp: 20, cd: 25 }),
        sk('skvow', 'Sacrificial Vow', 'قسم التضحية', '30% health back.', 'يرجعلك 30% صحة.', 170, 'heal', { pct: 0.3, mp: 30, cd: 60 })
      ] },
    // Damian (ch122, 421): refused the Pope's order and became the Goddess' Agent; Light's Blessing; later the Pope's blessings
    { id: 'gagent', n: { en: 'Goddess\' Agent', ar: 'وكيل الإلهة' }, root: 'priest', from: ['paladin'], by: 'cassus', lv: 150, mst: ['melee', 5], col: '#ffe8a0',
      obj: { t: 'kill', it: 'ypriest', n: 1 }, xp: 500000, gold: 20000,
      q: q(['The Goddess\' Divine Punishment', 'العقاب الإلهي للإلهة'], ['A corrupt priest wears the goddess\' robe. Refuse every order but hers: strike down the Yatan priest.', 'فيه كاهن فاسد لابس رداء الإلهة. ارفض أي أمر غير أمرها: اقتل كاهن ياتان.'], ['The corruption still stands.', 'الفساد لسه واقف.'], ['A hidden class: Goddess\' Agent. You act in Rebecca\'s name.', 'كلاس مخفي: وكيل الإلهة. انت بتتصرف باسم ريبيكا.']),
      skills: [
        sk('gajudge', 'Judgment', 'الحُكم', 'A blow of the goddess\' light.', 'ضربة من نور الإلهة.', 150, 'line', { r: 65, mul: 2.4, mp: 16, cd: 5, col: '#fff8c0' }),
        sk('gaagent', 'Agent of the Goddess', 'وكيل الإلهة', 'All stats raised: +10% damage and defence.', 'كل الإحصائيات زادت: +10% ضرر ودفاع.', 150, 'pas', { stat: 'atk', pct: 0.1, also: [{ stat: 'def', pct: 0.1 }] }),
        sk('galight', 'Light\'s Blessing', 'بركة النور', 'A golden pillar falls from the sky: +80% damage and defence and +10% critical hits for 3 minutes, for you and your party nearby.', 'عمود دهبي بينزل من السما: +80% ضرر ودفاع و+10% كريتيكال لمدة 3 دقايق، ليك وللبارتي اللي جنبك.', 150, 'buff', { stat: 'atk', pct: 0.8, dur: 180, also: [{ stat: 'def', pct: 0.8 }, { stat: 'crit', pct: 0.1 }], mp: 80, cd: 300 }),
        sk('gadesire', 'Heart\'s Desire', 'رغبة القلب', 'The dead are resurrected on the spot: every fallen party member near you rises with full health. Players only.', 'الميتين بيقوموا في مكانهم: كل حد من البارتي وقع جنبك بيقوم بصحة كاملة. للاعيبة بس.', 170, 'heal', { pct: 0, mp: 40, cd: 600 }),
        sk('gabreath', 'Goddess\' Breath', 'نَفَس الإلهة', 'All your health back, and 70% of it to your party nearby.', 'كل صحتك بترجع، و70% منها للبارتي اللي جنبك.', 150, 'heal', { pct: 1, mp: 30, cd: 300 }),
        sk('gashield', 'Goddess\' Protection', 'حماية الإلهة', 'A shield of absolute defence: the next blow you take, within 30 s, does nothing.', 'درع دفاع مطلق: الضربة الجاية اللي هتاخدها، في خلال 30 ثانية، مش هتعمل حاجة.', 160, 'heal', { pct: 0, mp: 20, cd: 120 }),
        sk('gaprot', 'Divine Protection', 'الحماية الإلهية', '+20% defence for 3 minutes.', '+20% دفاع لمدة 3 دقايق.', 200, 'buff', { stat: 'def', pct: 0.2, dur: 180, mp: 40, cd: 300 })
      ] }
  );
})(typeof window !== 'undefined' ? window : globalThis);
