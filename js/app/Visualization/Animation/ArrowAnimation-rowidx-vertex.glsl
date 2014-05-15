attribute vec4 point;
attribute vec4 rowidx;
attribute float magnitude;
attribute float heading;
attribute float time;

uniform float startTime;
uniform float endTime;
uniform mat4 mapMatrix;

varying vec4 baseColor;

void main() {
  gl_Position = mapMatrix * point;
  if (heading >= 0.0) {
    gl_Position = gl_Position + vec4(magnitude * sin(radians(heading)), magnitude * cos(radians(heading)), 0, 0);
  }

  if (time < startTime || time > endTime) {
    baseColor = vec4(rowidx[0], rowidx[1], rowidx[2], 0);
    gl_PointSize = 0.0;
  } else {
    gl_PointSize = 1.0;
    baseColor = rowidx;
  }
}
