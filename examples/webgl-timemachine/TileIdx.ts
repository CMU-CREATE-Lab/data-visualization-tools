///////////////////////////
// Tile index
//

import { Layer } from "./Layer";

// A tile has a level, row, and column
// Level 0 has 1x1=1 tiles; level 1 has 2x2=4 tiles; level 2 has 4x4=16 tiles
//
// key is a string that encodes [level, row, column] with leading zeros to allow
// lexicographic sorting to match sorting by [level, row, column]

/// <reference path="../../js/utils.js"/>

export class TileIdx {
  l: number;
  c: number;
  r: number;
  key: string;

  constructor(l: number, c: number, r: number) {
    this.l = l;
    this.c = c;
    this.r = r;
    this.key = ('00' + l).substr(-3) + ('00000' + r).substr(-6) + ('00000' + c).substr(-6);
  }
  parent() {
    if (this.l > 0) {
      return new TileIdx(this.l - 1, this.c >> 1, this.r >> 1);
    }
    else {
      return null;
    }
  }
  toString() {
    return this.l + ',' + this.c + ',' + this.r;
  }
  // Expands {x} (column), {y} (row), {yflip} (mirrored row), and {z} (level) in an URL
  expandUrl(url, layer: Layer = null) {
    if (layer?.startDate && layer?.endDate) {
      let startEpochTime = parseDateStr(layer.startDate);
      if (layer.setDataOptions && layer.setDataOptions.startDateMargin) {
        // @ts-ignore
        startEpochTime -= layer.setDataOptions.startDateMargin;
      }
      var endEpochTime = parseDateStr(layer.endDate);

      url = url.replace("{startEpochTime}", startEpochTime).replace("{endEpochTime}", endEpochTime);
    }

    return url
      .replace("{z}", this.l)
      .replace("{x}", this.c)
      .replace("{y}", this.r)
      .replace("{yflip}", Math.pow(2, this.l) - 1 - this.r);
  }
}




