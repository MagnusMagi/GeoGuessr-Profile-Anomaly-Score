<!--
  Greasy Fork script description. Paste the contents of this file into the
  "Description" field with the markup type set to Markdown.

  Written against https://greasyfork.org/en/help/allowed-markup and the
  renderer Greasy Fork actually uses (Redcarpet with fenced_code_blocks,
  lax_spacing, tables, strikethrough, no_intra_emphasis; then Sanitize with
  a BASIC-derived allowlist).

  Rules this file follows, so please keep them if you edit it:

    - No mermaid, no LaTeX math, no [!NOTE] alert blocks, no task lists.
      Greasy Fork renders none of them.
    - No heading anchors, so no in-page "](#section)" links either. Redcarpet
      emits no heading ids.
    - No bare URLs. Autolink is not enabled; write [text](url) explicitly.
    - Inline styles may only use border, background-color and color.
    - Content inside a raw HTML block (center, div, details) is written as
      HTML, not Markdown. Depending on how the renderer classifies the tag,
      Markdown inside it may be passed through verbatim.
    - Images must be https.
-->

<center>
<h1>📊 GeoGuessr Profile Anomaly Score</h1>
<p><b>Rank-aware smurf detection with an explicitly mapped math breakdown and visible threshold caps.</b></p>
<p><b>English · Türkçe · Eesti · Français · Deutsch</b></p>
<p>
<img src="https://img.shields.io/badge/version-6.4.0-38bdf8" alt="Version 6.4.0" height="20">
<img src="https://img.shields.io/badge/license-MIT-a3e635" alt="MIT license" height="20">
<img src="https://img.shields.io/badge/languages-5-8b5cf6" alt="Five languages" height="20">
<img src="https://img.shields.io/badge/dependencies-0-14532d" alt="Zero dependencies" height="20">
<img src="https://img.shields.io/badge/network%20requests-none-71717a" alt="No network requests" height="20">
</p>
</center>

Open any GeoGuessr profile and this script reads the public stats already on the page, corrects the win rates for sample size, compares match volume against what the player's division actually demands, and shows you a score from 0 to 100 — together with **every step of the arithmetic that produced it**, in your language.

<div style="border: 1px solid #e0b000; background-color: #fff8e1; color: #4a3a00">
<p><b>⚠️ This is an anomaly indicator, not a cheat verdict.</b></p>
<p>A high score means <i>"this statistical profile is unusual for this division"</i> — nothing more. Returning veterans, alt accounts of honest players, and small samples all produce elevated scores. Please do not use this output as the sole basis for accusing, reporting, or harassing anyone.</p>
</div>

---

## Why it exists

You lose a Ranked Duel to an account with a Champion badge and 40 lifetime matches, and you wonder whether you were outplayed or met a smurf. The raw numbers on the profile can't answer that:

| The naive read | Why it's wrong |
|---|---|
| "70% win rate — suspicious!" | Over **10 matches**, 70% is a coin flip landing 7 heads. It happens constantly. |
| "80 matches — that's nothing!" | For a **Silver** player, 80 matches is a complete, normal career. |
| "2,100 rating — obviously legit" | Not if they got there in **60 games** with an 84% win rate. |

Each number is meaningless alone. Win rate needs sample-size correction, match count only means something relative to division, and both need weighing against the other modes the account plays. This script does all three — and then shows its work.

---

## What it does

- **Five languages.** English, Turkish, Estonian, French and German — the whole panel, including every line of the math derivation. Auto-detected from GeoGuessr and your browser, with a picker in the header.
- **Explicit math breakdown.** Every signal prints its own derivation chain — stabilized win rate, risk curve, smurf multiplier, applied signal — with the real numbers substituted in. No hidden weights.
- **Visible threshold caps.** The panel prints the complete expected-match table, so you can audit the calibration instead of trusting it.
- **Rank-aware thresholds.** A 10-tier division ladder maps each rating band to an expected match count. 80 games at Silver is unremarkable; 80 games at Champion 1.9k+ is a five-alarm signal.
- **Small-sample shrinkage.** Win rates are pulled toward 50% by 50 phantom matches, so a 9-1 hot streak can't spike the score the way a 900-100 record does.
- **Automatic stat fetching.** Detailed per-mode stats live behind the "Show stats" comparison modal. The script opens it invisibly, harvests the values, and closes it — you never see a flicker.
- **Locale-proof parsing.** `1.234,5` and `1,234.5` both parse correctly; the decimal separator is inferred from position, not assumed.
- **Draggable, dismissible panel.** Grab the header to move it. Close it and it collapses to a slim edge tab; click "📊 Analyze" to bring it back.
- **Zero dependencies, zero network.** No libraries, no `@grant`, no external requests, no telemetry, no storage.

