attribute vec4 worldCoord;
uniform mat4 mapMatrix;

void main() {
  gl_Position = mapMatrix * worldCoord;
  gl_PointSize = 2.0;
}
