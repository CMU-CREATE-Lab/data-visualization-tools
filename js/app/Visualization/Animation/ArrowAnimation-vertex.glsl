attribute vec4 worldCoord;
attribute vec4 color;
attribute float magnitude;
attribute float heading;
attribute float time;

uniform float startTime;
uniform float endTime;
uniform mat4 mapMatrix;

varying vec4 baseColor;

void main() {
  gl_Position = mapMatrix * worldCoord;
  if (heading >= 0.0) {
    gl_Position = gl_Position + vec4(magnitude * sin(radians(heading)), magnitude * cos(radians(heading)), 0, 0);
  }

  if (time < startTime || time > endTime) {
    baseColor = vec4(0, 0, 0, 0);
    gl_PointSize = 0.0;
  } else {
    gl_PointSize = 1.0;
    baseColor = color;
  }
}
