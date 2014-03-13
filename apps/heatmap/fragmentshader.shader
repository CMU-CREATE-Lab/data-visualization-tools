precision mediump float;

uniform int doShade;

varying vec4 baseColor;

void main() {
  if (doShade == 1) {
    float dist = length(gl_PointCoord.xy - vec2(.5, .5));
    dist = 1. - (dist * 2.);
    dist = max(0., dist);
    gl_FragColor = baseColor * dist;
  } else {
    gl_FragColor = baseColor;
  }        
}
