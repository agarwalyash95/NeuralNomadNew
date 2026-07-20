"""
Unified Recommendation Engine & explainability (T2.1 / T5.1).

Every AI recommendation should be able to answer: why this, how confident,
what did I assume, what's the trade-off, what's the alternative. This
module is the one place that generates that structured explanation via
Gemini, routed through the shared client factory (apps.common.ai) so it
respects Vertex AI / AI Studio configuration like every other AI call.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ConfidenceDimension:
    """One axis of confidence with a short label and a 0-100 score."""
    dimension: str          # e.g. "location", "timing", "budget", "weather"
    score: int              # 0-100
    explanation: str        # one sentence on why this score
    trust_tier: str = "suggested"  # verified | estimated | suggested


@dataclass
class RecommendationAlternative:
    title: str
    rationale: str
    tradeoffs: List[str]


@dataclass
class StructuredRecommendation:
    title: str
    rationale: str

    why_this: List[str]
    confidence_score: int           # overall 0-100
    confidence_explanation: str

    # T5.1: multidimensional confidence — each axis tells the user exactly
    # why confidence is high or low on that specific aspect.
    confidence_dimensions: List[ConfidenceDimension] = field(default_factory=list)

    assumptions: List[str] = field(default_factory=list)
    tradeoffs: List[str] = field(default_factory=list)
    expected_impact: Dict[str, str] = field(default_factory=dict)
    alternatives: List[RecommendationAlternative] = field(default_factory=list)

    # T5.3: uncertainty_state maps to the trust palette:
    #   high_confidence -> --trust-verified
    #   medium_confidence -> --trust-estimated
    #   needs_decision | weather_dependent | traffic_dependent -> --trust-suggested
    uncertainty_state: str = "medium_confidence"


class RecommendationEngine:
    """Generates structured recommendations via Gemini with multidimensional confidence."""

    def __init__(self):
        from apps.common.ai import get_genai_client
        self.client = get_genai_client()

    def _build_explainability_prompt(self, context_prompt: str) -> str:
        return f"""
{context_prompt}

You must return your recommendation in the following strict JSON schema:
{{
  "title": "Short title of the recommendation",
  "rationale": "High level summary",
  "why_this": ["Reason 1", "Reason 2"],
  "confidence_score": 85,
  "confidence_explanation": "Why this score overall?",
  "confidence_dimensions": [
    {{"dimension": "location", "score": 95, "explanation": "Verified location data", "trust_tier": "verified"}},
    {{"dimension": "timing", "score": 70, "explanation": "Opening hours may vary on holidays", "trust_tier": "estimated"}},
    {{"dimension": "budget", "score": 60, "explanation": "Price range from historic data, not a live quote", "trust_tier": "estimated"}},
    {{"dimension": "crowd", "score": 40, "explanation": "Based on typical patterns, no live data", "trust_tier": "suggested"}}
  ],
  "uncertainty_state": "medium_confidence",
  "assumptions": ["Assuming standard opening hours apply"],
  "tradeoffs": ["Takes longer", "More expensive"],
  "expected_impact": {{"time": "+45 mins", "cost": "-$20"}},
  "alternatives": [
    {{
      "title": "Alternative option",
      "rationale": "Why choose this instead?",
      "tradeoffs": ["Less comfortable", "Cheaper"]
    }}
  ]
}}

uncertainty_state must be one of: high_confidence, medium_confidence, needs_decision, weather_dependent, traffic_dependent.
"""

    def generate_recommendation(self, prompt: str) -> Optional[StructuredRecommendation]:
        import json
        from apps.common.ai import DEFAULT_GEMINI_MODEL
        full_prompt = self._build_explainability_prompt(prompt)
        try:
            response = self.client.models.generate_content(
                model=DEFAULT_GEMINI_MODEL,
                contents=full_prompt,
                config={"response_mime_type": "application/json"},
            )
            data = json.loads(response.text)
            alts = [RecommendationAlternative(**a) for a in data.get("alternatives", [])]
            dims = [
                ConfidenceDimension(
                    dimension=d.get("dimension", ""),
                    score=int(d.get("score", 50)),
                    explanation=d.get("explanation", ""),
                    trust_tier=d.get("trust_tier", "suggested"),
                )
                for d in data.get("confidence_dimensions", [])
            ]
            return StructuredRecommendation(
                title=data.get("title", ""),
                rationale=data.get("rationale", ""),
                why_this=data.get("why_this", []),
                confidence_score=int(data.get("confidence_score", 50)),
                confidence_explanation=data.get("confidence_explanation", ""),
                confidence_dimensions=dims,
                assumptions=data.get("assumptions", []),
                tradeoffs=data.get("tradeoffs", []),
                expected_impact=data.get("expected_impact", {}),
                alternatives=alts,
                uncertainty_state=data.get("uncertainty_state", "medium_confidence"),
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("Failed to generate structured recommendation: %s", exc)
            return None
