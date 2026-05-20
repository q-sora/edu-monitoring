-- Migration 012: New section tables + 538 pending catalog fields

BEGIN;

-- ── CREATE new section tables ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS edu_digitalization (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_digitalization_org ON edu_digitalization(org_id);
CREATE INDEX IF NOT EXISTS idx_digitalization_lvl ON edu_digitalization(education_level);
ALTER TABLE edu_digitalization ENABLE ROW LEVEL SECURITY;
CREATE POLICY digitalization_rls ON edu_digitalization USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_dormitory (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_dormitory_org ON edu_dormitory(org_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_lvl ON edu_dormitory(education_level);
ALTER TABLE edu_dormitory ENABLE ROW LEVEL SECURITY;
CREATE POLICY dormitory_rls ON edu_dormitory USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_education_process (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_education_process_org ON edu_education_process(org_id);
CREATE INDEX IF NOT EXISTS idx_education_process_lvl ON edu_education_process(education_level);
ALTER TABLE edu_education_process ENABLE ROW LEVEL SECURITY;
CREATE POLICY education_process_rls ON edu_education_process USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_equipment (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_equipment_org ON edu_equipment(org_id);
CREATE INDEX IF NOT EXISTS idx_equipment_lvl ON edu_equipment(education_level);
ALTER TABLE edu_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_rls ON edu_equipment USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_fraud (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_fraud_org ON edu_fraud(org_id);
CREATE INDEX IF NOT EXISTS idx_fraud_lvl ON edu_fraud(education_level);
ALTER TABLE edu_fraud ENABLE ROW LEVEL SECURITY;
CREATE POLICY fraud_rls ON edu_fraud USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_general_info (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_general_info_org ON edu_general_info(org_id);
CREATE INDEX IF NOT EXISTS idx_general_info_lvl ON edu_general_info(education_level);
ALTER TABLE edu_general_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY general_info_rls ON edu_general_info USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_graduates_ext (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_graduates_ext_org ON edu_graduates_ext(org_id);
CREATE INDEX IF NOT EXISTS idx_graduates_ext_lvl ON edu_graduates_ext(education_level);
ALTER TABLE edu_graduates_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY graduates_ext_rls ON edu_graduates_ext USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_groups (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_groups_org ON edu_groups(org_id);
CREATE INDEX IF NOT EXISTS idx_groups_lvl ON edu_groups(education_level);
ALTER TABLE edu_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_rls ON edu_groups USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_infrastructure (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_infrastructure_org ON edu_infrastructure(org_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_lvl ON edu_infrastructure(education_level);
ALTER TABLE edu_infrastructure ENABLE ROW LEVEL SECURITY;
CREATE POLICY infrastructure_rls ON edu_infrastructure USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_international (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_international_org ON edu_international(org_id);
CREATE INDEX IF NOT EXISTS idx_international_lvl ON edu_international(education_level);
ALTER TABLE edu_international ENABLE ROW LEVEL SECURITY;
CREATE POLICY international_rls ON edu_international USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_medical (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_medical_org ON edu_medical(org_id);
CREATE INDEX IF NOT EXISTS idx_medical_lvl ON edu_medical(education_level);
ALTER TABLE edu_medical ENABLE ROW LEVEL SECURITY;
CREATE POLICY medical_rls ON edu_medical USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE TABLE IF NOT EXISTS edu_science_ext (
    id           BIGSERIAL PRIMARY KEY,
    org_id       UUID NOT NULL REFERENCES organizations(id),
    education_level VARCHAR(10) NOT NULL,
    period_year  SMALLINT NOT NULL,
    period_month SMALLINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (org_id, education_level, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_science_ext_org ON edu_science_ext(org_id);
CREATE INDEX IF NOT EXISTS idx_science_ext_lvl ON edu_science_ext(education_level);
ALTER TABLE edu_science_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY science_ext_rls ON edu_science_ext USING (org_id = current_setting('app.org_id', true)::uuid);

-- ── ADD field columns ──────────────────────────────────────────────

ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS erp_subd_avtomatizatsiya_protsessov NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS it_oborudovanie_kompyuteryinteraktivnye_doskiplanshety NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS avtomaticheskaya_sistema_ucheta_turniket_face_id_skud_i_td NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS dokumenty_po_informatsionnoj_bezopasnosti_obrabotke_i_zaschite_ NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS internet_i_svyaz_skorost_stabilnost_propusknaya_sposobnost_tari NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS nalichie_informatsionnykh_sistem NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS nalichie_sajta_mobilnykh_prilozhenij_elektronnykh_bibliotek_tsi NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS tekhzaschita_antivirusy_obnovlenie_os_rezervnoe_kopirovanie_dan NUMERIC;
ALTER TABLE edu_digitalization ADD COLUMN IF NOT EXISTS tsifrovye_platformyservisy_onlajn_platforma_dlya_obucheniya_dis NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS vvod_obekta_v_ekspluatatsiyu_postavschikom NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS data_provedeniya_kapitalnogo_remonta NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS dokumenty_postavschika_notarialno_zaverennaya_kopiya_akta_priem NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS dokumenty_postavschika_pravoustanavlivayuschie_i_identifikatsio NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS zaklyuchenie_dogovora_goszakaza_na_razmeschenie_studentov_v_obs NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS zaklyuchenie_dopolnitelnogo_soglasheniya_k_predvaritelnomu_dogo NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS zaklyuchenie_i_registratsiya_soglasheniya_o_neizmennosti_tselev NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS zaklyuchenie_predvaritelnogo_dogovora_po_utverzhdennoj_forme_op NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS integratsiya_s_sistemoj_stutdom_edinaya_platforma_vysshego_obra NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS kolichestvo_zhilykh_komnat_i_ikh_ploschad NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS kolichestvo_mest_predusmotrennykh_proektnoj_dokumentatsiej NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS kolichestvo_etazhej NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS kolichestvom_chasov_prozhivaniya_odnogo_studenta_v_sootvetstvuy TEXT;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS korrektnosti_iin_v_gbdfl_kak_studenta NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS material_sten_i_konstruktivnye_kharakteristiki NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS monitoring_fakticheski_zanyatykh_studentami_mest_v_obschezhitii NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS nalichie_i_ploschad_vspomogatelnykh_pomeschenij_sanuzly_kukhni_ NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS obschaya_ploschad_kvm NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS obschij_srok_dogovora_gos_zakaza NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS osuschestvlenie_monitoringa_vvoda_obekta_v_ekspluatatsiyu_opera NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS ploschad_zemelnogo_uchastka_i_prinadlezhnost NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS podacha_postavschikom_zayavleniya_i_polnogo_paketa_dokumentov_d NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS podacha_postavschikom_zayavleniya_i_polnogo_paketa_dokumento_2 NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS poleznaya_ploschad_kvm NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS proverka_mesta_obucheniya_po_vuzam_v_epvo NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS proverka_mesta_obucheniya_po_kolledzham_v_lms NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS proverka_propiski_v_gbdfl NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS proektnaya_moschnost NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS rastorzhenie_dogovora_gos_zakaza_data_osnovanie_prichina NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS rastorzhenie_predvaritelnogo_dogovora_data_osnovanie_prichina NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS tekhnicheskoe_sostoyanie_zdaniya NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS fiksatsiya_perioda_prozhivaniya_ne_menee_7236_chasov_v_techenie NUMERIC;
ALTER TABLE edu_dormitory ADD COLUMN IF NOT EXISTS formirovanie_korrektnogo_reestra NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS akademicheskaya_mobilnost_vkhodyaschaya_iskhodyaschaya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS akademicheskaya_uspevaemost NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS dopolnitelnye_vidy_obrazovatelnykh_programm NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_prizerov_olimpiad_mezhdunarodnogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_prizerov_olimpiad_oblastnogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_prizerov_olimpiad_rajonnogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_prizerov_olimpiad_respublikanskogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_studentov_vkhodyaschej_mobilnosti_vnutri_rk NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_studentov_vkhodyaschej_mobilnosti_za_rubezh NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_studentov_iskhodyaschej_mobilnosti_vnutri_rk NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_studentov_iskhodyaschej_mobilnosti_za_rubezh NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_uchastnikov_olimpiad_mezhdunarodnogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_uchastnikov_olimpiad_oblastnogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_uchastnikov_olimpiad_rajonnogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kol_vo_uchastnikov_olimpiad_respublikanskogo_urovnya NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kolichestvo_mezhdunarodnykh_programm_i_partnerov NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kolichestvo_obrazovatelnoj_programmy_po_vyboru NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS kolichestvo_obyazatelnykh_obrazovatelnykh_programm NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS nalichie_razvivayuschej_sredy NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS nalichie_startap_proektov NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS praktika_studentov_partnyory_mesta_praktiki_stazhirovka NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS rezultaty_oprosovanketirovaniya_roditelej NUMERIC;
ALTER TABLE edu_education_process ADD COLUMN IF NOT EXISTS uchastie_v_olimpiadakh_konkursakh_chempionatakh_sorevnovaniyakh NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS itoborudovanie_servery_pk_laboratorii_simulyatory NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS amortizatsiya_oborudovaniya_iznos_srok_sluzhby_ostatochnaya_sto NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS investitsii_v_oborudovanie_za_poslednie_3_goda_po_napravleniyam NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS materialno_tekhnicheskaya_baza NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS materialno_tekhnicheskaya_baza_dlya_spetsialnykh_gruppkorrektsi NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS nauchnoe_oborudovanie_mikroskopy_robototekhnika_khimbio_oborudo NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS proizvodstvennye_masterskie_nalichie_osnaschenie NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS raskhodnye_materialy_dlya_praktiki_obyom_zakupok_v_god NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS raskhodnye_materialy_reaktivy_laboratornye_materialy NUMERIC;
ALTER TABLE edu_equipment ADD COLUMN IF NOT EXISTS uchebnye_materialy_bibliotekaelektronnye_uchebniki_i_td NUMERIC;
ALTER TABLE edu_fraud ADD COLUMN IF NOT EXISTS korrektnost_iin_v_gbdfl_na_zhivogo_zadvoennogo_kak_vospitannika NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS id_sistemy_ucheta NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS akkreditatsiya_gosudarstvennaya_natsionalnaya_mezhdunarodnaya_a NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS bin_organizatsii NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS byudzhetnye_zayavki_na_finansirovanie_premii_gosudarstva NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS byudzhetnye_zayavki_na_finansirovanie_startovogo_obrazovatelnog NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS vid_organizatsii_obrazovaniya NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS data_polucheniya_litsenzii NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS data_reorganizatsiipereuchrezhdeniya_esli_byla NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS dogovory_o_sotrudnichestve_v_ramkakh_gons_mezhdu_bvu_kszh_i_fin NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS dogovory_porucheniyadogovory_prisoedineniya NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS zayavleniya_na_prisoedinenie_postavschikov_k_dogovoru NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS kolichestvo_bvukszh_uchastniki_gons NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS kolichestvo_obschezhitij_predostavlyayuschikh_mesta_studentam_p NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS kolichestvo_organizatsij_sozdannykh_dejstvuyuschikh_likvidirova NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS kolichestvo_smen_obucheniya NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS litsenzirovanie_nalichie_litsenzii_na_obrazovatelnuyu_deyatelno NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS litsenzirovanie_nalichie_litsenzii_perechen_spetsialnostej_napr NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS naimenovanie_organizatsii_ili_bvukszh NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS napravleniya_podgotovki NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS naselennyj_punkt_i_adres NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS nachalo_obrazovatelnoj_deyatelnosti NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS oblast_gorod_respznacheniya NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS obschee_kolichestvo_vkladov_depozitov_aqyl_i_v_razreze_bvu NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS obschee_kolichestvo_dogovorov_strakhovaniya_i_v_razreze_kszh NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS obschezhitiya_na_balanse_tipo_vuz_ili_chastnogo_investora NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS osnovnye_finansovye_pokazateli_bvu_kszh_aktivy_obyazatelstva_us NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS plany_razvitiya_strategicheskie_plany_otchety NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS proektnaya_moschnost NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS spravka_vypiska_o_nachislennom_startovom_obrazovatelnom_kapital NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS status_natsionalnyj_gosudarstvennyj_regionalnyj_chastnyj_mezhdu NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS forma_sobstvennosti NUMERIC;
ALTER TABLE edu_general_info ADD COLUMN IF NOT EXISTS yazyk_obucheniya_organizatsii_obrazovaniya_kaz_russ_angl_smesha NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS vyplachennye_nalogi_vypusknikov_v_razreze_otraslej NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS dolya_trudoustroennykh_vypusknikov_cherez_6_12_36_60_mesyatsev TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS dostizheniya_vypusknikov_prof_biznes_uspekhi_vysokie_rezultaty_ NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_zaregistrirovannykh_kak_bezrabotnye_v_r NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_pervichno_trudoustroennykh NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osnove NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osnove_ NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osno_2 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osno_2 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu_s_anglij NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu_s_kazakh NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu_s_russki NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_prodolzhivshikh_obuchenie_v_vipo NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_100_119 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_100_119_s_anglijskim_yazyk NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_100_119_s_kazakhskim_yazyk NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_100_119_s_russkim_yazykom_ NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140_s_angli NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140_s_kazak NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140_s_russk NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_70_99 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_70_99_s_anglijskim_yazykom NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_70_99_s_kazakhskim_yazykom NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_70_99_s_russkim_yazykom_ob NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_nizhe_70 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_nizhe_70_s_anglijskim_yazy NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_nizhe_70_s_kazakhskim_yazy NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_s_ballom_ent_nizhe_70_s_russkim_yazykom NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_sdavshikh_ent NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_sdavshikh_ent_s_anglijskim_yazykom_obuc NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_sdavshikh_ent_s_kazakhskim_yazykom_obuc NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_sdavshikh_ent_s_russkim_yazykom_obuchen NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_so_znakom_altyn_belg_vab NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_so_znakom_altyn_belg_vab_s_anglijskim_y NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_so_znakom_altyn_belg_vab_s_kazakhskim_y NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_so_znakom_altyn_belg_vab_s_russkim_yazy NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_trudoustroennykh_v_techenie_12_mesyatse NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_vypusknikov_trudoustroennykh_v_techenie_6_mesyatsev NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_publikatsij_v_izdaniyakh_scopusweb_of_science NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_trudoustroennykh_vypusknikov_v_razreze_vuzov_i_spet NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_uchaschikhsya_9_klassa_sdavshikh_kt_kompleksnoe_tes NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_uchaschikhsya_9_klassa_sdavshikh_kt_kompleksnoe__2 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS kolichestvo_uchaschikhsya_9_klassa_sdavshikh_kt_kompleksnoe__2 NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS oprosyanketirovanie_vypusknikov NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS otrabotka_vypusknikov_granta_summa_vozmescheniya_v_sluchae_ne_o NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS partnyoryrabotodateli_kolichestvo_otrasli_tip_vzaimodejstviya NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS rezultaty_itogovoj_attestatsii_srednij_ball_dolya_uspeshnykh TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS rezultaty_itogovoj_attestatsii_srednij_ball_po_spetsialnosti NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_istorii_kazakhstana TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_kazakhskomurusskomu_yazyku TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_matematike TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_organizatsii TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_organizatsii_s_anglijskim_yazykom_obucheniy TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_organizatsii_s_kazakhskim_yazykom_obucheniy TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_organizatsii_s_russkim_yazykom_obucheniya TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_ent_po_organizatsii_so_smeshannym_yazykom_obucheni TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_kt_po_organizatsii_9_klass TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_kt_po_organizatsii_9_klass_s_kazakhskim_yazykom_ob TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_kt_po_organizatsii_9_klass_s_russkim_yazykom_obuch TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednij_ball_kt_po_organizatsii_9_klass_so_smeshannym_yazykom_o TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednyaya_zarabotnaya_plata_vypusknikov_cherez_12_mesyatsev_pos NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS srednyaya_zarplata_vypusknikov_po_spetsialnostyam_dinamika TEXT;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS uchastie_vypusknikov_v_yurlitsakh_ip_too_ao NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS chislennost_vypusknikov NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS chislennost_vypusknikov_ne_postupivshikh_v_ovpo NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS chislennost_vypusknikov_postupivshikh_v_ovpo_v_tom_chisle_gosud NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS chislennost_vypusknikov_postupivshikh_v_organizatsii_tippo NUMERIC;
ALTER TABLE edu_graduates_ext ADD COLUMN IF NOT EXISTS chislennost_vypusknikov_s_uchetom_rezultatov_ent_kt_so_znakom_a NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS vidy_grupp NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS grafik_posescheniya_2_raza_v_nedelyu3_raza_v_nedelyu_i_tp NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS kolichestvo_grupp NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS kolichestvo_grupp_v_razreze_kruzhkovsektsij NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS kolichestvo_grupp_v_razreze_yazyka_obucheniya NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS kolichestvo_inklyuzivnykhspetsialnykhintegrirovannykhs_oop_grup NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS kolichestvo_odnovozrastnykhraznovozrastnykh_grupp NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS napolnyaemost_grupp NUMERIC;
ALTER TABLE edu_groups ADD COLUMN IF NOT EXISTS prodolzhitelnost_posescheniya_polnyj_denpol_dnyaprodlenka NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS f_1tip_zdaniya_zastrojki NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS f_2tekhnicheskoe_sostoyanie_zdaniya NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS antiterroristicheskaya_bezopasnost NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS vid_otopleniya NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS data_provedeniya_kapitalnogo_i_tekuschego_remonta NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS dostupnost_transportnaya_dostupnost NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS ispolzuemoe_pomeschenie_sobstvennoearenduemoe NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS kolichestvo_korpusov_pri_nalichii NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS nalichie_bassejna NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS nalichie_biblioteki_fond_elektronnye_resursy_podpiski NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS nalichie_interneta NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS nalichie_razvozki NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS nalichie_stolovojbufeta NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS obschaya_ploschad_territorii NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS ploschad_zdaniya_v_tom_chisle_na_odnogo_rebenka NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS proektnaya_moschnost NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS sootvetstvie_normam_sanpin NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS sootvetstvie_normam_snip NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS sostoyanie_zdanij_iznos_provedenie_tekuschego_i_kapitalnogo_rem NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS sportivnaya_infrastruktura_zaly_stadiony_osnaschenie NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS sposob_vvoda_zdaniya_stroitelstvorekonstruktsiya NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS tekhnicheskoe_sostoyanie_zdaniya NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS tip_zdaniya_zastrojki NUMERIC;
ALTER TABLE edu_infrastructure ADD COLUMN IF NOT EXISTS uchebnaya_infrastruktura_muzzaly_auditorii_laboratorii_mastersk NUMERIC;
ALTER TABLE edu_international ADD COLUMN IF NOT EXISTS inostrannye_prepodavateli_kolichestvo_kontraktnaya_stoimost NUMERIC;
ALTER TABLE edu_international ADD COLUMN IF NOT EXISTS inostrannye_studenty_chislo_napravleniya NUMERIC;
ALTER TABLE edu_international ADD COLUMN IF NOT EXISTS mezhdunarodnye_programmy_erasmus_mevlana_obmen NUMERIC;
ALTER TABLE edu_international ADD COLUMN IF NOT EXISTS partnyorskie_zarubezhnye_vuzy_kolledzhi_kolichestvo_napravleniy NUMERIC;
ALTER TABLE edu_medical ADD COLUMN IF NOT EXISTS meditsinskij_kabinet_nalichie_litsenziya NUMERIC;
ALTER TABLE edu_medical ADD COLUMN IF NOT EXISTS medpersonal_shtat_fakt NUMERIC;
ALTER TABLE edu_medical ADD COLUMN IF NOT EXISTS meduslugi_osmotry_profilaktika NUMERIC;
ALTER TABLE edu_medical ADD COLUMN IF NOT EXISTS nalichie_v_shtate_kvalifitsirovannogo_psikhologa NUMERIC;
ALTER TABLE edu_medical ADD COLUMN IF NOT EXISTS nalichie_dogovora_na_meditsinskoe_obsluzhivanie NUMERIC;
ALTER TABLE edu_medical ADD COLUMN IF NOT EXISTS okhrana_truda_i_tekhnika_bezopasnosti_zhurnaly_instruktazha_osn NUMERIC;
ALTER TABLE edu_science_ext ADD COLUMN IF NOT EXISTS indeks_khirsha_pps_srednij_i_maksimalnyj_pokazatel TEXT;
ALTER TABLE edu_science_ext ADD COLUMN IF NOT EXISTS nauchnye_granty_summy_kolichestvo_napravleniya NUMERIC;
ALTER TABLE edu_science_ext ADD COLUMN IF NOT EXISTS nauchnye_proekty_studentov_startupproekty_konkursy NUMERIC;
ALTER TABLE edu_science_ext ADD COLUMN IF NOT EXISTS publikatsii_q1q4_scopus_web_of_science NUMERIC;

-- ── Update catalog_field_mapping ────────────────────────────────────

UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='erp_subd_avtomatizatsiya_protsessov' WHERE catalog_field_id=518;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='erp_subd_avtomatizatsiya_protsessov' WHERE catalog_field_id=517;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='erp_subd_avtomatizatsiya_protsessov' WHERE catalog_field_id=515;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='erp_subd_avtomatizatsiya_protsessov' WHERE catalog_field_id=514;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='erp_subd_avtomatizatsiya_protsessov' WHERE catalog_field_id=513;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='it_oborudovanie_kompyuteryinteraktivnye_doskiplanshety' WHERE catalog_field_id=519;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='it_oborudovanie_kompyuteryinteraktivnye_doskiplanshety' WHERE catalog_field_id=516;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='it_oborudovanie_kompyuteryinteraktivnye_doskiplanshety' WHERE catalog_field_id=786;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='it_oborudovanie_kompyuteryinteraktivnye_doskiplanshety' WHERE catalog_field_id=380;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='it_oborudovanie_kompyuteryinteraktivnye_doskiplanshety' WHERE catalog_field_id=521;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='avtomaticheskaya_sistema_ucheta_turniket_face_id_skud_i_td' WHERE catalog_field_id=269;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='avtomaticheskaya_sistema_ucheta_turniket_face_id_skud_i_td' WHERE catalog_field_id=268;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='avtomaticheskaya_sistema_ucheta_turniket_face_id_skud_i_td' WHERE catalog_field_id=383;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='avtomaticheskaya_sistema_ucheta_turniket_face_id_skud_i_td' WHERE catalog_field_id=270;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='avtomaticheskaya_sistema_ucheta_turniket_face_id_skud_i_td' WHERE catalog_field_id=382;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='avtomaticheskaya_sistema_ucheta_turniket_face_id_skud_i_td' WHERE catalog_field_id=524;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='dokumenty_po_informatsionnoj_bezopasnosti_obrabotke_i_zaschite_' WHERE catalog_field_id=128;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='dokumenty_po_informatsionnoj_bezopasnosti_obrabotke_i_zaschite_' WHERE catalog_field_id=272;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='dokumenty_po_informatsionnoj_bezopasnosti_obrabotke_i_zaschite_' WHERE catalog_field_id=791;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='dokumenty_po_informatsionnoj_bezopasnosti_obrabotke_i_zaschite_' WHERE catalog_field_id=385;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='dokumenty_po_informatsionnoj_bezopasnosti_obrabotke_i_zaschite_' WHERE catalog_field_id=523;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='internet_i_svyaz_skorost_stabilnost_propusknaya_sposobnost_tari' WHERE catalog_field_id=122;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='internet_i_svyaz_skorost_stabilnost_propusknaya_sposobnost_tari' WHERE catalog_field_id=266;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='internet_i_svyaz_skorost_stabilnost_propusknaya_sposobnost_tari' WHERE catalog_field_id=384;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='internet_i_svyaz_skorost_stabilnost_propusknaya_sposobnost_tari' WHERE catalog_field_id=785;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='internet_i_svyaz_skorost_stabilnost_propusknaya_sposobnost_tari' WHERE catalog_field_id=379;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='internet_i_svyaz_skorost_stabilnost_propusknaya_sposobnost_tari' WHERE catalog_field_id=520;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_informatsionnykh_sistem' WHERE catalog_field_id=123;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_informatsionnykh_sistem' WHERE catalog_field_id=124;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_informatsionnykh_sistem' WHERE catalog_field_id=125;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_informatsionnykh_sistem' WHERE catalog_field_id=126;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_informatsionnykh_sistem' WHERE catalog_field_id=127;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_sajta_mobilnykh_prilozhenij_elektronnykh_bibliotek_tsi' WHERE catalog_field_id=130;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_sajta_mobilnykh_prilozhenij_elektronnykh_bibliotek_tsi' WHERE catalog_field_id=267;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_sajta_mobilnykh_prilozhenij_elektronnykh_bibliotek_tsi' WHERE catalog_field_id=787;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_sajta_mobilnykh_prilozhenij_elektronnykh_bibliotek_tsi' WHERE catalog_field_id=381;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='nalichie_sajta_mobilnykh_prilozhenij_elektronnykh_bibliotek_tsi' WHERE catalog_field_id=522;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tekhzaschita_antivirusy_obnovlenie_os_rezervnoe_kopirovanie_dan' WHERE catalog_field_id=129;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tekhzaschita_antivirusy_obnovlenie_os_rezervnoe_kopirovanie_dan' WHERE catalog_field_id=271;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tekhzaschita_antivirusy_obnovlenie_os_rezervnoe_kopirovanie_dan' WHERE catalog_field_id=789;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tekhzaschita_antivirusy_obnovlenie_os_rezervnoe_kopirovanie_dan' WHERE catalog_field_id=788;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tekhzaschita_antivirusy_obnovlenie_os_rezervnoe_kopirovanie_dan' WHERE catalog_field_id=790;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tsifrovye_platformyservisy_onlajn_platforma_dlya_obucheniya_dis' WHERE catalog_field_id=819;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tsifrovye_platformyservisy_onlajn_platforma_dlya_obucheniya_dis' WHERE catalog_field_id=817;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tsifrovye_platformyservisy_onlajn_platforma_dlya_obucheniya_dis' WHERE catalog_field_id=820;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tsifrovye_platformyservisy_onlajn_platforma_dlya_obucheniya_dis' WHERE catalog_field_id=816;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_digitalization', db_column='tsifrovye_platformyservisy_onlajn_platforma_dlya_obucheniya_dis' WHERE catalog_field_id=818;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu' WHERE catalog_field_id=553;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='data_provedeniya_kapitalnogo_remonta' WHERE catalog_field_id=564;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='kolichestvo_zhilykh_komnat_i_ikh_ploschad' WHERE catalog_field_id=558;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='kolichestvo_mest_predusmotrennykh_proektnoj_dokumentatsiej' WHERE catalog_field_id=559;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='kolichestvo_etazhej' WHERE catalog_field_id=557;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='material_sten_i_konstruktivnye_kharakteristiki' WHERE catalog_field_id=561;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='nalichie_i_ploschad_vspomogatelnykh_pomeschenij_sanuzly_kukhni_' WHERE catalog_field_id=560;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='obschaya_ploschad_kvm' WHERE catalog_field_id=555;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='ploschad_zemelnogo_uchastka_i_prinadlezhnost' WHERE catalog_field_id=562;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='poleznaya_ploschad_kvm' WHERE catalog_field_id=556;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='proektnaya_moschnost' WHERE catalog_field_id=554;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='tekhnicheskoe_sostoyanie_zdaniya' WHERE catalog_field_id=563;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='integratsiya_s_sistemoj_stutdom_edinaya_platforma_vysshego_obra' WHERE catalog_field_id=597;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='kolichestvom_chasov_prozhivaniya_odnogo_studenta_v_sootvetstvuy' WHERE catalog_field_id=598;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='korrektnosti_iin_v_gbdfl_kak_studenta' WHERE catalog_field_id=599;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='monitoring_fakticheski_zanyatykh_studentami_mest_v_obschezhitii' WHERE catalog_field_id=596;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='proverka_mesta_obucheniya_po_vuzam_v_epvo' WHERE catalog_field_id=602;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='proverka_mesta_obucheniya_po_kolledzham_v_lms' WHERE catalog_field_id=601;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='proverka_propiski_v_gbdfl' WHERE catalog_field_id=600;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='fiksatsiya_perioda_prozhivaniya_ne_menee_7236_chasov_v_techenie' WHERE catalog_field_id=603;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='formirovanie_korrektnogo_reestra' WHERE catalog_field_id=604;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='akademicheskaya_mobilnost_vkhodyaschaya_iskhodyaschaya' WHERE catalog_field_id=834;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='akademicheskaya_mobilnost_vkhodyaschaya_iskhodyaschaya' WHERE catalog_field_id=829;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='akademicheskaya_uspevaemost' WHERE catalog_field_id=840;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='akademicheskaya_uspevaemost' WHERE catalog_field_id=839;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij' WHERE catalog_field_id=112;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij' WHERE catalog_field_id=248;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij' WHERE catalog_field_id=245;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij' WHERE catalog_field_id=246;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij' WHERE catalog_field_id=247;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='dopolnitelnye_vidy_obrazovatelnykh_programm' WHERE catalog_field_id=111;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='dopolnitelnye_vidy_obrazovatelnykh_programm' WHERE catalog_field_id=244;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='dopolnitelnye_vidy_obrazovatelnykh_programm' WHERE catalog_field_id=701;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='dopolnitelnye_vidy_obrazovatelnykh_programm' WHERE catalog_field_id=699;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='dopolnitelnye_vidy_obrazovatelnykh_programm' WHERE catalog_field_id=700;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_prizerov_olimpiad_mezhdunarodnogo_urovnya' WHERE catalog_field_id=1255;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_prizerov_olimpiad_oblastnogo_urovnya' WHERE catalog_field_id=1251;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_prizerov_olimpiad_rajonnogo_urovnya' WHERE catalog_field_id=1249;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_prizerov_olimpiad_respublikanskogo_urovnya' WHERE catalog_field_id=1253;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_vkhodyaschej_mobilnosti_vnutri_rk' WHERE catalog_field_id=835;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_vkhodyaschej_mobilnosti_vnutri_rk' WHERE catalog_field_id=830;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_vkhodyaschej_mobilnosti_za_rubezh' WHERE catalog_field_id=837;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_vkhodyaschej_mobilnosti_za_rubezh' WHERE catalog_field_id=832;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_iskhodyaschej_mobilnosti_vnutri_rk' WHERE catalog_field_id=836;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_iskhodyaschej_mobilnosti_vnutri_rk' WHERE catalog_field_id=831;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_iskhodyaschej_mobilnosti_za_rubezh' WHERE catalog_field_id=838;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_studentov_iskhodyaschej_mobilnosti_za_rubezh' WHERE catalog_field_id=833;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_uchastnikov_olimpiad_mezhdunarodnogo_urovnya' WHERE catalog_field_id=1254;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_uchastnikov_olimpiad_oblastnogo_urovnya' WHERE catalog_field_id=1250;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_uchastnikov_olimpiad_rajonnogo_urovnya' WHERE catalog_field_id=1248;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kol_vo_uchastnikov_olimpiad_respublikanskogo_urovnya' WHERE catalog_field_id=1252;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_mezhdunarodnykh_programm_i_partnerov' WHERE catalog_field_id=115;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_mezhdunarodnykh_programm_i_partnerov' WHERE catalog_field_id=254;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_mezhdunarodnykh_programm_i_partnerov' WHERE catalog_field_id=243;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_mezhdunarodnykh_programm_i_partnerov' WHERE catalog_field_id=707;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_mezhdunarodnykh_programm_i_partnerov' WHERE catalog_field_id=709;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obrazovatelnoj_programmy_po_vyboru' WHERE catalog_field_id=114;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obrazovatelnoj_programmy_po_vyboru' WHERE catalog_field_id=253;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obrazovatelnoj_programmy_po_vyboru' WHERE catalog_field_id=250;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obrazovatelnoj_programmy_po_vyboru' WHERE catalog_field_id=251;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obrazovatelnoj_programmy_po_vyboru' WHERE catalog_field_id=252;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obyazatelnykh_obrazovatelnykh_programm' WHERE catalog_field_id=113;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obyazatelnykh_obrazovatelnykh_programm' WHERE catalog_field_id=249;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obyazatelnykh_obrazovatelnykh_programm' WHERE catalog_field_id=698;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obyazatelnykh_obrazovatelnykh_programm' WHERE catalog_field_id=708;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='kolichestvo_obyazatelnykh_obrazovatelnykh_programm' WHERE catalog_field_id=710;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_razvivayuschej_sredy' WHERE catalog_field_id=702;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_razvivayuschej_sredy' WHERE catalog_field_id=703;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_razvivayuschej_sredy' WHERE catalog_field_id=704;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_razvivayuschej_sredy' WHERE catalog_field_id=705;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_razvivayuschej_sredy' WHERE catalog_field_id=706;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_startap_proektov' WHERE catalog_field_id=261;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_startap_proektov' WHERE catalog_field_id=262;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_startap_proektov' WHERE catalog_field_id=263;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_startap_proektov' WHERE catalog_field_id=264;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='nalichie_startap_proektov' WHERE catalog_field_id=265;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='praktika_studentov_partnyory_mesta_praktiki_stazhirovka' WHERE catalog_field_id=841;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='praktika_studentov_partnyory_mesta_praktiki_stazhirovka' WHERE catalog_field_id=842;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='rezultaty_oprosovanketirovaniya_roditelej' WHERE catalog_field_id=116;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='rezultaty_oprosovanketirovaniya_roditelej' WHERE catalog_field_id=260;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='rezultaty_oprosovanketirovaniya_roditelej' WHERE catalog_field_id=711;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='uchastie_v_olimpiadakh_konkursakh_chempionatakh_sorevnovaniyakh' WHERE catalog_field_id=255;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='uchastie_v_olimpiadakh_konkursakh_chempionatakh_sorevnovaniyakh' WHERE catalog_field_id=256;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='uchastie_v_olimpiadakh_konkursakh_chempionatakh_sorevnovaniyakh' WHERE catalog_field_id=257;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='uchastie_v_olimpiadakh_konkursakh_chempionatakh_sorevnovaniyakh' WHERE catalog_field_id=258;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_education_process', db_column='uchastie_v_olimpiadakh_konkursakh_chempionatakh_sorevnovaniyakh' WHERE catalog_field_id=259;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='itoborudovanie_servery_pk_laboratorii_simulyatory' WHERE catalog_field_id=375;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='itoborudovanie_servery_pk_laboratorii_simulyatory' WHERE catalog_field_id=499;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='amortizatsiya_oborudovaniya_iznos_srok_sluzhby_ostatochnaya_sto' WHERE catalog_field_id=86;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='amortizatsiya_oborudovaniya_iznos_srok_sluzhby_ostatochnaya_sto' WHERE catalog_field_id=275;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='amortizatsiya_oborudovaniya_iznos_srok_sluzhby_ostatochnaya_sto' WHERE catalog_field_id=794;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='amortizatsiya_oborudovaniya_iznos_srok_sluzhby_ostatochnaya_sto' WHERE catalog_field_id=372;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='amortizatsiya_oborudovaniya_iznos_srok_sluzhby_ostatochnaya_sto' WHERE catalog_field_id=503;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='investitsii_v_oborudovanie_za_poslednie_3_goda_po_napravleniyam' WHERE catalog_field_id=370;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='investitsii_v_oborudovanie_za_poslednie_3_goda_po_napravleniyam' WHERE catalog_field_id=500;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza' WHERE catalog_field_id=84;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza' WHERE catalog_field_id=273;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza' WHERE catalog_field_id=606;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza' WHERE catalog_field_id=795;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza' WHERE catalog_field_id=373;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza' WHERE catalog_field_id=504;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza_dlya_spetsialnykh_gruppkorrektsi' WHERE catalog_field_id=87;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza_dlya_spetsialnykh_gruppkorrektsi' WHERE catalog_field_id=276;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza_dlya_spetsialnykh_gruppkorrektsi' WHERE catalog_field_id=793;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza_dlya_spetsialnykh_gruppkorrektsi' WHERE catalog_field_id=377;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='materialno_tekhnicheskaya_baza_dlya_spetsialnykh_gruppkorrektsi' WHERE catalog_field_id=506;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='nauchnoe_oborudovanie_mikroskopy_robototekhnika_khimbio_oborudo' WHERE catalog_field_id=376;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='nauchnoe_oborudovanie_mikroskopy_robototekhnika_khimbio_oborudo' WHERE catalog_field_id=498;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='proizvodstvennye_masterskie_nalichie_osnaschenie' WHERE catalog_field_id=369;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='proizvodstvennye_masterskie_nalichie_osnaschenie' WHERE catalog_field_id=501;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='raskhodnye_materialy_dlya_praktiki_obyom_zakupok_v_god' WHERE catalog_field_id=378;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='raskhodnye_materialy_dlya_praktiki_obyom_zakupok_v_god' WHERE catalog_field_id=502;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='raskhodnye_materialy_reaktivy_laboratornye_materialy' WHERE catalog_field_id=374;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='raskhodnye_materialy_reaktivy_laboratornye_materialy' WHERE catalog_field_id=507;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='uchebnye_materialy_bibliotekaelektronnye_uchebniki_i_td' WHERE catalog_field_id=85;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='uchebnye_materialy_bibliotekaelektronnye_uchebniki_i_td' WHERE catalog_field_id=274;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='uchebnye_materialy_bibliotekaelektronnye_uchebniki_i_td' WHERE catalog_field_id=792;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='uchebnye_materialy_bibliotekaelektronnye_uchebniki_i_td' WHERE catalog_field_id=371;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_equipment', db_column='uchebnye_materialy_bibliotekaelektronnye_uchebniki_i_td' WHERE catalog_field_id=505;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_fraud', db_column='korrektnost_iin_v_gbdfl_na_zhivogo_zadvoennogo_kak_vospitannika' WHERE catalog_field_id=796;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_fraud', db_column='korrektnost_iin_v_gbdfl_na_zhivogo_zadvoennogo_kak_vospitannika' WHERE catalog_field_id=799;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_fraud', db_column='korrektnost_iin_v_gbdfl_na_zhivogo_zadvoennogo_kak_vospitannika' WHERE catalog_field_id=797;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_fraud', db_column='korrektnost_iin_v_gbdfl_na_zhivogo_zadvoennogo_kak_vospitannika' WHERE catalog_field_id=800;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_fraud', db_column='korrektnost_iin_v_gbdfl_na_zhivogo_zadvoennogo_kak_vospitannika' WHERE catalog_field_id=798;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='id_sistemy_ucheta' WHERE catalog_field_id=801;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='id_sistemy_ucheta' WHERE catalog_field_id=802;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='id_sistemy_ucheta' WHERE catalog_field_id=806;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='id_sistemy_ucheta' WHERE catalog_field_id=803;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='id_sistemy_ucheta' WHERE catalog_field_id=804;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='id_sistemy_ucheta' WHERE catalog_field_id=805;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='akkreditatsiya_gosudarstvennaya_natsionalnaya_mezhdunarodnaya_a' WHERE catalog_field_id=284;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='akkreditatsiya_gosudarstvennaya_natsionalnaya_mezhdunarodnaya_a' WHERE catalog_field_id=396;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='bin_organizatsii' WHERE catalog_field_id=821;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='bin_organizatsii' WHERE catalog_field_id=822;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='bin_organizatsii' WHERE catalog_field_id=827;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='bin_organizatsii' WHERE catalog_field_id=826;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='bin_organizatsii' WHERE catalog_field_id=823;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='bin_organizatsii' WHERE catalog_field_id=824;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='bin_organizatsii' WHERE catalog_field_id=825;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='byudzhetnye_zayavki_na_finansirovanie_premii_gosudarstva' WHERE catalog_field_id=614;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='byudzhetnye_zayavki_na_finansirovanie_startovogo_obrazovatelnog' WHERE catalog_field_id=615;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='vid_organizatsii_obrazovaniya' WHERE catalog_field_id=7;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='vid_organizatsii_obrazovaniya' WHERE catalog_field_id=136;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='vid_organizatsii_obrazovaniya' WHERE catalog_field_id=651;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='vid_organizatsii_obrazovaniya' WHERE catalog_field_id=285;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='vid_organizatsii_obrazovaniya' WHERE catalog_field_id=398;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_polucheniya_litsenzii' WHERE catalog_field_id=609;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_polucheniya_litsenzii' WHERE catalog_field_id=647;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_polucheniya_litsenzii' WHERE catalog_field_id=283;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_polucheniya_litsenzii' WHERE catalog_field_id=395;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_reorganizatsiipereuchrezhdeniya_esli_byla' WHERE catalog_field_id=8;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_reorganizatsiipereuchrezhdeniya_esli_byla' WHERE catalog_field_id=140;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_reorganizatsiipereuchrezhdeniya_esli_byla' WHERE catalog_field_id=652;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_reorganizatsiipereuchrezhdeniya_esli_byla' WHERE catalog_field_id=286;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='data_reorganizatsiipereuchrezhdeniya_esli_byla' WHERE catalog_field_id=399;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='dogovory_o_sotrudnichestve_v_ramkakh_gons_mezhdu_bvu_kszh_i_fin' WHERE catalog_field_id=611;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='dogovory_porucheniyadogovory_prisoedineniya' WHERE catalog_field_id=5;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='dogovory_porucheniyadogovory_prisoedineniya' WHERE catalog_field_id=137;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='dogovory_porucheniyadogovory_prisoedineniya' WHERE catalog_field_id=646;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='zayavleniya_na_prisoedinenie_postavschikov_k_dogovoru' WHERE catalog_field_id=9;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='zayavleniya_na_prisoedinenie_postavschikov_k_dogovoru' WHERE catalog_field_id=138;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='zayavleniya_na_prisoedinenie_postavschikov_k_dogovoru' WHERE catalog_field_id=653;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_bvukszh_uchastniki_gons' WHERE catalog_field_id=607;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_obschezhitij_predostavlyayuschikh_mesta_studentam_p' WHERE catalog_field_id=544;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_organizatsij_sozdannykh_dejstvuyuschikh_likvidirova' WHERE catalog_field_id=1;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_organizatsij_sozdannykh_dejstvuyuschikh_likvidirova' WHERE catalog_field_id=131;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_organizatsij_sozdannykh_dejstvuyuschikh_likvidirova' WHERE catalog_field_id=642;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_organizatsij_sozdannykh_dejstvuyuschikh_likvidirova' WHERE catalog_field_id=287;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_organizatsij_sozdannykh_dejstvuyuschikh_likvidirova' WHERE catalog_field_id=400;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='kolichestvo_smen_obucheniya' WHERE catalog_field_id=649;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='litsenzirovanie_nalichie_litsenzii_na_obrazovatelnuyu_deyatelno' WHERE catalog_field_id=394;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='litsenzirovanie_nalichie_litsenzii_perechen_spetsialnostej_napr' WHERE catalog_field_id=280;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='litsenzirovanie_nalichie_litsenzii_perechen_spetsialnostej_napr' WHERE catalog_field_id=139;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='litsenzirovanie_nalichie_litsenzii_perechen_spetsialnostej_napr' WHERE catalog_field_id=281;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='litsenzirovanie_nalichie_litsenzii_perechen_spetsialnostej_napr' WHERE catalog_field_id=282;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naimenovanie_organizatsii_ili_bvukszh' WHERE catalog_field_id=2;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naimenovanie_organizatsii_ili_bvukszh' WHERE catalog_field_id=132;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naimenovanie_organizatsii_ili_bvukszh' WHERE catalog_field_id=608;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naimenovanie_organizatsii_ili_bvukszh' WHERE catalog_field_id=545;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naimenovanie_organizatsii_ili_bvukszh' WHERE catalog_field_id=643;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naimenovanie_organizatsii_ili_bvukszh' WHERE catalog_field_id=277;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naimenovanie_organizatsii_ili_bvukszh' WHERE catalog_field_id=391;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='napravleniya_podgotovki' WHERE catalog_field_id=279;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='napravleniya_podgotovki' WHERE catalog_field_id=397;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naselennyj_punkt_i_adres' WHERE catalog_field_id=4;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naselennyj_punkt_i_adres' WHERE catalog_field_id=134;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naselennyj_punkt_i_adres' WHERE catalog_field_id=547;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naselennyj_punkt_i_adres' WHERE catalog_field_id=645;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naselennyj_punkt_i_adres' WHERE catalog_field_id=807;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='naselennyj_punkt_i_adres' WHERE catalog_field_id=808;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='nachalo_obrazovatelnoj_deyatelnosti' WHERE catalog_field_id=6;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='nachalo_obrazovatelnoj_deyatelnosti' WHERE catalog_field_id=135;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='nachalo_obrazovatelnoj_deyatelnosti' WHERE catalog_field_id=654;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='nachalo_obrazovatelnoj_deyatelnosti' WHERE catalog_field_id=288;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='nachalo_obrazovatelnoj_deyatelnosti' WHERE catalog_field_id=401;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='oblast_gorod_respznacheniya' WHERE catalog_field_id=809;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='oblast_gorod_respznacheniya' WHERE catalog_field_id=810;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='oblast_gorod_respznacheniya' WHERE catalog_field_id=815;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='oblast_gorod_respznacheniya' WHERE catalog_field_id=814;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='oblast_gorod_respznacheniya' WHERE catalog_field_id=811;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='oblast_gorod_respznacheniya' WHERE catalog_field_id=812;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='oblast_gorod_respznacheniya' WHERE catalog_field_id=813;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='obschee_kolichestvo_vkladov_depozitov_aqyl_i_v_razreze_bvu' WHERE catalog_field_id=612;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='obschee_kolichestvo_dogovorov_strakhovaniya_i_v_razreze_kszh' WHERE catalog_field_id=613;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='obschezhitiya_na_balanse_tipo_vuz_ili_chastnogo_investora' WHERE catalog_field_id=548;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='osnovnye_finansovye_pokazateli_bvu_kszh_aktivy_obyazatelstva_us' WHERE catalog_field_id=610;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='plany_razvitiya_strategicheskie_plany_otchety' WHERE catalog_field_id=10;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='plany_razvitiya_strategicheskie_plany_otchety' WHERE catalog_field_id=141;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='plany_razvitiya_strategicheskie_plany_otchety' WHERE catalog_field_id=655;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='plany_razvitiya_strategicheskie_plany_otchety' WHERE catalog_field_id=289;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='plany_razvitiya_strategicheskie_plany_otchety' WHERE catalog_field_id=402;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='proektnaya_moschnost' WHERE catalog_field_id=648;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='spravka_vypiska_o_nachislennom_startovom_obrazovatelnom_kapital' WHERE catalog_field_id=616;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='status_natsionalnyj_gosudarstvennyj_regionalnyj_chastnyj_mezhdu' WHERE catalog_field_id=393;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='forma_sobstvennosti' WHERE catalog_field_id=3;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='forma_sobstvennosti' WHERE catalog_field_id=133;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='forma_sobstvennosti' WHERE catalog_field_id=546;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='forma_sobstvennosti' WHERE catalog_field_id=644;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='forma_sobstvennosti' WHERE catalog_field_id=278;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='forma_sobstvennosti' WHERE catalog_field_id=392;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_general_info', db_column='yazyk_obucheniya_organizatsii_obrazovaniya_kaz_russ_angl_smesha' WHERE catalog_field_id=650;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='vyplachennye_nalogi_vypusknikov_v_razreze_otraslej' WHERE catalog_field_id=695;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='vyplachennye_nalogi_vypusknikov_v_razreze_otraslej' WHERE catalog_field_id=686;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='vyplachennye_nalogi_vypusknikov_v_razreze_otraslej' WHERE catalog_field_id=541;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='dolya_trudoustroennykh_vypusknikov_cherez_6_12_36_60_mesyatsev' WHERE catalog_field_id=691;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='dolya_trudoustroennykh_vypusknikov_cherez_6_12_36_60_mesyatsev' WHERE catalog_field_id=682;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='dolya_trudoustroennykh_vypusknikov_cherez_6_12_36_60_mesyatsev' WHERE catalog_field_id=538;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='dostizheniya_vypusknikov_prof_biznes_uspekhi_vysokie_rezultaty_' WHERE catalog_field_id=693;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='dostizheniya_vypusknikov_prof_biznes_uspekhi_vysokie_rezultaty_' WHERE catalog_field_id=684;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='dostizheniya_vypusknikov_prof_biznes_uspekhi_vysokie_rezultaty_' WHERE catalog_field_id=542;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_zaregistrirovannykh_kak_bezrabotnye_v_r' WHERE catalog_field_id=2973;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_pervichno_trudoustroennykh' WHERE catalog_field_id=2971;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osnove' WHERE catalog_field_id=1292;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osnove_' WHERE catalog_field_id=1295;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osno_2' WHERE catalog_field_id=1293;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_na_platnoj_osno_2' WHERE catalog_field_id=1294;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu' WHERE catalog_field_id=1288;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu_s_anglij' WHERE catalog_field_id=1291;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu_s_kazakh' WHERE catalog_field_id=1289;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_postupivshikh_v_vuzy_po_grantu_s_russki' WHERE catalog_field_id=1290;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_prodolzhivshikh_obuchenie_v_vipo' WHERE catalog_field_id=2970;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_100_119' WHERE catalog_field_id=1264;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_100_119_s_anglijskim_yazyk' WHERE catalog_field_id=1267;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_100_119_s_kazakhskim_yazyk' WHERE catalog_field_id=1265;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_100_119_s_russkim_yazykom_' WHERE catalog_field_id=1266;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140' WHERE catalog_field_id=1260;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140_s_angli' WHERE catalog_field_id=1263;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140_s_kazak' WHERE catalog_field_id=1261;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_120_i_vyshe_iz_140_s_russk' WHERE catalog_field_id=1262;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_70_99' WHERE catalog_field_id=1268;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_70_99_s_anglijskim_yazykom' WHERE catalog_field_id=1271;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_70_99_s_kazakhskim_yazykom' WHERE catalog_field_id=1269;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_70_99_s_russkim_yazykom_ob' WHERE catalog_field_id=1270;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_nizhe_70' WHERE catalog_field_id=1272;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_nizhe_70_s_anglijskim_yazy' WHERE catalog_field_id=1275;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_nizhe_70_s_kazakhskim_yazy' WHERE catalog_field_id=1273;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_s_ballom_ent_nizhe_70_s_russkim_yazykom' WHERE catalog_field_id=1274;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_sdavshikh_ent' WHERE catalog_field_id=1256;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_sdavshikh_ent_s_anglijskim_yazykom_obuc' WHERE catalog_field_id=1259;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_sdavshikh_ent_s_kazakhskim_yazykom_obuc' WHERE catalog_field_id=1257;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_sdavshikh_ent_s_russkim_yazykom_obuchen' WHERE catalog_field_id=1258;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_so_znakom_altyn_belg_vab' WHERE catalog_field_id=1284;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_so_znakom_altyn_belg_vab_s_anglijskim_y' WHERE catalog_field_id=1287;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_so_znakom_altyn_belg_vab_s_kazakhskim_y' WHERE catalog_field_id=1285;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_so_znakom_altyn_belg_vab_s_russkim_yazy' WHERE catalog_field_id=1286;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_trudoustroennykh_v_techenie_12_mesyatse' WHERE catalog_field_id=2968;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_vypusknikov_trudoustroennykh_v_techenie_6_mesyatsev' WHERE catalog_field_id=2967;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_publikatsij_v_izdaniyakh_scopusweb_of_science' WHERE catalog_field_id=2974;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_trudoustroennykh_vypusknikov_v_razreze_vuzov_i_spet' WHERE catalog_field_id=2972;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_uchaschikhsya_9_klassa_sdavshikh_kt_kompleksnoe_tes' WHERE catalog_field_id=1296;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_uchaschikhsya_9_klassa_sdavshikh_kt_kompleksnoe__2' WHERE catalog_field_id=1297;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='kolichestvo_uchaschikhsya_9_klassa_sdavshikh_kt_kompleksnoe__2' WHERE catalog_field_id=1298;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='oprosyanketirovanie_vypusknikov' WHERE catalog_field_id=696;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='oprosyanketirovanie_vypusknikov' WHERE catalog_field_id=687;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='oprosyanketirovanie_vypusknikov' WHERE catalog_field_id=543;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='otrabotka_vypusknikov_granta_summa_vozmescheniya_v_sluchae_ne_o' WHERE catalog_field_id=844;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='otrabotka_vypusknikov_granta_summa_vozmescheniya_v_sluchae_ne_o' WHERE catalog_field_id=845;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='partnyoryrabotodateli_kolichestvo_otrasli_tip_vzaimodejstviya' WHERE catalog_field_id=846;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='partnyoryrabotodateli_kolichestvo_otrasli_tip_vzaimodejstviya' WHERE catalog_field_id=843;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='rezultaty_itogovoj_attestatsii_srednij_ball_dolya_uspeshnykh' WHERE catalog_field_id=690;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='rezultaty_itogovoj_attestatsii_srednij_ball_dolya_uspeshnykh' WHERE catalog_field_id=681;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='rezultaty_itogovoj_attestatsii_srednij_ball_dolya_uspeshnykh' WHERE catalog_field_id=537;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='rezultaty_itogovoj_attestatsii_srednij_ball_po_spetsialnosti' WHERE catalog_field_id=2966;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_istorii_kazakhstana' WHERE catalog_field_id=1283;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_kazakhskomurusskomu_yazyku' WHERE catalog_field_id=1282;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_matematike' WHERE catalog_field_id=1281;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_organizatsii' WHERE catalog_field_id=1276;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_organizatsii_s_anglijskim_yazykom_obucheniy' WHERE catalog_field_id=1279;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_organizatsii_s_kazakhskim_yazykom_obucheniy' WHERE catalog_field_id=1277;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_organizatsii_s_russkim_yazykom_obucheniya' WHERE catalog_field_id=1278;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_ent_po_organizatsii_so_smeshannym_yazykom_obucheni' WHERE catalog_field_id=1280;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_kt_po_organizatsii_9_klass' WHERE catalog_field_id=1299;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_kt_po_organizatsii_9_klass_s_kazakhskim_yazykom_ob' WHERE catalog_field_id=1300;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_kt_po_organizatsii_9_klass_s_russkim_yazykom_obuch' WHERE catalog_field_id=1301;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednij_ball_kt_po_organizatsii_9_klass_so_smeshannym_yazykom_o' WHERE catalog_field_id=1302;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednyaya_zarabotnaya_plata_vypusknikov_cherez_12_mesyatsev_pos' WHERE catalog_field_id=2969;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednyaya_zarplata_vypusknikov_po_spetsialnostyam_dinamika' WHERE catalog_field_id=692;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednyaya_zarplata_vypusknikov_po_spetsialnostyam_dinamika' WHERE catalog_field_id=683;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='srednyaya_zarplata_vypusknikov_po_spetsialnostyam_dinamika' WHERE catalog_field_id=539;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='uchastie_vypusknikov_v_yurlitsakh_ip_too_ao' WHERE catalog_field_id=694;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='uchastie_vypusknikov_v_yurlitsakh_ip_too_ao' WHERE catalog_field_id=685;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='uchastie_vypusknikov_v_yurlitsakh_ip_too_ao' WHERE catalog_field_id=540;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov' WHERE catalog_field_id=676;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov' WHERE catalog_field_id=677;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov' WHERE catalog_field_id=672;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov' WHERE catalog_field_id=688;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov' WHERE catalog_field_id=689;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov_ne_postupivshikh_v_ovpo' WHERE catalog_field_id=697;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov_ne_postupivshikh_v_ovpo' WHERE catalog_field_id=679;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov_postupivshikh_v_ovpo_v_tom_chisle_gosud' WHERE catalog_field_id=675;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov_postupivshikh_v_ovpo_v_tom_chisle_gosud' WHERE catalog_field_id=680;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov_postupivshikh_v_organizatsii_tippo' WHERE catalog_field_id=673;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov_s_uchetom_rezultatov_ent_kt_so_znakom_a' WHERE catalog_field_id=674;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_graduates_ext', db_column='chislennost_vypusknikov_s_uchetom_rezultatov_ent_kt_so_znakom_a' WHERE catalog_field_id=678;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='vidy_grupp' WHERE catalog_field_id=29;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='vidy_grupp' WHERE catalog_field_id=160;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij' WHERE catalog_field_id=30;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='vidy_kruzhkovsektsij_dopolnitelnykh_zanyatij' WHERE catalog_field_id=157;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='grafik_posescheniya_2_raza_v_nedelyu3_raza_v_nedelyu_i_tp' WHERE catalog_field_id=34;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='grafik_posescheniya_2_raza_v_nedelyu3_raza_v_nedelyu_i_tp' WHERE catalog_field_id=166;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_grupp' WHERE catalog_field_id=26;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_grupp' WHERE catalog_field_id=158;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_grupp_v_razreze_kruzhkovsektsij' WHERE catalog_field_id=27;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_grupp_v_razreze_kruzhkovsektsij' WHERE catalog_field_id=159;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_grupp_v_razreze_yazyka_obucheniya' WHERE catalog_field_id=28;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_grupp_v_razreze_yazyka_obucheniya' WHERE catalog_field_id=164;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_inklyuzivnykhspetsialnykhintegrirovannykhs_oop_grup' WHERE catalog_field_id=32;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_inklyuzivnykhspetsialnykhintegrirovannykhs_oop_grup' WHERE catalog_field_id=163;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_odnovozrastnykhraznovozrastnykh_grupp' WHERE catalog_field_id=33;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='kolichestvo_odnovozrastnykhraznovozrastnykh_grupp' WHERE catalog_field_id=165;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='napolnyaemost_grupp' WHERE catalog_field_id=31;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='napolnyaemost_grupp' WHERE catalog_field_id=161;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='prodolzhitelnost_posescheniya_polnyj_denpol_dnyaprodlenka' WHERE catalog_field_id=35;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_groups', db_column='prodolzhitelnost_posescheniya_polnyj_denpol_dnyaprodlenka' WHERE catalog_field_id=162;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='f_1tip_zdaniya_zastrojki' WHERE catalog_field_id=494;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='f_2tekhnicheskoe_sostoyanie_zdaniya' WHERE catalog_field_id=764;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='antiterroristicheskaya_bezopasnost' WHERE catalog_field_id=109;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='antiterroristicheskaya_bezopasnost' WHERE catalog_field_id=241;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='antiterroristicheskaya_bezopasnost' WHERE catalog_field_id=775;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='antiterroristicheskaya_bezopasnost' WHERE catalog_field_id=360;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='antiterroristicheskaya_bezopasnost' WHERE catalog_field_id=497;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='vid_otopleniya' WHERE catalog_field_id=97;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='vid_otopleniya' WHERE catalog_field_id=238;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='vid_otopleniya' WHERE catalog_field_id=763;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='vid_otopleniya' WHERE catalog_field_id=367;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='vid_otopleniya' WHERE catalog_field_id=491;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu' WHERE catalog_field_id=89;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu' WHERE catalog_field_id=231;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu' WHERE catalog_field_id=756;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu' WHERE catalog_field_id=363;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='god_postrojki_zdaniya_god_vvoda_zdaniya_v_ekspluatatsiyu' WHERE catalog_field_id=479;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='data_provedeniya_kapitalnogo_i_tekuschego_remonta' WHERE catalog_field_id=100;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='data_provedeniya_kapitalnogo_i_tekuschego_remonta' WHERE catalog_field_id=240;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='data_provedeniya_kapitalnogo_i_tekuschego_remonta' WHERE catalog_field_id=765;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='data_provedeniya_kapitalnogo_i_tekuschego_remonta' WHERE catalog_field_id=351;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='data_provedeniya_kapitalnogo_i_tekuschego_remonta' WHERE catalog_field_id=488;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='dostupnost_transportnaya_dostupnost' WHERE catalog_field_id=103;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='dostupnost_transportnaya_dostupnost' WHERE catalog_field_id=224;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='dostupnost_transportnaya_dostupnost' WHERE catalog_field_id=768;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='dostupnost_transportnaya_dostupnost' WHERE catalog_field_id=355;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='dostupnost_transportnaya_dostupnost' WHERE catalog_field_id=495;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ispolzuemoe_pomeschenie_sobstvennoearenduemoe' WHERE catalog_field_id=107;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ispolzuemoe_pomeschenie_sobstvennoearenduemoe' WHERE catalog_field_id=229;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ispolzuemoe_pomeschenie_sobstvennoearenduemoe' WHERE catalog_field_id=769;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ispolzuemoe_pomeschenie_sobstvennoearenduemoe' WHERE catalog_field_id=359;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ispolzuemoe_pomeschenie_sobstvennoearenduemoe' WHERE catalog_field_id=496;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='kolichestvo_korpusov_pri_nalichii' WHERE catalog_field_id=96;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='kolichestvo_korpusov_pri_nalichii' WHERE catalog_field_id=237;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='kolichestvo_korpusov_pri_nalichii' WHERE catalog_field_id=762;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='kolichestvo_korpusov_pri_nalichii' WHERE catalog_field_id=350;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='kolichestvo_korpusov_pri_nalichii' WHERE catalog_field_id=490;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_bassejna' WHERE catalog_field_id=110;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_biblioteki_fond_elektronnye_resursy_podpiski' WHERE catalog_field_id=106;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_biblioteki_fond_elektronnye_resursy_podpiski' WHERE catalog_field_id=228;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_biblioteki_fond_elektronnye_resursy_podpiski' WHERE catalog_field_id=773;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_biblioteki_fond_elektronnye_resursy_podpiski' WHERE catalog_field_id=358;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_biblioteki_fond_elektronnye_resursy_podpiski' WHERE catalog_field_id=486;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_interneta' WHERE catalog_field_id=105;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_interneta' WHERE catalog_field_id=227;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_interneta' WHERE catalog_field_id=771;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_interneta' WHERE catalog_field_id=357;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_interneta' WHERE catalog_field_id=485;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_razvozki' WHERE catalog_field_id=108;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_razvozki' WHERE catalog_field_id=225;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_razvozki' WHERE catalog_field_id=770;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_stolovojbufeta' WHERE catalog_field_id=104;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_stolovojbufeta' WHERE catalog_field_id=226;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_stolovojbufeta' WHERE catalog_field_id=772;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_stolovojbufeta' WHERE catalog_field_id=356;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='nalichie_stolovojbufeta' WHERE catalog_field_id=484;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='obschaya_ploschad_territorii' WHERE catalog_field_id=91;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='obschaya_ploschad_territorii' WHERE catalog_field_id=232;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='obschaya_ploschad_territorii' WHERE catalog_field_id=758;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='obschaya_ploschad_territorii' WHERE catalog_field_id=364;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='obschaya_ploschad_territorii' WHERE catalog_field_id=480;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ploschad_zdaniya_v_tom_chisle_na_odnogo_rebenka' WHERE catalog_field_id=92;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ploschad_zdaniya_v_tom_chisle_na_odnogo_rebenka' WHERE catalog_field_id=233;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ploschad_zdaniya_v_tom_chisle_na_odnogo_rebenka' WHERE catalog_field_id=759;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ploschad_zdaniya_v_tom_chisle_na_odnogo_rebenka' WHERE catalog_field_id=365;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='ploschad_zdaniya_v_tom_chisle_na_odnogo_rebenka' WHERE catalog_field_id=481;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='proektnaya_moschnost' WHERE catalog_field_id=94;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='proektnaya_moschnost' WHERE catalog_field_id=235;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='proektnaya_moschnost' WHERE catalog_field_id=760;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='proektnaya_moschnost' WHERE catalog_field_id=366;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='proektnaya_moschnost' WHERE catalog_field_id=482;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sootvetstvie_normam_sanpin' WHERE catalog_field_id=99;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sootvetstvie_normam_sanpin' WHERE catalog_field_id=242;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sootvetstvie_normam_sanpin' WHERE catalog_field_id=774;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sootvetstvie_normam_sanpin' WHERE catalog_field_id=368;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sootvetstvie_normam_sanpin' WHERE catalog_field_id=492;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sootvetstvie_normam_snip' WHERE catalog_field_id=90;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sostoyanie_zdanij_iznos_provedenie_tekuschego_i_kapitalnogo_rem' WHERE catalog_field_id=88;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sostoyanie_zdanij_iznos_provedenie_tekuschego_i_kapitalnogo_rem' WHERE catalog_field_id=230;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sostoyanie_zdanij_iznos_provedenie_tekuschego_i_kapitalnogo_rem' WHERE catalog_field_id=755;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sostoyanie_zdanij_iznos_provedenie_tekuschego_i_kapitalnogo_rem' WHERE catalog_field_id=352;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sostoyanie_zdanij_iznos_provedenie_tekuschego_i_kapitalnogo_rem' WHERE catalog_field_id=489;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sportivnaya_infrastruktura_zaly_stadiony_osnaschenie' WHERE catalog_field_id=102;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sportivnaya_infrastruktura_zaly_stadiony_osnaschenie' WHERE catalog_field_id=223;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sportivnaya_infrastruktura_zaly_stadiony_osnaschenie' WHERE catalog_field_id=767;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sportivnaya_infrastruktura_zaly_stadiony_osnaschenie' WHERE catalog_field_id=354;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sportivnaya_infrastruktura_zaly_stadiony_osnaschenie' WHERE catalog_field_id=487;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='sposob_vvoda_zdaniya_stroitelstvorekonstruktsiya' WHERE catalog_field_id=757;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tekhnicheskoe_sostoyanie_zdaniya' WHERE catalog_field_id=98;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tekhnicheskoe_sostoyanie_zdaniya' WHERE catalog_field_id=239;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tekhnicheskoe_sostoyanie_zdaniya' WHERE catalog_field_id=361;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tekhnicheskoe_sostoyanie_zdaniya' WHERE catalog_field_id=493;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tip_zdaniya_zastrojki' WHERE catalog_field_id=95;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tip_zdaniya_zastrojki' WHERE catalog_field_id=236;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tip_zdaniya_zastrojki' WHERE catalog_field_id=761;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='tip_zdaniya_zastrojki' WHERE catalog_field_id=362;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='uchebnaya_infrastruktura_muzzaly_auditorii_laboratorii_mastersk' WHERE catalog_field_id=101;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='uchebnaya_infrastruktura_muzzaly_auditorii_laboratorii_mastersk' WHERE catalog_field_id=222;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='uchebnaya_infrastruktura_muzzaly_auditorii_laboratorii_mastersk' WHERE catalog_field_id=766;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='uchebnaya_infrastruktura_muzzaly_auditorii_laboratorii_mastersk' WHERE catalog_field_id=353;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_infrastructure', db_column='uchebnaya_infrastruktura_muzzaly_auditorii_laboratorii_mastersk' WHERE catalog_field_id=483;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='inostrannye_prepodavateli_kolichestvo_kontraktnaya_stoimost' WHERE catalog_field_id=531;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='inostrannye_prepodavateli_kolichestvo_kontraktnaya_stoimost' WHERE catalog_field_id=534;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='inostrannye_studenty_chislo_napravleniya' WHERE catalog_field_id=530;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='inostrannye_studenty_chislo_napravleniya' WHERE catalog_field_id=532;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='mezhdunarodnye_programmy_erasmus_mevlana_obmen' WHERE catalog_field_id=533;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='mezhdunarodnye_programmy_erasmus_mevlana_obmen' WHERE catalog_field_id=529;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='partnyorskie_zarubezhnye_vuzy_kolledzhi_kolichestvo_napravleniy' WHERE catalog_field_id=535;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_international', db_column='partnyorskie_zarubezhnye_vuzy_kolledzhi_kolichestvo_napravleniy' WHERE catalog_field_id=536;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meditsinskij_kabinet_nalichie_litsenziya' WHERE catalog_field_id=117;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meditsinskij_kabinet_nalichie_litsenziya' WHERE catalog_field_id=216;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meditsinskij_kabinet_nalichie_litsenziya' WHERE catalog_field_id=605;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meditsinskij_kabinet_nalichie_litsenziya' WHERE catalog_field_id=780;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meditsinskij_kabinet_nalichie_litsenziya' WHERE catalog_field_id=386;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meditsinskij_kabinet_nalichie_litsenziya' WHERE catalog_field_id=508;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='medpersonal_shtat_fakt' WHERE catalog_field_id=119;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='medpersonal_shtat_fakt' WHERE catalog_field_id=218;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='medpersonal_shtat_fakt' WHERE catalog_field_id=219;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='medpersonal_shtat_fakt' WHERE catalog_field_id=782;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='medpersonal_shtat_fakt' WHERE catalog_field_id=388;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='medpersonal_shtat_fakt' WHERE catalog_field_id=510;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meduslugi_osmotry_profilaktika' WHERE catalog_field_id=120;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meduslugi_osmotry_profilaktika' WHERE catalog_field_id=220;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meduslugi_osmotry_profilaktika' WHERE catalog_field_id=778;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meduslugi_osmotry_profilaktika' WHERE catalog_field_id=783;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meduslugi_osmotry_profilaktika' WHERE catalog_field_id=389;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='meduslugi_osmotry_profilaktika' WHERE catalog_field_id=511;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='nalichie_v_shtate_kvalifitsirovannogo_psikhologa' WHERE catalog_field_id=777;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='nalichie_dogovora_na_meditsinskoe_obsluzhivanie' WHERE catalog_field_id=118;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='nalichie_dogovora_na_meditsinskoe_obsluzhivanie' WHERE catalog_field_id=217;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='nalichie_dogovora_na_meditsinskoe_obsluzhivanie' WHERE catalog_field_id=776;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='nalichie_dogovora_na_meditsinskoe_obsluzhivanie' WHERE catalog_field_id=781;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='nalichie_dogovora_na_meditsinskoe_obsluzhivanie' WHERE catalog_field_id=387;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='nalichie_dogovora_na_meditsinskoe_obsluzhivanie' WHERE catalog_field_id=509;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='okhrana_truda_i_tekhnika_bezopasnosti_zhurnaly_instruktazha_osn' WHERE catalog_field_id=121;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='okhrana_truda_i_tekhnika_bezopasnosti_zhurnaly_instruktazha_osn' WHERE catalog_field_id=221;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='okhrana_truda_i_tekhnika_bezopasnosti_zhurnaly_instruktazha_osn' WHERE catalog_field_id=779;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='okhrana_truda_i_tekhnika_bezopasnosti_zhurnaly_instruktazha_osn' WHERE catalog_field_id=784;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='okhrana_truda_i_tekhnika_bezopasnosti_zhurnaly_instruktazha_osn' WHERE catalog_field_id=390;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_medical', db_column='okhrana_truda_i_tekhnika_bezopasnosti_zhurnaly_instruktazha_osn' WHERE catalog_field_id=512;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_science_ext', db_column='indeks_khirsha_pps_srednij_i_maksimalnyj_pokazatel' WHERE catalog_field_id=526;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_science_ext', db_column='nauchnye_granty_summy_kolichestvo_napravleniya' WHERE catalog_field_id=527;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_science_ext', db_column='nauchnye_proekty_studentov_startupproekty_konkursy' WHERE catalog_field_id=528;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_science_ext', db_column='publikatsii_q1q4_scopus_web_of_science' WHERE catalog_field_id=525;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='vvod_obekta_v_ekspluatatsiyu_postavschikom' WHERE catalog_field_id=568;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='dokumenty_postavschika_notarialno_zaverennaya_kopiya_akta_priem' WHERE catalog_field_id=572;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='dokumenty_postavschika_pravoustanavlivayuschie_i_identifikatsio' WHERE catalog_field_id=566;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='zaklyuchenie_dogovora_goszakaza_na_razmeschenie_studentov_v_obs' WHERE catalog_field_id=574;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='zaklyuchenie_dopolnitelnogo_soglasheniya_k_predvaritelnomu_dogo' WHERE catalog_field_id=570;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='zaklyuchenie_i_registratsiya_soglasheniya_o_neizmennosti_tselev' WHERE catalog_field_id=573;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='zaklyuchenie_predvaritelnogo_dogovora_po_utverzhdennoj_forme_op' WHERE catalog_field_id=567;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='obschij_srok_dogovora_gos_zakaza' WHERE catalog_field_id=575;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='osuschestvlenie_monitoringa_vvoda_obekta_v_ekspluatatsiyu_opera' WHERE catalog_field_id=569;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='podacha_postavschikom_zayavleniya_i_polnogo_paketa_dokumentov_d' WHERE catalog_field_id=565;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='podacha_postavschikom_zayavleniya_i_polnogo_paketa_dokumento_2' WHERE catalog_field_id=571;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='rastorzhenie_dogovora_gos_zakaza_data_osnovanie_prichina' WHERE catalog_field_id=577;
UPDATE catalog_field_mapping SET storage_type='column', db_table='edu_dormitory', db_column='rastorzhenie_predvaritelnogo_dogovora_data_osnovanie_prichina' WHERE catalog_field_id=576;

COMMIT;