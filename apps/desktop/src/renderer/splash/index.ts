import appIconUrl from "../../../assets/app-icon.png";
import "./splash.css";

const isRussian = navigator.language.toLowerCase().startsWith("ru");
const copy = isRussian
  ? {
      label: "ApexHUD запускается",
      title: "Запускаем ApexHUD",
      description: "Подготавливаем телеметрию, раскладки и виджеты…",
      local: "Все данные обрабатываются локально на этом компьютере.",
    }
  : {
      label: "ApexHUD is starting",
      title: "Starting ApexHUD",
      description: "Preparing telemetry, layouts and widgets…",
      local: "Everything runs locally on this PC.",
    };

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  root.innerHTML = `
    <main class="startup-card" aria-label="${copy.label}">
      <div class="startup-brand">
        <img src="${appIconUrl}" alt="" />
        <div><b>APEXHUD</b><span>iRacing overlay</span></div>
      </div>
      <div class="startup-copy">
        <h1>${copy.title}</h1>
        <p>${copy.description}</p>
      </div>
      <div class="startup-progress" aria-hidden="true"><i></i></div>
      <small>${copy.local}</small>
    </main>`;
}
