# Раскладки и наследование

[English](../en/layouts.md)

Workspace содержит профили HUD. В каждом профиле есть `default`, показываемый как **Base Layout**, и дочерние Test Drive, Practice, Qualifying, Race и Replay.

Base хранит полные instances. Дочерний слой хранит только локальные instances, `baseOverrides` и `hiddenBaseInstanceIds`. При resolve берётся Base, исключаются tombstones, применяются точечные overrides и добавляются локальные модули.

Override точный: изменение только bounds не блокирует будущие Base settings. Новый Base instance появляется во всех дочерних слоях, если не скрыт. Удаление inherited instance создаёт tombstone, поэтому дальнейшие изменения Base не возвращают его.

`Reset to Base` очищает локальные instances, overrides и tombstones. При копировании source сначала полностью resolve-ится, затем записывается в target согласно правилам target inheritance.

Workspace использует schema v3, concrete layout — schema v1. Миграции обязаны сохранять пользовательские координаты и настройки и не перезаписывать осознанно изменённые раскладки.
