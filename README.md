# Sirius IDE

IDE с локальной языковой моделью через LM Studio. Редактор кода на базе Monaco, встроенный терминал, AI-ассистент с возможностью управления файлами.

## Требования

- **Node.js** 18+ (рекомендуется 20 LTS)
- **LM Studio** — для работы AI (опционально)
- **Windows** — основной целевой режим (node-pty)

## Установка

```bash
npm install
```

После установки автоматически выполняется `electron-rebuild` для сборки native-модуля `node-pty`. Если терминал не работает, пересоберите вручную:

```bash
npm run postinstall
```

## Запуск

```bash
npm start
```

Или сборка + запуск:

```bash
npm run build
npm start
```

Режим разработки (без `npm run build`):

```bash
npm run dev
```

## Подключение LM Studio

1. Установите [LM Studio](https://lmstudio.ai/)
2. Загрузите любую модель (например, Llama, Mistral)
3. Откройте **Local Server** → **Start Server** (порт 1234)
4. В Sirius IDE индикатор статуса в правом нижнем углу станет зелёным

## Структура проекта

```
IDE/
├── src/              # Main process (TypeScript)
│   ├── main.ts       # Точка входа, окно, IPC
│   ├── preload.ts    # Bridge для renderer
│   ├── fileHandlers.ts
│   └── terminalHandler.ts
├── renderer/         # Renderer process
│   ├── index.html
│   ├── app.js        # Инициализация и связка модулей
│   ├── styles.css
│   └── js/           # Модули (см. ниже)
├── dist/             # Скомпилированный main process
└── package.json
```

## Модули renderer (js/)

| Модуль | Назначение |
|--------|------------|
| `utils.js` | Утилиты: toast, uid, langOf, getFileIcon |
| `state.js` | Состояние, persistence, theme |
| `editor.js` | Инициализация Monaco |
| `fileTree.js` | Дерево файлов, open/save/close, контекстное меню |
| `terminal.js` | Терминал (xterm + node-pty) |
| `search.js` | Поиск по файлам |
| `ai.js` | AI-чат, LM Studio, инструменты |
| `ui.js` | Вкладки, меню, resize, модалки |
| `app.js` | Инициализация и связка модулей |

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Ctrl+O` | Открыть папку |
| `Ctrl+N` | Новый файл |
| `Ctrl+S` | Сохранить |
| `Ctrl+Shift+S` | Сохранить всё |
| `Ctrl+W` | Закрыть вкладку |
| `Ctrl+B` | Проводник / Поиск |
| `Ctrl+Shift+A` | Панель Sirius AI |
| `Ctrl+\`` | Терминал |
| `F5` | Запустить проект |

## AI — команды управления файлами

| Команда | Описание |
|---------|----------|
| `[CREATEFILE:путь]` | Создать файл |
| `[EDITFILE:путь]` | Изменить файл |
| `[READFILE:путь]` | Прочитать файл |
| `[READDIR:путь]` | Список файлов в папке |
| `[DELETEFILE:путь]` | Удалить файл |

Пути указываются **относительно** корня проекта. Все операции только внутри открытой папки. Пример: `[CREATEFILE:src/main.py]`

## Сборка

```bash
npm run build
```

Сборка выполняется перед `npm start` автоматически.

## Лицензия

MIT
