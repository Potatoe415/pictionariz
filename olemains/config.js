// config.js

const state = { theme: null, points: null };

const TYPE_LABELS = {
  olemimes: {
    1: "Action (1 pt)",
    2: "Sport (2 pts)",
    3: "Musique (3 pts)",
  },
  olemots: {
    1: "Douce France (1 pts)",
    2: "Graines de Star (2 pts)",
    3: "Marques (3 pts)",
  },
  olesons: {
    1: "Chansons (1 pts)",
    2: "Imitation (2 pts)",
    3: "Finis les paroles (3 pts)",
  }
};

function applyTypeLabels(themeId){
  const map = TYPE_LABELS[themeId] || {};
  document.querySelectorAll(".typeBtn").forEach(btn => {
    const p = btn.dataset.points; // "1"|"2"|"3"
    btn.textContent = map[p] || `${p} point${p === "1" ? "" : "s"}`;
  });
}


function refreshStart(){
  $("btnStart").disabled = !(state.theme && state.points);
}

function renderThemes(){
  const wrap = $("themeRow");
  wrap.innerHTML = "";

  for (const t of OHM_THEMES){
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
      state.theme = t.id;
      $("hint").textContent = "Choisis 1 / 2 / 3 points.";
      [...wrap.querySelectorAll(".themeBtn")]
        .forEach(b => b.classList.toggle("active", b.dataset.theme === t.id));
	applyTypeLabels(t.id);
      refreshStart();
    });

    wrap.appendChild(btn);
  }
}

function wirePoints(){
  document.querySelectorAll(".typeBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!state.theme){
        $("hint").textContent = "Non. D’abord le thème.";
        return;
      }
      state.points = btn.dataset.points;
      document.querySelectorAll(".typeBtn")
        .forEach(b => b.classList.toggle("active", b.dataset.points === state.points));
      refreshStart();
    });
  });
}

function resetConfig(){
  state.theme = null;
  state.points = null;
  document.querySelectorAll(".themeBtn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".typeBtn").forEach(b => b.classList.remove("active"));
  $("hint").textContent = "Sélectionne un thème d’abord.";
  refreshStart();
}

(function init(){
  renderThemes();
  wirePoints();
  resetConfig();

  $("btnStart").addEventListener("click", () => {
    saveConfigToSession({ theme: state.theme, points: state.points });
    window.location.href = "game.html";
  });

  const btnReset = $("btnReset");
if (btnReset) {
  btnReset.addEventListener("click", () => {
    if (confirm("Réinitialiser la sélection ?")) resetConfig();
  });
}

})();
