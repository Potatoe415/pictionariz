/* Pictionary mobile UI (single-page)
   - Splash with two tiles (Pictionary clickable, Esquisser disabled placeholder)
   - On click Pictionary: load CSV (pictionary_words.csv), build non-repeating random order for this session
   - Colors: use word_color (NOT card_color) for the big box; red token must be #DC143C
   - Word vertically centered in box (handled by CSS)
   - Hide hint element when empty
*/

(() => {
  // ===== Palette (token -> nice hex) =====
  const TOKEN_PALETTE = {
    yellow: "#FBBF24",
    green:  "#22C55E",
    blue:   "#60A5FA",
    red:    "#DC143C",   // REQUIRED
    purple: "#A78BFA",
    orange: "#FB923C",
    pink:   "#F472B6",
    teal:   "#2DD4BF",
    gray:   "#94A3B8",
    black:  "#0F172A",
    white:  "#E2E8F0"
  };

  const SESSION_KEY = "pictionary_session_v1";

  // ===== Dev knobs =====
  // 0.4 = 4 times out of 10
  const CHALLENGE_PROB = 0.4;
  const HIDDEN_MASK = "**********";

  function normalizeToken(x){ return String(x ?? "").trim().toLowerCase(); }
  function resolveColor(token){
    const t = normalizeToken(token);
    return TOKEN_PALETTE[t] || "#A78BFA";
  }
  function idealTextColor(hex){
    const h = hex.replace("#","").trim();
    if (h.length !== 6) return "rgba(255,255,255,0.92)";
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    const lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    return lum > 0.68 ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.92)";
  }
  function cardNumberFromId(card_id){
    const m = String(card_id).match(/C(\d+)/i);
    return m ? m[1] : card_id;
  }
  // ===== Category legend (based on your reference card) =====
  // Uses OUR CSS palette values for consistency.
  const CATEGORY_LEGEND = [
    { token: "yellow", label: "OBJET", shape: "✦" },
    { token: "blue",   label: "PERSONNE / LIEU / ANIMAL", shape: "●" },
    { token: "orange", label: "ACTION", shape: "◖" },
    { token: "green",  label: "DIFFICILE", shape: "▼" },
    { token: "red",    label: "CULTURE GÉNÉRALE", shape: "■" }
  ];

  function buildLegend(currentToken){
    if (!legendList) return;
    legendList.innerHTML = CATEGORY_LEGEND.map(item => {
      const hex = resolveColor(item.token);
      return `
        <div class="legendRow">
          <div class="legendLeft">
            <div class="legendSwatch" style="background:${hex}"></div>
            <div class="legendText">${item.label}</div>
          </div>
          <div class="legendShape">${item.shape}</div>
        </div>
      `;
    }).join("");

    const tok = normalizeToken(currentToken);
    const match = CATEGORY_LEGEND.find(x => x.token === tok);
    if (legendNote){
      legendNote.textContent = match
        ? `Couleur actuelle : ${match.label} (${tok})`
        : (tok ? `Couleur actuelle : ${tok} (catégorie inconnue)` : "Couleur actuelle : inconnue");
    }
  }

  function openInfo(){
    if (!infoModal) return;
    // Use current card's WORD color token for the explanation.
    const idx = sessionState?.order?.[sessionState.pos] ?? 0;
    const card = CARDS?.[idx];
    buildLegend(card?.card_color);
    infoModal.classList.remove("hidden");
  }

  function closeInfo(){
    if (!infoModal) return;
    infoModal.classList.add("hidden");
  }

  function getLabel(card, lang){
    const key = `label_${lang}`;
    if (card[key] && String(card[key]).trim()) return card[key];
    return card.label_fr || card.label_en || card.label_es || card.word_key || "—";
  }

  // ===== CSV parsing (robust, handles quotes/commas) =====
  function parseCSV(text){
    const rows = [];
    let row = [];
    let field = "";
    let i = 0;
    let inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i+1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      } else {
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ',') { row.push(field); field = ""; i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
        field += c; i++; continue;
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  function rowsToObjects(rows){
    if (!rows.length) return [];
    const header = rows[0].map(h => String(h || "").trim());
    const objs = [];
    for (let r = 1; r < rows.length; r++){
      const line = rows[r];
      if (!line || line.every(x => String(x ?? "").trim() === "")) continue;
      const o = {};
      for (let c = 0; c < header.length; c++){
        const key = header[c];
        if (!key) continue;
        o[key] = line[c] ?? "";
      }
      objs.push(o);
    }
    return objs;
  }

  async function loadCSV(){
    // MUST be served over http:// (local server) — file:// will usually fail
    const resp = await fetch("pictionary_words.csv", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} - ${resp.statusText}`);
    const text = await resp.text();
    const rows = parseCSV(text);
    const objs = rowsToObjects(rows);

    const cards = objs.map(o => ({
      game_id: o.game_id,
      card_id: o.card_id,
      card_color: o.card_color,
      hint: o.hint,
      word_index: o.word_index,
      word_color: o.word_color, // IMPORTANT
      word_key: o.word_key,
      label_fr: o.label_fr,
      label_es: o.label_es,
      label_en: o.label_en
    })).filter(c => String(c.card_id || "").trim() !== "");

    return cards;
  }

  // ===== Session random order (no repeats) =====
  function newShuffledIndices(n){
    const a = Array.from({length:n}, (_,i)=>i);
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function loadSessionState(){
    try{
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{
      return null;
    }
  }

  function saveSessionState(state){
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  }

  function getOrCreateSessionOrder(deckSize){
    const session = loadSessionState();
    if (session && Array.isArray(session.order) && typeof session.pos === "number"){
      if (session.order.length === deckSize) return session;
    }
    const state = { order: newShuffledIndices(deckSize), pos: 0 };
    saveSessionState(state);
    return state;
  }

  // ===== DOM =====
  const splash = document.getElementById("splash");
  const tilePictionary = document.getElementById("tilePictionary");
  const pictionaryBadge = document.getElementById("pictionaryBadge");
  const splashError = document.getElementById("splashError");

  const elCardTitle = document.getElementById("cardTitle");
  const elLabel = document.getElementById("label");
  const elHint = document.getElementById("hint");

  const wordCardEl = document.getElementById("wordCard");
  const challengeBannerEl = document.getElementById("challengeBanner");

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const langButtons = [...document.querySelectorAll(".langBtn")];

  // Info modal
  const infoBtn = document.getElementById("infoBtn");
  const infoModal = document.getElementById("infoModal");
  const infoClose = document.getElementById("infoClose");
  const legendList = document.getElementById("legendList");
  const legendNote = document.getElementById("legendNote");

  // ===== State =====
  let CARDS = [];
  let sessionState = null;
  let currentLang = "fr";
  let gameStarted = false;

  let wordHidden = false;
  let currentIsChallenge = false;

  function showError(msg){
    splashError.classList.add("show");
    splashError.innerHTML =
      `<div style="font-weight:950; margin-bottom:6px;">CSV load failed</div>
       <div style="color: rgba(255,255,255,0.82);">${escapeHtml(msg)}</div>
       <div style="margin-top:10px; color: rgba(255,255,255,0.72);">
         Put <span class="mono">pictionary_words.csv</span> next to <span class="mono">index.html</span>,
         and open via <span class="mono">http://</span> (local server), not <span class="mono">file://</span>.
       </div>`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }

  function render(){
    if (!CARDS.length){
      elCardTitle.textContent = "Carte —";
      elLabel.textContent = "—";
      elHint.textContent = "";
      elHint.style.display = "none";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      if (challengeBannerEl) challengeBannerEl.classList.add("hidden");
      return;
    }

    const idx = sessionState?.order?.[sessionState.pos] ?? 0;
    const card = CARDS[idx];

    // Dot uses card_color
    const cardHex = resolveColor(card.card_color);
    document.documentElement.style.setProperty("--dotColor", cardHex);

    // Word box uses word_color
    const wordHex = resolveColor(card.word_color);
    document.documentElement.style.setProperty("--cardColor", wordHex);
    document.documentElement.style.setProperty("--wordText", idealTextColor(wordHex));

    elCardTitle.textContent = `Carte ${cardNumberFromId(card.card_id)}`;

    // New display => word visible
    wordHidden = false;
    elLabel.textContent = getLabel(card, currentLang);

    // Hint display
    const hintText = (card.hint || "").trim();
    if (hintText){
      elHint.textContent = hintText;
      elHint.style.display = "";
    } else {
      elHint.textContent = "";
      elHint.style.display = "none";
    }

    // Challenge probability (per word display)
    currentIsChallenge = Math.random() < CHALLENGE_PROB;
    if (challengeBannerEl){
      if (currentIsChallenge) challengeBannerEl.classList.remove("hidden");
      else challengeBannerEl.classList.add("hidden");
    }

    prevBtn.disabled = (CARDS.length <= 1);
    nextBtn.disabled = (CARDS.length <= 1);
  }

  function toggleWordVisibility(){
    if (!gameStarted || !CARDS.length) return;

    const idx = sessionState?.order?.[sessionState.pos] ?? 0;
    const card = CARDS[idx];

    if (!wordHidden){
      elLabel.textContent = HIDDEN_MASK;
      wordHidden = true;
    } else {
      elLabel.textContent = getLabel(card, currentLang);
      wordHidden = false;
    }
  }

  function setLang(lang){
    currentLang = lang;
    for (const btn of langButtons){
      btn.setAttribute("aria-pressed", btn.dataset.lang === lang ? "true" : "false");
    }
    if (!gameStarted) return;
    if (wordHidden){
      elLabel.textContent = HIDDEN_MASK;
    } else {
      const idx = sessionState?.order?.[sessionState.pos] ?? 0;
      const card = CARDS[idx];
      elLabel.textContent = getLabel(card, currentLang);
    }
  }

  function prevCard(){
    if (!sessionState) return;
    sessionState.pos = (sessionState.pos - 1 + sessionState.order.length) % sessionState.order.length;
    saveSessionState(sessionState);
    render();
  }

  function nextCard(){
    if (!sessionState) return;
    sessionState.pos = (sessionState.pos + 1) % sessionState.order.length;
    saveSessionState(sessionState);
    render();
  }

  async function startPictionary(){
    try{
      splashError.classList.remove("show");
      tilePictionary.classList.add("disabled");
      pictionaryBadge.textContent = "Loading…";

      const cards = await loadCSV();
      if (!cards.length) throw new Error("CSV parsed but no cards found. Check header names and rows.");

      CARDS = cards;
      sessionState = getOrCreateSessionOrder(CARDS.length);

      gameStarted = true;
      splash.classList.add("hidden");

      render();
    }catch(e){
      tilePictionary.classList.remove("disabled");
      pictionaryBadge.textContent = "Tap to start";
      showError(e && e.message ? e.message : String(e));
    }
  }

  // ===== Events =====
  tilePictionary.addEventListener("click", startPictionary);

  prevBtn.addEventListener("click", () => { if (gameStarted) prevCard(); });
  nextBtn.addEventListener("click", () => { if (gameStarted) nextCard(); });

  langButtons.forEach(btn => btn.addEventListener("click", () => setLang(btn.dataset.lang)));

  if (infoBtn) infoBtn.addEventListener("click", () => { if (gameStarted) openInfo(); });
  if (infoClose) infoClose.addEventListener("click", closeInfo);
  if (infoModal) infoModal.addEventListener("click", (e) => { if (e.target === infoModal) closeInfo(); });

  // Keyboard for desktop testing
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeInfo(); return; }
    if (!gameStarted) return;
    if (e.key === "ArrowLeft") prevCard();
    if (e.key === "ArrowRight") nextCard();
  });

  // Init placeholders behind splash
  render();
})();
