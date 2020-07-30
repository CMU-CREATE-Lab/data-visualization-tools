// While this is implemented in index.ts, we create an interface and shared variable for all modules that import
// We also set window.gEarthTime for js files

import { GSheet } from './GSheet'
import { LayerDB } from './LayerDB'

export class EarthTime {
    layerDB = null;
    layerDBPromise = null;
    timelapse = null;
    rootTilePath = null;
    glb = null;
    canvasLayer = null;
    readyToDraw = false;
    async setDatabaseID(databaseID: GSheet) {
      async function internal(earthTime: EarthTime) {
        earthTime.layerDB = null;
        earthTime.layerDB = await LayerDB.create(databaseID, {earthTime: earthTime});
      }
      this.layerDBPromise = internal(this);
      await this.layerDBPromise;
    }
    async LayerDBLoaded() {
      if (!this.layerDB) await this.layerDBPromise;
    }
    // Compute standard Google Maps zoom level -- 0 means world fits inside 256 pixels across, 1 means 512, 2: 1024 etc
    // Assumes timelapse.getPanoWidth() represents 360 degrees of longitude
    computeGmapsZoomLevel(): number {
      return Math.log2(this.timelapse.getPanoWidth() * this.timelapse.getView().scale / 256);
    }  
  
    _maximumUpdateTime = 30; // milliseconds
    _startOfRedraw: number;
  
    startRedraw() {
      this._startOfRedraw = performance.now();
    }
    redrawTakingTooLong() {
      return performance.now() - this._startOfRedraw > this._maximumUpdateTime;
    }

  };
  
export var gEarthTime: EarthTime;
export function createGEarthTime() {
  gEarthTime = (window as any).gEarthTime = new EarthTime();
}

  