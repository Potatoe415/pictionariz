// shared.js

const OHM_THEMES = [
{ id: "olemots",  name: "Olémots",  color: "#2ecc71" },
  { id: "olemimes", name: "Olémimes", color: "#ff7a00" },
  
  { id: "olesons",  name: "Olésons",  color: "#ff4fa3" },
];

function $(id){ return document.getElementById(id); }

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// CSV parser (guillemets + virgules + "" échappé)
function parseCSV(text){
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++){
    const c = text[i];
    const next = text[i+1];

    if (inQuotes){
      if (c === '"' && next === '"'){ cur += '"'; i++; }
      else if (c === '"'){ inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === '"'){ inQuotes = true; }
      else if (c === ","){ row.push(cur); cur = ""; }
      else if (c === "\n"){
        row.push(cur); cur = "";
        if (row.some(v => v.trim() !== "")) rows.push(row.map(v => v.trim()));
        row = [];
      } else if (c === "\r"){ /* ignore */ }
      else { cur += c; }
    }
  }
  row.push(cur);
  if (row.some(v => v.trim() !== "")) rows.push(row.map(v => v.trim()));
  return rows;
}
async function loadOHMCSV(){
  const res = await fetch("olemains_words.csv", { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de charger olemains_words.csv");
  const text = await res.text();

  const rows = parseCSV(text);
  if (!rows.length) throw new Error("CSV vide");

  const header = rows.shift().map(h => h.toLowerCase());

  const idxTheme  = header.indexOf("theme");
  const idxPoints = header.indexOf("points");
  const idxFR     = header.indexOf("label_fr");
  const idxEN     = header.indexOf("label_en");
  const idxES     = header.indexOf("label_es");

  if ([idxTheme, idxPoints, idxFR, idxEN, idxES].some(i => i < 0)){
    throw new Error("CSV: colonnes attendues: theme,points,label_fr,label_en,label_es");
  }

  const words = new Map(); // `${theme}|${points}` -> [{fr,en,es}]
  const gages = new Map(); // theme -> [{fr,en,es}]

  for (const r of rows){
    const theme = (r[idxTheme] || "").trim();
    const ptsRaw = (r[idxPoints] || "").trim();
    if (!theme || ptsRaw === "") continue;

    const points = Number(ptsRaw);
    const item = {
      fr: ((r[idxFR] || "").trim()),
      en: ((r[idxEN] || "").trim()),
      es: ((r[idxES] || "").trim()),
    };

    if (points === 0){
      if (!gages.has(theme)) gages.set(theme, []);
      gages.get(theme).push(item);
      continue;
    }

    if ([1,2,3].includes(points)){
      const key = `${theme}|${points}`;
      if (!words.has(key)) words.set(key, []);
      words.get(key).push(item);
    }
  }

  return { words, gages };
}




function saveConfigToSession(config){
  sessionStorage.setItem("ohm_config", JSON.stringify(config));
}
function loadConfigFromSession(){
  const raw = sessionStorage.getItem("ohm_config");
  return raw ? JSON.parse(raw) : null;
}
