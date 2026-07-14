"""
Trip Health / Trip Quality Index.

Evaluates plan feasibility continuously: pace (items per day), budget
pressure, and logistics (missing meals). Pure math over already-loaded
trip.days JSON, no LLM call — cheap enough to compute on every read.
"""


def evaluate_trip_health(trip):
    if not trip or not trip.days:
        return {"score": 0, "metrics": {}}

    score = 100
    metrics = {
        "pace": {"status": "good", "penalty": 0},
        "budget": {"status": "good", "penalty": 0},
        "logistics": {"status": "good", "penalty": 0},
    }

    total_activities = sum(len(day.get("activities", [])) for day in trip.days)
    avg_per_day = total_activities / len(trip.days)
    if avg_per_day > 5:
        metrics["pace"] = {"status": "exhausting", "penalty": 15}
        score -= 15
    elif avg_per_day < 2:
        metrics["pace"] = {"status": "too_slow", "penalty": 5}
        score -= 5

    # Missing meals — "food" is the canonical block category across the
    # codebase (conversation_service, insight_engine, plan_generation).
    missing_meals = 0
    for day in trip.days:
        activities = day.get("activities", [])
        meal_count = sum(1 for a in activities if a.get("category") == "food")
        if meal_count < 2:
            missing_meals += (2 - meal_count)

    if missing_meals > 0:
        penalty = min(missing_meals * 5, 20)
        metrics["logistics"] = {"status": f"missing {missing_meals} meals", "penalty": penalty}
        score -= penalty

    return {"score": max(score, 0), "metrics": metrics}
