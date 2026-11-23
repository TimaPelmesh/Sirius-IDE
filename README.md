# Sirius IDE

Локальный AI-агент IDE: Monaco + терминал + Ollama / LM Studio / любой OpenAI-compatible API.

## Требования

- **Node.js** 18+ (лучше 20 LTS)
- **Ollama** или **LM Studio** (или свой `/v1` endpoint)
- **Windows** — основной режим (терминал через `node-pty`)

## Установка

```bash
npm install
```

`npm install` нужен **один раз** (или после смены зависимостей в `package.json`). Каждый день достаточно:

```bash
npm start
```

Native-терминал собирается отдельно (раньше из‑за этого install «висел» минутами):

```bash
npm run rebuild:native
```

Нужны Visual Studio Build Tools (C++). Без этого IDE работает, но встроенный терминал может не подняться.

## Запуск

```bash
npm start
```

## Локальные модели

В панели AI выбери провайдер:

| Провайдер | URL по умолчанию |
|-----------|------------------|
| LM Studio | `http://127.0.0.1:1234/v1` |
| Ollama | `http://127.0.0.1:11434/v1` |
| Custom | свой base URL (+ optional API key) |

Ollama: `ollama serve` + любая модель (`ollama pull qwen2.5-coder` и т.п.).

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
