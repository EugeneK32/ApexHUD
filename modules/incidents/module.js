(() => {
  "use strict";
  const root = document.getElementById("incidents");
  const count = document.getElementById("count");
  const risk = document.getElementById("risk");
  const message = document.getElementById("message");
  let settings = { hideAtZero: false, warningAt: 8, dangerAt: 12, opacity: .92 };
  let editMode = false;
  let incidents = 0;

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const incoming = event.data;
    if (incoming.type === "apex:init" || incoming.type === "apex:settings") {
      settings = { ...settings, ...(incoming.settings || {}) };
      root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
      render();
    } else if (incoming.type === "apex:frame") {
      incidents = Math.max(0, Math.trunc(number(incoming.payload?.player?.incidentCount, 0)));
      render();
    } else if (incoming.type === "apex:visibility") {
      editMode = Boolean(incoming.editMode);
      document.documentElement.classList.toggle("module-hidden", !incoming.visible);
      root.classList.toggle("editing", editMode);
      render();
    }
  });

  function render() {
    count.textContent = `${incidents}x`;
    const warningAt = Math.max(1, Math.trunc(number(settings.warningAt, 8)));
    const dangerAt = Math.max(warningAt, Math.trunc(number(settings.dangerAt, 12)));
    const warning = incidents >= warningAt && incidents < dangerAt;
    const danger = incidents >= dangerAt;
    root.classList.toggle("warning", warning);
    root.classList.toggle("danger", danger);
    risk.textContent = danger ? "HIGH RISK" : warning ? "CAREFUL" : "CLEAN";
    message.textContent = danger ? "ONE CONTACT FROM TROUBLE" : warning ? "KEEP IT TIDY" : "KEEP IT CLEAN";
    root.hidden = Boolean(settings.hideAtZero) && incidents === 0 && !editMode;
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  render();
  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.incidents" }, "*");
})();
