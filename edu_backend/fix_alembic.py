import re
import os

path = "migrations/versions/0001_initial_schema.py"

if not os.path.exists(path):
    print("Ошибка: Файл миграции не найден!")
else:
    with open(path, "r", encoding="utf-8") as f:
        data = f.read()

    # 1. Разделяем DROP и CREATE для POLICY
    data = re.sub(
        r";\s*CREATE POLICY",
        r'""")\n        op.execute(f"""CREATE POLICY',
        data
    )
    
    # 2. Разделяем DROP и CREATE для TRIGGER (на случай, если что-то осталось)
    data = re.sub(
        r";\s*CREATE TRIGGER",
        r'""")\n        op.execute(f"""CREATE TRIGGER',
        data
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(data)

    print(f"Файл {path} полностью пропатчен (триггеры и политики)!")
