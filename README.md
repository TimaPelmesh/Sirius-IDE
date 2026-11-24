# Sirius IDE

Локальный AI-агент IDE: Monaco + терминал + Ollama / LM Studio / любой OpenAI-compatible API.

## Требования

- **Node.js** 18+ (лучше 20 LTS)
- **Ollama** или **LM Studio** (или свой `/v1` endpoint)
- **Windows** — основной режим (терминал через `node-pty`)

## Установка

```bash
npm install
npm start
```

Native-терминал (опционально, нужны VS Build Tools):

```bash
npm run rebuild:native
```

## Локальные модели

В панели Sirius → настройки модели:

| Провайдер | URL по умолчанию |
|-----------|------------------|
| LM Studio | `http://127.0.0.1:1234/v1` |
| Ollama | `http://127.0.0.1:11434/v1` |
| Custom | свой Base URL (+ optional API key) |

API-ключи хранятся в OS-encrypted vault, не в папке проекта. URL/модель — в `.sirius/` (в git игнорируется).

## Структура

```
├── src/                 # Main process (TypeScript)
│   ├── main.ts          # Окно, static server, IPC
│   ├── llmProxy.ts      # LLM models + streaming proxy
│   ├── secretsVault.ts  # Encrypted API keys
│   ├── preload.ts
│   ├── fileHandlers.ts
│   ├── pathValidator.ts
│   └── terminalHandler.ts
├── renderer/            # UI
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── js/              # Модули
├── tests/               # Vitest
├── scripts/             # postinstall, test-pipeline
└── package.json
```

### Renderer (`js/`)

| Модуль | Назначение |
|--------|------------|
| `state.js` | Состояние, LLM settings, project cache |
| `ai.js` | Агент, инструменты, стрим |
| `editor.js` / `monaco-config.js` | Monaco |
| `fileTree.js` | Проводник |
| `terminal.js` | xterm + pty |
| `search.js` | Поиск |
| `ui.js` | Меню, хоткеи, resize |
| `workspaceService.js` | Open folder / RW probe |
| `store.js` / `ux.js` / `utils.js` | Store, UX, утилиты |

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Ctrl+O` | Открыть папку |
| `Ctrl+N` | Новый файл |
| `Ctrl+S` / `Ctrl+Shift+S` | Сохранить / всё |
| `Ctrl+W` | Закрыть вкладку |
| `Ctrl+B` | Проводник |
| `Ctrl+Shift+F` | Поиск |
| `Ctrl+Shift+A` | Sirius AI |
| `Ctrl+\`` | Терминал |
| `F5` | Запуск проекта |

## AI-инструменты

| Команда | Описание |
|---------|----------|
| `[CREATEFILE:путь]` | Создать файл |
| `[EDITFILE:путь]` | Изменить (полное тело) |
| `[READFILE:путь]` | Прочитать |
| `[READDIR:путь]` | Список папки |
| `[DELETEFILE:путь]` | В `.trash/` после подтверждения |

Пути **относительно** корня проекта.

## Тесты и сборка

```bash
npm run test          # vitest
npm run test:ci       # tsc + vitest + static checks
npm run build         # TypeScript → dist/
npm run dist          # NSIS + portable → release/ (после predist)
```

Подробности: [СБОРКА.md](./СБОРКА.md).

## Лицензия

MIT
