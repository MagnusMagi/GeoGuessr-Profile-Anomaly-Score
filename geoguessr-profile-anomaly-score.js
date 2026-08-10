// ==UserScript==
// @name         GeoGuessr Profile Anomaly Score
// @namespace    https://github.com/MagnusMagi/GeoGuessr-Profile-Anomaly-Score/blob/main/geoguessr-profile-anomaly-score.js
// @version      6.4.0
// @description  Rank-aware smurf detection with auto-fetch, explicit math breakdown, and visible threshold caps. Available in English, Turkish, Estonian, French and German.
// @match        https://www.geoguessr.com/*
// @license      MIT
// @grant        none
// ==/UserScript==
 
(() => {
    "use strict";
 
    const CONFIG = {
        panelId: "geo-profile-anomaly-panel",
        toggleId: "geo-profile-anomaly-toggle",
        styleId: "geo-profile-anomaly-style",
        debounceMs: 500,
        minimumSignals: 1
    };
 
    let currentPath = "";
    let debounceTimer = null;
    let observer = null;
    let isPanelManuallyClosed = false;
    let isAnalyzing = false;
    let hiddenStatsCache = {};
    // Kept so a language change can re-derive the panel from the same numbers
    // instead of re-reading the page.
    let lastStats = null;

    // ==========================================
    // 0. LOCALISATION
    // ==========================================

    const FALLBACK_LANG = "en";

    // Display names are written in their own language, as language pickers should be.
    const LANGUAGES = [
        { code: "en", label: "English", numberLocale: "en-US" },
        { code: "tr", label: "Türkçe", numberLocale: "tr-TR" },
        { code: "et", label: "Eesti", numberLocale: "et-EE" },
        { code: "fr", label: "Français", numberLocale: "fr-FR" },
        { code: "de", label: "Deutsch", numberLocale: "de-DE" }
    ];

    // "ee" is the country code for Estonia; the language code is "et". Accept both,
    // since users and URLs use them interchangeably.
    const LANG_ALIASES = { ee: "et" };

    const STRINGS = {
        en: {
            langTitle: "Language",
            analyze: "Analyze",
            panelTitle: "Profile Analysis",
            insufficient: "Insufficient data",
            insufficientBody: "Statistics are not loaded yet or the profile is private.",
            scoreHeading: "STATISTICAL ANOMALY SCORE",
            disclaimer: "This score is a statistical anomaly indicator; it is not a definitive cheat verdict.",
            bandLow: "Low", bandLimited: "Limited", bandHigh: "High", bandVeryHigh: "Very High",
            confHigh: "High", confMedium: "Medium", confLow: "Low",
            badge: "{band} signal · {conf} conf.",
            unknownRank: "Unknown",
            rankExpected: "Expected matches for this division:",
            rawTitle: "Raw Data Summary:",
            rawIntro: "This anomaly score is based on the following mode data:",
            modeRanked: "Ranked", modeClassic: "Classic", modeTeam: "Team",
            modeImpact: "Mode Impact: {impact}% (Anomaly: {anomaly}%)",
            descDuel: "{games} matches, {wr}% win rate",
            descClassic: "{games} matches, {avg} avg score",
            howTitle: "How is this calculated?",
            howStabLabel: "Stabilization:",
            howStabText: "Adds 50 hypothetical matches (50% win rate) to filter out lucky streaks on new accounts.",
            howCurveLabel: "Risk Curve:",
            howCurveText: "Anomaly starts once the stabilized win rate exceeds 56%, rises steeply between 62% and 70%, then increases more gradually above 70%.",
            howSmurfLabel: "Smurf Boost:",
            howSmurfText: "Multiplies the score if a Gold+ player reached their division with suspiciously few matches.",
            howWeightsLabel: "Weights:",
            howWeightsText: "Ranked (50%), Classic (30%), Team (20%).",
            capsTitle: "Expected Match Thresholds (Caps):",
            capsTeamNote: "Team Duels use 70% of these caps.",
            mathTitle: "Personal Math Breakdown:",
            mathIntro: "The step-by-step mathematical logic for this profile:",
            mathModeDetails: "{mode} Mode Details:",
            mathStabilized: "Stabilized Win Rate:",
            mathBase: "Base Anomaly (Risk Curve):",
            mathCurveApplied: "Curve limit applied to {stab}% = {base}%",
            mathSmurf: "Smurf Multiplier:",
            mathSmurfSkippedCap: "Not applied (Matches &gt;= Expected Cap)",
            mathSmurfSkippedRank: "Not applied (rank below Gold)",
            mathApplied: "Applied Signal:",
            mathScoreAnomaly: "Score Anomaly:",
            mathBasedOnAvg: "Based on avg {avg} = {score}%",
            mathConfidence: "Confidence Multiplier:",
            finalWeighted: "Final Weighted Score:",
            finalCalculation: "Calculation:",
            finalTotal: "Total Score:"
        },
        tr: {
            langTitle: "Dil",
            analyze: "Analiz",
            panelTitle: "Profil Analizi",
            insufficient: "Yetersiz veri",
            insufficientBody: "İstatistikler henüz yüklenmedi veya profil gizli.",
            scoreHeading: "İSTATİSTİKSEL ANOMALİ SKORU",
            disclaimer: "Bu skor istatistiksel bir anomali göstergesidir; kesin bir hile hükmü değildir.",
            bandLow: "Düşük", bandLimited: "Sınırlı", bandHigh: "Yüksek", bandVeryHigh: "Çok Yüksek",
            confHigh: "Yüksek", confMedium: "Orta", confLow: "Düşük",
            badge: "Sinyal: {band} · Güven: {conf}",
            unknownRank: "Bilinmiyor",
            rankExpected: "Bu lig için beklenen maç sayısı:",
            rawTitle: "Ham Veri Özeti:",
            rawIntro: "Bu anomali skoru aşağıdaki mod verilerine dayanıyor:",
            modeRanked: "Dereceli", modeClassic: "Klasik", modeTeam: "Takım",
            modeImpact: "Mod Etkisi: %{impact} (Anomali: %{anomaly})",
            descDuel: "{games} maç, %{wr} kazanma oranı",
            descClassic: "{games} maç, {avg} ortalama skor",
            howTitle: "Bu nasıl hesaplanıyor?",
            howStabLabel: "Dengeleme:",
            howStabText: "Yeni hesaplardaki şans serilerini elemek için 50 varsayımsal maç (%50 kazanma oranı) ekler.",
            howCurveLabel: "Risk Eğrisi:",
            howCurveText: "Dengelenmiş kazanma oranı %56'yı aşınca anomali başlar, %62-%70 arasında hızla yükselir, %70 üzerinde ise daha kademeli artar.",
            howSmurfLabel: "Smurf Çarpanı:",
            howSmurfText: "Gold ve üzeri bir oyuncu ligine şüpheli derecede az maçla ulaştıysa skoru büyütür.",
            howWeightsLabel: "Ağırlıklar:",
            howWeightsText: "Dereceli (%50), Klasik (%30), Takım (%20).",
            capsTitle: "Beklenen Maç Eşikleri (Tavanlar):",
            capsTeamNote: "Takım Düellosu bu tavanların %70'ini kullanır.",
            mathTitle: "Kişisel Matematik Dökümü:",
            mathIntro: "Bu profil için adım adım matematiksel mantık:",
            mathModeDetails: "{mode} Modu Detayları:",
            mathStabilized: "Dengelenmiş Kazanma Oranı:",
            mathBase: "Temel Anomali (Risk Eğrisi):",
            mathCurveApplied: "%{stab} değerine eğri sınırı uygulandı = %{base}",
            mathSmurf: "Smurf Çarpanı:",
            mathSmurfSkippedCap: "Uygulanmadı (Maç sayısı &gt;= Beklenen tavan)",
            mathSmurfSkippedRank: "Uygulanmadı (lig Gold altında)",
            mathApplied: "Uygulanan Sinyal:",
            mathScoreAnomaly: "Skor Anomalisi:",
            mathBasedOnAvg: "{avg} ortalamasına göre = %{score}",
            mathConfidence: "Güven Çarpanı:",
            finalWeighted: "Nihai Ağırlıklı Skor:",
            finalCalculation: "Hesaplama:",
            finalTotal: "Toplam Skor:"
        },
        et: {
            langTitle: "Keel",
            analyze: "Analüüsi",
            panelTitle: "Profiili analüüs",
            insufficient: "Ebapiisavad andmed",
            insufficientBody: "Statistika pole veel laaditud või profiil on privaatne.",
            scoreHeading: "STATISTILINE ANOMAALIASKOOR",
            disclaimer: "See skoor on statistiline anomaalianäitaja, mitte lõplik petmise otsus.",
            bandLow: "Madal", bandLimited: "Piiratud", bandHigh: "Kõrge", bandVeryHigh: "Väga kõrge",
            confHigh: "Kõrge", confMedium: "Keskmine", confLow: "Madal",
            badge: "Signaal: {band} · Kindlus: {conf}",
            unknownRank: "Teadmata",
            rankExpected: "Selle divisjoni eeldatav mängude arv:",
            rawTitle: "Algandmete kokkuvõte:",
            rawIntro: "See anomaaliaskoor põhineb järgmistel režiimiandmetel:",
            modeRanked: "Reitingumängud", modeClassic: "Klassikaline", modeTeam: "Meeskond",
            modeImpact: "Režiimi mõju: {impact}% (Anomaalia: {anomaly}%)",
            descDuel: "{games} mängu, {wr}% võidumäär",
            descClassic: "{games} mängu, {avg} keskmine skoor",
            howTitle: "Kuidas seda arvutatakse?",
            howStabLabel: "Stabiliseerimine:",
            howStabText: "Lisab 50 hüpoteetilist mängu (50% võidumäär), et välistada uute kontode õnneseeriad.",
            howCurveLabel: "Riskikõver:",
            howCurveText: "Anomaalia algab, kui stabiliseeritud võidumäär ületab 56%, tõuseb järsult vahemikus 62–70% ja kasvab üle 70% aeglasemalt.",
            howSmurfLabel: "Smurf-kordaja:",
            howSmurfText: "Suurendab skoori, kui Gold või kõrgema divisjoni mängija jõudis sinna kahtlaselt väheste mängudega.",
            howWeightsLabel: "Kaalud:",
            howWeightsText: "Reitingumängud (50%), Klassikaline (30%), Meeskond (20%).",
            capsTitle: "Eeldatavad mängude lävendid (ülempiirid):",
            capsTeamNote: "Meeskonnaduellid kasutavad neist ülempiiridest 70%.",
            mathTitle: "Isiklik arvutuskäik:",
            mathIntro: "Selle profiili samm-sammuline matemaatiline loogika:",
            mathModeDetails: "{mode} režiimi üksikasjad:",
            mathStabilized: "Stabiliseeritud võidumäär:",
            mathBase: "Baasanomaalia (riskikõver):",
            mathCurveApplied: "Kõvera piirang rakendatud väärtusele {stab}% = {base}%",
            mathSmurf: "Smurf-kordaja:",
            mathSmurfSkippedCap: "Ei rakendatud (mänge &gt;= eeldatav ülempiir)",
            mathSmurfSkippedRank: "Ei rakendatud (liiga alla Gold)",
            mathApplied: "Rakendatud signaal:",
            mathScoreAnomaly: "Skoori anomaalia:",
            mathBasedOnAvg: "Keskmise {avg} põhjal = {score}%",
            mathConfidence: "Kindluse kordaja:",
            finalWeighted: "Lõplik kaalutud skoor:",
            finalCalculation: "Arvutus:",
            finalTotal: "Koguskoor:"
        },
        fr: {
            langTitle: "Langue",
            analyze: "Analyser",
            panelTitle: "Analyse du profil",
            insufficient: "Données insuffisantes",
            insufficientBody: "Les statistiques ne sont pas encore chargées ou le profil est privé.",
            scoreHeading: "SCORE D'ANOMALIE STATISTIQUE",
            disclaimer: "Ce score est un indicateur d'anomalie statistique ; ce n'est pas un verdict de triche.",
            bandLow: "Faible", bandLimited: "Limité", bandHigh: "Élevé", bandVeryHigh: "Très élevé",
            confHigh: "Élevée", confMedium: "Moyenne", confLow: "Faible",
            badge: "Signal : {band} · Confiance : {conf}",
            unknownRank: "Inconnu",
            rankExpected: "Matchs attendus pour cette division :",
            rawTitle: "Résumé des données brutes :",
            rawIntro: "Ce score d'anomalie repose sur les données de mode suivantes :",
            modeRanked: "Classé", modeClassic: "Classique", modeTeam: "Équipe",
            modeImpact: "Impact du mode : {impact} % (Anomalie : {anomaly} %)",
            descDuel: "{games} matchs, {wr} % de victoires",
            descClassic: "{games} matchs, {avg} score moyen",
            howTitle: "Comment est-ce calculé ?",
            howStabLabel: "Stabilisation :",
            howStabText: "Ajoute 50 matchs hypothétiques (50 % de victoires) pour filtrer les séries chanceuses des nouveaux comptes.",
            howCurveLabel: "Courbe de risque :",
            howCurveText: "L'anomalie démarre lorsque le taux de victoires stabilisé dépasse 56 %, grimpe fortement entre 62 % et 70 %, puis augmente plus progressivement au-delà de 70 %.",
            howSmurfLabel: "Bonus smurf :",
            howSmurfText: "Amplifie le score si un joueur en division Gold ou supérieure l'a atteinte avec étonnamment peu de matchs.",
            howWeightsLabel: "Pondérations :",
            howWeightsText: "Classé (50 %), Classique (30 %), Équipe (20 %).",
            capsTitle: "Seuils de matchs attendus (plafonds) :",
            capsTeamNote: "Les duels d'équipe utilisent 70 % de ces plafonds.",
            mathTitle: "Détail du calcul personnel :",
            mathIntro: "La logique mathématique étape par étape pour ce profil :",
            mathModeDetails: "Détails du mode {mode} :",
            mathStabilized: "Taux de victoires stabilisé :",
            mathBase: "Anomalie de base (courbe de risque) :",
            mathCurveApplied: "Limite de courbe appliquée à {stab} % = {base} %",
            mathSmurf: "Multiplicateur smurf :",
            mathSmurfSkippedCap: "Non appliqué (matchs &gt;= plafond attendu)",
            mathSmurfSkippedRank: "Non appliqué (division inférieure à Gold)",
            mathApplied: "Signal appliqué :",
            mathScoreAnomaly: "Anomalie de score :",
            mathBasedOnAvg: "D'après une moyenne de {avg} = {score} %",
            mathConfidence: "Multiplicateur de confiance :",
            finalWeighted: "Score pondéré final :",
            finalCalculation: "Calcul :",
            finalTotal: "Score total :"
        },
        de: {
            langTitle: "Sprache",
            analyze: "Analysieren",
            panelTitle: "Profilanalyse",
            insufficient: "Unzureichende Daten",
            insufficientBody: "Die Statistiken sind noch nicht geladen oder das Profil ist privat.",
            scoreHeading: "STATISTISCHER ANOMALIE-SCORE",
            disclaimer: "Dieser Wert ist ein statistischer Anomalie-Indikator und kein endgültiges Cheat-Urteil.",
            bandLow: "Niedrig", bandLimited: "Begrenzt", bandHigh: "Hoch", bandVeryHigh: "Sehr hoch",
            confHigh: "Hoch", confMedium: "Mittel", confLow: "Niedrig",
            badge: "Signal: {band} · Konfidenz: {conf}",
            unknownRank: "Unbekannt",
            rankExpected: "Erwartete Spiele für diese Division:",
            rawTitle: "Rohdaten-Übersicht:",
            rawIntro: "Dieser Anomalie-Score basiert auf den folgenden Modus-Daten:",
            modeRanked: "Gewertet", modeClassic: "Klassisch", modeTeam: "Team",
            modeImpact: "Modus-Einfluss: {impact} % (Anomalie: {anomaly} %)",
            descDuel: "{games} Spiele, {wr} % Siegquote",
            descClassic: "{games} Spiele, {avg} Durchschnittspunkte",
            howTitle: "Wie wird das berechnet?",
            howStabLabel: "Stabilisierung:",
            howStabText: "Fügt 50 hypothetische Spiele (50 % Siegquote) hinzu, um Glückssträhnen neuer Konten herauszufiltern.",
            howCurveLabel: "Risikokurve:",
            howCurveText: "Die Anomalie beginnt, wenn die stabilisierte Siegquote 56 % übersteigt, steigt zwischen 62 % und 70 % stark an und danach oberhalb von 70 % gleichmäßiger.",
            howSmurfLabel: "Smurf-Verstärkung:",
            howSmurfText: "Erhöht den Wert, wenn ein Spieler ab Gold seine Division mit verdächtig wenigen Spielen erreicht hat.",
            howWeightsLabel: "Gewichtungen:",
            howWeightsText: "Gewertet (50 %), Klassisch (30 %), Team (20 %).",
            capsTitle: "Erwartete Spielzahl-Schwellen (Obergrenzen):",
            capsTeamNote: "Team-Duelle verwenden 70 % dieser Obergrenzen.",
            mathTitle: "Persönliche Rechenaufschlüsselung:",
            mathIntro: "Die schrittweise mathematische Logik für dieses Profil:",
            mathModeDetails: "Details zum Modus {mode}:",
            mathStabilized: "Stabilisierte Siegquote:",
            mathBase: "Basis-Anomalie (Risikokurve):",
            mathCurveApplied: "Kurvengrenze angewendet auf {stab} % = {base} %",
            mathSmurf: "Smurf-Multiplikator:",
            mathSmurfSkippedCap: "Nicht angewendet (Spiele &gt;= erwartete Obergrenze)",
            mathSmurfSkippedRank: "Nicht angewendet (Liga unter Gold)",
            mathApplied: "Angewendetes Signal:",
            mathScoreAnomaly: "Punkte-Anomalie:",
            mathBasedOnAvg: "Basierend auf Durchschnitt {avg} = {score} %",
            mathConfidence: "Konfidenz-Multiplikator:",
            finalWeighted: "Endgültiger gewichteter Score:",
            finalCalculation: "Berechnung:",
            finalTotal: "Gesamtscore:"
        }
    };

    function normalizeLang(value) {
        if (!value) return null;
        const base = String(value).trim().toLowerCase().split(/[-_]/)[0];
        const code = LANG_ALIASES[base] || base;
        return STRINGS[code] ? code : null;
    }

    // Prefer the language GeoGuessr itself is rendering in, then the browser's
    // preference list, then English.
    function detectLanguage() {
        const candidates = [
            document.documentElement.getAttribute("lang"),
            ...(navigator.languages || []),
            navigator.language
        ];

        for (const candidate of candidates) {
            const code = normalizeLang(candidate);
            if (code) return code;
        }
        return FALLBACK_LANG;
    }

    let activeLang = FALLBACK_LANG;

    function t(key, params) {
        const table = STRINGS[activeLang] || STRINGS[FALLBACK_LANG];
        let text = table[key] != null ? table[key] : STRINGS[FALLBACK_LANG][key];
        if (text == null) return key;
        if (!params) return text;

        for (const [name, value] of Object.entries(params)) {
            text = text.replaceAll(`{${name}}`, value);
        }
        return text;
    }

    function numberLocale() {
        const entry = LANGUAGES.find(l => l.code === activeLang);
        return entry ? entry.numberLocale : "en-US";
    }

    function formatNumber(value) {
        return value != null ? value.toLocaleString(numberLocale()) : "?";
    }

    // Finding GeoGuessr's own "Show stats" button, which opens the comparison modal
    // when the profile page has not rendered the detailed stats yet. This is matched
    // against GeoGuessr's UI, not ours, so it has to work in whatever interface
    // language the user is browsing in - independently of the panel language.
    //
    // The button is rendered as:
    //   <button class="button_button__HASH button_variantTertiary__HASH button_sizeSmall__HASH">
    //     <div class="button_wrapper__HASH">
    //       <span class="button_label__HASH">Show stats</span>
    //     </div>
    //   </button>
    //
    // The CSS-module hashes change between deploys, so only the stable prefixes are
    // matched. Structure alone is not enough - tertiary small buttons are used all
    // over the site - so the label still has to identify it.
    const SHOW_STATS_BUTTON_SELECTOR = 'button[class*="button_button__"]';
    const SHOW_STATS_LABEL_SELECTOR = '[class*="button_label__"]';

    // Exact labels, kept for precision and as documentation of what is expected.
    const SHOW_STATS_LABELS = [
        "show stats",                 // en
        "istatistikleri göster",      // tr
        "näita statistikat",          // et
        "afficher les statistiques",  // fr
        "statistiken anzeigen"        // de
    ];

    // Every one of those labels contains "stat" once lower-cased - including Turkish
    // "istatistikleri" and French "statistiques" - so this single fragment matches all
    // five supported languages without depending on the exact wording, and keeps
    // working for any other locale built on the same Latin root.
    const STATS_WORD_FRAGMENT = "stat";

    function readButtonLabel(button) {
        const label = button.querySelector(SHOW_STATS_LABEL_SELECTOR);
        return ((label || button).textContent || "").toLowerCase().trim();
    }

    function findShowStatsButton() {
        // Prefer GeoGuessr's own button component, but fall back to every button on
        // the page if that class naming ever changes.
        let candidates = Array.from(document.querySelectorAll(SHOW_STATS_BUTTON_SELECTOR));
        if (candidates.length === 0) candidates = Array.from(document.querySelectorAll("button"));

        return candidates.find(button => {
            const text = readButtonLabel(button);
            if (!text) return false;
            return SHOW_STATS_LABELS.some(label => text.includes(label)) || text.includes(STATS_WORD_FRAGMENT);
        }) || null;
    }

    // ==========================================
    // 1. DATA PARSING & EXTRACTION
    // ==========================================
 
    function isProfilePage() {
        return location.pathname.startsWith("/user/");
    }
 
    function clamp(value, min = 0, max = 1) {
        return Math.min(max, Math.max(min, value));
    }
 
    function parseLocaleNumber(value) {
        if (value == null) return null;
        const raw = String(value).replace(/\u00a0/g, " ").trim().replace(/[^\d,.\-]/g, "");
        if (!raw) return null;
 
        const lastComma = raw.lastIndexOf(",");
        const lastDot = raw.lastIndexOf(".");
        let normalized = raw;
 
        if (lastComma !== -1 && lastDot !== -1) {
            const decimalSeparator = lastComma > lastDot ? "," : ".";
            const thousandsSeparator = decimalSeparator === "," ? "." : ",";
            normalized = normalized.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
        } else if (lastComma !== -1) {
            const commaParts = raw.split(",");
            normalized = commaParts.length === 2 && commaParts[1].length <= 2
                ? raw.replace(",", ".")
                : raw.replaceAll(",", "");
        } else if (lastDot !== -1) {
            const dotParts = raw.split(".");
            normalized = dotParts.length === 2 && dotParts[1].length <= 2
                ? raw
                : raw.replaceAll(".", "");
        }
 
        const number = Number(normalized);
        return Number.isFinite(number) ? number : null;
    }
 
    function extractProfileStats() {
        let stats = {
            classicGames: null, classicAverageScore: null,
            rankedGames: null, rankedWinRate: null,
            teamGames: null, teamWinRate: null,
            rating: null, rankIconUrl: null
        };
 
        const statModal = document.querySelector('[class*="stat-comparison-modal_grid"]');
        if (statModal) {
            let currentMode = "";
            let currentSubMode = "all";
            let isRatingSection = false;
 
            for (const el of statModal.children) {
                const text = el.textContent.trim().toLowerCase();
 
                if (el.className.includes("stat-comparison-modal_header")) {
                    currentMode = text;
                    currentSubMode = "all";
                    isRatingSection = text.includes("all-time rating");
                } else if (el.className.includes("stat-comparison-modal_subheader")) {
                    currentSubMode = text;
                } else if (el.className.includes("stat-comparison-modal_label")) {
                    const youCell = el.nextElementSibling;
                    const otherCell = youCell ? youCell.nextElementSibling : null;
 
                    if (otherCell) {
                        const val = parseLocaleNumber(otherCell.textContent);
                        if (val !== null) {
                            if (isRatingSection && text === "all") {
                                stats.rating = val;
                            } else if (currentMode === "classic") {
                                if (text.includes("completed games")) stats.classicGames = val;
                                if (text.includes("avg. score")) stats.classicAverageScore = val;
                            } else if (currentMode === "ranked duels" && currentSubMode === "all") {
                                if (text === "played") stats.rankedGames = val;
                                if (text.includes("win ratio") || text.includes("win rate")) stats.rankedWinRate = val;
                            } else if ((currentMode === "ranked team duels" || currentMode === "team duels") && currentSubMode === "all") {
                                if (text === "played") stats.teamGames = val;
                                if (text.includes("win ratio") || text.includes("win rate")) stats.teamWinRate = val;
                            }
                        }
                    }
                }
            }
        }
 
        if (stats.rating === null) {
            const divs = [...document.querySelectorAll("div")];
            for (let d of divs) {
                if (d.textContent.includes("Current rating:") || d.textContent.includes("Current rating")) {
                    const s = d.querySelector("strong");
                    if (s) {
                        const r = parseLocaleNumber(s.textContent);
                        if (r !== null) { stats.rating = r; break; }
                    }
                }
            }
        }
 
        const iconImg = document.querySelector('img[alt="division image"], img[src*="champion"], img[src*="master"], img[src*="gold"], img[src*="silver"], img[src*="bronze"]');
        if (iconImg) {
            stats.rankIconUrl = iconImg.src;
        }
 
        if (!statModal) {
            const headings = [...document.querySelectorAll("h1, h2, h3")];
            for (const h of headings) {
                const title = h.textContent.trim().toLowerCase();
                const widget = h.closest('[class*="widget_widgetBorder"], [class*="widget_widgetOuter"]');
                if (!widget) continue;
 
                const statLabels = [...widget.querySelectorAll('span')];
                for (const span of statLabels) {
                    const labelText = span.textContent.trim().toLowerCase();
                    const valueEl = span.previousElementSibling;
                    if (!valueEl) continue;
 
                    const num = parseLocaleNumber(valueEl.textContent);
                    if (num === null) continue;
 
                    if (title.includes("classic")) {
                        if (labelText === "games") stats.classicGames = num;
                        if (labelText.includes("avg. score") || labelText.includes("average score")) stats.classicAverageScore = num;
                    } else if (title === "ranked duels") {
                        if (labelText === "games") stats.rankedGames = num;
                        if (labelText.includes("win ratio") || labelText.includes("win rate")) stats.rankedWinRate = num;
                    } else if (title === "ranked team duels" || title === "team duels") {
                        if (labelText === "games") stats.teamGames = num;
                        if (labelText.includes("win ratio") || labelText.includes("win rate")) stats.teamWinRate = num;
                    }
                }
            }
        }
 
        return stats;
    }
 
    async function autoFetchHiddenStats() {
        if (hiddenStatsCache[currentPath]) {
            return hiddenStatsCache[currentPath];
        }
 
        let stats = extractProfileStats();
 
        if (stats.rankedGames !== null || stats.teamGames !== null || stats.classicGames !== null) {
            hiddenStatsCache[currentPath] = stats;
            return stats;
        }

        const showStatsBtn = findShowStatsButton();

        if (showStatsBtn) {
            const hideStyle = document.createElement("style");
            hideStyle.id = "geo-temp-hide-modal";
            hideStyle.textContent = `div[class*="stat-comparison-modal"] { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }`;
            document.head.appendChild(hideStyle);
 
            showStatsBtn.click();
 
            await new Promise(resolve => {
                let checks = 0;
                const interval = setInterval(() => {
                    const modal = document.querySelector('[class*="stat-comparison-modal_grid"]');
                    if (modal) {
                        const hasNumbers = Array.from(modal.querySelectorAll('[class*="stat-comparison-modal_cell"]')).some(c => /\d/.test(c.textContent));
                        if (hasNumbers || checks > 40) {
                            clearInterval(interval);
                            setTimeout(resolve, 200);
                        }
                    } else if (checks > 40) {
                        clearInterval(interval);
                        resolve();
                    }
                    checks++;
                }, 50);
            });
 
            stats = extractProfileStats();
 
            if (stats.rankedGames !== null || stats.teamGames !== null || stats.classicGames !== null) {
                hiddenStatsCache[currentPath] = stats;
            }
 
            const closeBtn = document.querySelector('button[aria-label="Close"], [class*="modal_close"] button');
            if (closeBtn) {
                closeBtn.click();
            } else {
                const overlay = document.querySelector('[class*="backgroundOverlay"]');
                if (overlay) overlay.click();
                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
            }
 
            setTimeout(() => {
                if (hideStyle.parentNode) hideStyle.remove();
            }, 100);
        }
 
        return stats;
    }
 
    // ==========================================
    // 2. EXPLICIT MATH & RANK LOGIC
    // ==========================================
 
    function getRankContext(rating) {
        let cap = 600;
        // Division names below are GeoGuessr's own badge names and stay untranslated
        // so they match the badge shown on the profile; only this fallback is localised.
        let name = t("unknownRank");

        if (rating == null) return { name, cap, rating: "?" };
 
        if (rating < 400) { name = "Bronze"; cap = 30; }
        else if (rating < 600) { name = "Silver"; cap = 80; }
        else if (rating < 850) { name = "Gold"; cap = 200; }
        else if (rating < 1100) { name = "Master"; cap = 350; }
        else if (rating < 1200) { name = "Champion (1.1k)"; cap = 500; }
        else if (rating < 1300) { name = "Champion (1.2k)"; cap = 700; }
        else if (rating < 1500) { name = "Champion (1.3k-1.4k)"; cap = 900; }
        else if (rating < 1700) { name = "Champion (1.5k-1.6k)"; cap = 1200; }
        else if (rating < 1900) { name = "Champion (1.7k-1.8k)"; cap = 1600; }
        else { name = "Champion (1.9k+)"; cap = 2500; }
 
        return { name, cap, rating };
    }
 
    function isUsableNumber(value) {
        return typeof value === "number" && Number.isFinite(value) && value >= 0;
    }
 
    function stabilizedWinRate(games, winRate) {
        const priorGames = 50;
        const priorWinRate = 0.5;
        return (games * clamp(winRate / 100, 0, 1) + priorGames * priorWinRate) / (games + priorGames);
    }
 
    function winRateSignal(stabilizedRate) {
        if (stabilizedRate == null || stabilizedRate <= 0.56) return 0;
        if (stabilizedRate <= 0.62) return ((stabilizedRate - 0.56) / 0.06) * 0.25;
        if (stabilizedRate <= 0.7) return 0.25 + ((stabilizedRate - 0.62) / 0.08) * 0.35;
        return clamp(0.6 + ((stabilizedRate - 0.7) / 0.3) * 0.25);
    }
 
    function rankAnomalySignalDetailed(games, winRate, rating, expectedCap) {
        if (!isUsableNumber(games) || !isUsableNumber(winRate) || games <= 0) return null;
 
        const stabRate = stabilizedWinRate(games, winRate);
        const baseSignal = winRateSignal(stabRate);
 
        let smurfBoost = 0;
        let calcText = "";
 
        const stabStr = (stabRate * 100).toFixed(1);
        const baseStr = (baseSignal * 100).toFixed(1);
        const wrStr = winRate.toFixed(1);
 
        if (rating >= 600 && games < expectedCap) {
            const deficit = clamp((expectedCap - games) / expectedCap);
            smurfBoost = deficit * clamp(winRate / 100);
            const smurfStr = (smurfBoost * 100).toFixed(1);
            const finalStr = (Math.max(baseSignal, smurfBoost) * 100).toFixed(1);
 
            calcText = `
                <div class="geo-math-row">
                    <span class="geo-math-row-title">${t("mathStabilized")}</span>
                    <span class="geo-math-row-formula">(${games} * ${wrStr}% + 50 * 50%) / (${games} + 50) = ${stabStr}%</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">${t("mathBase")}</span>
                    <span class="geo-math-row-formula">${t("mathCurveApplied", { stab: stabStr, base: baseStr })}</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">${t("mathSmurf")}</span>
                    <span class="geo-math-row-formula">(${expectedCap} - ${games}) / ${expectedCap} * ${wrStr}% = ${smurfStr}%</span>
                </div>
                <div class="geo-math-final">
                    <span>${t("mathApplied")}</span>
                    <span>Max(${baseStr}%, ${smurfStr}%) = ${finalStr}%</span>
                </div>
            `;
        } else {
            calcText = `
                <div class="geo-math-row">
                    <span class="geo-math-row-title">${t("mathStabilized")}</span>
                    <span class="geo-math-row-formula">(${games} * ${wrStr}% + 50 * 50%) / (${games} + 50) = ${stabStr}%</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">${t("mathBase")}</span>
                    <span class="geo-math-row-formula">${t("mathCurveApplied", { stab: stabStr, base: baseStr })}</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">${t("mathSmurf")}</span>
                    <span class="geo-math-row-formula" style="color:#71717a; background: transparent; padding: 0;">${t(rating >= 600 ? "mathSmurfSkippedCap" : "mathSmurfSkippedRank")}</span>
                </div>
                <div class="geo-math-final">
                    <span>${t("mathApplied")}</span>
                    <span>${baseStr}%</span>
                </div>
            `;
        }
 
        return { value: clamp(Math.max(baseSignal, smurfBoost)), calcText };
    }
 
    function classicSignalDetailed(games, averageScore) {
        if (!isUsableNumber(games) || !isUsableNumber(averageScore) || games <= 0) return null;
        let scoreSignal = 0;
 
        if (averageScore > 20000) {
            scoreSignal = 0.6 + ((averageScore - 20000) / 5000) * 0.4;
        } else if (averageScore > 18000) {
            scoreSignal = ((averageScore - 18000) / 2000) * 0.6;
        }
 
        const evidence = clamp(Math.sqrt(games / 1500));
        const val = clamp(scoreSignal * evidence);
 
        const scoreStr = (scoreSignal * 100).toFixed(1);
        const evStr = evidence.toFixed(2);
        const finalStr = (val * 100).toFixed(1);
 
        const calcText = `
            <div class="geo-math-row">
                <span class="geo-math-row-title">${t("mathScoreAnomaly")}</span>
                <span class="geo-math-row-formula">${t("mathBasedOnAvg", { avg: formatNumber(averageScore), score: scoreStr })}</span>
            </div>
            <div class="geo-math-row">
                <span class="geo-math-row-title">${t("mathConfidence")}</span>
                <span class="geo-math-row-formula">√(${games} / 1500) = ${evStr}</span>
            </div>
            <div class="geo-math-final">
                <span>${t("mathApplied")}</span>
                <span>${scoreStr}% * ${evStr} = ${finalStr}%</span>
            </div>
        `;
 
        return { value: val, calcText };
    }
 
    function getScoreBand(score) {
        if (score < 20) return { label: t("bandLow"), className: "low" };
        if (score < 45) return { label: t("bandLimited"), className: "limited" };
        if (score < 70) return { label: t("bandHigh"), className: "high" };
        return { label: t("bandVeryHigh"), className: "very-high" };
    }
 
    function calculateAnomalyScore(stats) {
        const formatNum = formatNumber;
        const rankCtx = getRankContext(stats.rating);
 
        const rankedDet = rankAnomalySignalDetailed(stats.rankedGames, stats.rankedWinRate, stats.rating, rankCtx.cap);
        const classicDet = classicSignalDetailed(stats.classicGames, stats.classicAverageScore);
        const teamDet = rankAnomalySignalDetailed(stats.teamGames, stats.teamWinRate, stats.rating, rankCtx.cap * 0.7);
 
        const signals = [];
        if (rankedDet) signals.push({ name: t("modeRanked"), weight: 0.5, value: rankedDet.value, rawDesc: t("descDuel", { games: formatNum(stats.rankedGames), wr: stats.rankedWinRate }), calcText: rankedDet.calcText });
        if (classicDet) signals.push({ name: t("modeClassic"), weight: 0.3, value: classicDet.value, rawDesc: t("descClassic", { games: formatNum(stats.classicGames), avg: formatNum(stats.classicAverageScore) }), calcText: classicDet.calcText });
        if (teamDet) signals.push({ name: t("modeTeam"), weight: 0.2, value: teamDet.value, rawDesc: t("descDuel", { games: formatNum(stats.teamGames), wr: stats.teamWinRate }), calcText: teamDet.calcText });

        if (signals.length < CONFIG.minimumSignals) {
            return { score: null, confidence: t("insufficient"), message: t("insufficientBody") };
        }
 
        const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
        const normalizedScore = signals.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight;
        const score = Math.round(clamp(normalizedScore * 100, 0, 100) * 10) / 10;
 
        return {
            score,
            band: getScoreBand(score),
            confidence: signals.length === 3 ? t("confHigh") : (signals.length === 2 ? t("confMedium") : t("confLow")),
            message: t("disclaimer"),
            signals,
            totalWeight,
            rankCtx,
            iconUrl: stats.rankIconUrl
        };
    }
 
    // ==========================================
    // 3. UI & DRAG MECHANICS
    // ==========================================
 
    function injectStyles() {
        if (document.getElementById(CONFIG.styleId)) return;
        const style = document.createElement("style");
        style.id = CONFIG.styleId;
        style.textContent = `
            #${CONFIG.panelId} {
                font-family: var(--font-family-neo-sans), "Neo Sans", system-ui, sans-serif !important;
                position: fixed;
                top: 96px;
                right: 24px;
                width: 350px;
                z-index: 2147483647;
                box-sizing: border-box;
                color: #f5f7fb;
                background: rgba(15, 15, 15, 0.95) !important;
                backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                border-radius: 12px !important;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
                user-select: none !important;
            }
            #${CONFIG.panelId} .geo-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                background: rgba(255,255,255,0.05);
                border-bottom: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px 12px 0 0;
                cursor: grab;
            }
            #${CONFIG.panelId} .geo-header:active { cursor: grabbing; }
            #${CONFIG.panelId} .geo-title { margin: 0; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
            #${CONFIG.panelId} .geo-header-actions { display: flex; align-items: center; gap: 8px; }
            #${CONFIG.panelId} .geo-lang {
                background: rgba(0, 0, 0, 0.35);
                color: #e4e4e7;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 5px;
                font-size: 10px;
                font-family: inherit;
                padding: 2px 4px;
                cursor: pointer;
                outline: none;
            }
            #${CONFIG.panelId} .geo-lang:hover { border-color: rgba(255, 255, 255, 0.35); }
            /* Native dropdown lists inherit the page background on some platforms. */
            #${CONFIG.panelId} .geo-lang option { background: #18181b; color: #e4e4e7; }
            #${CONFIG.panelId} .geo-close { background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 18px; line-height: 1; padding: 0; }
            #${CONFIG.panelId} .geo-close:hover { color: #ff4b4b; }
            #${CONFIG.panelId} .geo-content { padding: 14px; max-height: 80vh; overflow-y: auto; }
 
            /* Rank Context Box */
            #${CONFIG.panelId} .geo-rank-context {
                display: flex;
                align-items: center;
                gap: 12px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                padding: 8px 12px;
                border-radius: 8px;
                margin-bottom: 12px;
            }
            #${CONFIG.panelId} .geo-rank-icon { width: 40px; height: 40px; object-fit: contain; }
            #${CONFIG.panelId} .geo-rank-text { font-size: 11px; color: #a1a1aa; line-height: 1.4; }
            #${CONFIG.panelId} .geo-rank-text strong { color: #fff; font-size: 12px; }
            #${CONFIG.panelId} .geo-rank-text b { color: #ff4b4b; }

            /* Translated band/confidence labels are longer than the English ones,
               so the badge is allowed to wrap onto its own line instead of overflowing. */
            #${CONFIG.panelId} .geo-score-row { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; flex-wrap: wrap; gap: 6px; }
            #${CONFIG.panelId} .geo-score { font-size: 28px; font-weight: 800; }
            #${CONFIG.panelId} .geo-subtitle { color: #888; font-size: 10px; text-transform: uppercase; }
            #${CONFIG.panelId} .geo-badge { padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
            #${CONFIG.panelId} .geo-note { color: #cbd5e1; margin-top: 12px; font-size: 11px; }
 
            /* Divider and Explanation Elements */
            #${CONFIG.panelId} .geo-divider { border-top: 1px solid rgba(255, 255, 255, 0.15); margin: 12px 0; }
            #${CONFIG.panelId} .geo-explanation { font-size: 11px; color: #a1a1aa; line-height: 1.45; }
            #${CONFIG.panelId} .geo-explanation strong { color: #e4e4e7; font-weight: 600; font-size: 11.5px; }
            #${CONFIG.panelId} .geo-explanation ul { margin: 8px 0 0 0; padding-left: 0; list-style: none; }
            #${CONFIG.panelId} .geo-explanation li { margin-bottom: 8px; padding-left: 8px; border-left: 2px solid rgba(255, 255, 255, 0.15); }
            #${CONFIG.panelId} .geo-explanation li b { color: #e4e4e7; font-weight: 600; }
            #${CONFIG.panelId} .geo-raw-data { margin-top: 3px; font-size: 10.5px; color: #8f8f97; font-family: monospace; }
 
            /* Explicit Math Breakdown Styles */
            #${CONFIG.panelId} .geo-math-container { margin-top: 5px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 6px 8px; }
            #${CONFIG.panelId} .geo-math-row { margin-bottom: 7px; font-size: 10.5px; color: #a1a1aa; }
            #${CONFIG.panelId} .geo-math-row:last-child { margin-bottom: 0; }
            #${CONFIG.panelId} .geo-math-row-title { display: block; margin-bottom: 3px; color: #e4e4e7; }
            #${CONFIG.panelId} .geo-math-row-formula { display: block; font-family: monospace; color: #a3e635; background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 4px; word-break: break-word; }
            #${CONFIG.panelId} .geo-math-final { border-top: 1px dashed rgba(255, 255, 255, 0.15); padding-top: 6px; margin-top: 8px; font-weight: 700; color: #38bdf8; display: flex; justify-content: space-between; align-items: center; }
            #${CONFIG.panelId} .geo-math-final span:last-child { font-family: monospace; font-size: 12px; }
 
            /* Threshold List */
            #${CONFIG.panelId} .geo-cap-list { font-family: monospace; color: #8f8f97; background: rgba(0,0,0,0.25); padding: 6px; border-radius: 4px; margin-top: 6px; line-height: 1.5; font-size: 10px; }
            #${CONFIG.panelId} .geo-cap-list-note { color: #71717a; font-size: 10px; margin-top: 4px; }
 
            #${CONFIG.panelId} .low { background: #14532d; color: #bbf7d0; }
            #${CONFIG.panelId} .limited { background: #713f12; color: #fde68a; }
            #${CONFIG.panelId} .high { background: #7c2d12; color: #fed7aa; }
            #${CONFIG.panelId} .very-high { background: #7f1d1d; color: #fecaca; }
 
            /* Edge Toggle Button */
            #${CONFIG.toggleId} {
                position: fixed;
                right: 0;
                top: 120px;
                background: rgba(15, 15, 15, 0.95) !important;
                backdrop-filter: blur(8px) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                border-right: none !important;
                color: #fff !important;
                padding: 10px 14px !important;
                border-radius: 12px 0 0 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                z-index: 2147483647 !important;
                box-shadow: -4px 4px 15px rgba(0,0,0,0.5) !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                transition: transform 0.2s ease, background 0.2s ease !important;
            }
            #${CONFIG.toggleId}:hover {
                background: rgba(40, 40, 40, 0.95) !important;
                transform: translateX(-3px);
            }
 
            /* Custom Scrollbar */
            #${CONFIG.panelId} .geo-content::-webkit-scrollbar { width: 6px; }
            #${CONFIG.panelId} .geo-content::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
            #${CONFIG.panelId} .geo-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
        `;
        document.head.append(style);
    }
 
    function makeDraggable(panel) {
        const header = panel.querySelector('.geo-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
 
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.geo-close, .geo-lang')) return;
            isDragging = true;
 
            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;
 
            panel.style.left = `${initialLeft}px`;
            panel.style.top = `${initialTop}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
 
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
 
        function onMouseMove(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = `${initialLeft + dx}px`;
            panel.style.top = `${initialTop + dy}px`;
        }
 
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }
 
    function removeUI() {
        document.getElementById(CONFIG.panelId)?.remove();
        document.getElementById(CONFIG.toggleId)?.remove();
    }
 
    function renderToggleButton() {
        if (!isProfilePage()) return;
        if (document.getElementById(CONFIG.toggleId) || document.getElementById(CONFIG.panelId)) return;
 
        const toggleBtn = document.createElement("button");
        toggleBtn.id = CONFIG.toggleId;
        toggleBtn.innerHTML = `<span style="color:#ff4b4b;">📊</span> ${t("analyze")}`;

        toggleBtn.onclick = () => {
            isPanelManuallyClosed = false;
            toggleBtn.remove();
            analyzeProfile();
        };
 
        document.body.appendChild(toggleBtn);
    }
 
    function updatePanelContent(result) {
        injectStyles();
        let panel = document.getElementById(CONFIG.panelId);
 
        if (!panel) {
            panel = document.createElement("aside");
            panel.id = CONFIG.panelId;
            document.body.append(panel);

            const languageOptions = LANGUAGES
                .map(l => `<option value="${l.code}">${l.label}</option>`)
                .join("");

            panel.innerHTML = `
                <div class="geo-header">
                    <div class="geo-title"><span style="color:#ff4b4b;">📊</span> <span id="geo-title-text"></span></div>
                    <div class="geo-header-actions">
                        <select class="geo-lang" id="geo-lang-select">${languageOptions}</select>
                        <button class="geo-close" id="geo-close-btn">×</button>
                    </div>
                </div>
                <div class="geo-content" id="geo-content-container"></div>
            `;
 
            makeDraggable(panel);

            const langSelect = document.getElementById("geo-lang-select");
            langSelect.value = activeLang;
            // Keep the dropdown from starting a drag or bubbling into the header.
            langSelect.addEventListener("mousedown", e => e.stopPropagation());
            langSelect.addEventListener("change", e => {
                const chosen = normalizeLang(e.target.value);
                if (!chosen || chosen === activeLang) return;

                activeLang = chosen;
                // Re-derive from the same numbers; nothing is re-read from the page.
                if (lastStats) updatePanelContent(calculateAnomalyScore(lastStats));
            });

            document.getElementById("geo-close-btn").onclick = () => {
                isPanelManuallyClosed = true;
                panel.remove();
                renderToggleButton();
            };
        }

        document.getElementById("geo-title-text").textContent = t("panelTitle");
        document.getElementById("geo-lang-select").value = activeLang;
        document.getElementById("geo-lang-select").title = t("langTitle");

        const content = document.getElementById("geo-content-container");
        if (result.score == null) {
            content.innerHTML = `
                <div class="geo-subtitle">${result.confidence}</div>
                <div class="geo-note">${result.message}</div>
            `;
        } else {
            let explanationHtml = "";
            let rankHtml = "";
 
            let formulaHtml = `
                <div class="geo-divider"></div>
                <div class="geo-explanation">
                    <strong>${t("howTitle")}</strong>
                    <ul>
                        <li><b>${t("howStabLabel")}</b> ${t("howStabText")}</li>
                        <li><b>${t("howCurveLabel")}</b> ${t("howCurveText")}</li>
                        <li><b>${t("howSmurfLabel")}</b> ${t("howSmurfText")}</li>
                        <li><b>${t("howWeightsLabel")}</b> ${t("howWeightsText")}</li>
                    </ul>
 
                    <div class="geo-divider"></div>
                    <strong>${t("capsTitle")}</strong>
                    <div class="geo-cap-list">
                        Bronze: 30 | Silver: 80 | Gold: 200 | Master: 350<br>
                        Champ 1.1k: 500 | 1.2k: 700 | 1.4k: 900<br>
                        Champ 1.6k: 1200 | 1.8k: 1600 | 1.9k+: 2500
                    </div>
                    <div class="geo-cap-list-note">${t("capsTeamNote")}</div>
                </div>
            `;
 
            let personalMathHtml = "";
 
            if (result.rankCtx && result.rankCtx.rating) {
                const genericIcon = "https://www.geoguessr.com/images/auto/48/48/ce/0/plain/division-icon/champion.png";
                rankHtml = `
                    <div class="geo-rank-context">
                        <img src="${result.iconUrl || genericIcon}" class="geo-rank-icon" onerror="this.style.display='none'">
                        <div class="geo-rank-text">
                            <strong>${result.rankCtx.name} (${result.rankCtx.rating})</strong><br>
                            ${t("rankExpected")} <b>~${result.rankCtx.cap}</b>
                        </div>
                    </div>
                `;
            }
 
            if (result.signals && result.signals.length > 0 && result.totalWeight > 0) {
                const listItems = result.signals.map(s => {
                    const impact = Math.round((s.weight / result.totalWeight) * 100);
                    const anomalyLevel = (s.value * 100).toFixed(1);
                    return `
                        <li>
                            <b>${s.name}:</b> ${t("modeImpact", { impact, anomaly: anomalyLevel })}
                            <div class="geo-raw-data">↳ ${s.rawDesc}</div>
                        </li>
                    `;
                }).join("");
 
                explanationHtml = `
                    <div class="geo-divider"></div>
                    <div class="geo-explanation">
                        <strong>${t("rawTitle")}</strong><br>
                        ${t("rawIntro")}
                        <ul>
                            ${listItems}
                        </ul>
                    </div>
                `;
 
                const mathListItems = result.signals.map(s => {
                    return `
                        <div style="margin-bottom: 12px;">
                            <b style="color: #e4e4e7; font-size: 11.5px;">${t("mathModeDetails", { mode: s.name })}</b>
                            <div class="geo-math-container">
                                ${s.calcText}
                            </div>
                        </div>
                    `;
                }).join("");
 
                // NEW: Calculate and display the final weighted score logic
                const finalCalculationStr = result.signals.map(s => {
                    const impact = Math.round((s.weight / result.totalWeight) * 100);
                    const anomalyLevel = (s.value * 100).toFixed(1);
                    return `(${anomalyLevel}% * ${impact}%)`;
                }).join(" + ");
 
                const finalScoreBox = `
                    <div style="margin-top: 12px;">
                        <b style="color: #e4e4e7; font-size: 11.5px;">${t("finalWeighted")}</b>
                        <div class="geo-math-container" style="background: rgba(163, 230, 53, 0.1); border-color: rgba(163, 230, 53, 0.2);">
                            <div class="geo-math-row">
                                <span class="geo-math-row-title">${t("finalCalculation")}</span>
                                <span class="geo-math-row-formula" style="color: #a3e635; background: transparent;">${finalCalculationStr}</span>
                            </div>
                            <div class="geo-math-final" style="color: #a3e635; border-top-color: rgba(163, 230, 53, 0.3);">
                                <span>${t("finalTotal")}</span>
                                <span>${result.score.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                `;
 
                personalMathHtml = `
                    <div class="geo-divider"></div>
                    <div class="geo-explanation">
                        <strong>${t("mathTitle")}</strong><br>
                        ${t("mathIntro")}
                        <div style="margin-top: 10px;">
                            ${mathListItems}
                            ${finalScoreBox}
                        </div>
                    </div>
                `;
            }
 
            content.innerHTML = `
                ${rankHtml}
                <div class="geo-subtitle">${t("scoreHeading")}</div>
                <div class="geo-score-row">
                    <div class="geo-score">${result.score.toFixed(1)}%</div>
                    <span class="geo-badge ${result.band.className}">${t("badge", { band: result.band.label, conf: result.confidence })}</span>
                </div>
                <div class="geo-note">${result.message}</div>
                ${explanationHtml}
                ${formulaHtml}
                ${personalMathHtml}
            `;
        }
    }
 
    async function analyzeProfile() {
        if (!isProfilePage()) {
            removeUI();
            isPanelManuallyClosed = false;
            return;
        }
 
        if (isPanelManuallyClosed) {
            renderToggleButton();
            return;
        }
 
        if (isAnalyzing) return;
        isAnalyzing = true;
 
        try {
            const stats = await autoFetchHiddenStats();
            lastStats = stats;
            const result = calculateAnomalyScore(stats);
            updatePanelContent(result);
        } finally {
            isAnalyzing = false;
        }
    }
 
    function scheduleAnalysis() {
        if (currentPath !== location.pathname) {
            currentPath = location.pathname;
            // Cleared before anything else on this path so a language switch can never
            // re-render the previous profile's numbers.
            lastStats = null;
            isPanelManuallyClosed = false;
            removeUI();
        }
 
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(analyzeProfile, CONFIG.debounceMs);
    }
 
    // ==========================================
    // 4. ROUTER & OBSERVER
    // ==========================================
 
    const origPush = history.pushState;
    history.pushState = function (...args) {
        const res = origPush.apply(this, args);
        window.dispatchEvent(new Event("gg-route-change"));
        return res;
    };
    const origReplace = history.replaceState;
    history.replaceState = function (...args) {
        const res = origReplace.apply(this, args);
        window.dispatchEvent(new Event("gg-route-change"));
        return res;
    };
 
    window.addEventListener("popstate", scheduleAnalysis);
    window.addEventListener("gg-route-change", scheduleAnalysis);
 
    observer = new MutationObserver(() => {
        if (isProfilePage() && !isPanelManuallyClosed && !isAnalyzing) {
            scheduleAnalysis();
        } else if (isProfilePage() && isPanelManuallyClosed) {
            renderToggleButton();
        }
    });
 
    observer.observe(document.documentElement, { childList: true, subtree: true });

    activeLang = detectLanguage();

    scheduleAnalysis();
 
})();
