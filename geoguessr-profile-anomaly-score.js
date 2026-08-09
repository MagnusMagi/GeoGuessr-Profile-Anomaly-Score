// ==UserScript==
// @name         GeoGuessr Profile Anomaly Score
// @namespace    https://github.com/MagnusMagi/GeoGuessr-Profile-Anomaly-Score
// @version      1.0.0
// @description  Rank-aware smurf detection with auto-fetch and explicitly mapped math breakdown UI.
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

        const buttons = Array.from(document.querySelectorAll('button'));
        const showStatsBtn = buttons.find(b => {
            const txt = b.textContent ? b.textContent.toLowerCase().trim() : "";
            return txt.includes("show stats") || txt.includes("istatistikleri göster");
        });

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
        let name = "Unknown";

        if (rating == null) return { name, cap, rating: "?" };

        if (rating < 400) { name = "Bronze"; cap = 50; }
        else if (rating < 600) { name = "Silver"; cap = 100; }
        else if (rating < 850) { name = "Gold"; cap = 250; }
        else if (rating < 1100) { name = "Master"; cap = 500; }
        else if (rating < 1200) { name = "Champion (1.1k)"; cap = 600; }
        else if (rating < 1300) { name = "Champion (1.2k)"; cap = 800; }
        else if (rating < 1400) { name = "Champion (1.3k)"; cap = 1000; }
        else if (rating < 1500) { name = "Champion (1.4k)"; cap = 1200; }
        else if (rating < 1600) { name = "Champion (1.5k)"; cap = 1500; }
        else if (rating < 1700) { name = "Champion (1.6k)"; cap = 1800; }
        else if (rating < 1800) { name = "Champion (1.7k)"; cap = 2200; }
        else if (rating < 1900) { name = "Champion (1.8k)"; cap = 2600; }
        else if (rating < 2000) { name = "Champion (1.9k)"; cap = 3000; }
        else { name = "Champion (2k+)"; cap = 4000; }

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
                    <span class="geo-math-row-title">Stabilized Win Rate:</span>
                    <span class="geo-math-row-formula">(${games} * ${wrStr}% + 50 * 50%) / (${games} + 50) = ${stabStr}%</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">Base Anomaly (Risk Curve):</span>
                    <span class="geo-math-row-formula">Curve limit applied to ${stabStr}% = ${baseStr}%</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">Smurf Multiplier:</span>
                    <span class="geo-math-row-formula">(${expectedCap} - ${games}) / ${expectedCap} * ${wrStr}% = ${smurfStr}%</span>
                </div>
                <div class="geo-math-final">
                    <span>Applied Signal:</span>
                    <span>Max(${baseStr}%, ${smurfStr}%) = ${finalStr}%</span>
                </div>
            `;
        } else {
            calcText = `
                <div class="geo-math-row">
                    <span class="geo-math-row-title">Stabilized Win Rate:</span>
                    <span class="geo-math-row-formula">(${games} * ${wrStr}% + 50 * 50%) / (${games} + 50) = ${stabStr}%</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">Base Anomaly (Risk Curve):</span>
                    <span class="geo-math-row-formula">Curve limit applied to ${stabStr}% = ${baseStr}%</span>
                </div>
                <div class="geo-math-row">
                    <span class="geo-math-row-title">Smurf Multiplier:</span>
                    <span class="geo-math-row-formula" style="color:#71717a; background: transparent; padding: 0;">Not applied (Matches &gt;= Expected Cap)</span>
                </div>
                <div class="geo-math-final">
                    <span>Applied Signal:</span>
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
                <span class="geo-math-row-title">Score Anomaly:</span>
                <span class="geo-math-row-formula">Based on avg ${averageScore.toLocaleString()} = ${scoreStr}%</span>
            </div>
            <div class="geo-math-row">
                <span class="geo-math-row-title">Confidence Multiplier:</span>
                <span class="geo-math-row-formula">√(${games} / 1500) = ${evStr}</span>
            </div>
            <div class="geo-math-final">
                <span>Applied Signal:</span>
                <span>${scoreStr}% * ${evStr} = ${finalStr}%</span>
            </div>
        `;
        
        return { value: val, calcText };
    }

    function getScoreBand(score) {
        if (score < 20) return { label: "Low", className: "low" };
        if (score < 45) return { label: "Limited", className: "limited" };
        if (score < 70) return { label: "High", className: "high" };
        return { label: "Very High", className: "very-high" };
    }

    function calculateAnomalyScore(stats) {
        const formatNum = (num) => (num != null ? num.toLocaleString("en-US") : "?");
        const rankCtx = getRankContext(stats.rating);

        const rankedDet = rankAnomalySignalDetailed(stats.rankedGames, stats.rankedWinRate, stats.rating, rankCtx.cap);
        const classicDet = classicSignalDetailed(stats.classicGames, stats.classicAverageScore);
        const teamDet = rankAnomalySignalDetailed(stats.teamGames, stats.teamWinRate, stats.rating, rankCtx.cap * 0.7);

        const signals = [];
        if (rankedDet) signals.push({ name: "Ranked", weight: 0.5, value: rankedDet.value, rawDesc: `${formatNum(stats.rankedGames)} matches, ${stats.rankedWinRate}% win rate`, calcText: rankedDet.calcText });
        if (classicDet) signals.push({ name: "Classic", weight: 0.3, value: classicDet.value, rawDesc: `${formatNum(stats.classicGames)} matches, ${formatNum(stats.classicAverageScore)} avg score`, calcText: classicDet.calcText });
        if (teamDet) signals.push({ name: "Team", weight: 0.2, value: teamDet.value, rawDesc: `${formatNum(stats.teamGames)} matches, ${stats.teamWinRate}% win rate`, calcText: teamDet.calcText });

        if (signals.length < CONFIG.minimumSignals) {
            return { score: null, confidence: "Insufficient data", message: "Statistics are not loaded yet or the profile is private." };
        }

        const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
        const normalizedScore = signals.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight;
        const score = Math.round(clamp(normalizedScore * 100, 0, 100) * 10) / 10;

        return {
            score,
            band: getScoreBand(score),
            confidence: signals.length === 3 ? "High" : (signals.length === 2 ? "Medium" : "Low"),
            message: "This score is a statistical anomaly indicator; it is not a definitive cheat verdict.",
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

            #${CONFIG.panelId} .geo-score-row { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; }
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
            if (e.target.closest('.geo-close')) return;
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
        toggleBtn.innerHTML = `<span style="color:#ff4b4b;">📊</span> Analyze`;
        
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

            panel.innerHTML = `
                <div class="geo-header">
                    <div class="geo-title"><span style="color:#ff4b4b;">📊</span> Profile Analysis</div>
                    <button class="geo-close" id="geo-close-btn">×</button>
                </div>
                <div class="geo-content" id="geo-content-container"></div>
            `;

            makeDraggable(panel);

            document.getElementById("geo-close-btn").onclick = () => {
                isPanelManuallyClosed = true;
                panel.remove();
                renderToggleButton();
            };
        }

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
                    <strong>How is this calculated?</strong>
                    <ul>
                        <li><b>Stabilization:</b> Adds 50 hypothetical matches (50% win rate) to filter out lucky streaks on new accounts.</li>
                        <li><b>Risk Curve:</b> Anomaly starts if the stabilized win rate exceeds 56%, and scales up aggressively above 70%.</li>
                        <li><b>Smurf Boost:</b> Multiplies the score if the player reached a high division with suspiciously few matches.</li>
                        <li><b>Weights:</b> Ranked (50%), Classic (30%), Team (20%).</li>
                    </ul>
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
                            Expected matches for this division: <b>~${result.rankCtx.cap}</b>
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
                            <b>${s.name}:</b> Mode Impact: ${impact}% (Anomaly: ${anomalyLevel}%)
                            <div class="geo-raw-data">↳ ${s.rawDesc}</div>
                        </li>
                    `;
                }).join("");
                
                explanationHtml = `
                    <div class="geo-divider"></div>
                    <div class="geo-explanation">
                        <strong>Raw Data Summary:</strong><br>
                        This anomaly score is based on the following mode data:
                        <ul>
                            ${listItems}
                        </ul>
                    </div>
                `;

                // Render specific formula breakdown
                const mathListItems = result.signals.map(s => {
                    return `
                        <div style="margin-bottom: 12px;">
                            <b style="color: #e4e4e7; font-size: 11.5px;">${s.name} Mode Details:</b>
                            <div class="geo-math-container">
                                ${s.calcText}
                            </div>
                        </div>
                    `;
                }).join("");

                personalMathHtml = `
                    <div class="geo-divider"></div>
                    <div class="geo-explanation">
                        <strong>Personal Math Breakdown:</strong><br>
                        The step-by-step mathematical logic for this profile:
                        <div style="margin-top: 10px;">
                            ${mathListItems}
                        </div>
                    </div>
                `;
            }

            content.innerHTML = `
                ${rankHtml}
                <div class="geo-subtitle">STATISTICAL ANOMALY SCORE</div>
                <div class="geo-score-row">
                    <div class="geo-score">${result.score.toFixed(1)}%</div>
                    <span class="geo-badge ${result.band.className}">${result.band.label} signal · ${result.confidence} conf.</span>
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
            const result = calculateAnomalyScore(stats);
            updatePanelContent(result);
        } finally {
            isAnalyzing = false;
        }
    }

    function scheduleAnalysis() {
        if (currentPath !== location.pathname) {
            currentPath = location.pathname;
            isPanelManuallyClosed = false;
            hasAttemptedAutoFetch = false;
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

    scheduleAnalysis();

})();
