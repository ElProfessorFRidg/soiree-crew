# Recon-BAC report

Phase 0, Recon-BAC. Feeds O-04, O-05, O-15 to O-31, PREF-02, PREF-06, ADP-01, ADP-06, RANK-07 and the BAC engine of phase 1.
Read date for every web source: 2026-10-26 unless stated otherwise. Values computed by me (not read in a source) are labelled **COMPUTED**. Values I could not confirm on an official or peer-reviewed page are labelled **UNVERIFIED**.

## 1. Summary

- Model: one-compartment, first-order absorption per drink, Michaelis-Menten elimination that is zero-order (rate beta) at normal levels and tapers smoothly near zero. Integrated numerically from the full drink list each time (pure function), so drinks logged after the fact, edits and deletions never create jumps or double counts.
- Default constants: r = 0.70 L/kg (men), 0.60 L/kg (women) (Jones 2019); beta = 0.15 g/L/h (Jones 2010, population average for moderate drinkers); Km = 0.05 g/L (Norberg 2003, ADH 0.05-0.1 g/L); ethanol density 0.789 g/mL (OSAC). Absorption half-life 6 min fasted / 40 min fed, **COMPUTED** by calibrating the model to Jones & Jönsson 1994.
- Height matters. With weight and sex only, a man with BMI 35 is under-estimated by about 18 % at peak and told he is under 0.5 g/L about 1 h too early (**COMPUTED**, test T11). Recommendation: ask height (optional, encouraged) and use Watson (men, needs age) or Forrest (BMI) as recommended by Maskell et al. 2019; fall back to the r defaults. S2M dropped height because their formula never used it; ours does.
- Driving status must be conservative: the "under the limit at" time uses beta = 0.10 g/L/h (the low end of the OSAC 0.10-0.25 g/L/h range), never the central value, and is never shown while the BAC is still rising.
- Storage in g/L of blood (PREF-06). Breath is derived with the ratio implied by each country's own law (2000:1 in France and most of the EU, 2100:1 in the US, about 2300:1 in the UK). The measured physiological mean is about 2400:1 (Jones & Andersson 1996), so a 2000:1 display over-states breath, which is the safe direction.
- Legal limits: 34 rows (25 countries plus regions). Verified on official pages except Russia, Morocco, Tunisia (fully **UNVERIFIED**), Belgium breath, Czechia / Slovakia / Hungary / Romania details (EC page only) and the current Algerian value. Corrections to the brief: Victoria (AU) professionals are 0.00, not 0.02; Japan added a numeric drunk-driving tier on 21 July 2026; Irish professionals are 20 mg/100 mL; the French délit penalty now reads 3 years / EUR 9,000 (law reference unconfirmed); Morocco's emergency numbers are 150 / 190 / 177; in Norway 112 is the police.
- Thresholds proposed (blood g/L / breath mg/L at 2000:1): level 1 at 0.50 / 0.25, level 2 at 0.80 / 0.40, level 3 at 1.20 / 0.60, hysteresis 0.10 g/L + 10 min dwell; next-morning vault from 0.80 g/L (current or projected peak); danger cap RANK-07 at 1.20 g/L, with a medical-signs card from 2.0 g/L. These line up with the design's curve bands (0.25 / 0.60 mg/L), but the lowest band must not use the "OK" green for users whose legal limit is lower (novices, Sweden, Norway, Poland, zero-tolerance countries).

## 2. Findings

### 2.1 BAC model

#### 2.1.1 What the literature supports

| Item | Value | Source |
|---|---|---|
| Widmark relation | C = D / (r x W), C in g/L, D grams of ethanol, r (Vd) in L/kg, W in kg | OSAC 2020-S-0003, eq. 1 (S1); Searle 2015 (S4) |
| Average Vd / r | about 0.70 L/kg men, about 0.60 L/kg women; varies with age, sex, adiposity | Jones 2019 abstract (S5) |
| Population range of Vd | 0.40 to 0.80 L/kg, "use of a single factor for Vd is inappropriate" | OSAC 4.1.2.1, 4.1.2.3 (S1) |
| Best anthropometric formulas | men: Watson (age, height, weight), bias 0.00, 95 % range +-0.13 L/kg; women: Forrest (BMI), bias -0.01, 95 % range +-0.15 L/kg | Maskell et al. 2019 (S3) |
| Watson TBW, men | TBW (L) = 2.447 - 0.09516 x age (y) + 0.1074 x height (cm) + 0.3362 x weight (kg) | UW-Madison Addiction Research Center (S6), Searle 2015 (S4, same coefficients with height in m x 10.74) |
| Watson TBW, women | TBW (L) = -2.097 + 0.1069 x height (cm) + 0.2466 x weight (kg) | S6. Searle 2015 as rendered by PMC prints the intercept as +2.097 and drops the sign; -2.097 gives plausible body water (50 % for 165 cm / 60 kg), so S6 is retained |
| Watson to r | r = TBW / (0.80 x W), 0.80 = water fraction of blood | S6 uses the 0.8 divisor; Watson 1981 abstract (S7) confirms the model is TBW / blood-water fraction but the 0.80 value itself is read only on S6: **UNVERIFIED in the primary paper** |
| Forrest | men r = 1.0181 - 0.01213 x BMI; women r = 0.9367 - 0.01240 x BMI | Searle 2015 (S4) |
| Seidl 2000 | needs height and weight; one published copy gives height coefficient 0.004632, another 0.004432 | conflicting copies, **UNVERIFIED**, not used |
| Elimination (zero-order) | 0.10-0.15 g/L/h fasted, 0.15-0.20 fed, 0.25-0.35 alcoholics in detox; physiological range 0.10-0.35; 0.15 g/L/h good average for moderate drinkers, 0.19 for apprehended drivers; women slightly faster | Jones 2010 (S8) |
| Elimination range for calculations | 0.010-0.025 g/dL/h (0.10-0.25 g/L/h) covers most of the population; below 0.20 g/L elimination may stop being linear | OSAC 4.1.3.1, 4.1.3.2 (S1) |
| Michaelis constant | ADH Km 0.05-0.1 g/L; CYP2E1 Km 0.5-0.8 g/L | Norberg et al. 2003 (S9); Jones 2010 gives 2-10 mg/100 mL (0.02-0.1 g/L) (S8) |
| Low-level slowdown | mean rate fell from 0.163 to 0.083 g/kg/h below 0.19 g/kg in drivers | 2016 two-sample study, PubMed 27295074 (S10) |
| Absorption | peak usually 10-60 min after dosing (Jones 2019, S5); complete absorption can take up to 2 h after the last drink (OSAC 4.1.1, S1) | S1, S5 |
| First-order absorption model | one compartment, first-order absorption (half-lives 15 and 20 min tested), zero-order elimination 0.1 and 0.2 g/L/h; predicted peaks 0.68-0.84 g/L vs observed 0.77 +- 0.19 | Piekoszewski & Gubala 2000 (S11) |
| Food | 0.80 g/kg after breakfast vs fasted: peak 0.67 vs 1.04 g/L, AUC 0-6 h 2.41 vs 3.98 g.h/L, dose cleared about 2 h sooner; a meal raises elimination rate by 36-50 % | Jones & Jönsson 1994 (S12) |
| Food (population PK) | food multiplies maximum elimination rate by 1.39 (95 % CI 1.33-1.46) and lowers the absorption rate constant | Büsker et al. 2023 (S13) |
| Density of ethanol | 0.789 g/mL | OSAC 4.7 (S1) |
| BAC keeps rising after drinking stops | stated | NIAAA (S14) |
| Uncertainty | Gullberg's CV about 21 % on a BAC result is commonly cited; Searle argues it must be computed per case | Searle 2015 (S4) |

#### 2.1.2 What the profile really needs (O-04)

- Required: weight (kg) and sex used as "body model" (male / female). The formula has no third option; "other / prefer not to say" should map to the female body model because it gives the higher estimate (safe direction). Say so in the UI.
- Optional but used: height (cm). Needed for Forrest (both sexes) and Watson (men). Without it, defaults are 0.70 / 0.60.
- Optional but used: age (years, from the birth date if O-02 stores it). Needed only for Watson men.
- Why height is worth asking (**COMPUTED**, see T11): a 107 kg, 175 cm man (BMI 34.9) has Forrest r = 0.594 against the 0.70 default. After 3 pints the default model peaks at 0.60 g/L and says "under 0.5 g/L" after 2.2 h; with height it peaks at 0.73 g/L and says 3.2 h. For a lean woman (165 cm, 60 kg, Forrest r = 0.663) the default 0.60 over-estimates, which is the safe direction. So height mainly protects people with high BMI, which is exactly where the default is unsafe.
- Rule: r = Watson (men with age and height), else Forrest (height known), else default. Clamp r to [0.40, 0.80] (OSAC range) so out-of-range inputs never produce absurd values. Bounded inputs (O-04): weight 30-250 kg, height 120-230 cm, age 18-100 (**proposal**, not from a source).

#### 2.1.3 Equations (the engine)

Per drink i: volume V_i (mL), strength ABV_i (fraction v/v), logged time t_i (UTC), optional food flag.

1. Ethanol dose: D_i = V_i x ABV_i x 0.789 (g).
2. Distribution volume: Vd = r x W (L).
3. Gut amount of drink i (first-order absorption, bolus at t_i):
   G_i(t) = D_i x exp(-ka_i x (t - t_i)) for t >= t_i, 0 before. ka_i = ln 2 / t_half_i.
