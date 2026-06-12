"""
services/school_rating.py — Logic for calculating school ratings.
"""
from typing import Any, Dict

# Thresholds for scoring (can be moved to config later)
THRESHOLDS = {
    "ENT": {
        "EXCELLENT": 110,  # 5 points
        "GOOD": 90,       # 3 points
        "SATISFACTORY": 70 # 1 point
    },
    "ACADEMIC_PERF": {
        "HIGH": 90.0,      # 1.5 points
        "MEDIUM": 70.0,    # 1.0 point
        "LOW": 0.0         # 0.5 points
    },
    "KNOWLEDGE_QUALITY": {
        "HIGH": 80.0,      # 2.5 points
        "MEDIUM": 60.0,    # 1.5 points
        "LOW": 0.0         # 1.0 point
    }
}

def calculate_school_rating(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates school rating based on 7 blocks (A-G).
    Returns total score and breakdown.
    """
    block_scores = {}
    
    def get_bool(key: str) -> bool:
        return bool(data.get(key, False))

    def get_int(key: str, default: int = 0) -> int:
        try:
            return int(data.get(key, default))
        except (ValueError, TypeError):
            return default

    def get_float(key: str, default: float = 0.0) -> float:
        try:
            return float(data.get(key, default))
        except (ValueError, TypeError):
            return default

    # --- Block A: Material & Technical Base ---
    score_a = 0.0
    if get_bool("repair_capital_done"): score_a += 2.0
    elif get_bool("repair_capital_needed"): score_a -= 2.0
    
    if get_bool("repair_current"): score_a += 1.0
    elif get_bool("repair_current_needed"): score_a -= 1.0
    
    if get_bool("repair_not_needed"): score_a += 0.5
    
    if get_bool("has_sports_facility"): score_a += 1.0
    if get_bool("has_extended_day"): score_a += 1.0
    if get_bool("has_school_bus"): score_a += 1.0
    block_scores["infrastructure"] = score_a

    # --- Block B: Contingent ---
    capacity = get_int("design_capacity", 1)
    enrolled = get_int("enrolled_students", 0)
    occupancy_pct = (enrolled / capacity) * 100 if capacity > 0 else 0
    
    score_b = 0.0
    if 80 <= occupancy_pct <= 100:
        score_b = 4.0
    elif 60 <= occupancy_pct < 80 or 100 < occupancy_pct <= 110:
        score_b = 3.0
    elif 40 <= occupancy_pct < 60 or 110 < occupancy_pct <= 120:
        score_b = 2.0
    elif occupancy_pct > 120:
        score_b = 1.0
    block_scores["contingent"] = score_b

    # --- Block C: Quality of Education ---
    score_c = 0.0
    if get_bool("accreditation_passed"):
        score_c += 2.0 if get_int("accreditation_attempt") == 1 else 1.0
        
    ent_score = get_float("ent_average_score")
    if ent_score >= THRESHOLDS["ENT"]["EXCELLENT"]: score_c += 5.0
    elif ent_score >= THRESHOLDS["ENT"]["GOOD"]: score_c += 3.0
    elif ent_score >= THRESHOLDS["ENT"]["SATISFACTORY"]: score_c += 1.0
    
    perf_pct = get_float("academic_performance_pct")
    if perf_pct >= THRESHOLDS["ACADEMIC_PERF"]["HIGH"]: score_c += 1.5
    elif perf_pct >= THRESHOLDS["ACADEMIC_PERF"]["MEDIUM"]: score_c += 1.0
    else: score_c += 0.5
    
    quality_pct = get_float("knowledge_quality_pct")
    if quality_pct >= THRESHOLDS["KNOWLEDGE_QUALITY"]["HIGH"]: score_c += 2.5
    elif quality_pct >= THRESHOLDS["KNOWLEDGE_QUALITY"]["MEDIUM"]: score_c += 1.5
    else: score_c += 1.0
    
    block_scores["education_quality"] = score_c

    # --- Block D: Pedagogical Potential ---
    score_d = 0.0
    total_teachers = get_int("teachers_total", 1)
    if total_teachers > 0:
        high_cat_pct = (get_int("teachers_high_category") / total_teachers) * 100
        degree_pct = (get_int("teachers_with_degree") / total_teachers) * 100
        trained_abroad_pct = (get_int("teachers_trained_abroad") / total_teachers) * 100
        from_industry_pct = (get_int("teachers_from_industry") / total_teachers) * 100
        
        if high_cat_pct >= 40: score_d += 2.0
        elif high_cat_pct >= 20: score_d += 1.0
        
        if degree_pct >= 10: score_d += 4.0
        elif degree_pct >= 5: score_d += 2.0
        
        if trained_abroad_pct >= 5: score_d += 3.0
        elif trained_abroad_pct >= 2: score_d += 1.5
        
        if from_industry_pct >= 10: score_d += 3.0
        elif from_industry_pct >= 5: score_d += 1.0
        
    best_teacher_count = get_int("teachers_best_teacher_award")
    if best_teacher_count >= 3: score_d += 3.0
    elif best_teacher_count >= 1: score_d += 1.5
    
    block_scores["pedagogical"] = score_d

    # --- Block E: Extracurricular & Olympiads ---
    score_e = 0.0
    rep_winners = get_int("olympiad_winners_republican")
    intl_winners = get_int("olympiad_winners_international")
    
    if intl_winners >= 1: score_e += 5.0
    elif rep_winners >= 3: score_e += 3.0
    elif rep_winners >= 1: score_e += 1.5
    
    sport_achievements = get_int("sport_achievements")
    if sport_achievements >= 5: score_e += 3.0
    elif sport_achievements >= 2: score_e += 1.5
    
    creative_achievements = get_int("creative_achievements")
    if creative_achievements >= 5: score_e += 3.0
    elif creative_achievements >= 2: score_e += 1.5
    
    block_scores["extracurricular"] = score_e

    # --- Block F: University Enrollment ---
    score_f = 0.0
    total_grads = get_int("graduates_total", 1)
    if total_grads > 0:
        enrolled_uni_pct = (get_int("graduates_enrolled_university") / total_grads) * 100
        enrolled_spec_pct = (get_int("graduates_enrolled_by_specialty") / total_grads) * 100
        
        if enrolled_uni_pct >= 80: score_f += 3.0
        elif enrolled_uni_pct >= 50: score_f += 1.5
        
        if enrolled_spec_pct >= 40: score_f += 3.0
        elif enrolled_spec_pct >= 20: score_f += 1.5
        
    block_scores["enrollment"] = score_f

    # --- Block G: Finance & Partnership ---
    score_g = 0.0
    sponsor_funds = get_float("sponsor_funds")
    if sponsor_funds >= 5_000_000: score_g += 4.0
    elif sponsor_funds >= 1_000_000: score_g += 2.0
    elif sponsor_funds > 0: score_g += 1.0
    
    partnerships = get_int("enterprise_partnerships")
    score_g += min(partnerships * 1.0, 5.0) # 1 point per partnership, max 5
    
    self_earned = get_float("self_earned_income")
    if self_earned >= 2_000_000: score_g += 5.0
    elif self_earned >= 500_000: score_g += 2.5
    elif self_earned > 0: score_g += 1.0
    
    block_scores["finance"] = score_g

    total_score = sum(block_scores.values())
    
    return {
        "block_scores": block_scores,
        "total_score": round(total_score, 2),
        "breakdown": block_scores # Using block_scores as breakdown for now
    }
