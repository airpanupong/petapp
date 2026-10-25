/** True when the browser can create a usable WebGL context (MapLibre needs this). */
export function canCreateWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const opts: WebGLContextAttributes = {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'low-power',
      antialias: false,
    };
    const gl =
      (canvas.getContext('webgl2', opts) as WebGLRenderingContext | null) ||
      (canvas.getContext('webgl', opts) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl', opts) as WebGLRenderingContext | null);
    if (!gl) return false;
    if (typeof gl.isContextLost === 'function' && gl.isContextLost()) return false;

    // Probe: clear one pixel. Sandboxed / disabled GPUs often fail here.
    gl.viewport(0, 0, 8, 8);
    gl.clearColor(0.2, 0.3, 0.4, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const err = gl.getError();
    if (err === gl.CONTEXT_LOST_WEBGL) return false;

    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    if (debug) {
      const renderer = String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? '');
      if (/^disabled$/i.test(renderer.trim())) return false;
    }

    return true;
  } catch {
    return false;
  }
}