4. Blood concentration C(t) (g/L) solves
   dC/dt = (1 / Vd) x sum_i ka_i x G_i(t) - beta x C / (Km + C), with C(t_start) = 0.
   - With Km = 0 this is exactly Widmark with zero-order elimination plus an absorption phase; the closed form for one drink is C(t) = (D / Vd)(1 - exp(-ka t)) - beta t until C reaches 0 (used as test T5).
   - Km = 0.05 g/L makes the decline taper below about 0.2 g/L, consistent with S1, S8, S10, and removes the kink at zero. Vmax is set equal to beta, so in the 0.3-1.5 g/L range the effective rate is 86-97 % of beta: slightly slower elimination, the safe direction.
5. Integration: fixed step of 15 s with RK4 (or 1 min steps with RK4, both stable for t_half >= 6 min), from the start of the current episode to now and to the projection horizon. Deterministic, so app, widgets and backend give the same number from the same inputs.
6. Episode start: the last time before the earliest relevant drink when C < 0.005 g/L and total gut alcohol < 0.1 g. Drinks before that point cannot affect the present and are skipped. Cache checkpoints at each zero crossing.
7. Derived outputs:
   - Peak (O-16): max of C over [now, now + 4 h] if still rising, else the past maximum of the episode.
   - Trend: sign of dC/dt at now (rising / falling), with a dead band of +-0.02 g/L/h to avoid flicker.
   - Back to zero (O-17): first t > now with C < 0.005 g/L and gut < 0.1 g. Central constants.
   - Under the limit at (O-18): first t after the projected peak with C < legal limit, computed with beta_safe = 0.10 g/L/h. Never "under the limit" while gut alcohol would take C above the limit later.

Default constants:

| Constant | Default | Source / status |
|---|---|---|
| r men / women | 0.70 / 0.60 L/kg | S5 |
| beta (central) | 0.15 g/L/h | S8 |
| beta_safe (driving timer) | 0.10 g/L/h | low end of S1 range; decision, see 3 |
| beta fed | 0.20 g/L/h (= 1.33 x 0.15) | S8 fed range 0.15-0.20; S13 factor 1.39 |
| Km | 0.05 g/L | S9 (0.05-0.1), S8 (0.02-0.1) |
| t_half absorption, fasted or unknown | 6 min | **COMPUTED**: reproduces the S12 fasted peak (1.01 vs 1.04 g/L, peak at 51 min with drinking over 30 min) |
| t_half absorption, fed | 40 min | **COMPUTED**: with beta 0.20 reproduces the S12 fed peak (0.67 g/L) and the about 2 h shorter clearance (7.4 vs 9.5 h) |
| bioavailability | 1.0 (no first-pass reduction) | safe direction; S9 says first-pass is hard to assess |
| zero threshold | 0.005 g/L (shows 0.00 g/L and 0.00 mg/L) | proposal |
| density | 0.789 g/mL | S1 |

Note: S11 used 15-20 min half-lives with vodka. My 6 min fasted value comes from the S12 data and is aggressive (fast, high peaks). That is deliberate: when the food state is unknown, the model should not under-estimate the peak. Flag for phase 1: compare against a second published fasted curve before freezing.

#### 2.1.4 Edge cases

- Drink logged after the fact (O-22): the stored t_i is the time the user picked; the curve is recomputed from the full list, so a late-logged drink gives exactly the same curve as one logged on time (test T8). The curve between t_i and now changes retroactively; animate that change (MOT-04) instead of jumping.
- Drink in the future: any t_i > server now is excluded from every computation, including projections, until its time arrives (test T9). Client clocks are not trusted; use server time with the offset learned at sync (O-31).
- Double counting (O-31, O-33): drinks carry a client-generated UUID; the engine works on the de-duplicated set. The engine itself must be idempotent: same set in, same curve out.
- No discontinuity: the ODE solution is continuous in time and in the inputs. Adding a drink changes only the future (from t_i on). There is no "absorption complete" switch, no clamp other than C >= 0, and the Km taper removes the corner at zero. 24 h after one beer, C is 0 to machine precision (test T1).
- Very high BAC (O-17, above 1.5 mg/L breath = 3.0 g/L blood): no upper clamp in the engine, no fixed 24 h horizon. The horizon extends until the zero criterion is met (up to 96 h). Test T3b reaches 5.3 g/L and returns to zero after 41 h. The display shows the number; from 2.0 g/L the danger card is shown (see 2.5). Do not speed up elimination at high levels (CYP2E1 induction is real, S8, S9, but assuming it would shorten the timer for exactly the people at risk).
- Multi-day trips (O-40): one continuous timeline per user, not per party. Episodes split at zero crossings, so day 2 is independent of day 1 if the user returned to zero (test T6). Time zone changes do not matter because everything is UTC; only display uses local time.
- Food: one toggle "I ate a meal" per drink or per evening (default unknown = fasted parameters). Proposal only; the UI cost is one switch.

### 2.2 Blood / breath conversion

Physiology: Jones & Andersson 1996 (S15), 799 Swedish drink-drivers, mean time-adjusted blood/breath ratio 2407 (SD 213), 95 % limits of agreement 1981 to 2833; 4.3 % were below 2100.

Legal ratios are a convention fixed by each country's limits. See the table in 2.3 for the ratio implied per country.

Recommendation: store g/L of blood. Each country record carries its legal blood limit and, where the law has one, its legal breath limit; the display ratio is limitBlood / limitBreath for that country, or the country's stated ratio. Driving status is computed in the blood domain against limitBlood. This way the breath number shown always crosses the breath limit at the same moment the blood number crosses the blood limit, and we never invent a ratio.

Display formulas from C (g/L blood):
- mg/L breath = 1000 x C / ratio (2000:1: 0.50 g/L -> 0.25 mg/L)
- % BAC (g/100 mL, US) = C / 10 (0.8 g/L -> 0.08 %)
- mg/100 mL blood (UK, IE, CA) = 100 x C
- ug/100 mL breath (UK) = 100000 x C / ratio (0.80 g/L at 2286:1 -> 35)
- ug/L breath (NZ) = 1000000 x C / ratio (0.50 g/L at 2000:1 -> 250)
- per mille = C, see the note below
- g/210 L breath (US) = C / 10 when the ratio is 2100

Note on per mille: in German-speaking law the per mille can be a mass ratio (g of ethanol per kg of blood) rather than g/L; the difference is the density of blood (about 5 %). **UNVERIFIED** (I could not read the statute text for this point). Given the model uncertainty (CV about 21 %, S4), display per mille = g/L and say so in the glossary.

### 2.3 Legal driving limits (O-05, O-18)

Merged from two sub-agent passes that read official pages (legislation, government, European Commission "Your Europe" driving-abroad pages, which most say "last checked 18/09/2024"). [EC] = europa.eu/youreurope/citizens/travel/driving-abroad/road-rules-and-safety/{country}/index_en.htm (S50). [EC] writes values in mg/mL, which equals g/L of blood. All read 2026-10-26.

Engine encoding: each row becomes { limitBlood g/L, limitBreath mg/L or null, noviceBlood, noviceBreath, proBlood, proBreath, ratio, zeroTolerance flag, criminalBlood }. "0.0" rows mean "any alcohol"; the engine treats them as limit = 0.005 g/L (the zero threshold), so the driving card only shows back-to-zero.

