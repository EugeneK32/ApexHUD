# Участие в разработке ApexHUD

[English](CONTRIBUTING.md)

Спасибо за вклад. Перед крупным архитектурным изменением создайте issue. Pull request должен быть сфокусированным и описывать пользовательское поведение и проверки.

## Обязательные проверки

```powershell
npm ci
npm run verify
dotnet build ApexHUD.sln --configuration Release
```

Изменения телеметрии, standings, radar, focus окна и lifecycle редактора проверяются в live iRacing. При изменении public API обновляются mock telemetry и обе версии EN/RU документации. Не добавляйте generated output, secrets, личную телеметрию, чужие защищённые assets и font-файлы.

Отправляя contribution, вы соглашаетесь лицензировать его по MPL-2.0 и подтверждаете права на код и assets. Соблюдайте Code of Conduct.
