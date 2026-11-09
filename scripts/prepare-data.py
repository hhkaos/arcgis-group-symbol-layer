"""Rebuild the portable GeoJSON snapshot without geocoding or ArcGIS services.

Inputs are bundled Community Builders and IGN/Living Atlas snapshots.
Network access is never required. Living Atlas inputs retain their source terms.
Coordinates identify representative activity areas, not exact meeting venues.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public/data"


def interior_anchor(geometry):
    """Interior label point, approximating maximum clearance in the main component."""
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    def area(polygon):
        r = polygon[0]
        return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(r, r[1:] + r[:1])))
    rings = max(polygons, key=area)
    outer = rings[0]
    def inside(x, y, ring):
        yes = False
        for a, b in zip(ring, ring[1:] + ring[:1]):
            if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
                yes = not yes
        return yes
    segments = [(a, b) for ring in rings for a, b in zip(ring, ring[1:] + ring[:1])]
    def clearance(x, y):
        if not inside(x, y, outer) or any(inside(x, y, hole) for hole in rings[1:]):
            return -1
        distance = float("inf")
        for a, b in segments:
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = dx * dx + dy * dy
            t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length)) if length else 0
            distance = min(distance, (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2)
        return distance
    xmin, xmax = min(p[0] for p in outer), max(p[0] for p in outer)
    ymin, ymax = min(p[1] for p in outer), max(p[1] for p in outer)
    best = (-1, outer[0][0], outer[0][1])
    for i in range(1, 16):
        for j in range(1, 16):
            x, y = xmin + (xmax - xmin) * i / 16, ymin + (ymax - ymin) * j / 16
            best = max(best, (clearance(x, y), x, y))
    step = max(xmax - xmin, ymax - ymin) / 16
    for _ in range(4):
        candidates = [(best[1] + i * step / 2, best[2] + j * step / 2) for i in range(-2, 3) for j in range(-2, 3)]
        for x, y in candidates:
            best = max(best, (clearance(x, y), x, y))
        step /= 2
    return [round(best[1], 7), round(best[2], 7)]


def main():
    source = json.loads((DATA / "communities.source.json").read_text())
    territories = json.loads((DATA / "administration.regions.geojson").read_text())
    local_boundaries = json.loads((DATA / "administration.municipalities.geojson").read_text())
    memberships = json.loads((DATA / "administration.memberships.json").read_text())
    provinces = json.loads((DATA / "administration.provinces.json").read_text())["features"]
    region_by_nuts = {f["properties"]["CODNUT2"]: f["properties"] for f in territories["features"]}
    province_by_code = {str(f["attributes"].get("CODINE_PRO")).zfill(2): f["attributes"] for f in provinces}
    municipality_by_point = {tuple(p["coordinates"]): p["matches"][0] for p in memberships if len(p["matches"]) == 1}
    features, unmapped, unassigned = [], [], []
    positions = {}
    for row in source:
        loc = row.get("latLon") or {}
        lat, lon = loc.get("lat"), loc.get("lon")
        valid = all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in (lon, lat))
        valid = valid and -180 <= lon <= 180 and -90 <= lat <= 90
        region = None
        municipality = None
        province = None
        if valid:
            key = (lon, lat)
            if key not in positions:
                municipality = municipality_by_point.get(key)
                positions[key] = region_by_nuts.get(municipality["CODNUT2"]) if municipality else None
            region = positions[key]
            municipality = municipality_by_point.get(key)
            province = province_by_code.get((municipality.get("codine") or "")[:2]) if municipality else None
        props = dict(row)
        props.pop("latLon", None)
        props["sourceId"] = str(row["id"])
        props["regionId"] = region["NATCODE"] if region else None
        props["regionName"] = region["NAMEUNIT"] if region else None
        props["provinceId"] = province["NATCODE"] if province else None
        props["provinceName"] = province["NAMEUNIT"] if province else None
        props["municipalityCode"] = municipality.get("codine") if municipality else None
        props["localityId"] = "municipality:" + municipality["NATCODE"] if municipality else f"unassigned:{lon:.6f}:{lat:.6f}" if valid else None
        props["localityName"] = municipality["NAMEUNIT"] if municipality else None
        thumbnail = row.get("thumbnailUrl")
        props["imageUrl"] = "https://directory.communitybuilders.dev/" + thumbnail.lstrip("/") if thumbnail else None
        features.append({"type": "Feature", "id": row["id"], "geometry": {"type": "Point", "coordinates": [lon, lat]} if valid else None, "properties": props})
        if not valid:
            unmapped.append(row["id"])
        elif not region:
            unassigned.append({"id": row["id"], "location": row.get("location"), "coordinates": [lon, lat]})

    for i, t in enumerate(territories["features"]):
        t["id"] = i + 1
        p = t["properties"]
        anchor = interior_anchor(t["geometry"])
        t["properties"] = {"objectid": i + 1, "id": p["NATCODE"], "name": p["NAMEUNIT"], "anchorX": anchor[0], "anchorY": anchor[1]}
    for i, t in enumerate(local_boundaries["features"]):
        p = t["properties"]
        anchor = interior_anchor(t["geometry"])
        t["properties"] = {"id": p["NATCODE"], "name": p["NAMEUNIT"], "anchorX": anchor[0], "anchorY": anchor[1]}

    def write(name, value):
        (DATA / name).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")

    write("communities.geojson", {"type": "FeatureCollection", "features": features})
    write("territories.geojson", territories)
    write("municipalities.geojson", local_boundaries)
    report = {"total": len(source), "withCoordinates": len(source) - len(unmapped), "withoutCoordinates": len(unmapped), "sourceAnchors": len(positions), "municipalityGroups": len({f["properties"]["localityId"] for f in features if f["geometry"]}), "withoutCoordinatesIds": unmapped, "unassignedRegions": unassigned, "regionAssignment": "Public IGN/Living Atlas municipal point-in-polygon query, then CODNUT2 join to regions; no nearest-region guessing", "localityGrouping": "Municipal NATCODE, with source coordinates retained; coordinate fallback for unresolved points"}
    write("conversion-report.json", report)
    print(json.dumps({k: v for k, v in report.items() if k not in ("withoutCoordinatesIds", "unassignedRegions")}, ensure_ascii=False, indent=2))
    print(f"Unassigned regions: {len(unassigned)}; retained without a regional group.")


if __name__ == "__main__":
    main()
