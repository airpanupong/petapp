"""Breed/color filter matching; mirrors web/src/lib/petOptions.ts.

app/data/pet_options.json is generated from the web option lists, so both sides agree.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

OTHER_OPTION = "other"
_DATA = Path(__file__).resolve().parent.parent / "data" / "pet_options.json"


@lru_cache
def _options() -> dict[str, dict[str, list[dict]]]:
    return json.loads(_DATA.read_text(encoding="utf-8"))


def _key(value: str) -> str:
    return re.sub(r"สี|ปลอด|\s|-", "", value.lower())


def _find(options: list[dict], value: str) -> dict | None:
    v = value.strip().lower()
    for o in options:
        if o["th"].lower() == v or o["en"].lower() == v or o["id"] == v:
            return o
    # Older posts were typed freely ("ดำ", "แมนคูน"), so compare against each part of a label.
    k = _key(value)
    for o in options:
        for label in [o["th"], o["en"], *o.get("aliases", [])]:
            if any(_key(part) == k for part in [label, *re.split(r"[/()]", label)]):
                return o
    return None


def matches_pet_option(animal: str | None, attribute: str, value: str | None, option_filter: str | None) -> bool:
    """`option_filter` is an option id, "other" for typed-in values, or empty for anything."""
    if not option_filter:
        return True
    options = _options().get(animal or "", {}).get(attribute)
    if not options or not (value or "").strip():
        return False
    hit = _find(options, value or "")
    return hit is None if option_filter == OTHER_OPTION else hit is not None and hit["id"] == option_filter