---

## Languages

Every user-facing string is translated, including the per-mode math derivation — there is no half-localized state where the headline is translated but the reasoning underneath is still English.

| Code | Language | Number format |
|---|---|---|
| `en` | English | 19,500 |
| `tr` | Türkçe | 19.500 |
| `et` | Eesti | 19 500 |
| `fr` | Français | 19 500 |
| `de` | Deutsch | 19.500 |

The language is chosen automatically: GeoGuessr's own interface language first, then your browser's preference list, then English. Region subtags are ignored, so `de-DE`, `fr_CA` and `et-EE` all work. `EE` is the country code for Estonia while `et` is the language code — both are accepted.

You can override it with the picker in the panel header. Switching is instant and **re-reads nothing from the page**: the last extracted stats stay in memory and the panel is simply re-derived, so **the score cannot change when the language does**. The choice lasts for the session and is deliberately not saved, which keeps the no-storage guarantee below literally true.

Division names such as `Bronze` or `Champion (1.9k+)` stay untranslated so they match the badge GeoGuessr shows on the profile, and the formulas themselves are arithmetic that reads the same everywhere — only the labels around them change.

> Translations were produced by the author, not by native speakers of every language. Corrections are very welcome, especially for Estonian.

---

## How to use it

1. Install the script, then open any player profile — a URL beginning with `/user/`.
2. Wait about half a second. The panel appears in the top-right corner.
3. Read the headline score, then scroll the panel for the rank context, the raw data summary, the threshold table, and the full per-mode derivation.
4. Drag the header to reposition it. Press <kbd>×</kbd> to collapse it to the edge tab.

On every page that is not a profile, the script removes its own UI and idles.

---

## Reading the panel

```
┌────────────────────────────────────────────┐
│ 📊 Profile Analysis        [English v]   × │  <- drag here to move
├────────────────────────────────────────────┤
│  🏆  Champion (1.9k+) (1950)               │  <- rank context
│      Expected matches: ~2500               │
│                                            │
│  STATISTICAL ANOMALY SCORE                 │
│  77.3%          [ Very High · Medium conf ]│  <- headline + band
│                                            │
│  This score is a statistical anomaly       │
│  indicator; not a definitive cheat verdict.│
│  ──────────────────────────────────────    │
│  Raw Data Summary                          │
│   Ranked: Mode Impact 71% (Anomaly 82.0%)  │  <- weight share
│     ↳ 60 matches, 84% win rate             │
│   Team:   Mode Impact 29% (Anomaly 65.5%)  │
│     ↳ 12 matches, 66% win rate             │
│  ──────────────────────────────────────    │
│  How is this calculated?                   │  <- model summary
│  ──────────────────────────────────────    │
│  Expected Match Thresholds (Caps)          │  <- the full rulebook
│   Bronze: 30 | Silver: 80 | Gold: 200 |    │
│   Master: 350                              │
│   Champ 1.1k: 500 | 1.2k: 700 | 1.4k: 900  │
│   Champ 1.6k: 1200 | 1.8k: 1600 |1.9k+:2500│
│  ──────────────────────────────────────    │
│  Personal Math Breakdown                   │  <- per-mode derivation
│   Ranked Mode Details:                     │
│     Stabilized Win Rate                    │
│     (60 x 84.0% + 50 x 50%) / (60+50)=68.5%│
│     Base Anomaly (Risk Curve)      53.6%   │
│     Smurf Multiplier                       │
│     (2500-60)/2500 x 84.0%         82.0%   │
│     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│     Applied Signal: Max(53.6%,82.0%)=82.0% │
└────────────────────────────────────────────┘
```

| Element | What it tells you |
|---|---|
| **Rank context** | Division, rating, and the expected match count the smurf term compares against |
| **Headline score** | Weighted anomaly, 0 to 100 |
| **Band badge** | Low / Limited / High / Very High, plus confidence from how many signals were found |
| **Mode Impact** | That mode's *share of the weight* among the signals actually found — not its raw weight |
| **Anomaly** | That mode's own signal value, before weighting |
| **Raw data line** | The exact source numbers, so you can sanity-check the extraction |
| **Expected Match Thresholds** | The complete cap table, so you can audit the calibration in place |
| **Personal Math Breakdown** | The full substituted arithmetic for this specific profile |

