// Oh les mains (sans timer)
// CSV format: theme,type,word
// - type = 1|2|3 -> mots
// - type = gage  -> gages liés au thème
// word toujours entre guillemets pour gérer les virgules.

const THEMES = [
  { id: "olemots",  name: "Olémots",  color: "#2ecc71" }, // VERT
  { id: "olemimes", name: "Olémimes", color: "#ff7a00" }, // ORANGE
  { id: "olesons",  name: "Olésons",  color: "#ff4fa3" }, // ROSE
];

const state = {
  // mots: key = `${theme}|${points}` -> words[]
  words: new Map(),

  // gages: key = theme -> gages[]
  gages: new Map(),

  selectedTheme: null,     // theme id
  selectedType: null,      // "1" | "2" | "3" (points)
  bag: [],                 // tirage aléatoire sans répétition pour mots

  // gage courant: doit rester le même pour (theme|points)
  gageByThemeType: new Map(), // key = `${theme}|${points}` -> gage string
  currentGage: null,

  tries: 0,                // tentatives (passer + trouvé)
  found: 0,                // trouvés
  points: 0,               // points gagnés (trouvé => +points carte)
};

const $ = (id) => document.getElementById(id);

// ----------------------- utils -----------------------

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// CSV parser (gère guillemets + virgules + "" pour quote échappé)
function parseCSV(text){
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++){
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes){
      if (c === '"' && next === '"'){ // escaped quote
        cur += '"';
        i++;
      } else if (c === '"'){
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"'){
        inQuotes = true;
      } else if (c === ","){
        row.push(cur);
        cur = "";
      } else if (c === "\n"){
        row.push(cur);
        cur = "";
        if (row.some(v => v.trim() !== "")) rows.push(row.map(v => v.trim()));
        row = [];
      } else if (c === "\r"){
        // ignore
      } else {
        cur += c;
      }
    }
  }

  row.push(cur);
  if (row.some(v => v.trim() !== "")) rows.push(row.map(v => v.trim()));
  return rows;
}

function setView(view){
  $("setupView").classList.toggle("hidden", view !== "setup");
  $("playView").classList.toggle("hidden", view !== "play");
}

function refreshStartEnabled(){
  $("btnStart").disabled = !(state.selectedTheme && state.selectedType);
}

function getKeyThemeType(){
  return `${state.selectedTheme}|${state.selectedType}`;
}

function getTypePoints(){
  return Number(state.selectedType || 0);
}

function updateScoreUI(){
  $("foundCount").textContent = String(state.found);
  $("tryCount").textContent = String(state.tries);
  $("pointsCount").textContent = String(state.points);
}

// ----------------------- CSV load -----------------------

async function loadWords(){
  const res = await fetch("words.csv", { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de charger words.csv");
  const text = await res.text();

  const rows = parseCSV(text);
  if (!rows.length) throw new Error("CSV vide");

  const header = rows.shift().map(h => h.toLowerCase());
  const idxTheme = header.indexOf("theme");
  const idxType  = header.indexOf("type");
  const idxWord  = header.indexOf("word");

  if (idxTheme < 0 || idxType < 0 || idxWord < 0){
    throw new Error("CSV: colonnes attendues: theme,type,word");
  }

  state.words.clear();
  state.gages.clear();

  for (const r of rows){
    const theme = (r[idxTheme] || "").trim();
    const type  = (r[idxType]  || "").trim();
    const word  = (r[idxWord]  || "").trim();

    if (!theme || !type || !word) continue;

    if (type === "gage"){
      if (!state.gages.has(theme)) state.gages.set(theme, []);
      state.gages.get(theme).push(word);
    } else {
      // type doit être 1/2/3
      if (!["1","2","3"].includes(type)) continue;
      const key = `${theme}|${type}`;
      if (!state.words.has(key)) state.words.set(key, []);
      state.words.get(key).push(word);
    }
  }
}

// ----------------------- Theme/Type selection UI -----------------------

function renderThemes(){
  const wrap = $("themeRow");
  wrap.innerHTML = "";

  for (const t of THEMES){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "themeBtn";
    btn.dataset.theme = t.id;

    btn.innerHTML = `
      <div class="left">
        <span class="themeSwatch" style="background:${t.color}"></span>
        <span>${t.name}</span>
      </div>
      <span class="check">✓</span>
    `;

    btn.addEventListener("click", () => {
      state.selectedTheme = t.id;

      // Reset type selection when changing theme
      state.selectedType = null;
      state.bag = [];
      state.currentGage = null;

      // UI active state theme
      [...wrap.querySelectorAll(".themeBtn")]
        .forEach(b => b.classList.toggle("active", b.dataset.theme === t.id));

      // UI reset type
      [...document.querySelectorAll(".typeBtn")].forEach(b => b.classList.remove("active"));

      $("typeHint").textContent = "Choisis 1 / 2 / 3 points.";
      refreshStartEnabled();
    });

    wrap.appendChild(btn);
  }
}

function wireTypeButtons(){
  document.querySelectorAll(".typeBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!state.selectedTheme){
        $("typeHint").textContent = "Non. D’abord le thème.";
        return;
      }

      state.selectedType = btn.dataset.type;
      state.bag = [];

      // UI active type
      document.querySelectorAll(".typeBtn")
        .forEach(b => b.classList.toggle("active", b.dataset.type === state.selectedType));

      refreshStartEnabled();
    });
  });
}

