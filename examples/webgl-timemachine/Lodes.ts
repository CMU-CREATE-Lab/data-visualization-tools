"use strict";

export class Lodes {
    lodesGui: any;
    lodesOptions: any;  
    lodesAnimationState: any;

    constructor() {
        this.lodesOptions = new LodesOptions();
        this.lodesGui = new LodesGui(this.lodesOptions);
        this.lodesAnimationState = new LodesAnimationState();
    }

    getOptions() {
        let options = {
            se01: this.lodesOptions.se01,
            se02: this.lodesOptions.se02,
            se03: this.lodesOptions.se03,    
            filter: this.lodesOptions.filter,
            distance: this.lodesOptions.distance,
            step: 0    
        }        

        if (this.lodesOptions.animate == 'animate') {
            var now = new Date();
            var deltaTime = now.getTime() - this.lodesAnimationState.then.getTime();
            var step = deltaTime/(this.lodesOptions.totalTime*this.lodesOptions.speed);
            if (this.lodesAnimationState.inMainLoop) {
              if (this.lodesOptions.doPulse) {
                if (this.lodesAnimationState.pulse) {
                  step = 1. - step;
                }
              } else if (this.lodesAnimationState.pulse) {
                this.lodesAnimationState.pulse = false;
              }
  
              if (deltaTime >= this.lodesOptions.totalTime*this.lodesOptions.speed) {
                this.lodesAnimationState.then = new Date();
                this.lodesAnimationState.inMainLoop = false;
                if (this.lodesOptions.doPulse && this.lodesAnimationState.pulse) {
                  this.lodesAnimationState.inStartDwell = true;
                } else {
                  this.lodesAnimationState.inEndDwell = true;
                }
              }
            }
            else if (this.lodesAnimationState.inStartDwell) {
              step = 0.;
              if (deltaTime >= this.lodesOptions.dwellTime) {
                this.lodesAnimationState.inStartDwell = false;
                this.lodesAnimationState.inMainLoop = true;
                this.lodesAnimationState.then = new Date();
                if (this.lodesOptions.doPulse) {
                  this.lodesAnimationState.pulse = false;
                }
              }
            }
            else {
              step = 1.;
              if (deltaTime >= this.lodesOptions.dwellTime) {
                this.lodesAnimationState.inEndDwell = false;
                this.lodesAnimationState.then = new Date();
                if (this.lodesOptions.doPulse) {
                  this.lodesAnimationState.inMainLoop = true;
                  this.lodesAnimationState.pulse = true;
                } else {
                  this.lodesAnimationState.inStartDwell = true;
                }
              }
            }
            step = Math.min(Math.max(step, 0.),1.);
  
          } else if (this.lodesOptions.animate == 'home'){
              step = 0.;
          } else {
            step = 1.;
          }
  
          options.step = step;

        return options;
    }
       
}

class LodesOptions {
    doPulse: boolean;
    totalTime: number;
    dwellTime: number;
    filter: boolean;
    distance: number;
    animate: string;
    speed: number;
    se01: boolean;
    se02: boolean;
    se03: boolean;

    constructor() {
        this.doPulse = true;
        this.totalTime = 1000;
        this.dwellTime = 1000;
        this.filter = true;
        this.distance = 50.0;
        this.animate = 'animate';
        this.speed = 1;
        this.se01 = true;
        this.se02 = true;
        this.se03 = true;
      };
      
}

class LodesGui {
    gui: any;
    
    constructor(lodesOptions: LodesOptions) {
        // @ts-ignore
        let gui = new dat.GUI();
        //gui.domElement.id = 'lodes-gd';
        // @ts-ignore
        let f1 = gui.addFolder('Animation');
        f1.add(lodesOptions, 'animate', { animate: 'animate', home: 'home', work: 'work' } );
        f1.add(lodesOptions, 'speed', { fast: 1, medium: 3, slow: 5});
        f1.open();
        // @ts-ignore
        let f2 = gui.addFolder('Distance in KM');
        f2.add(lodesOptions, 'filter');
        f2.add(lodesOptions, 'distance',10,100);
        f2.open();
        // @ts-ignore
        let f3 = gui.addFolder('Earnings per Month');
        f3.add(lodesOptions, 'se01').name('< $1251');
        f3.add(lodesOptions, 'se02').name('$1251 - $3333');
        f3.add(lodesOptions, 'se03').name('> $3333');
        f3.open();
        f3.onResize = function() {
            let el1 = document.getElementById("se01-color");
            let el2 = document.getElementById("se02-color");
            let el3 = document.getElementById("se03-color");
            if (f3.closed) {
                el1.style['display'] = 'none';
                el2.style['display'] = 'none';
                el3.style['display'] = 'none';
            } else {
                el1.style['display'] = 'block';
                el2.style['display'] = 'block';
                el3.style['display'] = 'block';
            }
        };
        // @ts-ignore
        gui.onResize = function() {
            if (gui.closed) {
                let el1 = document.getElementById("se01-color");
                let el2 = document.getElementById("se02-color");
                let el3 = document.getElementById("se03-color");      
                el1.style['display'] = 'none';
                el2.style['display'] = 'none';
                el3.style['display'] = 'none';
            }
        };
        let dg = document.getElementsByClassName("dg ac")[0];
        let el = document.createElement("div");
        el["id"] = "se01-color";
        el["style"]["position"] = "absolute";
        el["style"]["width"] = "24px";
        el["style"]["height"] = "12px";
        el["style"]["top"] = "205px";
        el["style"]["right"] = "112px";
        el["style"]["backgroundColor"] = "#194BFF";
        el["style"]["zIndex"] = "100";
        dg.appendChild(el);
      
        el = document.createElement("div");
        el["id"] = "se02-color";
        el["style"]["position"] = "absolute";
        el["style"]["width"] = "24px";
        el["style"]["height"] = "12px";
        el["style"]["top"] = "233px";
        el["style"]["right"] = "112px";
        el["style"]["backgroundColor"] = "#148A09";
        el["style"]["zIndex"] = "100";
        dg.appendChild(el);
      
        el = document.createElement("div");
        el["id"] = "se03-color";
        el["style"]["position"] = "absolute";
        el["style"]["width"] = "24px";
        el["style"]["height"] = "12px";
        el["style"]["top"] = "261px";
        el["style"]["right"] = "112px";
        el["style"]["backgroundColor"] = "#E31E1E";
        el["style"]["zIndex"] = "100";
        dg.appendChild(el);
        dg["style"]["display"] = "block";
        this.gui = gui;
    }    

    toggle() {
      let el = document.getElementById("lodes");
      let dg = document.getElementsByClassName("dg ac")[0];
      // @ts-ignore
      if (el.checked && dg["style"]["display"] != "block") {
        dg["style"]["display"] = "block";
      } 
      // @ts-ignore
      else if (!el.checked && dg["style"]["display"] != "none") {
        dg["style"]["display"] = "none";
      }
    }
}

class LodesAnimationState {
    then: any;
    inMainLoop: boolean;
    inStartDwell: boolean;
    inEndDwell: boolean;
    pulse: boolean;

    constructor() {
        this.then = new Date();
        this.inMainLoop = false;
        this.inStartDwell = true;
        this.inEndDwell = false;
        this.pulse = false;     
    }
}