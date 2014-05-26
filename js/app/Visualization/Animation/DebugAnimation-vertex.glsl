attribute vec4 point;
uniform mat4 mapMatrix;

void main() {
  gl_Position = mapMatrix * point;
  gl_PointSize = 2.0;
}
