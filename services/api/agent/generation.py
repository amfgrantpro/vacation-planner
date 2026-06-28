import json

from core.config import settings
from core.image_resolver import resolve_destination_photo
from core.llm import get_groq_client
from .session import SupabaseSessionManager
from .utils import prune_history


# ---------------------------------------------------------------------------
# Tool Definitions
# ---------------------------------------------------------------------------

TOOL_SUGGEST_CANDIDATES_GENERATION = {
    "type": "function",
    "function": {
        "name": "suggest_candidates",
        "description": (
            "Suggest exactly 3 new destination candidates the traveler has not yet seen. "
            "Choose the best matches for this specific traveler given their full profile "
            "and the constraints listed. Each candidate must have a name, region, and a "
            "vibe."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "candidates": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 3,
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Destination name only — no country suffix.",
                            },
                            "region": {
                                "type": "string",
                                "description": (
                                    "If a city or area, use its country "
                                    "(e.g. 'Spain' for Basque Country). "
                                    "If a country, use a broader geographic grouping "
                                    "(e.g. 'Mediterranean' for Malta)."
                                ),
                            },
                            "vibe": {
                                "type": "string",
                                "description": (
                                    "1-sentence description of what this destination is like "
                                    "and famous for — its character and atmosphere."
                                ),
                            },
                        },
                        "required": ["name", "region", "vibe"],
                    },
                }
            },
            "required": ["candidates"],
        },
    },
}

TOOL_GENERATE_COMPARISON = {
    "type": "function",
    "function": {
        "name": "generate_comparison",
        "description": (
            "Populate the comparison table and destination enrichments as instructed. "
            "If generating criteria from scratch, choose criteria grounded in this "
            "specific traveler's profile. If filling gaps, use the exact criterion "
            "names provided — do not rename or add new ones. "
            "Provide trip_feel and seasonal_note only for destinations listed in the "
            "enrichment section."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "criteria": {
                    "type": "array",
                    "description": (
                        "Comparison criteria with values for each destination. "
                        "Each criterion has a name and one value per shortlisted candidate."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "criterion_name": {
                                "type": "string",
                                "description": (
                                    "The criterion label (e.g. 'Best time to go'). "
                                    "Must match existing names exactly when filling gaps."
                                ),
                            },
                            "values": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "candidate_name": {"type": "string"},
                                        "value": {
                                            "type": "string",
                                            "description": (
                                                "Short, comparable value — 1–2 sentences, "
                                                "consistent detail level across all destinations."
                                            ),
                                        },
                                    },
                                    "required": ["candidate_name", "value"],
                                },
                            },
                        },
                        "required": ["criterion_name", "values"],
                    },
                },
                "candidate_enrichments": {
                    "type": "array",
                    "description": (
                        "trip_feel and seasonal_note for destinations that need them. "
                        "Only include destinations listed in the enrichment section of the prompt."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "candidate_name": {"type": "string"},
                            "trip_feel": {
                                "type": "string",
                                "description": (
                                    "How THIS traveler is expected to experience this destination. "
                                    "It is NOT a description of the location — it is a description "
                                    "of the kind of trip that this user would have in this location."
                                ),
                            },
                            "seasonal_note": {
                                "type": "string",
                                "description": (
                                    "What this destination is like during the traveler's "
                                    "planned travel period."
                                ),
                            },
                        },
                        "required": ["candidate_name", "trip_feel", "seasonal_note"],
                    },
                },
            },
            "required": ["criteria", "candidate_enrichments"],
        },
    },
}


# ---------------------------------------------------------------------------
# Shared LLM call helper
# ---------------------------------------------------------------------------

def _call_llm_forced(client, messages: list, tool: dict) -> dict:
    """Single forced tool call; falls back to GROQ_FALLBACK_MODEL on rate limit."""
    tool_name = tool["function"]["name"]
    kwargs = {
        "model": settings.GROQ_PRIMARY_MODEL,
        "messages": messages,
        "tools": [tool],
        "tool_choice": {"type": "function", "function": {"name": tool_name}},
    }
    try:
        response = client.chat.completions.create(**kwargs)
    except Exception as e:
        if "rate_limit_exceeded" in str(e) or "429" in str(e):
            print(f"⚠️  Rate limit on {settings.GROQ_PRIMARY_MODEL}. Falling back to {settings.GROQ_FALLBACK_MODEL}...")
            kwargs["model"] = settings.GROQ_FALLBACK_MODEL
            response = client.chat.completions.create(**kwargs)
        else:
            raise

    message = response.choices[0].message
    if not message.tool_calls:
        raise RuntimeError(f"LLM did not call the required tool '{tool_name}'")

    return json.loads(message.tool_calls[0].function.arguments)


# ---------------------------------------------------------------------------
# CandidateGenerator
# ---------------------------------------------------------------------------

