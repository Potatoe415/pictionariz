// game.js (updated)

// ---- state ----
let bag = [];
let tries = 0, found = 0, pointsTotal = 0;

let currentLang = "fr"; // "fr" | "en" | "es"
let currentWord = null; // {fr,en,es}
let currentGage = null; // {fr,en,es}

let wordsMap = null; // Map key `${theme}|${points}` -> [{fr,en,es}]
let gagesMap = null; // Map key `theme` -> [{fr,en,es}]

// ---- helpers ----

function lastGageKey(config){
  return `ohm_last_gage_${config.theme}|${config.points}`;
}


function keyFor(config) { return `${config.theme}|${config.points}`; }



function pickLabel(item){
  if (!item) return "";
  const v = (item[currentLang] || "").trim();
  if (v) return v;

  // fallback chain: FR -> EN -> ES -> any stringy value
  return (item.fr || item.en || item.es || "").toString();
}

function updateScore(){
  $("tryCount").textContent = String(tries);
  $("foundCount").textContent = String(found);
  $("pointsCount").textContent = String(pointsTotal);
}

function refillBag(config){
  const list = (wordsMap && wordsMap.get(keyFor(config))) ? wordsMap.get(keyFor(config)) : [];
  bag = shuffle([...list]);
}

function nextWord(config){
  if (bag.length === 0) refillBag(config);
  if (bag.length === 0){
    return { fr: "Aucun mot", en: "No word available", es: "No hay palabra disponible" };
  }
  return bag.pop();
}

function getThemeMeta(themeId){
  return OHM_THEMES.find(t => t.id === themeId) || { name: "Thème", color: "#60a5fa" };
}

function pickRandomGage(theme, config){
  const list = (gagesMap && gagesMap.get(theme)) ? gagesMap.get(theme) : [];
  if (!list.length){
    return { fr: "Aucun gage pour ce thème.", en: "No dare for this theme.", es: "No hay reto para este tema." };
  }

  // Si 1 seul gage, pas de miracle
  if (list.length === 1) return list[0];

  // Eviter de reprendre le même gage que la dernière partie (même theme|points)
  const k = lastGageKey(config);
  const lastRaw = sessionStorage.getItem(k);
  const last = lastRaw ? lastRaw : null;

  // essaye quelques tirages
  let chosen = list[Math.floor(Math.random() * list.length)];
  for (let i = 0; i < 10; i++){
    const candidate = list[Math.floor(Math.random() * list.length)];
    const candKey = candidate.fr || candidate.en || candidate.es || "";
    if (!last || candKey !== last){
      chosen = candidate;
      break;
    }
  }

  // mémorise le dernier gage (clé texte stable)
  const chosenKey = chosen.fr || chosen.en || chosen.es || "";
  sessionStorage.setItem(k, chosenKey);

  return chosen;
}


function renderCurrentWord(){
  $("wordValue").textContent = pickLabel(currentWord);
}

function renderCurrentGage(){
  $("gageText").textContent = pickLabel(currentGage);
}

function applyHeader(config){
  const meta = getThemeMeta(config.theme);
  const p = Number(config.points);

  $("pillTheme").textContent = meta.name;
  $("pillTheme").style.borderColor = meta.color;
  $("pillTheme").style.background = `${meta.color}22`;

  $("pillPoints").textContent = `${p} point${p > 1 ? "s" : ""}`;
  $("pillPoints").style.borderColor = "rgba(255,255,255,.18)";
  $("pillPoints").style.background = "rgba(255,255,255,.06)";

  $("wordCard").style.borderColor = `${meta.color}66`;

  const count = (wordsMap && wordsMap.get(keyFor(config))) ? wordsMap.get(keyFor(config)).length : 0;
  $("stockInfo").textContent = `${count} mot(s) dispo`;
}

// ---- init ----
(async function init(){
  const config = loadConfigFromSession();
  if (!config || !config.theme || !config.points){
    window.location.href = "oleconfig.html";
    return;
  }

  // Load CSV first (so maps exist)
  try{
    const data = await loadOHMCSV();
    wordsMap = data.words;
    gagesMap = data.gages;

    if (!wordsMap || !gagesMap){
      throw new Error("CSV chargé mais maps invalides (words/gages manquants).");
    }
  } catch (e){
    console.error(e);
    alert("Erreur CSV: " + (e?.message || e));
    window.location.href = "oleconfig.html";
    return;
  }

  // Reset run state
  bag = [];
  tries = 0;
  found = 0;
  pointsTotal = 0;
  updateScore();

  applyHeader(config);

  // IMPORTANT: gage changes every start (no sessionStorage)
  currentGage = pickRandomGage(config.theme, config);

  renderCurrentGage();

  // First word
  currentWord = nextWord(config);
  renderCurrentWord();

  // Buttons
  $("btnFound").addEventListener("click", () => {
    tries += 1;
    found += 1;
    pointsTotal += Number(config.points);
    updateScore();

    currentWord = nextWord(config);
    renderCurrentWord();
  });

  $("btnSkip").addEventListener("click", () => {
    tries += 1; // 0 point on skip
    updateScore();

    currentWord = nextWord(config);
    renderCurrentWord();
  });

  $("btnBack").addEventListener("click", () => {
    window.location.href = "oleconfig.html";
  });

  // Language buttons: ONLY re-render (never draw a new word)
  document.querySelectorAll(".langBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentLang = btn.dataset.lang;

      document.querySelectorAll(".langBtn")
        .forEach(b => b.classList.toggle("active", b.dataset.lang === currentLang));

      renderCurrentWord();
      renderCurrentGage();
    });
  });
})();
