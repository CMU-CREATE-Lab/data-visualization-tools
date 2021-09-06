// While this is implemented in index.ts, we create an interface and shared variable for all modules that import
// We also set window.gEarthTime for js files

import { GSheet } from './GSheet'
import { LayerDB } from './LayerDB'
import { Glb } from './Glb'
import { Timeline } from './Timeline';

export interface EarthTime {
  mode: string;
  playbackRates(): {[key: string]: number},
  waitFrames: any;
  lastTimeNotWaiting: number;
  currentlyShownTimeline: any;
  lastClientDimensions: { width: number, height: number };
  lastView: {[key: string]: number},
  lastDrawnLayers: any;
  lastPlaybackTime: number;
  defaultMasterPlaybackRate: number;
  defaultPlaybackRate: number;
  dotmapsServerHost: any;
  redrawTakingTooLong(): boolean;
  startRedraw(): void;
  readyToDraw: boolean;
  canvasLayer: any;
  glb: Glb;
  layerDB: LayerDB;
  layerDBPromise: Promise<void>;
  setDatabaseID: (databaseID: GSheet)=>Promise<void>;
  LayerDBLoaded: ()=>Promise<void>;
  timelapse: any;
  rootTilePath: string;
  gmapsZoomLevel(): number;
  timelapseZoom(): number;
  currentEpochTime(): number;
  currentEpochTimeAndRate(): {epochTime: number, rate: number};
  timelapseCurrentTimeDelta(): number;
  timeline(): Timeline;
  updateTimelineIfNeeded(): void;
  handleGraphIfNeeded(): void;
  showVisibleLayersLegendsAndCredits(): void;
};

export const stdWebMercatorNorth = 85.05113006405742; // Northernmost latitude for standard Web Mercator
export const stdWebMercatorSouth = -85.05113006405742; // Southernmost latitude for standard Web Mercator

export var gEarthTime: EarthTime;

export function setGEarthTime(et: EarthTime) {
    (window as any).gEarthTime = gEarthTime = et;
}