---

## The math

Where **G** = matches in a mode, **W** = raw win rate in percent, **R** = rating, **C** = expected match cap for the division.

### 1. Stabilized win rate

A raw win rate over 12 games tells you almost nothing. The model adds **50 phantom matches at exactly 50%**, pulling small samples toward the mean while leaving large samples untouched:

```
stabilized = (G * (W/100) + 50 * 0.5) / (G + 50)
```

| Record | Raw win rate | Stabilized | Effect |
|---|---|---|---|
| 7 – 3 | 70.0% | **53.3%** | Streak almost fully absorbed |
| 40 – 20 | 66.7% | **59.1%** | Meaningfully discounted |
| 200 – 100 | 66.7% | **64.3%** | Lightly discounted |
| 900 – 450 | 66.7% | **66.1%** | Essentially unchanged |

This is the main defense against false positives. It is why a hot new account does not automatically look like a cheater.

### 2. The risk curve

The stabilized rate is mapped through a piecewise curve. Below 56% there is **no signal at all** — that band is simply "a good player".

```
stabilized 56% or below  ->  0
56% .. 62%               ->  (s - 0.56) / 0.06 * 0.25
62% .. 70%               ->  0.25 + (s - 0.62) / 0.08 * 0.35
above 70%                ->  0.60 + (s - 0.70) / 0.30 * 0.25   (clamped to 1)
```

| Stabilized win rate | Base signal | Interpretation |
|---|---|---|
| 56% or below | 0% | Normal to strong |
| 58% | 8.3% | Slight |
| 62% | 25% | Notable |
| 66% | 42.5% | Strong |
| 70% | 60% | Very strong |
| 80% | 68.3% | Extreme |
| 90% | 76.7% | Extreme |

The curve deliberately flattens above 70%: once a rate is that far out, more wins add little information, and the rank term below becomes the useful discriminator.

### 3. The smurf boost

This is what makes the model rank-aware. It applies **only when both** conditions hold: the rating is **600 or above** (the account actually climbed somewhere), **and** the match count is **below the division cap** (it got there in fewer games than the division normally takes).

```
deficit    = (C - G) / C
smurfBoost = deficit * (W / 100)

final signal = max(baseSignal, smurfBoost)
```

The two factors multiply, so **both** have to be true for the term to fire. 30 matches with a 45% win rate is a huge deficit but a weak rate, so the product stays small. 30 matches with an 85% win rate at Champion produces a very large one.

Team Duels use a reduced cap of **0.7 x C**, since team modes are played less often than solo Ranked.

<details>
<summary><b>Worked example — Champion 1.9k+ (1950), 60 matches, 84% win rate</b></summary>
<pre>
Division cap C for rating 1950  -&gt;  2500
Stabilized:  (60 x 0.84 + 50 x 0.5) / (60 + 50)  =  0.6855  -&gt; 68.5%
Risk curve:  0.25 + (0.6855 - 0.62)/0.08 x 0.35  =  0.5366  -&gt; 53.6%
Deficit:     (2500 - 60) / 2500                  =  0.9760
Smurf term:  0.9760 x 0.84                       =  0.8198  -&gt; 82.0%
Applied:     max(53.6%, 82.0%)                   =  82.0%
</pre>
<p>The rank term dominates by a wide margin — exactly the intended behavior. A 60-game account sitting at Champion is the signal; the win rate merely confirms it.</p>
</details>

<details>
<summary><b>Worked example — Gold (780), 400 matches, 61% win rate</b></summary>
<pre>
Division cap C for rating 780    -&gt;  200
Stabilized:  (400 x 0.61 + 25) / 450       =  0.5978  -&gt; 59.8%
Risk curve:  (0.5978 - 0.56)/0.06 x 0.25   =  0.1574  -&gt; 15.7%
Smurf term:  not applied (400 matches &gt;= 200 cap)
Applied:     15.7%
</pre>
<p>A strong, well-established Gold player. Low signal, as it should be.</p>
</details>

### 4. The Classic signal

Classic games have no win rate, so anomaly comes from **average score**, scaled by how much evidence supports it:

```
average 18,000 or below  ->  0
18,000 .. 20,000         ->  (A - 18000) / 2000 * 0.6
above 20,000             ->  0.6 + (A - 20000) / 5000 * 0.4

evidence = sqrt(G / 1500)     (capped at 1)
signal   = scoreAnomaly * evidence
```

