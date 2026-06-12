"""
Seed script — EDU Monitoring
12 ВУЗов × 3 года (2022-2024) × 5 доменов
Запуск: python3 /opt/edu-monitoring/seed_data.py
"""
import os
import psycopg2, json, random
from decimal import Decimal

_dsn = os.getenv("SEED_DSN") or os.getenv("DATABASE_URL", "")
if not _dsn:
    raise RuntimeError("Set SEED_DSN or DATABASE_URL env var. See .env.example")
DSN = _dsn.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql://", "")
# psycopg2 accepts DSN string or keyword args; reconstruct from env if needed
conn = psycopg2.connect(_dsn.replace("postgresql+asyncpg://", "postgresql://") if "://" in _dsn else _dsn)
conn.autocommit = False
cur = conn.cursor()

random.seed(42)

# ─── REGIONS ────────────────────────────────────────────────────────────────
regions = [
    (1,'AST','Астана','city'),
    (2,'ALA','Алматы','city'),
    (3,'SHY','Шымкент','city'),
    (4,'AKM','Акмолинская','oblast'),
    (5,'AKT','Актюбинская','oblast'),
    (6,'ALM','Алматинская','oblast'),
    (7,'ATY','Атырауская','oblast'),
    (8,'ZKZ','Западно-Казахстанская','oblast'),
    (9,'ZHB','Жамбылская','oblast'),
    (10,'ZHT','Жетісу','oblast'),
    (11,'KAR','Карагандинская','oblast'),
    (12,'KOS','Костанайская','oblast'),
    (13,'KZO','Кызылординская','oblast'),
    (14,'MAN','Мангистауская','oblast'),
    (15,'PAV','Павлодарская','oblast'),
    (16,'SKZ','Северо-Казахстанская','oblast'),
    (17,'TUR','Туркестанская','oblast'),
    (18,'ULT','Ұлытау','oblast'),
    (19,'ABY','Абай','oblast'),
    (20,'EKB','Восточно-Казахстанская','oblast'),
]
cur.execute("DELETE FROM regions")
cur.executemany(
    "INSERT INTO regions(id,code,name_ru,type) VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING",
    regions
)
print(f"Regions: {len(regions)}")

# ─── ORGANIZATIONS ──────────────────────────────────────────────────────────
orgs = [
    ('11000000-0000-0000-0000-000000000001','040000000001','КазНУ им. аль-Фараби',5,2,2,1),
    ('11000000-0000-0000-0000-000000000002','010000000002','ЕНУ им. Л.Н. Гумилёва',5,1,2,1),
    ('11000000-0000-0000-0000-000000000003','040000000003','КазНТУ им. К.И. Сатпаева',5,2,2,1),
    ('11000000-0000-0000-0000-000000000004','010000000004','Назарбаев Университет',5,1,5,1),
    ('11000000-0000-0000-0000-000000000005','010000000005','КазГЮУ им. М.С. Нарикбаева',5,1,2,1),
    ('11000000-0000-0000-0000-000000000006','040000000006','КБТУ',5,2,2,1),
    ('11000000-0000-0000-0000-000000000007','190000000007','КарТУ',5,11,2,1),
    ('11000000-0000-0000-0000-000000000008','150000000008','Торайгыров Университет',5,15,2,1),
    ('11000000-0000-0000-0000-000000000009','270000000009','ЗКТУ им. М. Утемисова',5,8,2,1),
    ('11000000-0000-0000-0000-000000000010','070000000010','Атырауский Университет',5,7,2,1),
    ('11000000-0000-0000-0000-000000000011','515000000011','ЮКУ им. М. Ауэзова',5,17,2,1),
    ('11000000-0000-0000-0000-000000000012','030000000012','Almaty Management University',5,6,2,1),
]
cur.execute("DELETE FROM organizations")
for o in orgs:
    cur.execute("""
        INSERT INTO organizations(id,bin,name_ru,org_type_id,region_id,ownership_form_id,status)
        VALUES(%s,%s,%s,%s,%s,%s,'active')
        ON CONFLICT(id) DO NOTHING
    """, (o[0],o[1],o[2],o[3],o[4],o[5]))
print(f"Organizations: {len(orgs)}")

