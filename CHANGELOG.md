# Changelog

## Unreleased

### Architecture
- LLM proxy вынесен в `src/llmProxy.ts` (normalize / models / stream / IPC)
- API keys — OS vault (`secretsVault`), не в дереве проекта

### Release
- `predist` → `test:ci` перед electron-builder
- CI: GitHub Actions (`windows-latest`, Node 20)
- В пакет: `LICENSE`, `README.md`; NSIS license page
- Docs: README + СБОРКА.md актуализированы

### Product
- Help / welcome: `Ctrl+O` для открытия папки; провайдеры LLM (LM Studio / Ollama / custom)
- Project cache `.sirius/` (gitignored); Base URL всегда виден и применяется при paste
