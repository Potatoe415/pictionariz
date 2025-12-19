// game.js


let bag = [];
let tries = 0, found = 0, pointsTotal = 0;
let currentLang = "fr"; // "fr" | "en"
let currentWord = null;
let currentGage = null;

let wordsMap = null;
let gagesMap = null;

function getLabel(item){
  return currentLang === "en" ? (item.en || item.fr) : item.fr;
}

function keyFor(config){ return `${config.theme}|${config.points}`; }

function updateScore(){
  $("tryCount").textContent = String(tries);
  $("foundCount").textContent = String(found);
  $("pointsCount").textContent = String(pointsTotal);
}

function refillBag(config){
  const list = wordsMap.get(keyFor(config)) || [];
  bag = shuffle([...list]);
}

function nextWord(config){
  if (bag.length === 0) refillBag(config);
  if (bag.length === 0) {
    return { fr: "Aucun mot", en: "No word available" };
  }
  return bag.pop();
}

function getThemeMeta(themeId){
  return OHM_THEMES.find(t => t.id === themeId) || { name: "Thème", color: "#60a5fa" };
}

function getOrPickGage(config){
  const key = "ohm_gage_" + `${config.theme}|${config.points}`;

  const existing = sessionStorage.getItem(key);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      // si c'est déjà un objet {fr,en}, parfait
      if (parsed && typeof parsed === "object") return parsed;
      // si c'était un JSON string, on l'enveloppe
      return { fr: String(parsed), en: String(parsed) };
    } catch {
      // ancienne valeur stockée en texte brut -> on l'enveloppe et on migre
      const migrated = { fr: existing, en: existing };
      sessionStorage.setItem(key, JSON.stringify(migrated));
      return migrated;
    }
  }

  const list = gagesMap.get(config.theme) || [];
  const g = list.length
    ? list[Math.floor(Math.random() * list.length)]
    : { fr: "Aucun gage pour ce thème.", en: "No dare for this theme." };

  sessionStorage.setItem(key, JSON.stringify(g));
  return g;
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

  const count = (wordsMap.get(keyFor(config)) || []).length;
  $("stockInfo").textContent = `${count} mot(s) dispo`;
}

(async function init(){
  const config = loadConfigFromSession();
  if (!config || !config.theme || !config.points){
    window.location.href = "oleconfig.html";
    return;
  }
  
  currentGage = pickRandomGage(config.theme);
renderCurrentGage();

  // load CSV
  try{
    const data = await loadOHMCSV();
    wordsMap = data.words;
    gagesMap = data.gages;
	if (!wordsMap || !gagesMap) {
  throw new Error("CSV chargé mais maps invalides (words/gages manquants).");
}
  } catch (e){
    console.error(e);
    alert("Erreur CSV: " + (e?.message || e));
    window.location.href = "oleconfig.html";
    return;
  }
  


  // init game state for this run
  bag = [];
  tries = 0; found = 0; pointsTotal = 0;
  updateScore();

  applyHeader(config);

  // gage stable for theme/points
  currentGage = getOrPickGage(config);
$("gageText").textContent = (currentLang === "en" ? (currentGage.en || currentGage.fr) : currentGage.fr);

  //$("gageText").textContent = getOrPickGage(config);

  // first word
  const w = nextWord(config);
currentWord = nextWord(config);
$("wordValue").textContent = currentLang === "en"
  ? (currentWord.en || currentWord.fr)
  : currentWord.fr;

  $("btnFound").addEventListener("click", () => {
    tries += 1;
    found += 1;
    pointsTotal += Number(config.points);
    updateScore();
    const w = nextWord(config);
currentWord = nextWord(config);
$("wordValue").textContent = currentLang === "en"
  ? (currentWord.en || currentWord.fr)
  : currentWord.fr;
  });

  $("btnSkip").addEventListener("click", () => {
    tries += 1; // 0 point
    updateScore();
    const w = nextWord(config);
currentWord = nextWord(config);
$("wordValue").textContent = currentLang === "en"
  ? (currentWord.en || currentWord.fr)
  : currentWord.fr;
  });

  $("btnBack").addEventListener("click", () => {
    window.location.href = "oleconfig.html";
  });
  
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


function pickRandomGage(theme){
  const list = (gagesMap && gagesMap.get(theme)) ? gagesMap.get(theme) : [];
  if (!list.length) {
    return { fr: "Aucun gage pour ce thème.", en: "No dare for this theme." };
  }
  return list[Math.floor(Math.random() * list.length)];
}

function renderCurrentWord(){
  if (!currentWord) return;
  $("wordValue").textContent =
    currentLang === "en"
      ? (currentWord.en || currentWord.fr)
      : currentWord.fr;
}

function renderCurrentGage(){
  if (!currentGage) return;
  $("gageText").textContent =
    currentLang === "en"
      ? (currentGage.en || currentGage.fr)
      : currentGage.fr;
}
