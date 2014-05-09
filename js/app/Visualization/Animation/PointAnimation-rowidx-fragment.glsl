precision mediump float;
varying vec4 baseColor;

void main() {
  if (baseColor[3] < 0.5) {
    gl_FragColor = vec4(0, 0, 0, 0);
  } else {
    gl_FragColor = vec4(baseColor[0], baseColor[1], baseColor[2], 1.0);
  }
}
