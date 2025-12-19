(() => {
  // ===== Dev knobs =====
  //const CSV_FILE = "pictionary_words.csv";
  const CHALLENGE_PROB = 0.4;           // 0.4 = 4 times out of 10
  const HIDDEN_MASK = "**********";
  const DOUBLE_TAP_DELAY = 300;         // ms
 
  
  const GAME_CONFIGS = {
  pictionary: {
    title: "Pictionary",
    csv: "pictionary_words.csv",
    topImage: "pictionary_top.jpg",
	hasChallenge: true
  },
  esquisse: {
    title: "Esquisse",
    csv: "esquisse_words.csv",
    topImage: "esquisse_top.jpg",
	hasChallenge: false
  }
};




  // ===== Palette (token -> hex) =====
  // red MUST be DC143C for the deck; challenge outline uses #c8102e in CSS.
  const TOKEN_PALETTE = {
    yellow: "#FBBF24",
    green:  "#22C55E",
    blue:   "#60A5FA",
    red:    "#DC143C",
    purple: "#A78BFA",
    orange: "#FB923C",
    pink:   "#F472B6",
    teal:   "#2DD4BF",
    gray:   "#94A3B8",
    black:  "#0F172A",
    white:  "#E2E8F0"
  };

  // Legend (based on your reference card) — driven by card_color (category)
  const CATEGORY_LEGEND = [
    { token: "yellow", label: "OBJET", shape: "✦" },
    { token: "blue",   label: "PERSONNE / LIEU / ANIMAL", shape: "●" },
    { token: "orange", label: "ACTION", shape: "◖" },
    { token: "green",  label: "DIFFICILE", shape: "▼" },
    { token: "red",    label: "CULTURE GÉNÉRALE", shape: "■" }
  ];

  // ===== DOM =====
  const elCardTitle = document.getElementById("cardTitle");
  const elLabel = document.getElementById("label");
  const elHint = document.getElementById("hint");
  const wordCardEl = document.getElementById("wordCard");
  const challengeBannerEl = document.getElementById("challengeBanner");

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const langButtons = [...document.querySelectorAll(".langBtn")];

  const infoBtn = document.getElementById("infoBtn");
  const infoModal = document.getElementById("infoModal");
  const infoClose = document.getElementById("infoClose");
  const legendList = document.getElementById("legendList");
  const legendNote = document.getElementById("legendNote");

  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingError = document.getElementById("loadingError");

  // ===== State =====
  let CARDS = [];
  let order = [];
  let pos = 0;
  let currentLang = "fr";
  let wordHidden = false;
  let lastTapTime = 0;
  
  function getGameKey(){
  const params = new URLSearchParams(window.location.search);
  return params.get("game") || "pictionary";
}

const GAME_KEY = getGameKey();
const GAME = GAME_CONFIGS[GAME_KEY] || GAME_CONFIGS.pictionary;

  function normalizeToken(x){ return String(x ?? "").trim().toLowerCase(); }
  function resolveColor(token){
    const t = normalizeToken(token);
    return TOKEN_PALETTE[t] || "#A78BFA";
  }
  function idealTextColor(hex){
    const h = String(hex || "").replace("#","").trim();
    if (h.length !== 6) return "rgba(255,255,255,0.92)";
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    const lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    return lum > 0.68 ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.92)";
  }
  function cardNumberFromId(card_id){
    const m = String(card_id).match(/C(\d+)/i);
    return m ? m[1] : (card_id || "—");
  }
  function getLabel(card, lang){
    const key = `label_${lang}`;
    const v = card?.[key];
    if (v && String(v).trim()) return v;
    return card?.label_fr || card?.label_en || card?.label_es || card?.word_key || "—";
  }

  // Robust CSV parser (quotes + commas)
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
      // skip empty rows
      if (!line || line.every(x => String(x ?? "").trim() === "")) continue;
      const o = {};
      for (let c = 0; c < header.length; c++){
        const key = header[c];
        if (!key) continue;
        o[key] = line[c] ?? "";
      }
      // skip rows with no card_id at all
      if (!String(o.card_id || "").trim()) continue;
      objs.push(o);
    }
    return objs;
  }

  async function loadCSV(){
    const resp = await fetch(CSV_FILE, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Cannot load ${CSV_FILE} (HTTP ${resp.status})`);
    const text = await resp.text();
    const rows = parseCSV(text);
    return rowsToObjects(rows);
  }

  function fisherYates(n){
    const a = Array.from({length:n}, (_,i)=>i);
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

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
        ? `Couleur actuelle : ${match.label}   -   Double tap on word to hide it`
        : (tok ? `Couleur actuelle : ${tok} (catégorie inconnue)` : "Couleur actuelle : inconnue");
    }

  }

  function openInfo(){
    const card = CARDS[order[pos]];
    buildLegend(card?.card_color);
    infoModal?.classList.remove("hidden");
  }
  function closeInfo(){
    infoModal?.classList.add("hidden");
  }

  function render(){
    if (!CARDS.length) return;

    const card = CARDS[order[pos]];

    // Dot uses card_color; Word box uses word_color
    const cardHex = resolveColor(card.card_color);
    const wordHex = resolveColor(card.word_color);
    document.documentElement.style.setProperty("--dotColor", cardHex);
    document.documentElement.style.setProperty("--cardColor", wordHex);
    document.documentElement.style.setProperty("--wordText", idealTextColor(wordHex));

    elCardTitle.textContent = `Carte ${cardNumberFromId(card.card_id)}`;

    // Word visible by default on each render
    wordHidden = false;
    elLabel.textContent = getLabel(card, currentLang);

    // Hint: hide if empty
    const hintText = String(card.hint || "").trim();
    if (hintText){
      elHint.textContent = hintText;
      elHint.style.display = "";
    } else {
      elHint.textContent = "";
      elHint.style.display = "none";
    }

    // Challenge roll (independent each time a word is displayed)
    const isChallenge = Math.random() < CHALLENGE_PROB;
    if (challengeBannerEl){
  if (GAME.hasChallenge && Math.random() < CHALLENGE_PROB){
    challengeBannerEl.classList.remove("hidden");
  } else {
    challengeBannerEl.classList.add("hidden");
  }
}
  }

  function setLang(lang){
    currentLang = lang;
    for (const btn of langButtons){
      btn.setAttribute("aria-pressed", btn.dataset.lang === lang ? "true" : "false");
    }
    // Update label only (do not re-roll challenge)
    const card = CARDS[order[pos]];
    elLabel.textContent = wordHidden ? HIDDEN_MASK : getLabel(card, currentLang);
  }

  function prev(){
    pos = (pos - 1 + order.length) % order.length;
    render();
  }
  function next(){
    pos = (pos + 1) % order.length;
    render();
  }

  function toggleWord(){
    const card = CARDS[order[pos]];
    if (!wordHidden){
      elLabel.textContent = HIDDEN_MASK;
      wordHidden = true;
    } else {
      elLabel.textContent = getLabel(card, currentLang);
      wordHidden = false;
    }
  }

  // Double-tap on word card toggles mask
  function onWordCardPointerUp(e){
    const target = e.target.closest("#wordCard");
    if (!target) return;

    const now = Date.now();
    const delta = now - lastTapTime;

    if (delta > 0 && delta < DOUBLE_TAP_DELAY){
      toggleWord();
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  }

  function showLoadingError(msg){
    if (!loadingError) return;
    loadingError.classList.remove("hidden");
    loadingError.innerHTML = `
      <div style="font-weight:950; margin-bottom:6px;">CSV load failed</div>
      <div>${escapeHtml(msg)}</div>
      <div style="margin-top:10px; opacity:0.85;">
        Make sure you run a local web server (not file://). Example:
        <div class="mono" style="margin-top:6px;">py -m http.server 8080</div>
      </div>
    `;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }

  async function init(){
    try{
      // wire events
      prevBtn?.addEventListener("click", prev);
      nextBtn?.addEventListener("click", next);
      langButtons.forEach(btn => btn.addEventListener("click", () => setLang(btn.dataset.lang)));

      infoBtn?.addEventListener("click", openInfo);
      infoClose?.addEventListener("click", closeInfo);
      infoModal?.addEventListener("click", (e) => { if (e.target === infoModal) closeInfo(); });
      window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeInfo(); });

      wordCardEl?.addEventListener("pointerup", onWordCardPointerUp);

      // load deck
      const cards = await loadCSV();
      CARDS = cards;
      order = fisherYates(CARDS.length);
      pos = 0;

      // render first
      render();

      // hide loading
      loadingOverlay?.classList.add("hidden");
    }catch(err){
      showLoadingError(err?.message || String(err));
    }
  }



const topImg = document.getElementById("topImg");
if (topImg) topImg.src = GAME.topImage;

function getGameKey(){
  const params = new URLSearchParams(window.location.search);
  return params.get("game") || "pictionary";
}

 
  document.title = GAME.title;
const CSV_FILE = GAME.csv;


  init();
})();