The evidence multiplier reaches its ceiling at 1,500 games. A 24k average over 20 games barely registers; the same average over 2,000 games is close to unanswerable.

<details>
<summary><b>Worked example — 800 classic games, 19,500 average score</b></summary>
<pre>
Score anomaly:  (19500 - 18000) / 2000 x 0.6  =  0.45   -&gt; 45.0%
Evidence:       sqrt(800 / 1500)              =  0.73
Applied:        45.0% x 0.73                  =  32.9%
</pre>
</details>

### 5. Putting it together

Each signal carries a fixed weight, and the score is a weighted mean **normalized over only the signals that were actually found**:

| Signal | Weight | Cap used | Requires |
|---|---|---|---|
| 🥇 Ranked Duels | **0.50** | C | games + win rate |
| 🌍 Classic | **0.30** | none | games + average score |
| 👥 Team Duels | **0.20** | 0.7 x C | games + win rate |

Because the denominator only sums the weights present, a profile with Ranked data alone is scored on Ranked alone — not silently penalized for the missing modes. What changes instead is the reported confidence:

| Signals found | Confidence |
|---|---|
| 3 | **High** |
| 2 | **Medium** |
| 1 | **Low** |
| 0 | *Insufficient data* — no score is shown |

### Score bands

| Score | Band |
|---|---|
| 0 – 19.9 | 🟢 **Low** |
| 20 – 44.9 | 🟡 **Limited** |
| 45 – 69.9 | 🟠 **High** |
| 70 – 100 | 🔴 **Very High** |

---

## Division and threshold reference

This table is the model's notion of "normal", and the panel prints it inline so you can audit it without reading the source.

| Rating | Division | Expected matches (C) | Team cap (0.7 x C) |
|---|---|---|---|
| below 400 | Bronze | 30 | 21 |
| 400 – 599 | Silver | 80 | 56 |
| 600 – 849 | Gold | 200 | 140 |
| 850 – 1099 | Master | 350 | 245 |
| 1100 – 1199 | Champion (1.1k) | 500 | 350 |
| 1200 – 1299 | Champion (1.2k) | 700 | 490 |
| 1300 – 1499 | Champion (1.3k–1.4k) | 900 | 630 |
| 1500 – 1699 | Champion (1.5k–1.6k) | 1,200 | 840 |
| 1700 – 1899 | Champion (1.7k–1.8k) | 1,600 | 1,120 |
| 1900 and above | Champion (1.9k+) | 2,500 | 1,750 |

If the rating cannot be read at all, the context falls back to `Unknown` with a cap of 600.

> **The smurf term never fires below rating 600.** Bronze and Silver accounts are exempt by design — a low-rated account with few games is just a new player, not a smurf.

### What version 6.2.0 changed

Every threshold came down, and the nine Champion bands were consolidated into five:

| Division | Old cap | 6.2.0 cap | Change |
|---|---|---|---|
| Bronze | 50 | 30 | −40% |
| Silver | 100 | 80 | −20% |
| Gold | 250 | 200 | −20% |
| Master | 500 | 350 | −30% |
| Champion 1.1k | 600 | 500 | −17% |
| Champion 1.2k | 800 | 700 | −13% |
| Champion 1.3k–1.4k | 1,000 / 1,200 | 900 | −10% to −25% |
| Champion 1.5k–1.6k | 1,500 / 1,800 | 1,200 | −20% to −33% |
| Champion 1.7k–1.8k | 2,200 / 2,600 | 1,600 | −27% to −38% |
| Champion 1.9k+ | 3,000 / 4,000 | 2,500 | −17% to −38% |

The direction is consistent: **fewer false positives at the top of the ladder.** The old table assumed a Champion 2k+ player needed 4,000 matches, which flagged efficient climbers who had simply improved fast.

The tradeoff is real and worth naming: a genuine smurf sitting between the old and new caps now scores lower than it used to. **6.2.0 trades some sensitivity for a lot of precision.**

<details>
<summary><b>Worked example — what the cap change actually does</b></summary>
<p>Same player, same numbers, judged by the old and new Gold caps. Rating 780, <b>120 matches, 70% win rate</b>:</p>
<pre>
Stabilized:  (120 x 0.70 + 25) / 170             =  0.6412  -&gt; 64.1%
Risk curve:  0.25 + (0.6412 - 0.62)/0.08 x 0.35  =  0.3427  -&gt; 34.3%

Old (cap 250):    deficit (250-120)/250 = 0.52  -&gt;  smurf 0.52 x 0.70 = 36.4%
                  Applied: max(34.3%, 36.4%)    =  36.4%   &lt;- rank term drives it

