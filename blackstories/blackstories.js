/* blackstories.js
  Expects these files in the SAME folder:
  - ./black_stories_fr.json
  - ./black_stories_en.json
  - ./black_stories_es.json

  Each file can be either:
  A) { "stories": [ {id,title,short_story,full_story}, ... ] }
  OR
  B) [ {id,title,short_story,full_story}, ... ]

  Required fields per story:
  - title
  - short_story
  - full_story
  - id (recommended; if missing we generate one)
*/

const els = {
  title: document.getElementById("title"),
  shortStory: document.getElementById("shortStory"),
  fullStory: document.getElementById("fullStory"),
  revealBox: document.getElementById("revealBox"),
  revealHint: document.getElementById("revealHint"),
  toggleRevealBtn: document.getElementById("toggleRevealBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  storyCounter: document.getElementById("storyCounter"),
  storyId: document.getElementById("storyId"),
  langBtns: Array.from(document.querySelectorAll(".langBtn")),
};

const FILES = {
  fr: "./black_stories_fr.json",
  en: "./black_stories_en.json",
  es: "./black_stories_es.json",
};

let DATA = { fr: [], en: [], es: [] };

let currentLang = "fr";
let revealed = false;

// History as indices in DATA[currentLang]
let history = [];
let historyPos = -1;

function normalizeLang(lang) {
  const l = (lang || "").toLowerCase().trim();
  return (l === "fr" || l === "en" || l === "es") ? l : "fr";
}

function setLangUI(lang) {
  currentLang = normalizeLang(lang);
  localStorage.setItem("blackstories_lang", currentLang);

  els.langBtns.forEach(btn => {
    const isActive = normalizeLang(btn.dataset.lang) === currentLang;
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setReveal(state) {
  revealed = !!state;
  els.fullStory.classList.toggle("hidden", !revealed);
  els.revealHint.textContent = revealed
    ? "Touchez pour cacher l’histoire complète"
    : "Touchez pour révéler l’histoire complète";
  els.toggleRevealBtn.textContent = revealed ? "Cacher" : "Révéler";
  els.toggleRevealBtn.setAttribute("aria-expanded", revealed ? "true" : "false");
}

function safeText(x) {
  return (typeof x === "string") ? x : "";
}

function getStories() {
  return DATA[currentLang] || [];
}

function ensureIds(stories, lang) {
  return stories.map((s, i) => {
    const id = (s && (s.id ?? s.story_id ?? s._id)) ?? `${lang}-${i+1}`;
    return {
      id: String(id),
      title: safeText(s?.title),
      short_story: safeText(s?.short_story ?? s?.short ?? s?.story_short),
      full_story: safeText(s?.full_story ?? s?.full ?? s?.story_full),
    };
  }).filter(s => s.title || s.short_story || s.full_story);
}

function renderByIndex(idx) {
  const stories = getStories();
  const story = stories[idx];

  if (!story) {
    els.title.textContent = "Aucune histoire";
    els.shortStory.textContent = "Tes fichiers JSON sont vides ou introuvables.";
    els.fullStory.textContent = "";
    els.storyCounter.textContent = `0 stories (${currentLang.toUpperCase()})`;
    els.storyId.textContent = "ID: —";
    els.prevBtn.disabled = true;
    els.nextBtn.disabled = true;
    setReveal(false);
    return;
  }

  els.title.textContent = story.title || "Sans titre";
  els.shortStory.textContent = story.short_story || "—";
  els.fullStory.textContent = story.full_story || "—";

  const total = stories.length;
  els.storyCounter.textContent = `${total} stories (${currentLang.toUpperCase()})`;
  els.storyId.textContent = `ID: ${story.id ?? "—"}`;

  els.prevBtn.disabled = historyPos <= 0;
  els.nextBtn.disabled = total <= 1; // still allow next for random, but if only 1 story, pointless

  setReveal(false);
}

function pickRandomIndexAvoiding(currentIdx) {
  const stories = getStories();
  const n = stories.length;
  if (n <= 1) return 0;

  let tries = 0;
  while (tries < 20) {
    const idx = Math.floor(Math.random() * n);
    if (idx !== currentIdx) return idx;
    tries++;
  }
  // fallback
  return (currentIdx + 1) % n;
}

function goNext() {
  const stories = getStories();
  if (!stories.length) return;

  // if we're not at the end of history, truncate (classic browser behavior)
  if (historyPos < history.length - 1) {
    history = history.slice(0, historyPos + 1);
  }

  const currentIdx = (historyPos >= 0) ? history[historyPos] : null;
  const nextIdx = pickRandomIndexAvoiding(currentIdx);

  history.push(nextIdx);
  historyPos = history.length - 1;
  renderByIndex(nextIdx);
}

function goPrev() {
  if (historyPos <= 0) return;
  historyPos -= 1;
  renderByIndex(history[historyPos]);
}

async function loadOne(lang, url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const json = await res.json();

  let stories = [];
  if (Array.isArray(json)) stories = json;
  else if (json && Array.isArray(json.stories)) stories = json.stories;
  else if (json && Array.isArray(json.stories_list)) {
    // if you ever accidentally give the old format, we try to salvage it
    const block = json.stories_list.find(x => normalizeLang(x.language) === lang);
    stories = block?.stories || [];
  }

  return ensureIds(stories, lang);
}

async function loadAll() {
  const langs = ["fr", "en", "es"];
  const results = await Promise.allSettled(langs.map(l => loadOne(l, FILES[l])));

  results.forEach((r, i) => {
    const lang = langs[i];
    if (r.status === "fulfilled") {
      DATA[lang] = r.value;
    } else {
      // If you mess up filenames or JSON, you’ll see it immediately.
      console.error(`Failed loading ${lang}:`, r.reason);
      DATA[lang] = [];
    }
  });
}

function resetHistoryAndStart() {
  history = [];
  historyPos = -1;

  const stories = getStories();
  if (!stories.length) {
    renderByIndex(-1);
    return;
  }

  // start with a random story
  const first = Math.floor(Math.random() * stories.length);
  history.push(first);
  historyPos = 0;
  renderByIndex(first);
}

function bindEvents() {
  els.langBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      setLangUI(btn.dataset.lang);
      resetHistoryAndStart();
    });
  });

  els.revealBox.addEventListener("click", () => setReveal(!revealed));
  els.toggleRevealBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setReveal(!revealed);
  });

  els.nextBtn.addEventListener("click", goNext);
  els.prevBtn.addEventListener("click", goPrev);

  // Optional: keyboard navigation
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  });
}

async function init() {
  const savedLang = localStorage.getItem("blackstories_lang");
  setLangUI(savedLang || "fr");

  bindEvents();
  await loadAll();
  resetHistoryAndStart();
}

init();
