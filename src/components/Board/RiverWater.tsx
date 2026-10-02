import { useEffect, useRef } from "react";

/** The water is soft, so it renders at half resolution and scales up */
const RESOLUTION = 0.5;

const VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Water flowing left to right. Noise is sampled in screen pixels, so every
// stretch of the river shows one continuous current.
const FRAGMENT = `
precision mediump float;
uniform float uTime;
uniform vec2 uSize;
uniform vec2 uOffset;
uniform float uScale;
uniform float uPad;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 local = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uScale;
  vec2 px = local + uOffset;
  vec2 uv = local / (uSize / uScale);
  float t = uTime;

  // Stretched along the flow, warped twice so the surface folds like a current
  vec2 p = px * vec2(0.006, 0.014);
  vec2 q = vec2(
    fbm(p + vec2(-t * 0.18, 0.0)),
    fbm(p + vec2(-t * 0.18 + 5.2, 1.3))
  );
  vec2 r = vec2(
    fbm(p + 1.8 * q + vec2(-t * 0.32 + 1.7, 9.2)),
    fbm(p + 1.8 * q + vec2(-t * 0.32 + 8.3, 2.8))
  );
  float surface = fbm(p * vec2(1.0, 1.6) + 2.2 * r - vec2(t * 0.45, 0.0));

  // Deep down the middle, shallow toward the banks
  float inner = clamp((uv.y - uPad) / (1.0 - 2.0 * uPad), 0.0, 1.0);
  float depth = sin(inner * 3.14159);
  vec3 shallow = vec3(0.30, 0.58, 0.56);
  vec3 mid = vec3(0.10, 0.38, 0.46);
  vec3 deep = vec3(0.03, 0.17, 0.25);
  vec3 col = mix(shallow, mix(mid, deep, depth), smoothstep(0.0, 0.7, depth));
  col = mix(col, col * 1.45 + vec3(0.02, 0.05, 0.05), surface * 0.75);

  // Bright caustic ridges and a soft sheen riding the current
  float ridge = fbm(px * vec2(0.011, 0.03) + 3.0 * r - vec2(t * 0.7, 0.0));
  col += vec3(0.65, 0.92, 1.0) * pow(smoothstep(0.52, 0.82, ridge), 2.5) * 0.5;
  float sheen = noise(vec2(px.x * 0.008 - t * 0.9, px.y * 0.09 + q.x * 2.0));
  col += vec3(0.85, 0.97, 1.0) * pow(sheen, 7.0) * 0.45;

  // A little froth where the water laps the banks
  float edge = min(inner, 1.0 - inner);
  float froth = smoothstep(0.14, 0.0, edge) * smoothstep(0.45, 0.75, fbm(px * 0.05 - vec2(t * 0.8, 0.0)));
  col = mix(col, vec3(0.88, 0.96, 0.95), froth * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/**
 * Animated water drawn on the GPU, cut to the river's outline by a mask.
 * `viewBox` and `outline` describe that outline in the river's own units.
 */
export function RiverWater({
  className,
  style,
  viewBox,
  outline,
  pad,
}: {
  className: string;
  style?: React.CSSProperties;
  viewBox: string;
  outline: string;
  /** Share of the canvas height above and below the river, where the banks sit */
  pad: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false });
    if (!canvas || !gl) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uTime = uniform("uTime");
    const uSize = uniform("uSize");
    const uOffset = uniform("uOffset");
    const uScale = uniform("uScale");
    const uPad = uniform("uPad");

    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * RESOLUTION));
      const h = Math.max(1, Math.round(rect.height * RESOLUTION));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uSize, w, h);
      gl.uniform2f(uOffset, rect.left, rect.top);
      gl.uniform1f(uScale, RESOLUTION);
      gl.uniform1f(uPad, pad);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [pad]);

  const mask = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="none"><path d="${outline}"/></svg>`,
  )}")`;
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        ...style,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
      }}
      aria-hidden
    />
  );
}
