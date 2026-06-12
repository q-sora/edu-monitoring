# Как подключить Claude Code к серверу — быстрый старт

У тебя 3 файла:

| Файл | Назначение |
|---|---|
| `CLAUDE.md` | **Постоянный контекст**. Кладётся в корень проекта на сервере. Claude Code читает его автоматически при каждом запуске. |
| `CLAUDE_CODE_PROMPT.md` | **Промпт для первой сессии**. Копируешь его содержимое и вставляешь в чат с Claude Code один раз. |
| `.env.test` (создашь сам) | **Пароли для smoke-тестов**. НЕ коммитится в git. Шаблон ниже. |

## Шаг 1. Установить Claude Code на сервере

Если ещё не установлен:

```bash
ssh root@192.168.13.245

# Способ 1 (рекомендуется): native installer, без зависимостей
curl -fsSL https://claude.ai/install.sh | bash

# Способ 2: через npm (требует Node.js 18+)
# ВАЖНО: НЕ через sudo — может сломать права. Используй nvm если ругается на permissions.
npm install -g @anthropic-ai/claude-code

# Проверка
claude --version
```

При первом запуске Claude Code откроет браузер для OAuth-авторизации. На сервере без
браузера — задай API key переменной окружения:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Положи в ~/.bashrc чтобы не задавать каждый раз
```

API key берёшь на console.anthropic.com.

## Шаг 2. Создать `.env.test` для smoke-тестов

**Это важно для безопасности.** Промпт в `CLAUDE_CODE_PROMPT.md` написан так, что пароль
суперадмина читается из `.env.test` — НЕ из самого промпта или командной строки. Это
защищает от попадания пароля в bash history и в `/proc/*/cmdline`.

```bash
cat > /opt/edu-monitoring/.env.test <<'EOF'
# Пароли для smoke-тестов после деплоя.
# НЕ коммитить в git — этот файл должен быть в .gitignore.
#
# ВАЖНО: используй ОДИНАРНЫЕ кавычки вокруг пароля. В двойных bash сделает
# substitution для $, ! и backticks — пароль с этими символами получит
# unexpected результат при `source .env.test`.
TEST_SUPERADMIN_PASSWORD='ВСТАВЬ_СВОЙ_ПАРОЛЬ_СУПЕРАДМИНА_СЮДА'
EOF

# Открой и подставь настоящий пароль (одиночные кавычки!)
nano /opt/edu-monitoring/.env.test

chmod 600 /opt/edu-monitoring/.env.test  # только владелец может читать

# Проверь что подгружается
source /opt/edu-monitoring/.env.test
echo "${TEST_SUPERADMIN_PASSWORD:0:3}***"   # покажет первые 3 символа + ***
unset TEST_SUPERADMIN_PASSWORD
```

Проверь что `.gitignore` его игнорирует:

```bash
cd /opt/edu-monitoring
grep -q "^.env.test$" .gitignore || echo ".env.test" >> .gitignore
grep -q "^\*.env\*$" .gitignore || echo "*.env*" >> .gitignore
```

## Шаг 3. Положить CLAUDE.md в корень проекта

```bash
# С твоего ПК — закинуть на сервер
scp CLAUDE.md root@192.168.13.245:/opt/edu-monitoring/CLAUDE.md

# Или прямо на сервере, если ты там
nano /opt/edu-monitoring/CLAUDE.md   # вставь содержимое
```

Этот файл Claude Code будет читать автоматически каждый раз когда запускается в
`/opt/edu-monitoring/`. То есть постоянный контекст про брендбук, конвенции, стек —
не надо повторять.

## Шаг 4. Запустить первую сессию

```bash
ssh root@192.168.13.245
cd /opt/edu-monitoring
claude
```

После запуска Claude Code:

1. Прочитает `CLAUDE.md` сам
2. Скажет «How can I help?» или похожее
3. **Тогда вставляешь содержимое `CLAUDE_CODE_PROMPT.md`** одним сообщением

Это запустит Шаг 0 → Шаг 1 (smoke-test) → Шаг 2 (Pydantic-схемы) → потом спросит
тебя что делать дальше из 5 вариантов roadmap.

## Шаг 5. Дальнейшие сессии

Когда захочешь продолжить работу:

```bash
ssh root@192.168.13.245
cd /opt/edu-monitoring

claude --continue           # = claude -c — продолжить последнюю сессию в этой папке
# или
claude --resume             # = claude -r — interactive picker всех сессий
# или
claude                       # начать новую (CLAUDE.md всё равно подгрузится)
```

Подтверждено в актуальных доках Claude Code (апрель 2026): сессии хранятся в
`~/.claude/projects/` per-project, можно резюмировать с полным контекстом. Команда
`/rename` внутри сессии — даёт ей человекочитаемое имя для будущего поиска.

## Полезные команды Claude Code

| Команда | Что делает |
|---|---|
| `/help` | список команд |
| `/clear` | очистить контекст текущей сессии (CLAUDE.md остаётся) |
| `/init` | создать или обновить CLAUDE.md (но ты уже создал свой) |
| `/permissions` | разрешения на команды (можно дать blanket-allow на bash) |
| `/cost` | сколько токенов потрачено |
| `Ctrl+C` дважды | прервать выполнение |

## Что важно понимать про Claude Code

1. **Доступ к bash и файлам** — он может выполнять любые команды на сервере.
   Если боишься — запускай в отдельном пользователе с ограниченными правами,
   не от root. Или используй `--allowedTools` чтобы ограничить.

2. **Контекст ограничен** (200k токенов). Длинные сессии нужно разбивать.
   `/clear` сбрасывает историю но оставляет CLAUDE.md.

3. **Не забывает между сессиями только то что в CLAUDE.md и в коде.**
   Решения которые ты дал ему словесно — забудутся. Если что-то важное —
   проси записывать в CLAUDE.md или в комментарии в коде.

4. **Может коммитить в git если разрешишь.** Я в промпте написал чтобы делал
   маленькие коммиты — он сам предложит, ты подтверждаешь.

5. **Стоит денег** (Anthropic API). При длительной работе следи за `/cost`.
   На задачах вроде «починить формы и сделать аналитику» — обычно $5-15.

## Если что-то пойдёт не так

- Claude Code сделал что-то не то → откатывайся через git: `git reset --hard HEAD~1`
  или `git checkout -- file.tsx`
- Контейнер упал после изменений → `docker compose logs --tail=100 <service>` и копируешь
  Claude Code, он починит
- Не понимает контекст → проверь что `CLAUDE.md` лежит именно в `/opt/edu-monitoring/`
  (не в подпапке), и что ты запускаешь `claude` из этой директории

## Дополнительные настройки (опционально)

### Ограничить доступ только к нужным инструментам

```bash
claude --allowedTools="Bash,Read,Edit,Write,Grep,Glob"
```

### Постоянные разрешения через `.claude/settings.json`

Claude Code читает `.claude/settings.json` из корня проекта (а не из `~/.config/...`).
Создай `/opt/edu-monitoring/.claude/settings.json`:

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
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(grep:*)",
      "Bash(find:*)",
      "Read(**)",
      "Grep(**)",
      "Glob(**)"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf ~)",
      "Bash(docker compose down -v)",
      "Bash(docker volume rm:*)",
      "Bash(dropdb:*)",
      "Bash(DROP DATABASE:*)"
    ]
  }
}
EOF
```

Закоммить этот файл — он шарится между всеми кто работает с проектом. **НЕ помещай**
сюда секреты и пароли.

### Опасный режим `--dangerously-skip-permissions`

Для CI/CD или хорошо контейнеризованных окружений можно вообще отключить промпты:

```bash
claude --dangerously-skip-permissions
```

⚠ На production-сервере под root так лучше **не делать**. Используй allowlist.

## Альтернатива — Cursor / Cline / другие IDE

Если не хочешь именно Claude Code в терминале — те же файлы (`CLAUDE.md` и промпт)
работают с:

- **Cursor IDE** — тот же `CLAUDE.md` через `.cursorrules` или скопировать содержимое в
  Cursor settings → Rules for AI
- **Cline (VSCode extension)** — `CLAUDE.md` копируется в `.clinerules`
- **Continue.dev** — через `.continuerules`

Главное — Claude (или другая модель) должна получить контекст в начале сессии.
