(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const paths = {
    sound: "M1 6h3l5-4v12l-5-4H1z M11 5h2v2h1v2h-1v2h-2V9h1V7h-1z M13 1h1v2h1v2h1v6h-1v2h-1v2h-1v-3h1V4h-1z",
    muted: "M1 6h3l5-4v12l-5-4H1z M11 5h1v1h1v1h1V6h1V5h1v2h-1v2h1v2h-1v-1h-1V9h-1v1h-1v1h-1V9h1V7h-1z",
    full: "M1 1h5v2H3v3H1z M10 1h5v5h-2V3h-3z M1 10h2v3h3v2H1z M13 10h2v5h-5v-2h3z",
    clock: "M5 0h6v2h3v3h2v6h-2v3h-3v2H5v-2H2v-3H0V5h2V2h3z M5 3v1H4v1H3v6h1v1h1v1h6v-1h1v-1h1V5h-1V4h-1V3z M7 4h2v4h3v2H7z",
    pause: "M3 2h4v12H3z M10 2h4v12h-4z",
    play: "M2 1h3v2h3v2h3v2h3v2h-3v2H8v2H5v2H2z",
    cross: "M6 0h4v3h3v3h3v4h-3v3h-3v3H6v-3H3v-3H0V6h3V3h3z M6 4v2H4v4h2v2h4v-2h2V6h-2V4z",
    cup: "M1 2h14v5h-1v2h-3v2H9v2h3v2H4v-2h3v-2H5V9H2V7H1z M3 4v3h2V4z M11 4v3h2V4z",
    shield: "M1 2h3V1h8v1h3v7h-2v3h-2v2H9v1H7v-1H5v-2H3V9H1z M4 4v5h1v2h2v1h2v-1h2V9h1V4z",
    bolt: "M8 0h5l-3 6h5L5 16l2-7H2z",
    heart: "M1 2h4v1h2v2h2V3h2V2h4v2h1v5h-2v2h-2v2h-2v2H8v1H7v-1H6v-2H4v-2H2V9H0V4h1z",
    book: "M0 2h6v1h4V2h6v11h-5v1H9v1H7v-1H5v-1H0z M2 4v7h4v1h1V5H5V4z M9 5v7h1v-1h4V4h-3v1z",
    keyboard: "M0 3h16v10H0z M2 5v2h2V5z M5 5v2h2V5z M8 5v2h2V5z M11 5v2h3V5z M2 9v2h2V9z M5 9v2h7V9z",
    touch: "M6 0h3v1h1v5h1V5h2v2h2v2h1v4h-1v2h-1v1H7v-1H5v-2H4v-2H3V9H2V7h3v1h1z M7 2v9H5v-1H4v1h1v2h2v1h6v-2h1V9h-2V8h-2V7H8V2z",
    wing: "M0 3h4v2h3V2h2v3h3V3h4v3h-2v2h-3v2H9v4H7v-4H5V8H2V6H0z"
  };
  function icon(name) {
    return '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="' + paths[name] + '"/></svg>';
  }
  document.querySelectorAll("i[data-icon]").forEach(node => { node.innerHTML = icon(node.dataset.icon); });
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement("i");
    heart.dataset.icon = "heart";
    heart.innerHTML = icon("heart");
    byId("lives").append(heart);
  }
  for (let i = 0; i < 10; i++) byId("cells").append(document.createElement("b"));
  const pad = (value, length) => String(Math.max(0, Math.ceil(value))).padStart(length, "0");
  let currentMode;
  function update(state) {
    const {mode, lives, charge, remaining, score, best, muted} = state;
    byId("score").textContent = pad(score, 6);
    byId("best").textContent = pad(best, 6);
    const seconds = Math.max(0, Math.ceil(remaining));
    byId("remaining").textContent = pad(Math.floor(seconds / 60), 2) + ":" + pad(seconds % 60, 2);
    [...byId("lives").children].forEach((h, i) => h.classList.toggle("empty", i >= lives));
    byId("lives").setAttribute("aria-label", "剩余 " + lives + " 架");
    [...byId("cells").children].forEach((c, i) => c.classList.toggle("charged", i < Math.floor(charge / 10)));
    byId("charge").textContent = Math.round(charge) + "%";
    const sound = byId("sound");
    if (sound.dataset.muted !== String(muted)) {
      sound.dataset.muted = String(muted);
      sound.setAttribute("aria-pressed", String(!muted));
      sound.setAttribute("aria-label", muted ? "开启音效" : "关闭音效");
      sound.querySelector("i").innerHTML = icon(muted ? "muted" : "sound");
      byId("soundLabel").textContent = muted ? "音效关" : "音效开";
    }
    if (mode === currentMode) return;
    currentMode = mode;
    byId("stage").dataset.mode = mode;
    byId("hero").hidden = mode !== "menu";
    byId("pause").hidden = mode !== "play";
    const panel = ["paused", "over", "win"].includes(mode);
    byId("result").hidden = !panel;
    if (mode === "play") {
      byId("flightCanvas").focus({preventScroll:true});
    } else if (panel) {
      const paused = mode === "paused";
      byId("resultTitle").textContent = paused ? "飞行暂停" : mode === "win" ? "顺利返航" : "飞行结束";
      byId("resultDetail").textContent = paused ? "航线已保留，随时继续。" : "本次得分 " + pad(score, 6);
      byId("primary").querySelector("span").textContent = paused ? "继续飞行" : "再飞一次";
      byId("primary").focus({preventScroll:true});
    }
  }
  byId("launch").onclick = () => window.Flight.start();
  byId("sound").onclick = () => window.Flight.toggleMute();
  byId("pause").onclick = () => window.Flight.pause();
  byId("back").onclick = () => { window.Flight.menu(); byId("launch").focus({preventScroll:true}); };
  byId("primary").onclick = () => currentMode === "paused" ? window.Flight.resume() : window.Flight.start();
  byId("releaseNotes").addEventListener("toggle", event => {
    if (event.currentTarget.open && currentMode === "play") window.Flight.pause();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.documentElement.classList.contains("theater") && !document.fullscreenElement) setTheater(false);
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.("button, a, summary")) return;
    if ((event.key === "Enter" || event.code === "Space") && currentMode === "menu") {
      event.preventDefault();
      window.Flight.start();
    }
  });
  function setTheater(active) {
    document.documentElement.classList.toggle("theater",active);
    byId("leaveFull").hidden = !active;
  }
  byId("full").onclick = async () => {
    try { await document.documentElement.requestFullscreen(); } catch { /* Embedded and iOS browsers use the stage-only layout. */ }
    setTheater(true);
    window.scrollTo(0,0);
  };
  byId("leaveFull").onclick = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    setTheater(false);
  };
  document.addEventListener("fullscreenchange", () => setTheater(Boolean(document.fullscreenElement)));
  window.addEventListener("flightstate", e => update(e.detail));
  if (window.Flight) update(window.Flight.state());
})();
