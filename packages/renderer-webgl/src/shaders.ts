// ============================================================
// Shaders — GLSL vertex and fragment shader source strings
// ============================================================

/**
 * Vertex shader for instanced particle rendering.
 *
 * Each instance is a quad (2 triangles, 6 vertices).
 * Instance attributes provide position, color, and size.
 * The vertex shader expands the quad around the instance position.
 */
export const PARTICLE_VERTEX_SHADER = `
attribute vec2 a_quadVertex;
attribute vec2 a_position;
attribute vec4 a_color;
attribute float a_size;

uniform mat4 u_projection;
uniform float u_particleShape;

varying vec4 v_color;
varying vec2 v_quadCoord;

void main() {
  vec2 worldPos = a_position + a_quadVertex * a_size;
  gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
  v_color = a_color;
  v_quadCoord = a_quadVertex;
}
`;

/**
 * Fragment shader for particle rendering.
 *
 * Uses SDF (signed distance field) to render circles.
 * For squares, simply fills the quad.
 * u_particleShape: 0.0 = circle, 1.0 = square
 */
export const PARTICLE_FRAGMENT_SHADER = `
precision mediump float;

varying vec4 v_color;
varying vec2 v_quadCoord;

uniform float u_particleShape;

void main() {
  if (u_particleShape < 0.5) {
    // Circle: discard fragments outside unit circle
    float dist = length(v_quadCoord);
    if (dist > 1.0) {
      discard;
    }
    // Smooth edge for antialiasing
    float alpha = 1.0 - smoothstep(0.9, 1.0, dist);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  } else {
    // Square: fill the entire quad
    gl_FragColor = v_color;
  }
}
`;

/**
 * Vertex shader for connection line rendering.
 *
 * Simple pass-through with projection transform.
 * Each vertex has position and color.
 */
export const CONNECTION_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_color;

uniform mat4 u_projection;

varying vec4 v_color;

void main() {
  gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
  v_color = a_color;
}
`;

/**
 * Fragment shader for connection line rendering.
 *
 * Simple color pass-through from vertex shader.
 */
export const CONNECTION_FRAGMENT_SHADER = `
precision mediump float;

varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`;
