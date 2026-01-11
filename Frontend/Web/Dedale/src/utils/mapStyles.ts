import { StyleSpecification } from "maplibre-gl";

// Facteur de conversion pour Strasbourg (Lat ~48.5)
export const METERS_TO_PX_Z19 = 3.35;

export const ROAD_WIDTHS = {
  motorway: 18 * METERS_TO_PX_Z19,
  primary: 14 * METERS_TO_PX_Z19,
  secondary: 10 * METERS_TO_PX_Z19,
  tertiary: 8 * METERS_TO_PX_Z19,
  minor: 6 * METERS_TO_PX_Z19,
  service: 4 * METERS_TO_PX_Z19,
  path: 2 * METERS_TO_PX_Z19,
};

export const interpolateWidth = (widthAtZ19: number) => [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  10,
  widthAtZ19 / 512,
  19,
  widthAtZ19,
];

export const getMapStyle = (): StyleSpecification =>
  ({
    version: 8,
    sources: {
      // Source Raster (Tuiles PNG depuis PMTiles)
      "raster-tiles": {
        type: "raster",
        url: "pmtiles:///eurometropole_strasbourg.pmtiles",
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "raster-layer",
        type: "raster",
        source: "raster-tiles",
        minzoom: 0,
        maxzoom: 22,
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
    ],
  }) as StyleSpecification;