# ─── HELPERS ────────────────────────────────────────────────────────────────
YEARS = [2022, 2023, 2024]

def r(lo, hi): return random.randint(lo, hi)
def rf(lo, hi, dec=2): return round(random.uniform(lo, hi), dec)
def trend(base, year, pct=0.06): return int(base * (1 + pct) ** (year - 2022))
def mln(x): return int(x * 1_000_000)

# Профили ВУЗов (базовый контингент, бюджет млн тг, публикации)
PROFILES = {
    '11000000-0000-0000-0000-000000000001': dict(students=25000, budget=22000, pubs=800,  name='КазНУ'),
    '11000000-0000-0000-0000-000000000002': dict(students=20000, budget=18000, pubs=600,  name='ЕНУ'),
    '11000000-0000-0000-0000-000000000003': dict(students=15000, budget=14000, pubs=400,  name='КазНТУ'),
    '11000000-0000-0000-0000-000000000004': dict(students=7000,  budget=35000, pubs=1200, name='НУ'),   # аномалия: высокий бюджет
    '11000000-0000-0000-0000-000000000005': dict(students=12000, budget=9000,  pubs=300,  name='КазГЮУ'),
    '11000000-0000-0000-0000-000000000006': dict(students=6000,  budget=8000,  pubs=250,  name='КБТУ'),
    '11000000-0000-0000-0000-000000000007': dict(students=11000, budget=7500,  pubs=200,  name='КарТУ'),
    '11000000-0000-0000-0000-000000000008': dict(students=9000,  budget=6000,  pubs=150,  name='ТорУ'),
    '11000000-0000-0000-0000-000000000009': dict(students=7500,  budget=5000,  pubs=100,  name='ЗКТУ'),
    '11000000-0000-0000-0000-000000000010': dict(students=5000,  budget=4000,  pubs=80,   name='АтыУ'),
    '11000000-0000-0000-0000-000000000011': dict(students=16000, budget=11000, pubs=350,  name='ЮКУ'),
    '11000000-0000-0000-0000-000000000012': dict(students=4000,  budget=5500,  pubs=120,  name='AlmaU'),
}

# ─── CONTINGENT ─────────────────────────────────────────────────────────────
cur.execute("DELETE FROM contingent_snapshots")
cnt = 0
for oid, p in PROFILES.items():
    for yr in YEARS:
        total = trend(p['students'], yr)
        bach  = int(total * 0.72)
        mast  = int(total * 0.20)
        phd   = total - bach - mast
        budg  = int(total * 0.48)
        paid  = total - budg
        kz    = int(total * 0.55)
        ru    = int(total * 0.40)
        en    = int(total * 0.04)
        oth   = total - kz - ru - en
        # Аномалия: КБТУ 2024 — резкий рост иностранцев
        foreign = r(50,200) if oid != '11000000-0000-0000-0000-000000000006' else (500 if yr==2024 else r(50,100))
        by_grade = json.dumps({str(i): r(int(total*0.22),int(total*0.28)) for i in range(1,5)})
        cur.execute("""
            INSERT INTO contingent_snapshots(
                org_id, snapshot_date, total_count, new_enrolled, withdrawn,
                bachelor_count, master_count, phd_count,
                full_time_count, distance_count, budget_count, paid_count,
                by_grade_json, by_specialty_json, kz_lang_count, ru_lang_count,
                en_lang_count, other_lang_count, many_children_count,
                low_income_count, disabled_count, orphan_count, oop_count,
                foreign_count, privileged_share, boarding_school_count,
                prize_winners_json, absences_count, submission_status,
                created_at, version
            ) VALUES(
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s::jsonb, '[]'::jsonb, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                '[]'::jsonb, %s, 'approved',
                now(), 1
            )
        """, (
            oid, f'{yr}-12-31', total, r(int(total*0.22),int(total*0.28)), r(100,600),
            bach, mast, phd,
            int(total*0.70), int(total*0.30), budg, paid,
            by_grade, kz, ru,
            en, oth, r(int(total*0.04),int(total*0.07)),
            r(int(total*0.05),int(total*0.09)), r(20,100), r(5,30), r(10,50),
            foreign, round(rf(0.12,0.22),4), r(0,200),
            r(50,500)
        ))
        cnt += 1
