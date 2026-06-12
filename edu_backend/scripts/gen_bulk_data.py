#!/usr/bin/env python3
"""Bulk data generator — 2000+ orgs, 100+ per region/type, years 2020-2025 with anomalies."""
import random, uuid, sys

random.seed(42)

REGIONS = list(range(1, 21))
REGION_NAMES = {
    1:"Астана",2:"Алматы",3:"Шымкент",4:"Акмолинская",
    5:"Актюбинская",6:"Алматинская",7:"Атырауская",
    8:"Западно-Казахстанская",9:"Жамбылская",10:"Жетісу",
    11:"Карагандинская",12:"Костанайская",13:"Кызылординская",
    14:"Мангистауская",15:"Павлодарская",16:"Северо-Казахстанская",
    17:"Туркестанская",18:"Ұлытау",19:"Абай",20:"Восточно-Казахстанская",
}

# (code, count_per_region)
ORG_TYPES = {
    1:("ДО", 20), 2:("ДопО", 12), 3:("СО", 30), 4:("ТиПО", 16),
    5:("ВиПО", 14), 6:("Общ", 10), 7:("ГОНС", 8),
}

NAME_TPLS = {
    1:["Детский сад №{n} ({r})","ДО «Балапан» №{n} ({r})","Ясли-сад №{n} ({r})",
       "ДОО «Жулдыз» №{n} ({r})","Детский сад «Айгерим» №{n} ({r})","Дошкольный центр №{n} ({r})"],
    2:["ЦДО №{n} ({r})","Центр допобразования №{n} ({r})","Школа искусств №{n} ({r})",
       "Дом детского творчества №{n} ({r})","ЦТД «Өркен» №{n} ({r})","Музыкальная школа №{n} ({r})"],
    3:["СШ №{n} ({r})","СОШ №{n} ({r})","Гимназия №{n} ({r})","Лицей №{n} ({r})",
       "ОШ «Білім» №{n} ({r})","Школа-гимназия №{n} ({r})",
       "Специализированная школа №{n} ({r})","Интернат №{n} ({r})"],
    4:["Колледж №{n} ({r})","Профессиональный колледж №{n} ({r})",
       "Политехнический колледж №{n} ({r})","Медицинский колледж №{n} ({r})",
       "Аграрный колледж №{n} ({r})","Технический колледж №{n} ({r})",
       "Строительный колледж №{n} ({r})","Педагогический колледж №{n} ({r})"],
    5:["Университет №{n} ({r})","Институт менеджмента №{n} ({r})",
       "Казахстанский университет №{n} ({r})","Высшая школа №{n} ({r})",
       "Академия №{n} ({r})","Институт технологий №{n} ({r})",
       "Международный университет №{n} ({r})","Медицинский университет №{n} ({r})"],
    6:["Общежитие №{n} ({r})","Студенческий дом №{n} ({r})",
       "Общежитие «Жастар» №{n} ({r})","Учебное общежитие №{n} ({r})"],
    7:["ГОНС «Келешек» №{n} ({r})","Центр «Келешек» №{n} ({r})",
       "ГОНС «Болашақ» №{n} ({r})","Накопительный центр ГОНС №{n} ({r})"],
}

CONT_BASE = {1:(50,300),2:(100,600),3:(200,1500),4:(300,2000),5:(500,8000),6:(50,400),7:(100,500)}
FIN_BASE  = {1:(50e6,300e6),2:(30e6,200e6),3:(100e6,800e6),4:(200e6,1500e6),
             5:(500e6,10000e6),6:(20e6,150e6),7:(100e6,600e6)}
OWNERSHIP = [1,2,3,4]
YEARS = [2020,2021,2022,2023,2024,2025]

def esc(s): return s.replace("'","''")
def ri(lo,hi): return random.randint(int(lo),int(hi))
def rd(lo,hi,d=2): return round(random.uniform(lo,hi),d)

def st(yr):
    return 'approved' if yr < 2025 else random.choice(['submitted','under_review','draft'])

def gen_contingent(oid,ot,yr,anom):
    lo,hi = CONT_BASE.get(ot,(100,500))
    total = ri(lo,hi)
    if anom and random.random()<0.05:
        total = max(1,int(total*random.choice([0.1,4.0,6.0])))
    bach=int(total*rd(0.5,0.7)) if ot==5 else 0
    mast=int(total*rd(0.1,0.2)) if ot==5 else 0
    phd=max(0,total-bach-mast) if ot==5 else 0
    ft=int(total*rd(0.6,0.85)); dist=total-ft
    bud_c=int(total*rd(0.3,0.6)); paid_c=total-bud_c
    kz=int(total*rd(0.5,0.75)); ru=int(total*rd(0.15,0.35))
    en=int(total*rd(0.0,0.1)) if ot==5 else 0
    oth=max(0,total-kz-ru-en)
    new_e=int(total*rd(0.2,0.35)); withdr=int(total*rd(0.05,0.15))
    disab=ri(0,max(1,int(total*0.03))); orph=ri(0,max(1,int(total*0.02)))
    priv=rd(5,25); absn=ri(0,max(1,int(total*0.05)))
    return (f"INSERT INTO contingent_snapshots"
        f"(org_id,snapshot_date,total_count,new_enrolled,withdrawn,"
        f"bachelor_count,master_count,phd_count,full_time_count,distance_count,"
        f"budget_count,paid_count,kz_lang_count,ru_lang_count,en_lang_count,other_lang_count,"
        f"disabled_count,orphan_count,privileged_share,absences_count,submission_status)"
        f"VALUES('{oid}','{yr}-12-31',{total},{new_e},{withdr},"
        f"{bach},{mast},{phd},{ft},{dist},{bud_c},{paid_c},{kz},{ru},{en},{oth},"
        f"{disab},{orph},{priv},{absn},'{st(yr)}')"
        f"ON CONFLICT(org_id,snapshot_date)DO NOTHING;\n")

