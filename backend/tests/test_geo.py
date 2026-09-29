from app.api.v1 import geo

API = "/api/v1"


def test_search_places_maps_results_and_caches(client, monkeypatch):
    geo._cache.clear()
    calls: list[tuple[str, dict]] = []

    async def fake(path, params):
        calls.append((path, params))
        return [
            {
                "lat": "13.7797",
                "lon": "100.5446",
                "name": "อารีย์",
                "display_name": "อารีย์, พญาไท, กรุงเทพมหานคร",
                "address": {"road": "พหลโยธิน", "city_district": "พญาไท", "city": "กรุงเทพมหานคร"},
            }
        ]

    monkeypatch.setattr(geo, "_nominatim", fake)
    res = client.get(f"{API}/geo/search", params={"q": "อารีย์", "lat": 13.75, "lng": 100.5})
    assert res.status_code == 200, res.text
    [place] = res.json()["data"]
    assert place["name"] == "อารีย์ พหลโยธิน พญาไท"
    assert (place["latitude"], place["longitude"]) == (13.7797, 100.5446)
    assert calls[0][1]["countrycodes"] == "th" and "viewbox" in calls[0][1]

    again = client.get(f"{API}/geo/search", params={"q": "  อารีย์ ", "lat": 13.75, "lng": 100.5})
    assert again.json()["data"] == res.json()["data"]
    assert len(calls) == 1


def test_search_requires_query(client):
    assert client.get(f"{API}/geo/search", params={"q": "a"}).status_code == 422


def test_reverse_geocode(client, monkeypatch):
    geo._cache.clear()

    async def fake(path, params):
        assert path == "/reverse"
        return {"name": "สวนจตุจักร", "display_name": "x", "address": {"city": "กรุงเทพมหานคร"}}

    monkeypatch.setattr(geo, "_nominatim", fake)
    res = client.get(f"{API}/geo/reverse", params={"lat": 13.8, "lng": 100.55})
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "สวนจตุจักร กรุงเทพมหานคร"