print(f"Contingent snapshots: {cnt}")

# ─── FINANCE ────────────────────────────────────────────────────────────────
cur.execute("DELETE FROM finance_records")
cnt = 0
for oid, p in PROFILES.items():
    for yr in YEARS:
        bud = trend(p['budget'], yr) * 1_000_000
        # Аномалия: КарТУ 2024 — бюджет упал (проблемы с финансированием)
        if oid == '11000000-0000-0000-0000-000000000007' and yr == 2024:
            bud = int(bud * 0.62)
        payroll    = int(bud * rf(0.52, 0.60))
        utilities  = int(bud * rf(0.06, 0.10))
        food       = int(bud * rf(0.03, 0.06))
        rnd        = int(bud * rf(0.04, 0.10))
        scholarsh  = int(bud * rf(0.02, 0.05))
        state_ord  = int(bud * rf(0.55, 0.75))
        extra      = bud - state_ord
        cur.execute("""
            INSERT INTO finance_records(
                org_id, period_year, period_quarter, report_date,
                annual_budget, state_order_volume, extra_budget_income,
                per_capita_norm, state_order_planned_amount,
                vouchers_issued, payments_to_suppliers,
                expenses_payroll, expenses_utilities, expenses_food,
                expenses_rnd, expenses_scholarships, expenses_medical,
                expenses_retraining, expenses_transport,
                paid_vs_free_ratio, payment_orders_count,
                financing_requests_count, currency_code,
                submission_status, created_at, version
            ) VALUES(
                %s, %s, 4, %s::date,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, 'KZT',
                'approved', now(), 1
            )
        """, (
            oid, yr, f'{yr}-12-31',
            bud, state_ord, extra,
            round(bud/p['students']/10), state_ord,
            r(500,3000), int(bud*rf(0.85,0.98)),
            payroll, utilities, food,
            rnd, scholarsh, int(bud*rf(0.01,0.02)),
            int(bud*rf(0.01,0.02)), int(bud*rf(0.01,0.03)),
            round(rf(0.4,0.7),3), r(200,2000),
            r(50,300)
        ))
        cnt += 1
print(f"Finance records: {cnt}")

# ─── SCIENCE ────────────────────────────────────────────────────────────────
cur.execute("DELETE FROM science_activity")
cnt = 0
for oid, p in PROFILES.items():
    for yr in YEARS:
        pubs = trend(p['pubs'], yr, 0.08)
        # Аномалия: AlmaU 2024 — всплеск публикаций Q1 (необычно для размера)
        q1 = r(int(pubs*0.20), int(pubs*0.30)) if oid != '11000000-0000-0000-0000-000000000012' else (r(180,220) if yr==2024 else r(20,40))
        q2 = r(int(pubs*0.15), int(pubs*0.25))
        q3 = r(int(pubs*0.10), int(pubs*0.20))
        q4 = r(int(pubs*0.05), int(pubs*0.15))
        scopus = q1+q2+q3+q4
        wos    = int(scopus * rf(0.5, 0.8))
        researchers = r(int(p['students']*0.04), int(p['students']*0.07))
        grants_fund = int(p['budget'] * rf(0.05, 0.15) * 1_000_000 * (1.08**(yr-2022)))
        grants_json = json.dumps([
            {"name": f"Грант МОН #{yr}-{i}", "amount": r(5,80)*1000000,
             "source": random.choice(["МОН РК","КН МОН","ВРН","EU Horizon","NIH"]),
             "status": "active"} for i in range(1, r(3,8))
        ])
        cur.execute("""
            INSERT INTO science_activity(
                org_id, period_year, report_date,
                publications_total, publications_q1, publications_q2,
                publications_q3, publications_q4, publications_scopus, publications_wos,
                publications_kokson, publications_rinc, publications_books,
                publications_conference_intl, publications_conference_local,
                grants_json, grants_active_count, grants_completed_count,
                grants_total_funding, grants_state_funding, grants_international_funding,
                grants_per_researcher,
                niokr_total_count, niokr_total_funding, niokr_with_industry, niokr_implemented,
                patents_filed, patents_granted_kz, patents_granted_intl, patents_active,
                researchers_total, researchers_phd, researchers_candidate, researchers_young,
                phd_students_total, phd_dissertations_defended,
                hirsch_index_avg, hirsch_index_max,
                intl_partners_count, intl_joint_projects,
                citations_total_scopus, citations_total_wos,
                student_publications, student_research_circles, student_conferences,
                research_labs_count, research_centers_count,
                submission_status, created_at, version
            ) VALUES(
                %s, %s, %s::date,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s::jsonb, %s, %s,
                %s, %s, %s,
                %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s,
                'approved', now(), 1
            )
        """, (
            oid, yr, f'{yr}-12-31',
            pubs, q1, q2,
            q3, q4, scopus, wos,
            r(int(pubs*0.3),int(pubs*0.5)), r(int(pubs*0.1),int(pubs*0.2)), r(5,30),
            r(int(pubs*0.05),int(pubs*0.12)), r(int(pubs*0.10),int(pubs*0.25)),
            grants_json, r(3,15), r(2,10),
            grants_fund, int(grants_fund*rf(0.6,0.8)), int(grants_fund*rf(0.1,0.3)),
            round(grants_fund/max(researchers,1)/1_000_000,2),
            r(5,30), int(grants_fund*rf(0.3,0.6)), r(2,12), r(3,15),
            r(5,30), r(3,15), r(0,5), r(3,20),
            researchers, int(researchers*rf(0.25,0.35)), int(researchers*rf(0.40,0.55)), int(researchers*rf(0.20,0.35)),
            r(int(p['students']*0.01), int(p['students']*0.03)), r(5,30),
            round(rf(2.5,8.5),2), round(rf(8,25),2),
            r(5,40), r(2,15),
            scopus*r(3,8), wos*r(2,5),
            r(50,500), r(10,80), r(20,200),
            r(3,20), r(1,8)
        ))
        cnt += 1