class CandidateGenerator:
    def __init__(self, session_manager: SupabaseSessionManager, client):
        self.session_manager = session_manager
        self.client = client

    def _build_prompt(self, profile, rejected: list, active_names: list) -> str:
        def fmt_list(items, fallback):
            return ", ".join(items) if items else fallback

        rejected_lines = (
            "\n".join(f"- {r['name']}: {r['reason']}" for r in rejected)
            if rejected else "None"
        )
        active_lines = (
            "\n".join(f"- {n}" for n in active_names)
            if active_names else "None yet"
        )
        origin = profile.origin or "not specified"

        return f"""You are an expert travel consultant. Given a traveler's profile and planning session,
your job is to suggest the 3 best-matching destination candidates they have not yet seen.

## Traveler Profile
Origin: {origin}
Travelers: {profile.travelers or "not specified"}
When: {profile.when or "not specified"}
Duration: {profile.duration or "not specified"}
Budget: {profile.budget or "not specified"}
Vacation type: {fmt_list(profile.vacation_type, "not specified")}
Likes: {fmt_list(profile.likes, "none recorded")}
Avoid: {fmt_list(profile.avoid, "none recorded")}

## Already Visible Destinations
The traveler can already see these destinations on screen — do not suggest them:
{active_lines}

## Rejected Destinations
The traveler has explicitly removed these — do not suggest them under any circumstances:
{rejected_lines}

## Your Task
Suggest the 3 best-matching destination candidates this traveler has not yet seen.

Selection rules:
- Budget and timing are constraints, not loose suggestions.
- Respect the hard profile constraints. e.g. A traveler flying from {origin} for {profile.duration or "the stated duration"} should not receive long-haul destinations that are not realistic given the time available.
- Choose destinations that fit the full profile — not just vacation type and likes, but all of it together.
- If the recent conversation contains preferences or constraints not yet captured in the profile fields above, factor them in alongside the existing profile fields.
- Do not suggest any destination that appears in the "Already Visible" or "Rejected" lists above.

For each destination, provide:
- name: the destination name only (city, region, or country — whichever level is most meaningful for the traveler)
- region: if a city or area, use its country (e.g. "Spain" for Basque Country, "Italy" for Amalfi Coast). If a country, use a broader geographic grouping (e.g. "Mediterranean" for Malta, "South Asia" for Sri Lanka).
- vibe: 1-sentence description of what this destination is like and famous for — its character and atmosphere (e.g. 'a laid-back island with whitewashed villages and volcanic beaches')."""

    def generate(self, session_id: str) -> dict:
        session = self.session_manager.get_session(session_id)
        profile = session.plan.trip_profile
        candidates = session.plan.candidates
        supabase = self.session_manager.supabase

        rejected = [
            {"name": c.name, "reason": c.rejection_reason or ""}
            for c in candidates if c.status == "rejected"
        ]
        active_names = [
            c.name for c in candidates if c.status in ("suggested", "shortlisted")
        ]

        pruned = prune_history(session.history)
        system_prompt = self._build_prompt(profile, rejected, active_names)
        messages = [{"role": "system", "content": system_prompt}] + pruned

        print(f"🔧 CandidateGenerator: calling LLM for session {session_id}")
        result = _call_llm_forced(self.client, messages, TOOL_SUGGEST_CANDIDATES_GENERATION)

        new_candidates = result.get("candidates", [])
        print(f"   LLM returned {len(new_candidates)} candidates")

        # Resolve photos
        for item in new_candidates:
            item["photo_url"] = resolve_destination_photo(item["name"], item.get("region"))

        # Pre-fetch all existing candidates for this session (with DB IDs)
        all_existing_result = (
            supabase.table("candidates")
            .select("id, name, status")
            .eq("session_id", session_id)
            .execute()
        )
        existing_by_name: dict = {
            row["name"].lower(): row for row in all_existing_result.data
        }
        protected_statuses = {"shortlisted", "rejected"}

        for item in new_candidates:
            name_lower = item["name"].lower()
            existing_row = existing_by_name.get(name_lower)

            if existing_row and existing_row["status"] in protected_statuses:
                print(f"   Skipping {item['name']} — {existing_row['status']}")
                continue

            row = {
                "session_id": session_id,
                "name": item["name"],
                "region": item["region"],
                "vibe": item["vibe"],
                "photo_url": item["photo_url"],
                "status": "suggested",
            }
            if existing_row:
                supabase.table("candidates").update(row).eq("id", existing_row["id"]).execute()
            else:
                supabase.table("candidates").insert(row).execute()

        # Return full candidate list from DB post-write
        all_candidates_result = (
            supabase.table("candidates")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return {"candidates": all_candidates_result.data}


# ---------------------------------------------------------------------------
# ComparisonGenerator
# ---------------------------------------------------------------------------

class ComparisonGenerator:
    def __init__(self, session_manager: SupabaseSessionManager, client):
        self.session_manager = session_manager
        self.client = client

    def _build_prompt(
        self,
        profile,
        shortlisted: list,
        existing_criterion_names: list,
        missing_cells: set,
        missing_enrichments: list,
    ) -> str:
        def fmt_list(items, fallback):
            return ", ".join(items) if items else fallback

        shortlisted_lines = "\n".join(
            f"- {c['name']} ({c['region']})" for c in shortlisted
        )

        if not existing_criterion_names:
            criteria_block = (
                "No criteria exist yet. Generate a comparison table from scratch.\n\n"
                "Choose 5–7 criteria that are genuinely useful for THIS traveler's decision. "
                "Ground them in the profile above — the best criteria reflect what this traveler "
                "actually cares about. A \"Best suited for\" row (e.g. \"Couples seeking culture "
                "and food\", \"Active families\") is a strong opening criterion. \"Weather\" and "
                "\"Getting Around\" are acceptable starting points, but at least half the criteria "
                "should be specific to this trip and this profile.\n\n"
                "For each criterion, provide a short value for every shortlisted destination — "
                "1–2 sentences at most, at a consistent level of detail between all destinations."
            )
        else:
            numbered = "\n".join(
                f"{i + 1}. {n}" for i, n in enumerate(existing_criterion_names)
            )
            missing_lines = "\n".join(
                f"- {criterion} / {candidate}"
                for criterion, candidate in sorted(missing_cells)
            )
            criteria_block = (
                "The comparison table already uses these criteria. Use the EXACT same names — "
                "do not rename, rephrase, or introduce new criteria:\n"
                f"{numbered}\n\n"
                "Fill values only for the following missing cells:\n"
                f"{missing_lines}\n\n"
                "Use the same level of detail and tone as the values already in the table — "
                "1–2 sentences at most, at a consistent level of detail between all destinations."
            )

        if missing_enrichments:
            enrichment_names = "\n".join(f"- {c['name']}" for c in missing_enrichments)
            when_str = profile.when or "their planned travel period"
            enrichment_block = (
                "\n## Destination Enrichments\n\n"
                "For each destination listed below, provide trip_feel and seasonal_note. "
                "Only destinations in this list need enrichment — do not provide these fields "
                "for destinations not listed here.\n\n"
                f"{enrichment_names}\n\n"
                "For each listed destination:\n"
                "- trip_feel: What would THIS traveler's experience here actually feel like, "
                "given their specific profile and how they think about vacations? Think about "
                "their travel style, companions, budget, and what they have said they value. "
                "This is personal — it is not a general description of the destination. "
                "Do not repeat or paraphrase the vibe.\n"
                f"- seasonal_note: What is this destination like during {when_str}? Focus on "
                "what is relevant to a traveler — weather, crowd levels, local events, anything "
                "time-specific."
            )
        else:
            enrichment_block = (
                "\nNo destination enrichments are needed this call — "
                "return an empty candidate_enrichments array."
            )

        return f"""You are an expert travel consultant helping a traveler decide between their shortlisted destinations. Your job is to populate a comparison table using what matters most to the user — so they can see, side by side, how their options stack up on the things they actually care about.

## Traveler Profile
Origin: {profile.origin or "not specified"}
Travelers: {profile.travelers or "not specified"}
When: {profile.when or "not specified"}
Duration: {profile.duration or "not specified"}
Budget: {profile.budget or "not specified"}
Vacation type: {fmt_list(profile.vacation_type, "not specified")}
Likes: {fmt_list(profile.likes, "none recorded")}
Avoid: {fmt_list(profile.avoid, "none recorded")}

## Shortlisted Destinations
{shortlisted_lines}

## Comparison Table

{criteria_block}
{enrichment_block}"""

    def generate(self, session_id: str) -> dict:
        session = self.session_manager.get_session(session_id)
        profile = session.plan.trip_profile
        candidates = session.plan.candidates
        supabase = self.session_manager.supabase

        shortlisted = [
            {
                "name": c.name,
                "region": c.region,
                "trip_feel": c.trip_feel,
                "seasonal_note": c.seasonal_note,
            }
            for c in candidates if c.status == "shortlisted"
        ]
        shortlisted_names: set = {c["name"] for c in shortlisted}

        # Read all comparison_criteria rows for this session
        criteria_result = (
            supabase.table("comparison_criteria")
            .select("criterion_name, candidate_name, value")
            .eq("session_id", session_id)
            .execute()
        )
        all_rows = criteria_result.data

        # Ordered, deduplicated list of existing criterion names
        existing_criterion_names: list = list(dict.fromkeys(
            r["criterion_name"] for r in all_rows
        ))

        # Determine missing cells (shortlisted candidates only)
        populated_cells: set = set()
        null_cells: set = set()
        for row in all_rows:
            if row["candidate_name"] in shortlisted_names:
                key = (row["criterion_name"], row["candidate_name"])
                if row["value"] is not None:
                    populated_cells.add(key)
                else:
                    null_cells.add(key)

        # Any shortlisted candidate × existing criterion with no DB row at all is also missing
        for criterion in existing_criterion_names:
            for name in shortlisted_names:
                key = (criterion, name)
                if key not in populated_cells and key not in null_cells:
                    null_cells.add(key)

        # Missing enrichments: shortlisted candidates where trip_feel or seasonal_note is null
        missing_enrichments = [
            c for c in shortlisted
            if c["trip_feel"] is None or c["seasonal_note"] is None
        ]

        # Early exit: nothing to generate
        if not null_cells and not missing_enrichments:
            print(f"✅ ComparisonGenerator: nothing missing for session {session_id} — skipping LLM call")
            return self._build_response(session_id, supabase, shortlisted_names)

        pruned = prune_history(session.history)
        system_prompt = self._build_prompt(
            profile, shortlisted, existing_criterion_names, null_cells, missing_enrichments
        )
        messages = [{"role": "system", "content": system_prompt}] + pruned

        print(
            f"🔧 ComparisonGenerator: calling LLM for session {session_id} "
            f"({len(null_cells)} missing cells, {len(missing_enrichments)} missing enrichments)"
        )
        result = _call_llm_forced(self.client, messages, TOOL_GENERATE_COMPARISON)

        # --- Write comparison_criteria (cell-locking enforced at application layer) ---
        cells_to_write = []
        for criterion in result.get("criteria", []):
            for cell in criterion.get("values", []):
                key = (criterion["criterion_name"], cell["candidate_name"])
                if key in null_cells:
                    cells_to_write.append({
                        "session_id": session_id,
                        "criterion_name": criterion["criterion_name"],
                        "candidate_name": cell["candidate_name"],
                        "value": cell["value"],
                    })

        if cells_to_write:
            supabase.table("comparison_criteria").upsert(
                cells_to_write,
                on_conflict="session_id,criterion_name,candidate_name",
            ).execute()
            print(f"   Wrote {len(cells_to_write)} comparison_criteria cells")

        # --- Write trip_feel / seasonal_note (null-only, never overwrite) ---
        if missing_enrichments:
            missing_enrichment_names: set = {c["name"] for c in missing_enrichments}

            # Pre-fetch candidate rows for efficient ID lookup
            cand_result = (
                supabase.table("candidates")
                .select("id, name, trip_feel, seasonal_note")
                .eq("session_id", session_id)
                .execute()
            )
            cand_by_name: dict = {
                row["name"].lower(): row for row in cand_result.data
            }

            for enrichment in result.get("candidate_enrichments", []):
                name = enrichment.get("candidate_name", "")
                if name not in missing_enrichment_names:
                    continue
                cand_row = cand_by_name.get(name.lower())
                if not cand_row:
                    continue
                update_data = {}
                if cand_row.get("trip_feel") is None and enrichment.get("trip_feel"):
                    update_data["trip_feel"] = enrichment["trip_feel"]
                if cand_row.get("seasonal_note") is None and enrichment.get("seasonal_note"):
                    update_data["seasonal_note"] = enrichment["seasonal_note"]
                if update_data:
                    supabase.table("candidates").update(update_data).eq("id", cand_row["id"]).execute()

        return self._build_response(session_id, supabase, shortlisted_names)

    def _build_response(self, session_id: str, supabase, shortlisted_names: set) -> dict:
        """Read DB post-write and build the API response."""
        shortlisted_names_lower = {n.lower() for n in shortlisted_names}

        # Reconstruct comparison_matrix from DB (shortlisted candidates only)
        criteria_result = (
            supabase.table("comparison_criteria")
            .select("criterion_name, candidate_name, value")
            .eq("session_id", session_id)
            .execute()
        )
        matrix_dict: dict = {}
        for row in criteria_result.data:
            if row["candidate_name"] in shortlisted_names and row["value"] is not None:
                criterion = row["criterion_name"]
                if criterion not in matrix_dict:
                    matrix_dict[criterion] = {"criterion": criterion}
                matrix_dict[criterion][row["candidate_name"]] = row["value"]
        comparison_matrix = list(matrix_dict.values())

        # Fetch updated enrichments for all shortlisted candidates in one query
        cand_result = (
            supabase.table("candidates")
            .select("name, trip_feel, seasonal_note")
            .eq("session_id", session_id)
            .execute()
        )
        updated_candidates = [
            row for row in cand_result.data
            if row["name"].lower() in shortlisted_names_lower
        ]

        return {
            "comparison_matrix": comparison_matrix,
            "candidates": updated_candidates,
        }
