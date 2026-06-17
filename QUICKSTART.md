# Как подключить Claude Code к серверу — быстрый старт

## Шаг 1. Установить Claude Code на сервере

```bash
ssh root@192.168.13.245

# Способ 1 (рекомендуется): native installer
curl -fsSL https://claude.ai/install.sh | bash

# Способ 2: через npm (требует Node.js 18+)
# НЕ через sudo — может сломать права. Используй nvm если ругается на permissions.
npm install -g @anthropic-ai/claude-code

# Проверка
claude --version
```

При первом запуске Claude Code откроет браузер для OAuth-авторизации. На сервере без браузера — задай API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Положи в ~/.bashrc чтобы не задавать каждый раз
```

API key берёшь на console.anthropic.com.

## Шаг 2. Запустить первую сессию

```bash
ssh root@192.168.13.245
cd /opt/edu-monitoring
claude
```

Claude Code прочитает `CLAUDE.md` автоматически — постоянный контекст про стек, брендбук, конвенции загружается сам при каждом запуске из этой директории.

## Шаг 3. Bootstrap суперадмина (первый деплой)

```bash
cd /opt/edu-monitoring/edu_backend
# Убедись что BOOTSTRAP_SUPERADMIN_EMAIL и BOOTSTRAP_SUPERADMIN_PASSWORD заданы в .env
docker compose run --rm api python -m scripts.create_superadmin --auto
```

## Шаг 4. Дальнейшие сессии

```bash
ssh root@192.168.13.245
cd /opt/edu-monitoring

claude --continue    # продолжить последнюю сессию
claude --resume      # interactive picker всех сессий
claude               # начать новую (CLAUDE.md всё равно подгрузится)
```

Сессии хранятся в `~/.claude/projects/` per-project. Команда `/rename` внутри сессии — даёт ей человекочитаемое имя.

---

## Полезные команды Claude Code

| Команда | Что делает |
|---|---|
| `/help` | список команд |
| `/clear` | очистить контекст сессии (CLAUDE.md остаётся) |
| `/permissions` | разрешения на команды |
| `/cost` | сколько токенов потрачено |
| `Ctrl+C` дважды | прервать выполнение |

---

## Что важно понимать

1. **Доступ к bash и файлам** — может выполнять любые команды на сервере. Не запускай от root без необходимости.

2. **Контекст ограничен** (200k токенов). Длинные сессии разбивай. `/clear` сбрасывает историю но оставляет CLAUDE.md.

3. **Между сессиями помнит только то что в CLAUDE.md и в коде.** Важные решения проси записывать в CLAUDE.md.

4. **Стоит денег** (Anthropic API). Следи за `/cost`.

---

## Если что-то пойдёт не так

```bash
# Claude Code сделал что-то не то
git reset --hard HEAD~1
# или откат одного файла
git checkout -- path/to/file.tsx

# Контейнер упал
docker compose logs --tail=100 api

# Не понимает контекст — проверь что CLAUDE.md лежит в /opt/edu-monitoring/ (не в подпапке)
```

---

## Ограничение доступа (опционально)

### Только нужные инструменты

```bash
claude --allowedTools="Bash,Read,Edit,Write,Grep,Glob"
```

### Постоянные разрешения через `.claude/settings.json`

```bash
mkdir -p /opt/edu-monitoring/.claude
cat > /opt/edu-monitoring/.claude/settings.json <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash(docker compose ps)",
      "Bash(docker compose logs:*)",
      "Bash(docker compose exec -T postgres psql:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Read(**)",
      "Grep(**)",
      "Glob(**)"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(docker compose down -v)",
      "Bash(docker volume rm:*)"
    ]
  }
}
EOF
```

### Режим без промптов (для CI)

```bash
claude --dangerously-skip-permissions
```

⚠ На production под root — не рекомендуется. Используй allowlist.