print(f"Science activity: {cnt}")

# ─── GRADUATES ──────────────────────────────────────────────────────────────
cur.execute("DELETE FROM graduates_records")
cnt = 0
for oid, p in PROFILES.items():
    for yr in YEARS:
        total_g = int(p['students'] * rf(0.20, 0.27))
        bach_g  = int(total_g * 0.70)
        mast_g  = int(total_g * 0.22)
        phd_g   = total_g - bach_g - mast_g
        # Аномалия: ЗКТУ 2024 — резкое падение трудоустройства
        emp_pct = rf(0.70, 0.85) if not (oid=='11000000-0000-0000-0000-000000000009' and yr==2024) else rf(0.38, 0.45)
        employed = int(total_g * emp_pct)
        avg_sal  = trend(200000 + p['budget']*5, yr, 0.07)
        employer_sat = round(rf(3.8, 4.8), 2)
        cur.execute("""
            INSERT INTO graduates_records(
                org_id, graduation_year, period_year, report_date,
                total_graduates, graduates_bachelor, graduates_master, graduates_phd,
                graduates_with_honors, graduates_grant_funded, graduates_paid_funded,
                graduates_foreign, graduates_full_time, graduates_part_time,
                employed_count, employed_by_specialty, employed_other_field,
                unemployed_count, self_employed, continue_education,
                continue_education_master, continue_education_phd,
                employed_state_sector, employed_private_sector, employed_it_sector,
                employed_in_region, employed_other_region, employed_abroad,
                avg_salary_first_year, avg_salary_third_year, avg_salary_fifth_year,
                employed_within_3_months, employed_within_6_months, employed_within_1_year,
                partner_employers_count, employer_satisfaction, graduate_satisfaction,
                final_attestation_avg_score, final_attestation_pass_pct,
                employed_6m_pct, employed_12m_pct,
                submission_status, created_at, version
            ) VALUES(
                %s, %s, %s, %s::date,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                'approved', now(), 1
            )
        """, (
            oid, yr, yr, f'{yr}-06-30',
            total_g, bach_g, mast_g, phd_g,
            int(total_g*rf(0.08,0.15)), int(total_g*rf(0.40,0.55)), int(total_g*rf(0.45,0.60)),
            r(10,80), int(total_g*0.72), int(total_g*0.28),
            employed, int(employed*rf(0.55,0.70)), int(employed*rf(0.30,0.45)),
            total_g-employed-r(50,200), r(30,150), int(total_g*rf(0.05,0.12)),
            int(total_g*rf(0.03,0.08)), int(total_g*rf(0.01,0.03)),
            int(employed*rf(0.25,0.35)), int(employed*rf(0.50,0.60)), int(employed*rf(0.08,0.15)),
            int(employed*rf(0.50,0.65)), int(employed*rf(0.25,0.35)), r(5,50),
            avg_sal, int(avg_sal*1.4), int(avg_sal*1.9),
            int(employed*rf(0.30,0.45)), int(employed*rf(0.55,0.70)), int(employed*rf(0.75,0.90)),
            r(20,150), employer_sat, round(rf(3.5,4.6),2),
            round(rf(76,92),2), round(rf(88,99),2),
            round(emp_pct*0.9,4), round(emp_pct,4)
        ))
        cnt += 1
