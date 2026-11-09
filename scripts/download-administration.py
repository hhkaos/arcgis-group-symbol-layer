"""Refresh public IGN/Living Atlas inputs. Explicit network operation, no credentials.

Queries only attributes for the distinct supplied community anchors; avoids
downloading every Spanish municipal polygon. Run data:prepare afterwards.
"""
import concurrent.futures
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent / "public/data"
BASE = "https://services1.arcgis.com/nCKYwcSONQTkPA4K/arcgis/rest/services/"
SERVICES = {"regions": "CCAA_wgs1984_wm", "provinces": "Prov", "municipalities": "muni"}


def get(url, parameters):
    request = urllib.request.Request(url + "?" + urllib.parse.urlencode(parameters), headers={"User-Agent": "GroupedSymbolLayerPrototype/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.load(response)
    if "error" in data:
        raise RuntimeError(data["error"])
    if data.get("exceededTransferLimit"):
        raise RuntimeError("Incomplete response: exceededTransferLimit")
    return data


def main():
    metadata = {}
    for role, service in SERVICES.items():
        url = BASE + service + "/FeatureServer"
        info = get(url, {"f": "json"})
        item = get("https://www.arcgis.com/sharing/rest/content/items/" + info["serviceItemId"], {"f": "json"})
        metadata[role] = {"serviceUrl": url, "itemId": info["serviceItemId"], "copyright": info.get("copyrightText"), "access": item.get("access"), "licenseInfo": item.get("licenseInfo"), "description": item.get("description"), "title": item.get("title")}
        if item.get("access") != "public":
            raise RuntimeError(f"{role} is not publicly accessible")

    regions = get(BASE + SERVICES["regions"] + "/FeatureServer/0/query", {"f": "geojson", "where": "1=1", "outFields": "OBJECTID,INSPIREID,NATCODE,NAMEUNIT,CODNUT2", "outSR": 4326, "maxAllowableOffset": 0.003, "returnGeometry": "true"})
    provinces = get(BASE + SERVICES["provinces"] + "/FeatureServer/0/query", {"f": "json", "where": "1=1", "outFields": "NATCODE,NAMEUNIT,CODNUT2,CODNUT3,CODINE_CCAA,CODINE_PRO", "returnGeometry": "false"})
    source = json.loads((ROOT / "communities.source.json").read_text())
    points = sorted({(r["latLon"]["lon"], r["latLon"]["lat"]) for r in source if r.get("latLon", {}).get("lon") is not None and r["latLon"].get("lat") is not None})

    def query(point):
        lon, lat = point
        result = get(BASE + SERVICES["municipalities"] + "/FeatureServer/0/query", {"f": "geojson", "geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "inSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": "INSPIREID,NATCODE,NAMEUNIT,CODNUT2,CODNUT3,codine", "returnGeometry": "true", "outSR": 4326, "maxAllowableOffset": 0.001})
        return {"coordinates": [lon, lat], "matches": [f["properties"] for f in result.get("features", [])], "geometries": result.get("features", [])}

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        memberships = list(pool.map(query, points))
    local_features = {}
    for point in memberships:
        for feature in point.pop("geometries"):
            local_features[feature["properties"]["NATCODE"]] = feature
    (ROOT / "administration.municipalities.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": list(local_features.values())}, ensure_ascii=False, separators=(",", ":")) + "\n")
    for filename, value in [("administration.metadata.json", metadata), ("administration.regions.geojson", regions), ("administration.provinces.json", provinces), ("administration.memberships.json", memberships)]:
        (ROOT / filename).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"regions": len(regions["features"]), "provinces": len(provinces["features"]), "anchors": len(memberships), "resolvedMunicipalities": sum(len(p["matches"]) == 1 for p in memberships), "unresolved": [p for p in memberships if len(p["matches"]) != 1], "access": {k: v["access"] for k, v in metadata.items()}}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
