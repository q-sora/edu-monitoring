const SOURCES = [
  {
    iconBg: "#E6F1FB",
    title: "Источник 1: Национальный центр тестирования",
    subtitle: "Таблица: Реестр выпускников · Ключ связи: ИИН выпускника",
    fields: [
      "ИИН — уникальный идентификатор",
      "Уровень образования (ТиПО / бакалавр / магистр)",
      "Специальность / код по классификатору",
      "Год выпуска",
      "Наименование учебного заведения",
      "Регион учебного заведения",
      "Стоимость обучения (тыс. тг/год)",
      "Общая сумма бюджетных расходов на студента",
      "Балл ЕНТ / итоговой аттестации",
      "Грант / платное (признак)",
    ],
  },
  {
    iconBg: "#E1F5EE",
    title: "Источник 2: Министерство труда и соцзащиты РК (МТСЗН)",
    subtitle: "Таблица: Реестр занятости (ОСМС/ЕНСС) · Ключ связи: ИИН сотрудника",
    fields: [
      "ИИН — связь с реестром выпускников",
      "Статус занятости (работает / безработный / ИП)",
      "Дата первого трудоустройства после выпуска",
      "Код ОКЭД работодателя (отрасль)",
      "Наименование работодателя",
      "Регион места работы",
      "Признак соответствия специальности",
    ],
  },
  {
    iconBg: "#EEEDFE",
    title: "Источник 3: Комитет государственных доходов (КГД)",
    subtitle: "Таблица: Налоговые отчисления физлиц · Ключ связи: ИИН налогоплательщика",
    fields: [
      "ИИН — связь",
      "Год / квартал",
      "Сумма начисленного ИПН (тг)",
      "Сумма дохода (зарплата до вычетов, тг/мес)",
      "Источник дохода (найм / предпринимательство)",
      "Код ОКЭД работодателя",
      "Регион регистрации работодателя",
    ],
  },
  {
    iconBg: "#FAEEDA",
    title: "Источник 4: ГЦВП (Государственный центр по выплате пенсий)",
    subtitle: "Таблица: Пенсионные накопления · Ключ связи: ИИН вкладчика",
    fields: [
      "ИИН — связь",
      "Сумма отчислений ЕНПФ (тг/год)",
      "Год",
      "Наименование работодателя",
      "Накопленная сумма на счёте (тг)",
    ],
  },
];

export function ItDataPage() {
  return (
    <div style={{ color: "#1a1a18" }}>

      {/* card-info */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "#E6F1FB", border: "1px solid #B5D4F4" }}>
        <div className="text-sm font-semibold mb-1" style={{ color: "#185FA5" }}>
          Техническое задание для IT-команды (озеро данных)
        </div>
        <div className="text-xs leading-relaxed" style={{ color: "#185FA5" }}>
          Для расчёта ROI по каждому выпускнику нужно связать 4 государственных источника через ИИН.
          Связка данных — один раз. Обновление — ежеквартально.
        </div>
      </div>

      {/* Source cards */}
      {SOURCES.map((src, i) => (
        <div key={i} className="rounded-xl p-4 mb-3 bg-white" style={{ border: "1px solid #e0ddd6" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg shrink-0" style={{ width: 36, height: 36, background: src.iconBg }} />
            <div>
              <div className="text-sm font-semibold">{src.title}</div>
              <div className="text-[11px]" style={{ color: "#888780" }}>{src.subtitle}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {src.fields.map((f, fi) => (
              <div key={fi} className="rounded-md px-2 py-1.5 text-xs" style={{ background: "#f0ede8", color: "#73726c" }}>
                {f}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* card-secondary: integration schema */}
      <div className="rounded-xl p-5" style={{ background: "#f0ede8" }}>
        <div className="text-[15px] font-bold mb-3" style={{ color: "#1A2133" }}>
          Схема интеграции (для архитектора данных)
        </div>
        <div className="rounded-lg p-3 text-xs leading-loose" style={{ fontFamily: "'Courier New', monospace", color: "#73726c", background: "#fff", border: "1px solid #e0ddd6" }}>
          <div>НЦТ (выпускники) ──── ИИН ────▶ МТСЗН (занятость)</div>
          <div style={{ paddingLeft: 24 }}>│</div>
          <div style={{ paddingLeft: 24 }}>└─── ИИН ────▶ КГД (налоги + зарплата)</div>
          <div style={{ paddingLeft: 24 }}>│</div>
          <div style={{ paddingLeft: 24 }}>└─── ИИН ────▶ ГЦВП (пенсии)</div>
          <div className="mt-2" style={{ color: "#888780" }}>
            Аналитическая витрина: ROI_выпускник = f(ИИН, год_выпуска)
          </div>
        </div>
        <div className="mt-2.5 text-xs leading-relaxed" style={{ color: "#73726c" }}>
          Все 4 источника уже существуют и имеют ИИН как ключ. Задача IT: настроить cross-agency API
          или ETL-пайплайн в озеро данных с ежеквартальным обновлением. Никаких новых данных собирать
          не нужно — всё уже есть.
        </div>
      </div>

      {/* card-success */}
      <div className="rounded-xl p-4 mt-3" style={{ background: "#E1F5EE", border: "1px solid #9FE1CB" }}>
        <div className="text-sm font-semibold mb-1.5" style={{ color: "#0F6E56" }}>
          Почему нельзя соврать
        </div>
        <div className="text-sm leading-relaxed" style={{ color: "#0F6E56" }}>
          Зарплата и налоги фиксируются КГД и ГЦВП независимо от НЦТ. Если выпускник «трудоустроен»
          по данным реестра, но не платит ИПН по данным КГД — система автоматически ставит флаг
          несоответствия. Это встроенный механизм верификации без ручного контроля.
        </div>
      </div>

    </div>
  );
}