print(f"Graduates records: {cnt}")

# ─── EDUCATIONAL PROCESS ─────────────────────────────────────────────────────
cur.execute("DELETE FROM educational_process")
cnt = 0
for oid, p in PROFILES.items():
    for yr in YEARS:
        teachers = int(p['students'] / rf(9, 14))
        phd_t    = int(teachers * rf(0.12, 0.22))
        cand_t   = int(teachers * rf(0.30, 0.45))
        specs    = r(30, 120)
        cur.execute("""
            INSERT INTO educational_process(
                org_id, period_year, report_date,
                teachers_total, teachers_full_time, teachers_part_time,
                teachers_with_phd, teachers_with_candidate, teachers_with_doctorate,
                teachers_professors, teachers_docents, teachers_senior,
                teachers_under_35, teachers_above_60, teachers_foreign,
                avg_teacher_age, teacher_to_student_ratio,
                specialties_total, specialties_bachelor, specialties_master, specialties_phd,
                specialties_accredited, specialties_intl_accredited,
                dual_degree_programs, english_programs, new_programs_launched,
                avg_gpa, gpa_above_3_5_count, gpa_below_2_0_count,
                expulsion_total, expulsion_academic, retention_rate,
                pass_rate_first_attempt, state_exam_pass_rate,
                internship_partners_count, students_on_internship, students_internship_abroad,
                academic_mobility_in, academic_mobility_out,
                olympiad_participants, olympiad_winners_intl, olympiad_winners_republic,
                classrooms_total, computer_classrooms, lab_classrooms,
                library_books_count, library_electronic_resources,
                continuing_education_count, qualification_courses,
                submission_status, created_at, version
            ) VALUES(
                %s, %s, %s::date,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                'approved', now(), 1
            )
        """, (
            oid, yr, f'{yr}-12-31',
            teachers, int(teachers*rf(0.70,0.82)), teachers-int(teachers*0.75),
            phd_t, cand_t, int(phd_t*rf(0.3,0.6)),
            int(cand_t*rf(0.15,0.25)), int(cand_t*rf(0.35,0.50)), int(teachers*rf(0.10,0.18)),
            int(teachers*rf(0.15,0.25)), int(teachers*rf(0.10,0.20)), r(2,30),
            round(rf(42,52),1), round(teachers/p['students'],4),
            specs, int(specs*0.65), int(specs*0.25), specs-int(specs*0.65)-int(specs*0.25),
            int(specs*rf(0.65,0.90)), r(0,15),
            r(0,8), r(2,20), r(1,10),
            round(rf(3.10,3.75),2), r(int(p['students']*0.15),int(p['students']*0.30)), r(50,500),
            r(int(p['students']*0.01),int(p['students']*0.04)), r(20,200), round(rf(0.82,0.96),4),
            round(rf(0.78,0.95),4), round(rf(0.80,0.97),4),
            r(20,200), r(int(p['students']*0.05),int(p['students']*0.15)), r(20,300),
            r(10,200), r(20,300),
            r(int(p['students']*0.02),int(p['students']*0.06)), r(5,30), r(2,10),
            r(100,800), r(10,60), r(20,100),
            r(50000,500000), r(5000,50000),
            r(int(p['students']*0.03),int(p['students']*0.08)), r(20,150)
        ))
        cnt += 1
print(f"Educational process: {cnt}")

conn.commit()
cur.close()
conn.close()
print("\n✅ Seed complete!")
