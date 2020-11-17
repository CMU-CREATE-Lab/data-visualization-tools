"use strict";

export class SeaLevelRise {
    _idx: any;
    _html: any;
    _el:  any;
    _heights: any;

    constructor(legendId) {
        this._idx = legendId;
        this._el = document.getElementById(this._idx);
        this._html = `
                <td><div style="font-size: 17px">Global Temperature Rise 
                        <span id="${this._idx}-slr-degree"></span> &#x2103;
                        <span class="credit"> (Climate Central)</span>
                    </div>
                    <div style="font-size: 15px">Multi-century Sea Level Increase:
                        <span id="${this._idx}-slr-feet" style="width:25px;"></span>
                        <span id="${this._idx}-slr-meters" style="width:25px; color: red;"></span>
                    </div>
                </td>
            `;
        this._el.innerHTML = this._html;
        this._heights = {
            "0&deg;C": [0.0, 0.0],
            "0.5&deg;C": [2.4, 0.7],
            "1&deg;C": [7.0, 2.1],
            "1.5&deg;C": [9.4, 2.9],
            "2.0&deg;C": [15, 4.7],
            "2.5&deg;C": [18, 5.6],
            "3.0&deg;C": [21, 6.4],
            "3.5&deg;C": [26, 7.9],
            "4.0&deg;C": [29, 8.9]
        }; // [feet,meters]
    }

    setTemperatureAndHeight(key) {
        var degree = document.getElementById(`${this._idx}-slr-degree`);
        var meters = document.getElementById(`${this._idx}-slr-meters`);
        if (!degree) { 
            this._el = document.getElementById(this._idx);
            this._el.innerHTML = this._html;
            degree = document.getElementById(`${this._idx}-slr-degree`);
            meters = document.getElementById(`${this._idx}-slr-meters`);
        }
        degree.innerHTML = Number.parseFloat(key.split('&')[0]).toFixed(1);
        meters.innerHTML = "+" + this._heights[key][1].toFixed(1) + "m";
    }

}

