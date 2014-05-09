attribute vec4 point;
attribute vec4 rowidx;
attribute float magnitude;
attribute float time;

uniform float startTime;
uniform float endTime;
uniform float pointSize;

uniform mat4 mapMatrix;

varying vec4 baseColor;

void main() {
  gl_Position = mapMatrix * point;

  if (time < startTime || time > endTime) {
    baseColor = vec4(rowidx[0], rowidx[1], rowidx[2], 0);
    gl_PointSize = 0.0;
  } else {
    gl_PointSize = pointSize * magnitude;
    baseColor = rowidx;
  }
}