| Country | Standard limit (law's unit) | Blood g/L | Breath mg/L | Novice limit, and who is novice | Professional limit | Special cases | Ratio implied | Sources |
|---|---|---|---|---|---|---|---|---|
| France | 0.50 g/L blood or 0.25 mg/L air (Code de la route R234-1) | 0.50 | 0.25 | 0.20 g/L / 0.10 mg/L for probationary licence: 3 years, 2 years with extra training or with accompanied learning (AAC), 18 months with both; also learners and the accompanying adult | 0.20 / 0.10 for bus and coach drivers and alcohol-interlock (EAD) drivers; other professionals 0.50 | Délit (criminal) at >= 0.80 g/L / 0.40 mg/L (L234-1). Penalty now read as 3 years prison + EUR 9,000, citing a "Loi n° 2026-798 of 18 Aug 2026": the law reference is **UNVERIFIED** (older texts say 2 years / EUR 4,500). Below: contravention up to EUR 750 and 6 points | 2000:1 (0.2/0.10, 0.5/0.25, 0.8/0.40) | S51 Légifrance R234-1 LEGIARTI000038954545, L234-1 LEGIARTI000051877291; service-public F2881 (checked 27 Aug 2026), F2390 |
| UK: England, Wales | 80 mg/100 mL blood; 35 ug/100 mL breath; 107 mg/100 mL urine (gov.uk) | 0.80 | 0.35 | none | none | DfT consultation (closed 11 May 2026) on lowering the limit and adding a novice limit; no outcome found | 2286:1 | S44 gov.uk/drink-drive-limit; gov.uk consultation page (S52) |
| UK: Northern Ireland | 80 / 35 / 107 as England | 0.80 | 0.35 | none in force (20 mg / 9 ug "planned") | none in force (planned 20 / 9) | 50 mg general limit "planned" | 2286:1 | S44, S52 |
| UK: Scotland | 50 mg/100 mL blood; 22 ug/100 mL breath; 67 mg/100 mL urine (since 5 Dec 2014) | 0.50 | 0.22 | none | none | The SSI 2014/328 reference was seen only in search results | 2273:1 | mygov.scot/drink-drive-limit (S53), S44 |
| Ireland | 50 mg/100 mL blood; 22 ug/100 mL breath; 67 mg/100 mL urine (Road Traffic Act 2010 s.4) | 0.50 | 0.22 | 20 mg / 9 ug for "specified persons": learners, first 2 years of a first licence, no licence for the category | 20 mg / 9 ug for C, C1, D, D1, EB, EC, EC1, ED, ED1, W licence holders driving such vehicles, and taxi / SPSV drivers. **Correction**: [EC] lists 0.5 for professionals; the Act is authoritative | up to EUR 5,000 and/or 6 months | 2273:1 (20/9 gives 2222:1) | S54 revisedacts.lawreform.ie 2010 act 25 s.3, s.4 |
| Germany | 0.5 per mille blood or 0.25 mg/L breath (StVG §24a, administrative) | 0.50 | 0.25 | total ban, no number (StVG §24c): under 21 or in probation (2 years, extendable by 2, §2a). Engine: 0.0 | bus, coach, taxi, hire-car staff: no alcohol on duty (BOKraft §8). Trucks: no specific rule found | 1.1 per mille absolute unfitness and >= 0.3 per mille with driving errors under StGB §316 come from case law (bpb.de), not the statute. [EC] novice line is garbled | 2000:1 | S43 gesetze-im-internet.de StVG §24a, §24c, §2a; BOKraft §8; bpb.de (S55) |
| Switzerland | 0.5 per mille blood / 0.25 mg/L breath; qualified >= 0.8 / 0.4 (SVG art. 91) | 0.50 | 0.25 | 0.10 per mille / 0.05 mg/L (VRV art. 2a(2)): probationary licence, learners, accompanying persons, instructors. Probation length (3 years) **UNVERIFIED** | 0.10 / 0.05 for professional passenger transport, trucks over 3.5 t, dangerous goods (VRV art. 2a(1)) | qualified level: up to 3 years or fine | 2000:1 | S56 Fedlex VRV PDF (2017 consolidation), bfu.ch, astra.admin.ch |
| Luxembourg | 0.5 per mille ~ 0.25 mg/L | 0.50 | 0.25 | 0.2 per mille / 0.1 mg/L for candidates, probation, instructors, accompanying adults, under 18 (securite-routiere.lu, an association: semi-official). Probation length **UNVERIFIED** | 0.2 / 0.1 for bus, coach, truck, taxi, rental, ambulance, tow, dangerous goods (police.public.lu names truck, taxi, bus) | 0.5-0.8 EUR 145; 0.8-1.2 per mille (0.35-0.55 mg/L) court; >= 1.2 / 0.55 criminal. Statute not read | inconsistent: 2000 / 2286 / 2182 | S57 police.public.lu (2019, updated 2021), securite-routiere.lu, [EC] |
| Belgium | 0.5 ([EC]) | 0.50 | **UNVERIFIED** (0.22 mg/L often cited, not read) | 0.5 ([EC]) | 0.2 ([EC]) | national law not read (CAPTCHA, Justel did not load); higher tiers **UNVERIFIED** | **UNVERIFIED**; default 2000 for display until confirmed | [EC] belgium |
| Spain | 0.5 g/L blood or 0.25 mg/L breath (RGC art. 20) | 0.50 | 0.25 | 0.3 g/L / 0.15 mg/L for the first 2 years of licence | 0.3 / 0.15 for goods > 3,500 kg, > 9 seats, public service, school transport, dangerous goods, emergency | [EC] "underage 0.0" not in art. 20: **UNVERIFIED**; criminal threshold **UNVERIFIED** | 2000:1 | S58 boe.es BOE-A-2003-23514 (updated 26/06/2026), [EC] |
| Italy | 0.5 g/L (Codice della strada art. 186; blood only) | 0.50 | not in law | 0.0 for under 21 and the first 3 years of a B licence (art. 186-bis) | 0.0 for passenger and goods transport, heavy vehicles, buses (186-bis) | 0.5-0.8 administrative; 0.8-1.5 criminal (arrest up to 6 months); > 1.5 criminal (6 months to 1 year) | none in law; display at 2000 | S59 normattiva.it art. 186, 186-bis |
| Portugal | >= 0.5 g/L blood (Código da Estrada art. 81 n.2) | 0.50 | 0.217 (via the legal factor) | 0.2 g/L for drivers under the probationary regime (art. 81 n.3); length (3 years) **UNVERIFIED** | 0.2 g/L for emergency, school transport, taxi, TVDE, heavy and dangerous goods | crime at 1.2 g/L **UNVERIFIED** | 2300:1 stated in law (art. 81 n.4: 1 mg/L air = 2.3 g/L blood) | S60 pgdlisboa.pt Código da Estrada (version to Lei 24/2025), [EC] |
| Netherlands | 0.5 mg/mL blood or 220 ug/L breath (WVW 1994 art. 8(2), version from 01-09-2026) | 0.50 | 0.22 | 0.2 mg/mL / 88 ug/L (art. 8(3)): < 5 years since first licence obtained at 18+; < 7 years since AM/T licence obtained before 18; < 5 years since B licence obtained before 18 | 0.5 ([EC]); no separate rule in art. 8 | | 2273:1 | S61 wetten.overheid.nl BWBR0006622 art. 8, [EC] |
| Poland | two tiers: 0.2-0.5 per mille or 0.1-0.25 mg/dm3 ("stan po użyciu alkoholu"); > 0.5 per mille or > 0.25 mg/dm3 ("stan nietrzeźwości") (act on upbringing in sobriety art. 46) | 0.20 | 0.10 | same for all | same | 0.2-0.5: offence (Kodeks wykroczeń art. 87 §1), arrest or fine >= PLN 2,500 + mandatory ban; > 0.5: crime (Kodeks karny art. 178a §1), up to 3 years (older summaries say 2) | 2000:1 | S62 api.sejm.gov.pl DU/2023/2151, DU/2026/1372, DU/2026/1342 |
| Czechia | 0.0 ([EC]) | 0.0 | 0.0 | 0.0 | 0.0 | practical tolerance, offence bands, crime threshold **UNVERIFIED** (e-Sbírka, BESIP unusable) | n/a | [EC] czechia |
| Slovakia | 0.0 ([EC]) | 0.0 | 0.0 | 0.0 | 0.0 | details **UNVERIFIED** (Slov-Lex did not render) | n/a | [EC] slovakia |
| Hungary | 0.0 ([EC]) | 0.0 | 0.0 | 0.0 | 0.0 | practical tolerance and Btk §236 threshold **UNVERIFIED** (njt.hu unreachable) | n/a | [EC] hungary |
| Romania | 0.0 ([EC]) | 0.0 | 0.0 | 0.0 | 0.0 | criminal threshold 0.80 g/L (Cod penal art. 336) **UNVERIFIED** | n/a | [EC] romania |
| Sweden | >= 0.2 per mille blood or 0.10 mg/L breath (Lag 1951:649 §4) | 0.20 | 0.10 | same | same | aggravated (grovt rattfylleri) >= 1.0 per mille / 0.50 mg/L, up to 2 years | 2000:1 | S63 riksdagen.se SFS 1951:649, [EC] |
| Norway | > 0.2 per mille blood or 0.1 mg/L breath (Vegtrafikkloven §22) | 0.20 | 0.10 | same | §22b: drivers carrying passengers or goods for work: no alcohol during working hours or 8 h before a shift | §31: up to 0.5 fine; 0.5-1.2 fine + possible prison; > 1.2 / 0.6 unconditional prison | 2000:1 | S64 lovdata.no lov 1965-06-18-4 ch. 4, [EC] |
| Russia | **UNVERIFIED**: 0.16 mg/L breath / 0.3 g/L blood (note to KoAP art. 12.8) | 0.30 (UNVERIFIED) | 0.16 (UNVERIFIED) | **UNVERIFIED** | **UNVERIFIED** | official sites (pravo.gov.ru, kremlin.ru, gibdd) unreachable. If confirmed, the 0.16 breath / 0.3 blood pair implies 1875:1, so store both limits separately and do not derive one from the other | 1875:1 if confirmed | none read |
| Morocco | **UNVERIFIED**: neither "zero" (brief) nor 0.2 g/L / 0.1 mg/L could be confirmed | **UNVERIFIED** | **UNVERIFIED** | **UNVERIFIED** | **UNVERIFIED** | loi 52-05 text not found in the scanned Bulletins officiels read (5822, 5823-bis, 5826, 5878-bis); narsa.ma and transport.gov.ma did not respond. Until verified, ship Morocco as zero tolerance (safe direction) | n/a | sgg.gov.ma (S65) |
| Tunisia | **UNVERIFIED** (0.5 g/L not confirmed) | **UNVERIFIED** | **UNVERIFIED** | **UNVERIFIED** | **UNVERIFIED** | ONSR lists "driving under the influence of an alcoholic state" with no number; legislation.tn timed out. Ship as 0.5 g/L flagged, or zero tolerance until verified (recommend zero) | n/a | onsr.nat.tn (S66) |
| Algeria | "état d'ivresse" at >= 0.20 g per mille blood (ordonnance 09-03 of 22 July 2009, amending loi 01-14) | 0.20 | not in text | 2-year probationary licence exists; no separate alcohol limit in this text | none found | later amendments (loi 17-05 and newer) not checked: current value **UNVERIFIED** | none in law | S67 joradp.dz JO 2009 n°45 |
| United States | 0.08 % BAC (23 U.S.C. 163, federal funding condition); illegal at .08 g/dL in all states, DC and Puerto Rico "except in Utah where the BAC limit is .05" (NHTSA) | 0.80 (Utah 0.50) | 0.08 g/210 L (Utah 0.05) | under 21: 0.02 % (23 U.S.C. 161); states may be lower, not checked | commercial drivers 0.04 (49 CFR 382.201; g/210 L breath per 382.107) | Utah: ".05 grams or greater", blood per 100 mL and breath per 210 L (Utah Code 41-6a-502) | 2100:1 | S68 nhtsa.gov/risky-driving/drunk-driving; govinfo 23 USC 161, 163; law.cornell.edu 49 CFR 382.107, 382.201; le.utah.gov 41-6a-502 |
| Canada (federal) | Criminal Code 320.14(1)(b): >= 80 mg/100 mL blood within 2 h of driving | 0.80 | breath results are expressed directly as mg/100 mL blood (320.31(1)) | provincial (below) | provincial (below) | provincial administrative "warn" ranges at 50 mg | none in law; instruments report blood-equivalent; display 2100 **UNVERIFIED** choice | S46 laws-lois.justice.gc.ca 320.14, 320.31; justice.gc.ca |
| Canada: Ontario | federal 80 + warn range 0.05-0.079 | 0.80 (warn 0.50) | - | 0.0 for age 21 or under and G1/G2/M1/M2 | 0.0 for A-F classes, CVOR vehicles, trucks, buses | | | S69 ontario.ca/page/impaired-driving |
| Canada: Quebec | federal 80; no 50 mg rule on SAAQ page | 0.80 | - | 0.0 for under 22 (current SAAQ page; older documents say 21 and under), learners, probationary, never licensed, motorcycle <= 24 months | 0.0 for taxi, limousine, minibus, bus | | | S70 saaq.gouv.qc.ca |
| Canada: British Columbia | "Warn" >= 0.05, "Fail" 80 mg | 0.80 (warn 0.50) | - | graduated (L / N): any alcohol -> 12 h suspension (0.0) | **UNVERIFIED** | other provinces except Quebec and Yukon suspend at 50-80 mg (SAAQ snippet only: **UNVERIFIED**) | | S71 www2.gov.bc.ca roadsafetybc |
| Australia: NSW | full licence: under 0.05 BAC | 0.50 | - | 0.0 for learner, P1, P2 and interstate / overseas learner or provisional | under 0.02 for taxi / rideshare, heavy vehicles > 13.9 t, dangerous goods | statutory units (g/210 L or g/100 mL) **UNVERIFIED** (search summary only) | 2100:1 **UNVERIFIED** | S72 nsw.gov.au alcohol-and-drugs |
| Australia: Victoria | most full licences: below 0.05 BAC | 0.50 | - | 0.00 for learners, P1/P2, Z or I conditions, restricted motorcycle, driving instructors | **0.00, not 0.02**, for bus and commercial passenger vehicle drivers (taxi) and trucks > 4.5 t GVM. **Correction** to the brief: 0.02 is the NSW rule, not national | units **UNVERIFIED** (law firms cite g/100 mL or g/210 L, RSA s.3(1)) | 2100:1 **UNVERIFIED** | S73 transport.vic.gov.au alcohol-and-driving-laws |
| New Zealand | age 20+: > 250 ug/L breath or > 50 mg/100 mL blood | 0.50 | 0.25 | under 20: zero; below 150 ug/L / 30 mg: fine + 50 demerits, above: disqualification | none separate | adults 251-400 ug/L (51-80 mg): infringement, fine + 50 demerits | 2000:1 | S74 nzta.govt.nz alcohol-and-drug-limits |
| Japan | 酒気帯び: 0.3 mg per mL blood or 0.15 mg per L breath (Enforcement Order art. 44-3) | 0.30 | 0.15 | none separate | none separate | 0.15-0.25 mg/L: 13 points, 90-day suspension; >= 0.25 mg/L (0.5 mg/mL): revocation, 2-year bar. **New since 21 July 2026**: 酒酔い (drunk driving) now has a number in the Act, 1.0 mg/mL blood or 0.5 mg/L breath (or impairment), up to 5 years or JPY 1,000,000. Any alcohol below 0.15 is still prohibited, so treat Japan as zero tolerance in the driving card | 2000:1 | S75 laws.e-gov.go.jp 335CO0000000270, 335AC0000000105 (version in force 令和8年7月21日); npa.go.jp |
| Brazil | any concentration of alcohol per litre of blood or alveolar air (CTB art. 276) -> art. 165 penalties (fine x10, 12-month suspension) | 0.0 | 0.0 | zero for all | zero for all | crime (art. 306 §1 I) at >= 6 dg/L blood (0.6 g/L) or >= 0.3 mg/L air. Measurement tolerance 0.05 mg/L breath (Contran Res. 432/2013) **UNVERIFIED** | 2000:1 | S76 planalto.gov.br L9503 compilado |

Per-row decisions for the engine:
- Zero-tolerance in effect (driving card shows only back-to-zero): CZ, SK, HU, RO, BR, JP (any alcohol prohibited), Morocco and Tunisia until verified, DE / IT novices, IT / VIC professionals, CA and AU novices.
- Two-tier display (Poland, France délit, Sweden, Norway, Italy, Japan): show the standard limit line; the higher tier is information only in the long-form notice.
- Countries with subnational rules (UK, CA, AU, US Utah): the country picker needs a region level for these four; default region from the device region where the OS gives it, else the most populous region with a prompt.
- Novice mode (O-05) needs a per-country definition text (above) and, where the law depends on age, the age from the profile.

Ratio summary: 2000:1 is the legal convention in FR, DE, CH, ES, PL, SE, NO, NZ, JP, BR (and LU at the base limit); about 2270-2300:1 in UK, IE, NL and PT (PT states 2.3 outright); 2100:1 in the US (law defines g/210 L); none in law for IT, DZ, CA; Russia's unconfirmed pair implies 1875:1. This confirms the recommendation in 2.2: store both legal limits per country and derive the display ratio from them, rather than one global ratio.

### 2.4 Locale defaults (PREF-02)

Sources for this section (secondary aggregator marked): [IARD] = IARD drinking-guidelines table, a secondary source that names each national body (S30); [FTA-xx] = UK Foreign Office travel advice "getting help" page for that country (S31); [CLDR] = Unicode CLDR territory information and supplemental data (S32, development branch read, take the tagged release at build time); [EU112] = European Commission 112 page (S33).

#### 2.4.1 Standard drink and usual sizes

| CC | Standard drink (g ethanol) | Source | Usual sizes for presets | Source |
|---|---|---|---|---|
| FR | 10 | Alcool Info Service / Santé publique France (S34) | demi 25 cl beer 5 %, flute 10 cl sparkling 12 % (S34). Pinte 50 cl, wine 12.5 cl, spirit 3-4 cl: **UNVERIFIED** (customary) | S34 |
| BE | 10 | [IARD] | **UNVERIFIED** (25 / 33 / 50 cl customary) | |
| CH | 10 | [IARD] | **UNVERIFIED** | |
| LU | 10-12 | [IARD] | **UNVERIFIED** | |
| DE | 10-12 | [IARD] (BZgA) | 0.3 / 0.5 L, Maß 1 L: **UNVERIFIED** | |
| ES | 10 (UBE) | [IARD] (Ministerio de Sanidad) | caña ~20-25 cl: **UNVERIFIED** | |
| IT | 12 (UA) | [IARD] (Ministero della Salute) | **UNVERIFIED** | |
| PT | none published per [IARD]; use 10 | [IARD] | **UNVERIFIED** | |
| NL | 10 | [IARD] (Voedingscentrum) | **UNVERIFIED** | |
| UK | 8 g (1 unit = 10 mL) | NHS (S35) | pint 568.26 mL (S36); draught beer only in 1/3, 1/2, 2/3 pint or multiples of 1/2 pint; spirits 25 or 35 mL; wine by the glass 125 / 175 mL or multiples (S37, S38); NHS also lists 250 mL wine, 330 mL bottle, 440 mL can (S35) | S35-S38 |
| IE | 10 | [IARD] (HSE page returned 403) | **UNVERIFIED** (Irish pint assumed 568 mL) | |
| PL | none published per [IARD]; use 10 | [IARD] | **UNVERIFIED** | |
| CZ | 20 per [IARD], unusually high: **UNVERIFIED**, use 10 until checked | [IARD] | **UNVERIFIED** | |
| SK | none published; use 10 | [IARD] | **UNVERIFIED** | |
| HU | none published; use 10 | [IARD] | **UNVERIFIED** | |
| RO | 12 | [IARD] | **UNVERIFIED** | |
| RU | 10 | [IARD] | **UNVERIFIED** | |
| MA, TN, DZ | none found; use 10 | [IARD] / not found | **UNVERIFIED** | |
| US | 14 g (0.6 fl oz) | NIAAA (S14b), CDC (S39) | 12 fl oz beer 5 %, 8-10 fl oz malt liquor 7 %, 5 fl oz wine 12 %, 1.5 fl oz spirits 40 % (S14b); 1 fl oz = 29.6 mL (S1; exact 29.5735 mL **UNVERIFIED** this session); US pint 16 fl oz = 473 mL (derived) | S14b, S1 |
| CA | 13.45 g (17.05 mL) | Health Canada (S40) | 341 mL beer 5 %, 142 mL wine 12 %, 43 mL spirits 40 % (S40) | S40 |
| AU | 10 | [IARD] (NHMRC; official site timed out) | pot / middy / schooner: **UNVERIFIED** | |
| NZ | 10 | [IARD] (official site 403) | **UNVERIFIED** | |
| JP | 20 per [IARD]; MHLW counts grams (mL x ABV x 0.8) and uses 500 mL beer 5 % = 20 g as its example, without defining a "standard drink" | MHLW (S41), [IARD] | 500 mL beer (S41) | S41 |
| BR | 10 | [IARD] | **UNVERIFIED** | |
| SE | 12 | [IARD] (Socialstyrelsen) | **UNVERIFIED** | |
| NO | none published; use 12 (as SE) | [IARD] | **UNVERIFIED** | |

Engine note: presets store mL and ABV; grams are always computed (0.789 g/mL). The "standard drink" is only a display unit for stats (O-28) and goals (O-26). A "pint" preset is 500 mL in FR, 568 mL in UK/IE, 473 mL in US.

#### 2.4.2 Units, currency, calendar, emergency numbers

Currency, first day of week and 12/24 h come from [CLDR] for every row. BAC display unit follows the unit of the country's law (2.3).

| CC | BAC display default | Currency | First day | Clock | Emergency numbers (source) |
|---|---|---|---|---|---|
| FR | g/L blood + mg/L breath | EUR | Mon | 24 h | 112, 15 SAMU, 17 police, 18 pompiers, 114 SMS / deaf (service-public S42, [FTA-france], [EU112]) |
| BE | g/L; breath unit **UNVERIFIED** | EUR | Mon | 24 h | 112 ([FTA-belgium]) |
| CH | per mille + mg/L | CHF | Mon | 24 h | 112, 144 ambulance, 118 fire, 117 police ([FTA-switzerland]) |
| LU | per mille + mg/L | EUR | Mon | 24 h | 112 ambulance / fire, 113 police ([FTA-luxembourg]) |
| DE | per mille + mg/L (StVG §24a, S43) | EUR | Mon | 24 h | 112 ambulance / fire, 110 police ([FTA-germany]) |
| ES | g/L + mg/L (law) | EUR | Mon | 24 h | 112 ([FTA-spain]) |
| IT | g/L (law) | EUR | Mon | 24 h | 112, 118 ambulance, 115 fire ([FTA-italy]) |
| PT | g/L (law) | EUR | Sun per CLDR | 24 h | 112 ([FTA-portugal]) |
| NL | g/L (law: mg/mL) + ug/L breath (law) | EUR | Mon | 24 h | 112 ([FTA-netherlands]) |
| UK | mg/100 mL blood + ug/100 mL breath (gov.uk S44) | GBP | Mon | 24 h | 999 (NHS S45); 112 **UNVERIFIED** this session |
| IE | mg/100 mL blood + ug/100 mL breath (law) | EUR | Mon | 24 h | 112 or 999 ([FTA-ireland]) |
| PL | per mille + mg/dm3 = mg/L (law) | PLN | Mon | 24 h | 112 **UNVERIFIED**; 999 ambulance, 998 fire, 997 police ([FTA-poland]) |
| CZ | per mille (zero tolerance; unit **UNVERIFIED**) | CZK | Mon | 24 h | 112 ([FTA-czech-republic]) |
| SK | per mille (zero tolerance; unit **UNVERIFIED**) | EUR | Mon | 24 h | 155 ambulance, 150 fire, 158 police ([FTA-slovakia]); 112 **UNVERIFIED** |
| HU | per mille (zero tolerance; unit **UNVERIFIED**) | HUF | Mon | 24 h | 112 ([FTA-hungary]) |
| RO | g/L (zero tolerance) | RON | Mon | 24 h | 112 ([FTA-romania]) |
| RU | per mille + mg/L: **UNVERIFIED** | RUB | Mon | 24 h | 112 ([FTA-russia]); 102 / 103 **UNVERIFIED** |
| MA | g/L: **UNVERIFIED** | MAD | Mon | 24 h | 150 ambulance / fire, 190 police, 177 gendarmerie ([FTA-morocco]); the 15 / 19 numbers in the brief are **not confirmed** |
| TN | g/L: **UNVERIFIED** | TND | Mon | 12 h per CLDR | 190 ambulance, 198 fire, 197 police, 193 National Guard ([FTA-tunisia]) |
| DZ | g/L (law: g per mille) | DZD | Sat | 12 h per CLDR | 1021 ambulance, 14 fire, 17 or 1548 police ([FTA-algeria]) |
| US | % BAC (g/100 mL) | USD | Sun | 12 h | 911 ([FTA-usa]) |
| CA | mg/100 mL (Criminal Code s.320.14, S46) | CAD | Sun | 12 h (fr-CA 24 h) | 911 ([FTA-canada]) |
| AU | BAC as 0.05 (g/100 mL, unit **UNVERIFIED**) | AUD | Mon | 12 h | 000 ([FTA-australia]); 112 from mobiles **UNVERIFIED** |
| NZ | mg/100 mL blood + ug/L breath (law) | NZD | Mon | 12 h | 111 ([FTA-new-zealand]) |
| JP | mg/L breath + mg/mL blood (law) | JPY | Sun | 24 h | 110 police, 119 fire / ambulance ([FTA-japan]) |
| BR | g/L blood (dg/L in law) + mg/L breath (law) | BRL | Sun | 24 h | 190 police, 192 SAMU, 193 fire ([FTA-brazil]) |
| SE | per mille + mg/L (law) | SEK | Mon | 24 h | 112 ([FTA-sweden]) |
| NO | per mille + mg/L (law) | NOK | Mon | 24 h | 110 fire, 112 police, 113 ambulance ([FTA-norway]) |

Points that change defaults:
- Norway: 112 is the police, 113 is the ambulance. SOS must not present 112 as a universal number there.
- Morocco: official UK page says 150 / 190 / 177, not the 15 / 19 in the brief.
- Portugal (Sunday) and Algeria (Saturday) week starts per CLDR; follow the phone setting where available (O-10).
- 12 h is preferred only in US, CA (en), AU, NZ, TN, DZ; follow the phone setting first, CLDR second.
- SOS should always offer 112 in EU/EEA countries and the national ambulance number; for the person in trouble, ambulance first.

### 2.5 Threshold proposals

Anchors with sources:
- WHO: crash risk starts at low BAC and "increases significantly" from 0.04 g/dL (0.4 g/L) (S16).
- Blomberg et al. 2009: risk rises at 0.04-0.05 % and sharply above 0.10 % (S17).
- NIAAA: binge drinking = reaching 0.08 % (0.8 g/L); BAC can keep rising after drinking stops (S14).
- Jones & Holmgren 2003: 693 deaths from acute alcohol poisoning, femoral blood mean and median 3.6 g/L, 5th percentile 2.2 g/L, minimum 0.74 g/L (S18).
- Model uncertainty: CV about 21 % (S4).
- Legal anchors (see 2.3): 0.2 g/L novice in France, 0.5 g/L standard in most of Europe, 0.8 g/L criminal threshold in France, UK England and Wales limit, US per se 0.08 %.

#### Adaptive levels (ADP-01)

| Level | Enter when C >= (blood g/L) | Breath mg/L at 2000:1 | US % | Exit when C < | Reasoning |
|---|---|---|---|---|---|
| 0 Fresh | - | - | - | - | |
| 1 Tipsy | 0.50 | 0.25 | 0.05 | 0.40 | WHO and Blomberg risk rise at 0.4-0.5 g/L; most common legal limit; first design colour band |
| 2 Loaded | 0.80 | 0.40 | 0.08 | 0.70 | NIAAA binge level, US per se limit, French criminal threshold |
| 3 Wasted | 1.20 | 0.60 | 0.12 | 1.10 | Blomberg: risk rises sharply above 0.10 %; design red band; leaves a 2 SD margin below the 2.2 g/L fatal 5th percentile (1.2 x 1.42 = 1.7 g/L, **COMPUTED**) |

Hysteresis (proposal): move up as soon as C crosses the entry threshold; move down only when C is below entry - 0.10 g/L (= 0.05 mg/L) and the level has been held at least 10 min. At beta 0.15 g/L/h, 0.10 g/L is about 40 min of elimination, so a level never flips back and forth after a single edit or a retro-logged drink. The manual override follows ADP-01 (raise any time, lower allowed, vault follows the estimate).

#### Next-morning vault (ADP-06)

- Lock when max(C now, projected peak in the next 60 min) >= 0.80 g/L. The projection matters because BAC keeps rising after the last drink (S14): someone who just downed shots must not be able to delete their account during the absorption window.
- Same value as level 2 entry, matching the prototype note "Niveau 2 : ... Les actions sensibles attendent demain".
- Unlock when the back-to-zero time is reached (C < 0.005 g/L), then ask for confirmation of the queued actions. Rationale: "the next day" in practice means "sober again"; a clock rule (06:00) fails for night shifts and trips.

#### Danger cap (RANK-07)

- Proposal: 1.20 g/L blood (0.60 mg/L breath, 0.12 %), same as level 3 entry, so "red zone = no more points" reads as one rule and RANK-07's switch to level 3 is automatic.
- Why not higher: a 1.5 or 2.0 g/L cap would invite people to chase points into the zone where, with a 21 % CV, the true value can reach the fatal 5th percentile (2.2 g/L). At 1.2 g/L the 2 SD upper bound is about 1.7 g/L (**COMPUTED**).
- Above 2.0 g/L (1.0 mg/L breath, 0.20 %): show a calm "signs of alcohol poisoning" card with the local emergency number and what not to do, from NHS (S19): confusion, vomiting, slow or irregular breathing, pale or blue skin, seizures, unconsciousness; do not leave them alone, no coffee, no cold shower, do not make them sick, no more alcohol. This is aimed at the crew, since the person concerned may not be reading.

#### Curve colour bands (O-24)

Design bands: < 0.25, 0.25-0.60, > 0.60 mg/L breath = < 0.50, 0.50-1.20, > 1.20 g/L blood at 2000:1.
- They match levels 1 and 3 above, which is good.
- They are not legal bands. 0.25 mg/L is the French standard limit, but the novice limit is 0.10 mg/L, and Sweden, Norway, Poland and others are at about 0.10 mg/L or zero (see 2.3). DESIGN.md uses `#9BD8A8` for "OK / safe / confirmed": using it for the whole < 0.25 band would tell a French probationary driver at 0.20 mg/L that he is fine.
- Proposal: band 1 starts at min(0.25 mg/L, user's own legal limit); the stretch between the legal limit and 0.25 mg/L uses the amber band, not the safe colour. The legal limit line stays separate (O-24), and the personal limit lines (O-25) too.
- For US and UK users, keep the bands defined in blood terms (0.50 / 1.20 g/L) and convert; do not re-derive them from each country's breath ratio.

#### Hydration reminder (O-27)

- No official interval exists. Official advice is qualitative: NHS "alternate alcoholic drinks with water or other non-alcoholic drinks" and have water before drinking (S20).
- Proposal: event-based first (after each alcoholic drink, if no water has been logged since the previous one, a reminder 20 min later), plus a time-based fallback every 45 min while a party is active and C > 0, adjustable 15-120 min (the prototype has a water interval setting), silent during quiet hours and at most one reminder per 20 min. Product assumption, not a health guideline.

### 2.6 Mandatory disclaimer (O-19)

What official and regulatory sources say:
- OSAC 2020-S-0003 (S1): an individual's volume of distribution and elimination rate "cannot be known"; the science does not support a single value, only a range.
- Searle 2015 (S4): an error range should always accompany a BAC calculation.
- NIAAA (S14): BAC can keep rising after drinking stops, even while unconscious.
- Apple App Store Review Guidelines (S21): 1.4.1 "Medical apps that could provide inaccurate data or information ... may be reviewed with greater scrutiny"; 1.4.3 apps that "encourage consumption ... excessive amounts of alcohol are not permitted"; 1.4.4 apps "should never encourage drunk driving or other reckless behavior"; 1.4.5 apps should not urge customers into challenges that risk physical harm. The leaderboard (RANK-09 flag) and any "under the limit, you can drive" wording are the two exposures.
- UK government (S44): "it's impossible to say exactly how many drinks this equals"; the effect depends on weight, age, sex, metabolism, type and amount of alcohol, food and stress. This is the closest official statement on estimators and supports the notice.
- Google Play Inappropriate Content policy (S77): not allowed: "the favorable portrayal of excessive, binge or competition drinking". A drinking leaderboard is competition drinking; it must stay behind the RANK-09 flag and be off in any public Play Store build, not only the App Store one.
- French Sécurité routière and Santé publique France pages could not be read (JavaScript-only or moved), so I have no official French wording on calculators: **UNVERIFIED**.

Proposed permanent notice (short form next to every BAC and driving status, O-19 and guardrails):
- FR: "Estimation indicative, pas un éthylotest. Ne prends jamais le volant sur la foi de ce chiffre."
- EN: "Rough estimate, not a breathalyser. Never decide to drive based on this number."
Long form (tap): what the estimate ignores (food, medication, health, individual metabolism, actual drink strength), that the real value can be 20 % or more higher, that alcohol keeps rising for up to 2 h after the last drink, and that the only legal measure is an approved breath test or a blood test.

Wording rules:
- Never "you can drive". Say "estimated under the limit from 03:40" and always add the notice. When the estimate is close to the limit (within 0.10 g/L or within 1 h), say "too close to call".
- In zero-tolerance or novice mode, the driving card says "any alcohol is over your limit" and shows only the back-to-zero time.

Legal risk notes (to hand to Recon-Security / legal; not legal advice):
- France: under the Code de la consommation, clauses that remove or reduce a consumer's right to compensation are considered abusive, so the disclaimer reduces risk through accurate information but does not exclude liability. **UNVERIFIED** (article text not read this session; I believe it is R212-1; confirm on Légifrance).
- EU: the revised Product Liability Directive (EU) 2024/2853 brings software into the definition of a product, with transposition due around December 2026. **UNVERIFIED** (EUR-Lex did not render for me); relevant because a BAC estimator that shows "under the limit" is the clearest defect claim this app could face.
- France, Loi Evin (Code de la santé publique, L3323 series) restricts advertising and promotion of alcoholic drinks; a public drinking leaderboard and shareable story cards (O-30, RANK-03) could be argued to be promotion. **UNVERIFIED**, needs legal review before any public release; supports keeping RANK-09's feature flag.
- EU MDR: estimating BAC for a lifestyle purpose is probably not a medical device, but the qualification depends on the intended purpose statement. **UNVERIFIED**, for Recon-Security.
- GDPR article 9: BAC history is likely health data (already in SEC-08).

### 2.7 Test cases for the BAC engine (all **COMPUTED** with the equations of 2.1.3)

Defaults unless stated: beta 0.15, Km 0.05, t_half 6 min, RK4 step 15 s, zero threshold 0.005 g/L. Times in hours after the first drink. Tolerance for implementation: +-0.005 g/L on concentrations, +-3 min on times.

Doses (grams of ethanol, density 0.789):

| Drink | Grams |
|---|---|
| FR demi 25 cl 5 % | 9.86 |
| FR pinte 50 cl 5 % | 19.73 |
| UK pint 568 mL 4 % | 17.93 |
| US beer 12 fl oz 5 % | 14.00 |
| Wine 12.5 cl 12 % | 11.84 |
| US wine 5 fl oz 12 % | 14.00 |
| Shot 4 cl 40 % | 12.62 |
| US spirit 1.5 fl oz 40 % | 14.00 |
| UK spirit 25 mL 40 % | 7.89 |

| ID | Scenario | Expected |
|---|---|---|
| T1 | Man 80 kg, r 0.70, one 50 cl 5 % beer at t = 0 | Widmark instant peak would be 0.352 g/L. Model: C(0.25 h) = 0.263, peak 0.284 g/L at 25 min, C(1 h) = 0.230, C(2 h) = 0.115, C(3 h) = 0.031, below 0.2 g/L at 1.25 h, zero at 3.78 h, C(24 h) = 0 |
| T2 | Woman 60 kg, r 0.60, three 12.5 cl 12 % wines at 0, 0.5, 1 h | C(1 h) = 0.521 (just before the 3rd glass absorbs), peak 0.783 g/L at 84 min, C(3 h) = 0.581, C(6 h) = 0.187; below 0.5 at 3.59 h, below 0.2 at 5.90 h, zero at 8.42 h |
| T2-safe | T2 with beta_safe 0.10 (driving timer) | under 0.5 g/L at 5.32 h, under 0.2 g/L (FR novice) at 8.77 h, zero 12.57 h. The driving card for a French driver shows 5.32 h, not 3.59 h |
| T3 | Man 70 kg, r 0.70, ten 4 cl 40 % shots every 12 min from 0 | peak 2.251 g/L at 132 min (danger card on), below 1.2 at 9.57 h, below 0.5 at 14.52 h, zero 19.36 h |
| T3b | Man 70 kg, r 0.70, twelve 50 cl 6 % beers every 15 min | peak 5.31 g/L at 194 min (2.65 mg/L, above the O-17 1.5 mg/L case), below 3.0 g/L at 18.96 h, below 1.2 at 31.27 h, zero at 41.06 h. Must not cap, must not stop at 24 h |
| T4 | T1 with food (t_half 40 min, beta 0.20) | peak 0.111 g/L at 56 min, zero 5.08 h (the slow absorption tail outlasts the faster elimination for a single small drink; acceptable, documented) |
| T4b | T2 with food | peak 0.467 g/L at 135 min, below 0.2 at 4.70 h, zero 6.72 h |
| T5 | Closed form: 20 g, man 80 kg r 0.70, Km -> 0 | engine = (20 / 56)(1 - exp(-6.93 t)) - 0.15 t: C(0.25) = 0.2565, C(1) = 0.2068, C(2) = 0.0571, zero at about 2.38 h |
| T6 | Man 80 kg, four 50 cl 5 % beers at 0, 0.5, 1, 1.5 h, then two more at 24 and 24.5 h | day 1 peak 1.131 g/L at 115 min, zero 11.37 h, C(23.99 h) = 0; day 2 peak 0.568 g/L 55 min after the first beer, identical to day 2 computed alone |
| T7 | Unit display of C = 0.50 g/L | FR 0.25 mg/L; US 0.050 %; UK 50 mg/100 mL and 21.9 ug/100 mL at 2286:1; NZ 250 ug/L; DE 0.50 per mille |
| T7b | Legal equivalences | FR 0.5 g/L <-> 0.25 mg/L; UK 80 mg/100 mL <-> 35 ug/100 mL; US 0.08 % <-> 0.08 g/210 L |
| T8 | T2 where the 2nd glass is logged at 2 h with t = 0.5 h | curve identical to T2 at every t; values between 0.5 h and 2 h change once, at logging time |
| T9 | T1 plus a drink stamped now + 10 min | C(now) and all projections identical to T1 until the stamped time passes |
| T10 | Woman 70 kg, two 50 cl 5 % beers at 0 and 0.5 h, default r 0.60 vs Forrest (160 cm, r 0.598) | peak 0.793 vs 0.796 g/L; below 0.5 at 3.21 vs 3.23 h (height barely changes the result at BMI 27) |
| T11 | Man 107 kg 175 cm (BMI 34.9), three 50 cl 5 % beers at 0, 0.5, 1 h, default r 0.70 vs Forrest r 0.594 | peak 0.597 vs 0.730 g/L; below 0.5 at 2.23 vs 3.21 h; zero 7.07 vs 8.04 h |
| T12 | r formulas | Watson man 30 y 180 cm 80 kg -> 0.716; Forrest same man -> 0.719; Forrest woman 165 cm 60 kg -> 0.663; Watson same woman -> 0.632; Forrest woman 160 cm 90 kg -> 0.501; clamp keeps r in [0.40, 0.80] |
| T13 | Level hysteresis | C rising through 0.50 -> level 1 at once; falling to 0.45 -> stays level 1; at 0.39 after >= 10 min at level 1 -> level 0 |
| T14 | Vault with rising BAC | T3 at t = 0.6 h: C below 0.8 but projected peak in 60 min above 0.8 -> vault locked |

## 3. Decisions proposed

1. Model: one compartment, first-order absorption per drink, Michaelis-Menten elimination with Vmax = beta and Km = 0.05 g/L, numerically integrated from the drink list. Reason: smooth, continuous, handles retro and multi-day logs, reduces exactly to Widmark plus zero-order elimination at normal levels (S1, S8, S11).
2. Constants as in the table of 2.1.3. Reason: each is the published average, or the safer end where a choice exists.
3. Profile: weight and body-model sex required; height and age optional but used (Watson men, Forrest), clamped to 0.40-0.80 L/kg. Reason: Maskell 2019 and OSAC say a single factor is inappropriate; T11 shows the risk for high BMI.
4. Two elimination rates: central 0.15 g/L/h for the curve, peak and back-to-zero; 0.10 g/L/h for "under the limit at". Reason: the harmful error is saying "under" too early; 0.10 is the OSAC lower bound. Alternative considered: one rate everywhere (simpler, but the driving card would be wrong for slow eliminators, about half the population by definition).
5. Storage in g/L of blood; breath and other units derived with each country's legal ratio. Reason: PREF-06 and exact agreement with each country's breath limit.
6. Levels at 0.50 / 0.80 / 1.20 g/L, hysteresis 0.10 g/L plus 10 min dwell; vault at 0.80 g/L including the 60 min projected peak; danger cap at 1.20 g/L; poisoning card from 2.0 g/L. Reasons in 2.5.
7. Colour bands kept, but band 1 starts at the user's legal limit when that is lower than 0.25 mg/L, and the safe green is never used above the user's legal limit.
8. Hydration: per-drink nudge plus 45 min fallback.

## 4. Assumptions

- A-BAC-1: absorption half-lives 6 min (fasted or unknown) and 40 min (fed) reproduce Jones & Jönsson 1994. Based on my calibration. Verify against at least one more published fasted and fed curve in phase 1 (test bench with digitised curves).
- A-BAC-2: Vmax = beta (no rescaling) is acceptable even though it makes elimination 3-14 % slower than beta in the 0.3-1.5 g/L range. Verify by comparing to Jones 2010 data; rescale Vmax = beta x (1 + Km / 1.0) if it proves too slow.
- A-BAC-3: blood water fraction 0.80 in the Watson conversion. Read on a university lab page, not in Watson 1981 itself. Verify in the paper.
- A-BAC-4: per mille displayed as g/L. Verify the German and Swiss statutory definition (mass or volume per mille).
- A-BAC-5: "other / prefer not to say" uses the female body model. Product choice for safety.
- A-BAC-6: input bounds 30-250 kg, 120-230 cm, 18-100 years. Product choice.
- A-BAC-7: the hydration interval (45 min) and nudge delay (20 min) are product choices; no official interval exists.
- A-BAC-8: the danger cap and level thresholds assume the 21 % CV from Searle 2015 applies to our estimate. Self-reported drinks are probably worse, so the margin may be optimistic.

## 5. Scope changes

- O-04: change "weight, sex" to "weight, body-model sex, optional height and age (used)". Priority stays P0.
- New ID proposal BAC-SAFE-01 [P0]: driving timer uses the conservative elimination rate and refuses "under the limit" while BAC is rising or within 0.10 g/L / 1 h of the limit ("too close to call").
- New ID proposal BAC-DANGER-01 [P0]: alcohol-poisoning signs card above 2.0 g/L with the local emergency number, for the person and the crew (links to SOS).
- New ID proposal BAC-FOOD-01 [P1]: "I ate" toggle per drink or per evening.
- O-24: band 1 colour depends on the user's legal limit (see 2.5).

## 6. Glossary additions

| English | French UI |
|---|---|
| Blood alcohol concentration (BAC), g/L of blood | Alcoolémie (g/L de sang) |
| Breath alcohol concentration, mg/L of breath | Taux d'alcool dans l'air expiré (mg/L) |
| Body model (sex used by the formula) | Morphologie pour le calcul |
| Widmark factor / distribution volume | Coefficient de diffusion |
| Elimination rate | Vitesse d'élimination |
| Absorption phase | Phase d'absorption |
| Peak | Pic |
| Back to zero | Retour à zéro |
| Under the limit at | Sous la limite à |
| Too close to call | Trop juste pour conclure |
| Standard drink | Verre standard / unité d'alcool |
| Probationary licence | Permis probatoire |
| Danger cap | Plafond de sécurité |
| Next-morning vault | Coffre du lendemain |
| Blood/breath ratio | Rapport sang/air expiré |

## 7. Blockers

None that need the user. Legal review (Loi Evin, consumer law, PLD, MDR) is needed before a public release, not before the build.

## 8. Sources

All read 2026-10-26.

- S1 OSAC 2020-S-0003, Guidelines for Performing Alcohol Calculations in Forensic Toxicology, NIST OSAC, April 2022: https://www.nist.gov/document/osac-2020-s-0003guidelines-performing-alcohol-calculations-forensic-toxicologyregistry
- S3 Maskell, Jones, Savage, Scott-Ham, Evidence based survey of the distribution volume of ethanol, Forensic Sci Int 294:124-131 (2019): https://eprints.gla.ac.uk/214441
- S4 Searle, Alcohol calculations and their uncertainty, Med Sci Law 55(1):58-64 (2015), doi 10.1177/0025802414524385: https://pmc.ncbi.nlm.nih.gov/articles/PMC4361698
- S5 Jones, Alcohol, its absorption, distribution, metabolism and excretion in the body and pharmacokinetic calculations, WIREs Forensic Sci e1340 (2019). Abstract as quoted in search results; full text (ResearchGate) returned 403: https://www.researchgate.net/publication/333219749
- S6 University of Wisconsin-Madison Addiction Research Center, alcohol administration methods: https://arc.psych.wisc.edu/alcohol/
- S7 Watson, Watson, Batt, Prediction of blood alcohol concentrations in human subjects. Updating the Widmark equation, J Stud Alcohol 42(7):547-556 (1981): https://trid.trb.org/View/180551
- S8 Jones, Evidence-based survey of the elimination rates of ethanol from blood with applications in forensic casework, Forensic Sci Int 200:1-20 (2010), PMID 20304569, doi 10.1016/j.forsciint.2010.02.021 (abstract via Europe PMC REST API): https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:20304569&resultType=core
- S9 Norberg, Jones, Hahn, Gabrielsson, Role of variability in explaining ethanol pharmacokinetics, Clin Pharmacokinet 42(1):1-31 (2003), PMID 12489977, doi 10.2165/00003088-200342010-00001 (abstract via Europe PMC)
- S10 Ethanol elimination rates at low concentrations based on two consecutive blood samples (2016), PMID 27295074 (search-result abstract only): https://pubmed.ncbi.nlm.nih.gov/27295074/
- S11 Piekoszewski, Gubala, Use of pharmacokinetic modelling in back calculation of alcohol concentration, T2000 conference, Stockholm: https://bibliotek.vti.se/bib/248691
- S12 Jones, Jönsson, Food-induced lowering of blood-ethanol profiles and increased rate of elimination immediately after a meal, J Forensic Sci 39(4):1084-1093 (1994), PMID 8064267, doi 10.1520/jfs13687j (abstract via Europe PMC)
- S13 Büsker et al., Population pharmacokinetics as a tool to reevaluate the complex disposition of ethanol in the fed and fasted states, J Clin Pharmacol 63(6):681-694 (2023), PMID 36688276, doi 10.1002/jcph.2205 (abstract via Europe PMC)
- S14 NIAAA, Understanding the dangers of alcohol overdose: https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/understanding-dangers-of-alcohol-overdose
- S14b NIAAA, What is a standard drink: https://www.niaaa.nih.gov/alcohols-effects-health/what-standard-drink
- S15 Jones, Andersson, Variability of the blood/breath alcohol ratio in drinking drivers, J Forensic Sci 41(6):916-921 (1996), PMID 8914280 (abstract via Europe PMC)
- S16 WHO, Road traffic injuries fact sheet (dated 20 July 2026): https://www.who.int/news-room/fact-sheets/detail/road-traffic-injuries
- S17 Blomberg et al., The Long Beach/Fort Lauderdale relative risk study, J Safety Res 40(4):285-292 (2009), PMID 19778652 (abstract via Europe PMC)
- S18 Jones, Holmgren, Comparison of blood-ethanol concentration in deaths attributed to acute alcohol poisoning and chronic alcoholism, J Forensic Sci 48(4):874-879 (2003), PMID 12877310 (abstract via Europe PMC)
- S19 NHS, Alcohol poisoning: https://www.nhs.uk/conditions/alcohol-poisoning/
- S20 NHS, Tips on cutting down: https://www.nhs.uk/live-well/alcohol-advice/tips-on-cutting-down-alcohol/
- S21 Apple App Store Review Guidelines 1.4.1, 1.4.3, 1.4.4, 1.4.5: https://developer.apple.com/app-store/review/guidelines/
- S30 IARD drinking guidelines, general population (secondary aggregator): https://iard.org/science-resources/detail/Drinking-Guidelines-General-Population
- S31 UK FCDO foreign travel advice, "getting help" page per country: https://www.gov.uk/foreign-travel-advice/{country}/getting-help
- S32 Unicode CLDR: https://www.unicode.org/cldr/charts/latest/supplemental/territory_information.html and https://raw.githubusercontent.com/unicode-org/cldr/main/common/supplemental/supplementalData.xml
- S33 European Commission, 112: https://digital-strategy.ec.europa.eu/en/policies/112
- S34 Alcool Info Service, verre d'alcool: https://www.alcool-info-service.fr/alcool/boissons-alcoolisees/verre-alcool ; Santé publique France: https://www.santepubliquefrance.fr/alcool/comment-reduire-les-risques-de-la-consommation-dalcool
- S35 NHS, Calculating alcohol units: https://www.nhs.uk/live-well/alcohol-advice/calculating-alcohol-units/
- S36 Weights and Measures Act 1985, Schedule 1 (pint = 0.568 261 25 dm3): https://www.legislation.gov.uk/ukpga/1985/72/schedule/1
- S37 Weights and Measures (Intoxicating Liquor) Order 1988: https://www.legislation.gov.uk/uksi/1988/2039
- S38 Weights and Measures (Specified Quantities) (Unwrapped Bread and Intoxicating Liquor) Order 2011: https://www.legislation.gov.uk/uksi/2011/2331/made
- S39 CDC, Standard drink sizes: https://www.cdc.gov/alcohol/standard-drink-sizes/index.html
- S40 Health Canada, low-risk alcohol drinking guidelines: https://www.canada.ca/en/health-canada/services/substance-use/alcohol/low-risk-alcohol-drinking-guidelines.html
- S41 MHLW (Japan), drinking guideline 2024: https://www.mhlw.go.jp/stf/newpage_38541.html
- S42 service-public, numéros d'urgence: https://www.service-public.gouv.fr/particuliers/vosdroits/F33954
- S43 StVG §24a, §24c, §2a; BOKraft §8: https://www.gesetze-im-internet.de/stvg/__24a.html , https://www.gesetze-im-internet.de/stvg/__24c.html , https://www.gesetze-im-internet.de/stvg/__2a.html , https://www.gesetze-im-internet.de/bokraft_1975/__8.html
- S44 gov.uk, The drink drive limit: https://www.gov.uk/drink-drive-limit
- S45 NHS, When to call 999: https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/
- S46 Criminal Code of Canada s.320.14 and s.320.31: https://laws-lois.justice.gc.ca/eng/acts/c-46/section-320.14.html , https://laws-lois.justice.gc.ca/eng/acts/c-46/section-320.31.html ; https://www.justice.gc.ca/eng/cj-jp/sidl-rlcfa/
- S50 European Commission, Your Europe, road rules and safety per country: https://europa.eu/youreurope/citizens/travel/driving-abroad/road-rules-and-safety/index_en.htm
- S51 Légifrance R234-1: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038954545 ; L234-1: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051877291 ; service-public: https://www.service-public.gouv.fr/particuliers/vosdroits/F2881 , https://www.service-public.gouv.fr/particuliers/vosdroits/F2390
- S52 gov.uk, Proposed changes to penalties for motoring offences: https://www.gov.uk/government/consultations/proposed-changes-to-penalties-for-motoring-offences
- S53 mygov.scot, Drink-drive limit: https://www.mygov.scot/drink-drive-limit
- S54 Road Traffic Act 2010 (Ireland) s.3, s.4: https://revisedacts.lawreform.ie/eli/2010/act/25/section/4/revised/en/html
- S55 bpb.de, Recht A-Z: https://www.bpb.de/kurz-knapp/lexika/recht-a-z/324164/
- S56 VRV (Fedlex PDF, 2017 consolidation); bfu: https://www.bfu.ch/de/services/rechtsfragen/alkoholgrenzwerte-schweizer-verkehr ; ASTRA: https://www.astra.admin.ch/de/atem-alkoholkontrolle-haeufige-fragen
- S57 Police Luxembourg: https://police.public.lu/fr/actualites/2019/02/w09/20190228-fuesend-alkohol.html ; https://securite-routiere.lu/alcool/
- S58 Reglamento General de Circulación: https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514
- S59 Codice della strada art. 186, 186-bis: https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1992-04-30;285!vig=~art186
- S60 Código da Estrada art. 81: https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=349&tabela=leis
- S61 Wegenverkeerswet 1994 art. 8: https://wetten.overheid.nl/jci1.3:c:BWBR0006622&hoofdstuk=II&paragraaf=1&artikel=8
- S62 Poland: https://api.sejm.gov.pl/eli/acts/DU/2023/2151/text.pdf , https://api.sejm.gov.pl/eli/acts/DU/2026/1372/text.pdf , https://api.sejm.gov.pl/eli/acts/DU/2026/1342/text.pdf
- S63 Lag (1951:649) om straff för vissa trafikbrott: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1951649-om-straff-for-vissa-trafikbrott_sfs-1951-649/
- S64 Vegtrafikkloven chapter 4: https://lovdata.no/dokument/NL/lov/1965-06-18-4/KAPITTEL_4
- S65 Morocco, Bulletin officiel: https://www.sgg.gov.ma/BulletinOfficiel.aspx
- S66 Tunisia ONSR: https://www.onsr.nat.tn/onsr/index.php?page=08ar
- S67 Algeria, JO 2009 n°45 (ordonnance 09-03): https://www.joradp.dz/FTP/jo-francais/2009/F2009045.pdf
- S68 NHTSA: https://www.nhtsa.gov/risky-driving/drunk-driving ; 23 U.S.C. 161 and 163: https://www.govinfo.gov/content/pkg/USCODE-2021-title23/html/USCODE-2021-title23-chap1-sec163.htm ; 49 CFR 382.107 and 382.201: https://www.law.cornell.edu/cfr/text/49/382.201 ; Utah Code 41-6a-502: https://le.utah.gov/xcode/Title41/Chapter6A/C41-6a-S502_2024070120240501.pdf
- S69 Ontario: https://www.ontario.ca/page/impaired-driving
- S70 SAAQ: https://saaq.gouv.qc.ca/securite-routiere/moyens-deplacement/auto/alcool
- S71 RoadSafetyBC: https://www2.gov.bc.ca/gov/content/transportation/driving-and-cycling/roadsafetybc/prohibitions/alcohol
- S72 NSW: https://www.nsw.gov.au/driving-boating-and-transport/roads-safety-and-rules/safe-driving/alcohol-and-drugs
- S73 Victoria: https://transport.vic.gov.au/road-and-active-transport/road-rules-and-safety/alcohol-drugs-and-driving/alcohol-and-driving-laws
- S74 NZTA: https://www.nzta.govt.nz/driver-licences/driving-offences-and-penalties/alcohol-and-drug-limits
- S75 Japan: https://laws.e-gov.go.jp/law/335CO0000000270 , https://laws.e-gov.go.jp/law/335AC0000000105 , https://www.npa.go.jp/bureau/traffic/insyu/info.html
- S76 Brazil CTB: https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm
- S77 Google Play Developer Policy, Inappropriate Content: https://support.google.com/googleplay/android-developer/answer/9878810

Not readable this session (facts that depend on them are flagged): Sécurité routière "L'alcool et la conduite" (JavaScript only), EUR-Lex Directive (EU) 2024/2853 (empty render), NHTSA "ABCs of BAC" PDF (403), WHO Global status report 2023 PDF (403), and the Russian, Hungarian, Czech, Slovak, Belgian, Moroccan and Tunisian law portals. The shared web-search budget ran out during the session, so later lookups used known URLs only.

Computation aid (not product code): the test values in 2.7 come from a throwaway RK4 script in the session temp folder, using exactly the equations and constants of 2.1.3.

Housekeeping: a sub-agent saved scanned Moroccan bulletins in the session scratchpad (folders ma_bo and render, one file of 46.2 MB, bo_5823-bis_fr.pdf). They can be deleted.

