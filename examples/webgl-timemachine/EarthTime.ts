// While this is implemented in index.ts, we create an interface and shared variable for all modules that import
// We also set window.gEarthTime for js files

import { GSheet } from './GSheet'
import { LayerDB } from './LayerDB'

export interface EarthTime {
    startRedraw();
    readyToDraw: boolean;
    canvasLayer: any;
    glb: Glb;
    layerDB: LayerDB;
    layerDBPromise: Promise<void>;
    setDatabaseID: (databaseID: GSheet)=>Promise<void>;
    LayerDBLoaded: ()=>Promise<void>;
    timelapse: any;
    rootTilePath: string;
    computeGmapsZoomLevel(): number;
  };

export var gEarthTime: EarthTime;

export function setGEarthTime(et: EarthTime) {
    (window as any).gEarthTime = gEarthTime = et;
}

  