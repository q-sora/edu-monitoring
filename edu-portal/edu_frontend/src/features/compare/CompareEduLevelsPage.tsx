// src/features/compare/CompareEduLevelsPage.tsx
// Статичная сравнительная страница — средние показатели РК, без API

const WORK    = 35;
const TAX     = 0.21;
const POVERTY = 47;

function calcROI(cost: number, salary: number, match: number) {
  const annualTax = Math.round(salary * 12 * TAX / 1000 * 100) / 100;
  const payback   = annualTax > 0 ? Math.round(cost / annualTax * 10) / 10 : 999;
  const lifetime  = Math.round(annualTax * WORK * 10) / 10;
  const roi       = Math.round(lifetime / cost * 10) / 10;
  const added     = Math.max(0, salary - POVERTY) * 12 / 1000 * WORK;
  const bonus     = (match / 100) * added * 0.3;
  return { annualTax, payback, lifetime, roi, added: Math.round((added + bonus) * 10) / 10 };
}

function statusInfo(payback: number) {
  if (payback <= 10) return { col: "#1D9E75", bg: "#E1F5EE", bd: "#9FE1CB", label: "Эффективно" };
  if (payback <= 17) return { col: "#BA7517", bg: "#FAEEDA", bd: "#FAC775", label: "Приемлемо" };
  return               { col: "#A32D2D", bg: "#FCEBEB", bd: "#F09595", label: "Требует пересмотра" };
}

const LEVELS = [
  { label: "ТиПО",     years: 3, cost: 4.2, salary: 180, match: 42 },
  { label: "Бакалавр", years: 4, cost: 6.0, salary: 320, match: 55 },
  { label: "Магистр",  years: 2, cost: 3.2, salary: 520, match: 62 },
] as const;

export function CompareEduLevelsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div>
        <p className="label-eyebrow" style={{ marginBottom: 2 }}>Аналитика платформы ФЦ</p>
        <h1 className="font-display" style={{ fontSize: 22, fontWeight: 900, color: "#19286D", lineHeight: 1.2 }}>
          Уровни образования
        </h1>
        <p style={{ fontSize: 12, color: "#73726c", marginTop: 6 }}>
          Сравнение уровней образования по ROI при текущих средних показателях Казахстана.
        </p>
      </div>

      {LEVELS.map(l => {
        const r   = calcROI(l.cost, l.salary, l.match);
        const st  = statusInfo(r.payback);
        const pct = Math.min(100, r.payback / 30 * 100);

        return (
          <div
            key={l.label}
            style={{
              background: "#fff",
              border: "1px solid #e0ddd6",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a18" }}>{l.label}</div>
                <div style={{ fontSize: 11, color: "#888780" }}>{l.years} года обучения</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, fontWeight: 500, background: st.bg, color: st.col, border: `1px solid ${st.bd}` }}>
                {st.label}
              </span>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Стоимость",       value: `${l.cost} млн тг`,    color: undefined },
                { label: "Ср. зарплата",    value: `${l.salary} тыс/мес`, color: undefined },
                { label: "По специальности", value: `${l.match}%`,        color: undefined },
                { label: "ROI за 35 лет",   value: `×${r.roi}`,           color: "#7F77DD" },
              ].map(s => (
                <div key={s.label} style={{ background: "#f0ede8", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, color: "#73726c", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: s.color ?? "#1a1a18" }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Payback bar */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#73726c" }}>Срок окупаемости</span>
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, fontWeight: 500, background: st.bg, color: st.col, border: `1px solid ${st.bd}` }}>
                {r.payback} лет
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#E5E9F2", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: st.col, transition: "width 0.5s" }} />
            </div>
          </div>
        );
      })}

      {/* Conclusion */}
      <div className="card" style={{ background: "#FEF9E7", border: "1px solid #FAC775", padding: "16px 20px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#854F0B", marginBottom: 6 }}>
          Вывод для принятия решений
        </div>
        <div style={{ fontSize: 13, color: "#854F0B", lineHeight: 1.7 }}>
          ТиПО — наибольший разрыв: при меньших вложениях выпускники зарабатывают вдвое меньше
          бакалавров, и только 42% работают по специальности. Окупаемость критическая.
          Приоритет: дуальное обучение + целевые места под реальный спрос рынка.
        </div>
      </div>

    </div>
  );
}