6.2.0 (cap 200):  deficit (200-120)/200 = 0.40  -&gt;  smurf 0.40 x 0.70 = 28.0%
                  Applied: max(34.3%, 28.0%)    =  34.3%   &lt;- win rate drives it
</pre>
<p>The score barely moves, but the <i>reason</i> changes: 120 games at Gold is no longer treated as suspiciously few, and the player is judged on performance instead of volume.</p>
</details>

---

## Privacy

| Concern | Status |
|---|---|
| Network requests | **None.** No `@grant`, no `GM_xmlhttpRequest`, no `fetch`, no `XMLHttpRequest`. |
| Data leaving your browser | **None.** Nothing is transmitted anywhere, ever. |
| Persistent storage | **None.** The stats cache and the language choice are in-memory only; both die with the tab. No `localStorage`, no cookies. |
| Language detection | Reads `<html lang>` and `navigator.languages` locally. Neither is sent anywhere. |
| Data sources | Only what is already rendered on the public profile page you are viewing. |
| Accounts touched | Only the profile you deliberately opened. No crawling, no enumeration. |
| Automation | One programmatic click on GeoGuessr's own "Show stats" button — the same action you would perform by hand. |

The script is a **local read-only analyzer**. It cannot see private profiles, cannot access the GeoGuessr API, and cannot act on your account.

---

## Known limitations

**About the model**

- **Correlation, not proof.** Every signal has innocent explanations: returning veterans, players who moved from another platform, coaching accounts, or someone who simply had a great month.
- **Deliberately blind below rating 600.** A low-rated smurf who has not climbed yet is invisible to the model.
- **6.2.0 is less sensitive by design.** The lowered caps cut false positives, but a real smurf whose match count falls between the old and new thresholds now scores lower.
- **The caps are heuristics.** They encode a reasonable prior about progression speed, not measured population data. Skilled players legitimately climb faster than any table assumes.
- **Team Duels are noisy.** Performance depends heavily on teammates, which is why the mode carries the lowest weight and a discounted cap.
- **Classic has no win rate.** Its signal rests entirely on average score, which is map-dependent and can be inflated by playing easy maps.

**About the script**

- GeoGuessr ships hashed CSS class names, so a major front-end refactor can break stat extraction until the selectors are updated.
- Private profiles yield "Insufficient data" and no score.
- Dragging is mouse-only; there is no touch support yet.
- In the Master and Champion 1.2k tiers, the Team breakdown prints its cap as `244.99999999999997` or `489.99999999999994`. That is a floating-point display artifact only — the comparison and the resulting score are correct.

---

## Troubleshooting

<details>
<summary><b>The panel never appears</b></summary>
<ol>
<li>Confirm you are on a profile URL — the path must start with <code>/user/</code>.</li>
<li>Check that your userscript manager lists the script as enabled for geoguessr.com.</li>
<li>Hard-reload the page with <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> (<kbd>Cmd</kbd> on macOS) — the app may have loaded before the script.</li>
<li>Look for a collapsed "📊 Analyze" tab on the right edge; you may have closed the panel earlier.</li>
<li>Open the browser console and check for errors.</li>
</ol>
</details>

<details>
<summary><b>It says "Insufficient data"</b></summary>
<p>The profile is private, the stats have not rendered yet, or the automatic fetch could not find the "Show stats" button.</p>
<ul>
<li>Click <b>Show stats</b> yourself, then close the modal — the script picks the values up on the next page update.</li>
<li>Give the page a couple more seconds; the fetch polls for about two seconds and then gives up.</li>
<li>Some profiles genuinely hide their statistics. Nothing can be computed from those.</li>
</ul>
</details>

<details>
<summary><b>The Team breakdown shows a number like 489.99999999999994</b></summary>
<p>A known cosmetic issue: it is the <code>0.7 x cap</code> floating-point result for the Master and Champion 1.2k tiers being printed verbatim. The comparison and the score are correct.</p>
</details>

<details>
<summary><b>The stats modal flashes visibly</b></summary>
<p>The hiding stylesheet is injected immediately before the click, but a very slow render can outrun it. Harmless — the modal is closed automatically.</p>
</details>

<details>
<summary><b>Numbers look wrong, or off by a factor of 1000</b></summary>
<p>A locale-parsing edge case. The decimal separator is inferred from the position of the last comma versus the last period. If your GeoGuessr locale formats numbers unusually, please report it with a screenshot of the raw profile numbers and your interface language.</p>
</details>

