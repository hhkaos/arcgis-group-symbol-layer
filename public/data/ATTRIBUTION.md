# Data attribution

Community records: **Community Builders**, [Directory of Spanish tech communities](https://directory.communitybuilders.dev/), [source repository](https://github.com/ComBuildersES/communities-directory). Data in `public/data/` of the source repository is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as stated in its [DATA_LICENSE.md](https://github.com/ComBuildersES/communities-directory/blob/master/DATA_LICENSE.md).

Snapshot retrieved 2026-11-09 from https://directory.communitybuilders.dev/data/communities.json. Changes: GeoJSON conversion, absolute image URLs, source identity strings, and territorial membership from point-in-polygon queries to the user-supplied administrative layers. Source descriptions and status are historical directory data, not independently verified claims.

Administrative data: **© Instituto Geográfico Nacional de España**, distributed through **Esri España / ArcGIS Living Atlas**. Public source items:

- [Autonomous communities](https://www.arcgis.com/home/item.html?id=e75892d1a49646d8a29705ac6680f981)
- [Provinces](https://www.arcgis.com/home/item.html?id=503ef1cb832f4e8bb4be7fc024ad9aa2)
- [Municipalities](https://www.arcgis.com/home/item.html?id=e3357dbd491140d28e230bca8e492875)

Retrieved 2026-11-09. Changes: regional geometries requested in WGS84 with 0.003-degree generalization for display; represented municipal geometries requested with 0.001-degree output generalization; properties renamed for the demo. Municipal membership is determined by point-in-polygon queries against source municipal geometry; the output generalization affects returned shapes, not the query's spatial selection. Source municipal `NATCODE` and `codine` are preserved. Province and region attributes are joined through municipal/INE/NUTS codes. Additional interior representative anchors are calculated from the main polygon component for display, without replacing source community coordinates.

The municipality service credits `BDLJE CC-BY 4.0 ign.es`; **Living Atlas item conditions additionally limit this distributed content to use within the ArcGIS environment**. This demo uses ArcGIS Maps SDK for JavaScript. Do not describe the Living Atlas snapshots as unrestricted open data for other map engines. Full source item descriptions and `licenseInfo` are preserved in `administration.metadata.json`; consult the [Esri España Living Atlas terms](https://www.esri.es/es-es/privacy/terminos-uso-living-atlas) for other uses. The geographic layer API remains independent of these particular example datasets.

The original third-party community logos are **referenced by remote URL**, not copied into this repository. Their trademarks and imagery remain with their respective owners; the directory's data license is not treated as a license to redistribute all logos. If the host or CORS policy prevents loading, the demo uses initials. The fictional NEXO, FARO, and portrait SVG assets under `public/images/` were created for this prototype and may be redistributed with it.

Both synthetic datasets are fictional. Their geographic anchors do not imply real offices, venues, or community memberships. Real communities' municipality assignments describe where their supplied representative coordinate falls; they do not establish an exact venue or exclusive service area. Unresolved coordinates retain a coordinate fallback key and are not assigned a guessed municipality.