def gen_finance(oid,ot,yr,anom):
    lo,hi = FIN_BASE.get(ot,(50e6,500e6))
    bud=round(random.uniform(lo,hi),2)
    if anom and random.random()<0.05:
        bud=round(bud*random.choice([0.15,4.0,7.0]),2)
    so=round(bud*rd(0.4,0.7),2); extra=round(bud*rd(0.05,0.2),2)
    pay=round(bud*rd(0.35,0.55),2)
    if anom and random.random()<0.04:
        pay=round(bud*random.choice([0.92,1.08,0.04]),2)
    util=round(bud*rd(0.05,0.12),2); food=round(bud*rd(0.03,0.1),2)
    rnd_e=round(bud*rd(0.0,0.08 if ot==5 else 0.01),2)
    sch=round(bud*rd(0.0,0.06 if ot==5 else 0.01),2)
    anti=round(bud*rd(0.005,0.02),2); med=round(bud*rd(0.01,0.04),2)
    retr=round(bud*rd(0.005,0.03),2); transp=round(bud*rd(0.005,0.02),2)
    pc=round(bud/max(1,ri(50,5000)),2); vouch=ri(0,200); ratio=rd(0,80)
    return (f"INSERT INTO finance_records"
        f"(org_id,period_year,period_month,"
        f"annual_budget,state_order_volume,extra_budget_income,per_capita_norm,"
        f"expenses_payroll,expenses_utilities,expenses_food,expenses_rnd,"
        f"expenses_scholarships,expenses_antiterror,expenses_medical,"
        f"expenses_retraining,expenses_transport,vouchers_issued,paid_vs_free_ratio,submission_status)"
        f"VALUES('{oid}',{yr},NULL,"
        f"{bud},{so},{extra},{pc},{pay},{util},{food},{rnd_e},"
        f"{sch},{anti},{med},{retr},{transp},{vouch},{ratio},'{st(yr)}')"
        f"ON CONFLICT(org_id,period_year,period_month)DO NOTHING;\n")

def gen_science(oid,yr,anom):
    sc=ri(0,80); wos=ri(0,50); q1=ri(0,20); q2=ri(0,30)
    tot=sc+wos+ri(10,200)
    if anom and random.random()<0.04:
        sc=sc*ri(8,20); tot=tot*ri(5,15)
    hi_avg=rd(0.5,12.0); hi_max=hi_avg+rd(1,15)
    pat=ri(0,20); pat_kz=ri(0,15)
    gr_cnt=ri(0,10); gr_amt=round(random.uniform(0,50e6),2)
    ni_cnt=ri(0,8); ni_amt=round(random.uniform(0,30e6),2)
    com=ri(0,5); com_rv=round(random.uniform(0,10e6),2)
    return (f"INSERT INTO science_activity"
        f"(org_id,period_year,report_date,"
        f"publications_scopus,publications_wos,publications_q1,publications_q2,publications_total,"
        f"hirsch_index_avg,hirsch_index_max,patents_filed,patents_granted_kz,"
        f"grants_active_count,grants_total_funding,niokr_total_count,niokr_total_funding,"
        f"commercialized_results,commercialization_revenue,submission_status)"
        f"VALUES('{oid}',{yr},'{yr}-12-31',"
        f"{sc},{wos},{q1},{q2},{tot},"
        f"{hi_avg},{hi_max},{pat},{pat_kz},"
        f"{gr_cnt},{gr_amt},{ni_cnt},{ni_amt},"
        f"{com},{com_rv},'{st(yr)}')"
        f"ON CONFLICT DO NOTHING;\n")

