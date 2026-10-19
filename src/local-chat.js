// Instant, rule-based MatchLens helper. No model download and no AI API calls.
(() => {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const send = document.querySelector("#chat-send");
  const log = document.querySelector("#chat-log");
  const title = document.querySelector(".chat-header strong");
  const headerNote = document.querySelector(".chat-header small");
  const note = document.querySelector(".ai-note");
  const disclaimer = document.querySelector(".chat-disclaimer");
  const opening = log?.querySelector(".chat-message.assistant");

  if (title) title.textContent = "MatchLens football helper";
  if (headerNote) headerNote.textContent = "Instant answers · uses matches loaded on this page";
  if (note) note.textContent = "Instant football explanations and match summaries. No generative AI, API calls, or model download.";
  if (disclaimer) disclaimer.textContent = "Forecasts are estimates, not guarantees or betting advice.";
  if (opening) opening.textContent = "Hi! I can explain football terms like 1X2 and summarize the forecasts currently shown here.";

  function addMessage(role, text, extra = "") {
    const element = document.createElement("div");
    element.className = `chat-message ${role} ${extra}`.trim();
    element.textContent = text;
    log.appendChild(element);
    log.scrollTop = log.scrollHeight;
    return element;
  }

  function getMatches() {
    return [...document.querySelectorAll("#match-list .match-card")].map((card) => {
      const teams = [...card.querySelectorAll(".team")].map((el) => el.textContent.trim());
      const values = (card.querySelector(".prob-labels")?.textContent || "").match(/HOME\s+(\d+)%\s+DRAW\s+(\d+)%\s+AWAY\s+(\d+)%/i);
      const meta = [...card.querySelectorAll(".match-meta span")].map((el) => el.textContent.trim());
      const foot = [...card.querySelectorAll(".match-foot span")].map((el) => el.textContent.trim());
      if (teams.length < 2 || !values) return null;
      return {
        home: teams[0], away: teams[1], competition: meta[0] || "Football",
        kickoff: meta[1] || "Kickoff unavailable", source: foot[0] || "",
        confidence: foot[1] || "",
        homePct: Number(values[1]), drawPct: Number(values[2]), awayPct: Number(values[3])
      };
    }).filter(Boolean);
  }

  function fixtureLine(match) {
    return `${match.home} vs ${match.away} (${match.competition}): home ${match.homePct}%, draw ${match.drawPct}%, away ${match.awayPct}%.`;
  }

  function summarize(matches) {
    if (!matches.length) return "There are no match cards loaded yet. Tap Load demo for examples, or refresh the match feed.";
    const leading = [...matches].sort((a, b) => Math.max(b.homePct, b.awayPct) - Math.max(a.homePct, a.awayPct))[0];
    const favorite = leading.homePct === leading.awayPct ? "Neither side leads" : leading.homePct > leading.awayPct ? `${leading.home} leads` : `${leading.away} leads`;
    const topPct = Math.max(leading.homePct, leading.awayPct);
    const list = matches.slice(0, 5).map((match) => `• ${fixtureLine(match)}`).join("\n");
    return `${matches.length} match${matches.length === 1 ? "" : "es"} are shown. The clearest home/away lean is ${favorite} in ${leading.home} vs ${leading.away} (${topPct}%), but that is only a model estimate.\n${list}${matches.length > 5 ? `\nPlus ${matches.length - 5} more.` : ""}`;
  }

  function describeMatch(match) {
    const lean = match.homePct === match.awayPct
      ? "The home and away probabilities are level."
      : match.homePct > match.awayPct
        ? `${match.home} has the higher win probability.`
        : `${match.away} has the higher win probability.`;
    const demo = document.querySelector("#demo-tag") && !document.querySelector("#demo-tag").hidden;
    return `${match.competition}: ${match.home} vs ${match.away} (${match.kickoff}). Home ${match.homePct}%, draw ${match.drawPct}%, away ${match.awayPct}%. ${lean} These are estimates, not guarantees.${demo ? " This is fictional demo data." : ""}`;
  }

  function respond(message) {
    const q = message.toLowerCase();
    const matches = getMatches();

    if (/\b1\s*x\s*2\b|\b1x2\b|what does.*\b1\b.*\bx\b/i.test(q)) {
      return "1X2 names the three possible match outcomes: 1 = the home team wins, X = the match is a draw, and 2 = the away team wins. In MatchLens, the percentages estimate each outcome; they are not guarantees.";
    }
    if (/\b(double chance|1x|12|x2)\b/.test(q)) {
      return "Double chance combines two 1X2 outcomes: 1X means home win or draw; 12 means either team wins (no draw); X2 means draw or away win. It describes outcomes, not a guarantee.";
    }
    if (/\b(both teams to score|btts)\b/.test(q)) {
      return "Both Teams To Score (BTTS) asks whether each team will score at least one goal. Yes means both score; No means one or both do not. MatchLens does not currently calculate BTTS probabilities.";
    }
    if (/\b(xg|expected goals?)\b/.test(q)) {
      return "Expected goals (xG) estimates the quality of a scoring chance based on factors such as shot location and situation. MatchLens does not currently include xG data.";
    }
    if (/\b(clean sheet)\b/.test(q)) {
      return "A clean sheet means a team concedes zero goals in a match. MatchLens does not currently forecast clean sheets.";
    }
    if (/\b(summar|overview|list|show me|upcoming matches|all matches)\b/.test(q)) return summarize(matches);
    if (/\b(probabilit|percent|percentage|forecast|prediction|most likely|favorite|favourite|confidence)\b/.test(q)) {
      if (!matches.length) return "Match probabilities are estimates of home win, draw, and away win. No matches are loaded right now; load demo examples or refresh the feed to see forecasts.";
      const match = matches.find((item) => q.includes(item.home.toLowerCase()) || q.includes(item.away.toLowerCase()));
      if (match) return describeMatch(match);
      return `The percentages show the model's estimated chance of each 1X2 outcome. They can be wrong and do not account for every factor.\n${summarize(matches)}`;
    }
    const match = matches.find((item) => q.includes(item.home.toLowerCase()) || q.includes(item.away.toLowerCase()));
    if (match) return describeMatch(match);
    if (/\b(odds?)\b/.test(q)) return "Odds express a market's price for an outcome and are not the same as a guaranteed probability. MatchLens shows its own estimated 1X2 percentages; it does not currently provide live bookmaker odds.";
    if (/\b(draw)\b/.test(q)) return "A draw means both teams finish with the same score. In 1X2 notation, a draw is X.";
    if (/\b(home win|home team|home side)\b/.test(q)) return "The home team is the side listed first in a fixture. A home-win forecast is the estimated chance that this team wins.";
    if (/\b(away win|away team|away side)\b/.test(q)) return "The away team is the side listed second in a fixture. An away-win forecast is the estimated chance that this team wins.";
    return "I can explain 1X2, double chance, BTTS, xG, clean sheets, odds, or summarize the loaded match forecasts. I only answer from this small built-in guide and the matches shown here.";
  }

  document.addEventListener("submit", (event) => {
    if (event.target !== form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const message = input.value.trim();
    if (!message || send.disabled) return;
    addMessage("user", message);
    input.value = "";
    send.disabled = true;
    const reply = respond(message);
    addMessage("assistant", reply);
    send.disabled = false;
    input.focus();
  }, true);
})();