<details>
<summary><b>Scores dropped after updating</b></summary>
<p>Expected. Version 6.2.0 lowered every division cap by 30 to 40 percent, so the smurf term fires on fewer profiles and contributes less when it does.</p>
</details>

---

## Questions

<details>
<summary><b>Does this prove someone is cheating?</b></summary>
<p><b>No.</b> It measures how unusual a statistical profile is for its division. That is evidence of <i>unusualness</i>, not of misconduct. Treat a high score as a prompt to look more closely — never as a conclusion, and never as grounds to publicly accuse anyone.</p>
</details>

<details>
<summary><b>What is a "normal" score?</b></summary>
<p>Most established players land in the <b>Low</b> band, 0 to 20. <b>Limited</b>, 20 to 45, is common for strong players with above-average win rates. <b>High</b> and <b>Very High</b> usually mean either a genuine rank-versus-volume mismatch or a very small sample — check the confidence label and the raw match counts first.</p>
</details>

<details>
<summary><b>Why is my own profile flagged?</b></summary>
<p>Most often you are a strong player with fewer games than the division table expects, or you have very few matches in one mode. Open the <b>Personal Math Breakdown</b> — it shows exactly which term drove the score — and compare it against the threshold table right above it.</p>
</details>

<details>
<summary><b>Can it analyze my own account?</b></summary>
<p>Yes, on your own profile page. Note that the extractor reads the "other player" column of the stat comparison grid, which is designed for viewing someone else's profile, so results on your own page depend on how GeoGuessr renders that grid for you.</p>
</details>

<details>
<summary><b>Can I change the panel's language?</b></summary>
<p>Yes. The language is auto-detected from GeoGuessr and your browser, and there is a picker in the panel header offering English, Türkçe, Eesti, Français and Deutsch. Switching does not change the score — it re-derives the panel from the same numbers already in memory. The choice lasts for the session and is not stored.</p>
</details>

<details>
<summary><b>Does it work on mobile?</b></summary>
<p>The analysis works anywhere a userscript manager runs, but dragging is mouse-only.</p>
</details>

<details>
<summary><b>Will this get me banned?</b></summary>
<p>It makes no network requests and issues a single click on a button GeoGuessr already shows you. That said, userscripts are used at your own risk — review GeoGuessr's Terms of Service and decide for yourself.</p>
</details>

<details>
<summary><b>Why is Ranked weighted at 50%?</b></summary>
<p>Ranked Duels are the most controlled signal available: fixed format, matchmade opponents, an explicit win or loss, and a rating that ties directly to the division caps. Classic has no opponent and is map-dependent; Team is diluted by teammate performance.</p>
</details>

---

## Changelog

**6.4.0 — Five languages**

- The panel is now available in English, Turkish, Estonian, French and German — 50 strings per locale, covering the full math derivation and not just the headline.
- Automatic language detection from GeoGuessr's interface language, then the browser's preferences, then English.
- Language picker in the panel header; switching re-derives the panel from the stats already in memory, so the score never moves.
- Locale-aware number formatting, so thousands separators follow the reader's convention.
- The **Show stats** button is now found in any interface language, using GeoGuessr's component classes plus the `stat` root every supported language shares.
- New **Final Weighted Score** box closing the math breakdown, showing the weighted sum that produces the headline.
- `@namespace` now points at the script in its repository; the fallback cap for an unreadable rating is back to 600.

**6.2.0 — Fair Caps**

- Recalibrated every division cap downward by 30 to 40 percent, to cut false positives on efficient climbers.
- Consolidated the ladder from 14 tiers to 10; the nine separate Champion bands became five.
- New **Expected Match Thresholds (Caps)** block — the complete cap table is now printed in the panel.
- Fallback cap for unreadable ratings lowered from 600 to 500.

**1.0.0 — Initial release**

- Rank-aware smurf detection across Ranked, Classic and Team Duels.
- Win-rate stabilization and the piecewise risk curve.
- Automatic fetching of hidden stats via the comparison modal.
- Draggable panel with per-mode math breakdown.

---

## Source and license

Source code, issue tracker and full documentation: [github.com/MagnusMagi/GeoGuessr-Profile-Anomaly-Score](https://github.com/MagnusMagi/GeoGuessr-Profile-Anomaly-Score)

Released under the MIT License. Bug reports and calibration data for the division caps are especially welcome.

<center>
<p><b>Built for players who would rather check the arithmetic than trust a score.</b></p>
</center>