def gen_graduates(oid,ot,yr,anom):
    lo,hi = (50,400) if ot==4 else (100,1500)
    total=ri(lo,hi)
    bach=int(total*rd(0.5,0.7)) if ot==5 else 0
    mast=int(total*rd(0.1,0.2)) if ot==5 else 0
    phd=max(0,total-bach-mast) if ot==5 else 0
    spec=total if ot==4 else 0
    hon=ri(0,max(1,int(total*0.1)))
    gr_f=int(total*rd(0.2,0.5)); paid_f=total-gr_f
    fore=ri(0,max(1,int(total*0.05)))
    empl=int(total*rd(0.55,0.85))
    by_sp=int(empl*rd(0.5,0.8)); oth_f=empl-by_sp; unempl=total-empl
    ep=round(empl/max(1,total)*100,2)
    if anom and random.random()<0.05: ep=round(rd(3,18),2)
    att_avg=rd(60,90); att_pass=rd(70,98)
    return (f"INSERT INTO graduates_records"
        f"(org_id,graduation_year,report_date,"
        f"total_graduates,graduates_bachelor,graduates_master,graduates_phd,graduates_specialist,"
        f"graduates_with_honors,graduates_grant_funded,graduates_paid_funded,graduates_foreign,"
        f"employed_count,employed_by_specialty,employed_other_field,unemployed_count,"
        f"employed_6m_pct,final_attestation_avg_score,final_attestation_pass_pct,submission_status)"
        f"VALUES('{oid}',{yr},'{yr}-07-01',"
        f"{total},{bach},{mast},{phd},{spec},"
        f"{hon},{gr_f},{paid_f},{fore},"
        f"{empl},{by_sp},{oth_f},{unempl},"
        f"{ep},{att_avg},{att_pass},'{st(yr)}')"
        f"ON CONFLICT DO NOTHING;\n")

def gen_education(oid,ot,yr,anom):
    mand=ri(3,20); opt=ri(0,10); intl=ri(0,5 if ot==5 else 1)
    start=ri(0,5)
    teach=ri(10,500); ft_t=int(teach*rd(0.7,0.9)); pt_t=teach-ft_t
    phd_t=ri(0,max(1,int(teach*0.15)) if ot==5 else 2)
    cand_t=ri(0,max(1,int(teach*0.25)) if ot==5 else 3)
    prof_t=ri(0,max(1,int(teach*0.1)) if ot==5 else 1)
    young_t=int(teach*rd(0.2,0.4))
    if anom and random.random()<0.03:
        teach=ri(1,5); ft_t=teach; pt_t=0; young_t=ri(0,teach); phd_t=0; cand_t=0; prof_t=0
    dev='true' if random.random()>0.3 else 'false'
    return (f"INSERT INTO educational_process"
        f"(org_id,snapshot_date,period_year,"
        f"mandatory_programs_count,optional_programs_count,international_programs_count,"
        f"startup_projects_count,"
        f"teachers_total,teachers_full_time,teachers_part_time,"
        f"teachers_with_phd,teachers_with_candidate,teachers_professors,teachers_under_35,"
        f"has_developing_environment,submission_status)"
        f"VALUES('{oid}','{yr}-12-31',{yr},"
        f"{mand},{opt},{intl},{start},"
        f"{teach},{ft_t},{pt_t},{phd_t},{cand_t},{prof_t},{young_t},"
        f"{dev},'{st(yr)}')"
        f"ON CONFLICT(org_id,snapshot_date)DO NOTHING;\n")

def main():
    used_bins=set()
    def gen_bin():
        while True:
            b=str(random.randint(100_000_000_000,999_999_999_999))
            if b not in used_bins:
                used_bins.add(b); return b

    out=sys.stdout
    out.write("BEGIN;\n")

    orgs=[]
    counter=0
    for region_id in REGIONS:
        rname=REGION_NAMES[region_id]
        for ot,(code,cnt) in ORG_TYPES.items():
            tpls=NAME_TPLS[ot]
            for i in range(cnt):
                counter+=1
                oid=str(uuid.uuid4())
                bin_=gen_bin()
                name=esc(tpls[i%len(tpls)].format(n=counter,r=rname))
                own=random.choice(OWNERSHIP)
                yr_s=random.randint(1990,2015)
                out.write(
                    f"INSERT INTO organizations(id,bin,name_ru,org_type_id,ownership_form_id,region_id,status,activity_start_date)"
                    f"VALUES('{oid}','{bin_}','{name}',{ot},{own},{region_id},'active','{yr_s}-09-01')"
                    f"ON CONFLICT(bin)DO NOTHING;\n"
                )
                orgs.append((oid,ot,region_id))

    out.write(f"-- generated {len(orgs)} orgs\n")

    anomaly_set=set(random.sample([r[0] for r in orgs], max(1,len(orgs)//20)))
    for oid,ot,rid in orgs:
        anom=oid in anomaly_set
        for yr in YEARS:
            out.write(gen_contingent(oid,ot,yr,anom))
            out.write(gen_finance(oid,ot,yr,anom))
            out.write(gen_education(oid,ot,yr,anom))
            if ot==5:
                out.write(gen_science(oid,yr,anom))
            if ot in (4,5):
                out.write(gen_graduates(oid,ot,yr,anom))

    out.write("COMMIT;\n")
    sys.stderr.write(f"Done: {len(orgs)} orgs\n")

main()