// ----------------------- Gameplay -----------------------

function refillBag(){
  const key = getKeyThemeType();
  const list = state.words.get(key) || [];
  state.bag = shuffle([...list]);
}

function nextWord(){
  if (state.bag.length === 0) refillBag();
  if (state.bag.length === 0) return "Aucun mot pour ce thème/valeur.";
  return state.bag.pop();
}

function pickGageForCurrentThemeType(){
  const key = getKeyThemeType();

  // if already picked for this (theme|points), reuse it
  if (state.gageByThemeType.has(key)){
    return state.gageByThemeType.get(key);
  }

  // pick random from theme gages
  const gList = state.gages.get(state.selectedTheme) || [];
  const gage = gList.length
    ? gList[Math.floor(Math.random() * gList.length)]
    : "Aucun gage pour ce thème.";

  state.gageByThemeType.set(key, gage);
  return gage;
}

function applyPlayHeader(){
  const theme = THEMES.find(t => t.id === state.selectedTheme);
  const color = theme?.color || "#60a5fa";
  const pts = getTypePoints();

  $("pillTheme").textContent = theme ? theme.name : "Thème";
  $("pillTheme").style.borderColor = color;
  $("pillTheme").style.background = `${color}22`;

  $("pillType").textContent = `${pts} point${pts > 1 ? "s" : ""}`;
  $("pillType").style.borderColor = "rgba(255,255,255,.18)";
  $("pillType").style.background = "rgba(255,255,255,.06)";

  $("wordCard").style.borderColor = `${color}66`;

  const count = (state.words.get(getKeyThemeType()) || []).length;
  $("stockInfo").textContent = `${count} mot(s) dispo`;
}

function startGame(){
  // reset counters for this run
  state.tries = 0;
  state.found = 0;
  state.points = 0;
  updateScoreUI();

  // reset bag for the selected (theme|points)
  state.bag = [];

  // set gage for this (theme|points)
  state.currentGage = pickGageForCurrentThemeType();
  $("gageText").textContent = state.currentGage;

  applyPlayHeader();

  $("wordValue").textContent = nextWord();
  setView("play");
}

function onFound(){
  state.tries += 1;
  state.found += 1;
  state.points += getTypePoints();
  updateScoreUI();
  $("wordValue").textContent = nextWord();
}

function onSkip(){
  state.tries += 1;
  // points unchanged
  updateScoreUI();
  $("wordValue").textContent = nextWord();
}

// ----------------------- Reset / Change -----------------------

function resetAll(){
  state.selectedTheme = null;
  state.selectedType = null;
  state.bag = [];
  state.currentGage = null;

  state.tries = 0;
  state.found = 0;
  state.points = 0;
  updateScoreUI();

  // NOTE: on ne vide PAS gageByThemeType ici, car tu as demandé que
  // le gage reste le même pour un (thème/points) donné tant que tu joues.
  // Si tu veux réinitialiser les gages aussi, on le fera via le bouton reset confirm.

  document.querySelectorAll(".themeBtn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".typeBtn").forEach(b => b.classList.remove("active"));

  $("typeHint").textContent = "Sélectionne un thème d’abord.";
  $("gageText").textContent = "—";

  refreshStartEnabled();
  setView("setup");
}

function hardResetEverything(){
  // reset selection + scores + memory of gages
  state.gageByThemeType.clear();
  resetAll();
}

// ----------------------- Wire UI -----------------------

function wireUI(){
  wireTypeButtons();

  $("btnStart").addEventListener("click", startGame);
  $("btnNext").addEventListener("click", onFound);
  $("btnSkip").addEventListener("click", onSkip);

  $("btnChange").addEventListener("click", () => setView("setup"));

  $("btnReset").addEventListener("click", () => {
    if (confirm("Tout réinitialiser (sélection + score + gages) ?")) {
      hardResetEverything();
    }
  });
}

// ----------------------- Init -----------------------

(async function init(){
  try{
    renderThemes();
    wireUI();
    await loadWords();
    resetAll();
  } catch (err){
    console.error(err);
    alert("Erreur: " + (err?.message || err));
  }
})();
