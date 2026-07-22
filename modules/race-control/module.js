(() => {
  "use strict";
  const root = document.getElementById("control");
  const message = document.getElementById("message");
  const detail = document.getElementById("detail");
  const instruction = document.getElementById("instruction");
  const incidentChip = document.getElementById("incident-chip");
  let settings = { opacity: .92, hideWhenClear: false, showIncidents: true };
  let editMode = false;

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const incoming = event.data;
    if (incoming.type === "apex:init" || incoming.type === "apex:settings") {
      settings = { ...settings, ...(incoming.settings || {}) };
      root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
    } else if (incoming.type === "apex:frame") {
      render(incoming.payload || {});
    } else if (incoming.type === "apex:visibility") {
      editMode = Boolean(incoming.editMode);
      document.documentElement.classList.toggle("module-hidden", !incoming.visible);
      root.classList.toggle("editing", editMode);
    }
  });

  function render(payload) {
    const flags = Math.trunc(number(payload.session?.flags, 0));
    const player = payload.player || {};
    let state = flag(flags);
    if (player.onPitRoad) state = { label: "PIT ROAD", detail: "LIMITER / LANE", instruction: "OBSERVE PIT SPEED", className: "pit" };
    message.textContent = state.label;
    detail.textContent = state.detail;
    instruction.textContent = state.instruction;
    const incidents = Math.max(0, Math.trunc(number(player.incidentCount, 0)));
    incidentChip.textContent = `${incidents}x`;
    incidentChip.hidden = !settings.showIncidents;
    root.className = `${state.className}${editMode ? " editing" : ""}`;
    root.hidden = Boolean(settings.hideWhenClear) && state.className === "green";
  }

  function flag(flags) {
    if (flags & 0x20000) return state("DISQUALIFIED", "RACE CONTROL", "RETURN TO PITS", "black");
    if (flags & 0x10000) return state("BLACK FLAG", "PENALTY", "SERVE THE PENALTY", "black");
    if (flags & 0x1) return state("CHECKERED", "SESSION FINISHED", "COMPLETE THE LAP", "checkered");
    if (flags & 0x10) return state("RED FLAG", "SESSION STOPPED", "SLOW DOWN / RETURN", "red");
    if (flags & 0x8000) return state("CAUTION", "YELLOW WAVING", "NO OVERTAKING", "yellow");
    if (flags & 0x4000) return state("CAUTION", "FULL COURSE", "NO OVERTAKING", "yellow");
    if (flags & 0x100) return state("YELLOW FLAG", "WAVING", "NO OVERTAKING", "yellow");
    if (flags & 0x8) return state("YELLOW FLAG", "LOCAL", "SLOW DOWN", "yellow");
    if (flags & 0x20) return state("BLUE FLAG", "FASTER CAR", "LET THEM PASS SAFELY", "blue");
    if (flags & 0x2) return state("WHITE FLAG", "FINAL LAP", "ONE LAP REMAINING", "white");
    return state("TRACK CLEAR", "GREEN FLAG", "RACING CONDITIONS", "green");
  }

  function state(label, detailText, instructionText, className) {
    return { label, detail: detailText, instruction: instructionText, className };
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.race-control" }, "*");
})();
