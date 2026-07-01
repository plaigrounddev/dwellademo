import React from "react";

const VERTEX_SHADER = "attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }";

const FLUID_DOTS_SHADER = `precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uEnergy;
uniform float uState;
uniform vec3 uColorA;
uniform vec3 uColorB;
const float TAU = 6.28318530718;
const int N = 6;
const float SMOOTH_K = 0.08;
const float INTENSITY = 0.0028;
const float FALLOFF_P = 1.35;
const float FADE_START = 0.02;
const float FADE_END = 0.56;
const float MERGE_PERIOD = 6.0;
const float STAGGER = 0.33;
const float HOLD = 0.0;
const float W = 4.6;
const float L = 3.2;
const float PIERCE = 0.12;
const float RECOIL = 0.035;
const float REC_LAG = 0.11;
const float GATHER_PERIOD = 12.0;
const float GATHER_START = 9.2;
const float GATHER_HOLD = 0.8;
const float GATHER_R = 0.008;
const float GATHER_DIM = 0.85;
const float GATHER_IN = 1.8;
const float GATHER_IN_L = 7.5;
const float BURST_W = 6.5;
const float BURST_L = 4.0;
const float CHARGE_T = 0.30;
const float CHARGE_SHRK = 0.18;
const float CHARGE_GLOW = 0.35;
const float FLASH_GAIN = 1.2;
const float FLASH_DECAY = 7.0;

float hash11(float n){ return fract(sin(n*127.1 + 311.7)*43758.5453); }
float settleWL(float tau, float w, float l){
  if(tau <= 0.0) return 0.0;
  return 1.0 - exp(-l*tau)*cos(w*tau);
}
float settle(float tau){ return settleWL(tau, W, L); }
float settleCrit(float tau, float l){
  if(tau <= 0.0) return 0.0;
  return 1.0 - exp(-l*tau)*(1.0 + l*tau);
}
float smin(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h*h*k*0.25;
}
float dotR(float fi, float seed, float t){
  return 0.027 + 0.007*sin(t*1.3 + seed*TAU) + 0.0035*sin(t*2.4 + fi*1.3);
}
float dotSD(vec2 p, vec2 pos, float r, float t, float fi, float shapeDamp){
  vec2 d = p - pos;
  float sq = 0.075 * (0.5 + 0.5*sin(t*0.9 + fi*2.0)) * shapeDamp;
  float ca = cos(t*0.35 + fi), sa = sin(t*0.35 + fi);
  d = mat2(ca,-sa,sa,ca) * d;
  d *= vec2(1.0+sq, 1.0-sq);
  return length(d) - r;
}
vec3 scene(vec2 p, float t){
  float k = floor(t/MERGE_PERIOD);
  float te = fract(t/MERGE_PERIOD) * MERGE_PERIOD;
  float tg = mod(t, GATHER_PERIOD);
  float g = settleCrit((tg - GATHER_START) * GATHER_IN, GATHER_IN_L)
    - settleWL(tg - GATHER_START - GATHER_HOLD, BURST_W, BURST_L);
  float gC = clamp(g, 0.0, 1.0);
  float tb = tg - (GATHER_START + GATHER_HOLD);
  float charge = smoothstep(-CHARGE_T, 0.0, min(tb, 0.0)) * gC;
  float flash = tb > 0.0 ? exp(-tb * FLASH_DECAY) : 0.0;
  float gBright = mix(1.0, GATHER_DIM, gC) * (1.0 + CHARGE_GLOW*charge + FLASH_GAIN*flash + uEnergy*0.8 + uState*0.2);
  vec3 total3 = vec3(1e5);
  vec3 cAcc = vec3(0.0);
  float wAcc = 1e-6;
  for(int i=0; i<N; i++){
    float fi = float(i);
    float seed = hash11(fi);
    float ang = fi/float(N)*TAU + t*(0.35 + uState*0.14);
    vec2 dir = vec2(cos(ang), sin(ang));
    float R = 0.17 + 0.010*sin(t*1.0) + 0.007*sin(t*1.3 + seed*TAU) + uEnergy*0.04;
    float pairId = mod(fi, 3.0);
    float moverLow = mod(k + pairId, 2.0);
    float isMover = (fi < 2.5) ? step(moverLow, 0.5) : step(0.5, moverLow);
    float goStart = pairId * STAGGER;
    float retStart = 3.0*STAGGER + HOLD + pairId * STAGGER;
    float m = (settle(te - goStart) - settle(te - retStart)) * isMover;
    float rec = (settle(te - goStart - REC_LAG) - settle(te - retStart - REC_LAG)) * (1.0 - isMover);
    float rSelf = dotR(fi, seed, t);
    rSelf = mix(rSelf, 0.027 + uEnergy*0.009, gC);
    rSelf *= 1.0 - CHARGE_SHRK * charge;
    float fj = mod(fi + 3.0, 6.0);
    float rPart = dotR(fj, hash11(fj), t);
    float deep = -(R + RECOIL) - PIERCE * rPart;
    float radial = mix(R, deep, m) + RECOIL * rec;
    radial = mix(radial, GATHER_R, g);
    vec2 pos = radial * dir;
    float sdR = dotSD(p, pos, rSelf, t, fi, 1.0 - gC);
    float sdG = dotSD(p, pos, rSelf, t, fi, 1.0 - gC);
    float sdB = dotSD(p, pos, rSelf, t, fi, 1.0 - gC);
    total3 = vec3(smin(total3.r, sdR, SMOOTH_K), smin(total3.g, sdG, SMOOTH_K), smin(total3.b, sdB, SMOOTH_K));
    vec3 dotCol = mix(uColorA, uColorB, fi / float(N));
    float w = exp(-sdG * 0.5);
    cAcc += w * dotCol;
    wAcc += w;
  }
  vec3 sd3 = max(total3, vec3(0.0)) + 1e-4;
  vec3 core3 = clamp(INTENSITY / pow(sd3, vec3(FALLOFF_P)), 0.0, 1.0);
  vec3 edge3 = 1.0 - smoothstep(vec3(FADE_START), vec3(FADE_END), sd3);
  return core3 * edge3 * gBright;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 res = iResolution.xy;
  vec2 p = (2.0*fragCoord - res) / min(res.x, res.y);
  float t = iTime;
  p /= 1.0 + 0.03*sin(t*1.0) + uEnergy*0.08;
  vec3 col = scene(p, t);
  col *= 1.0 + 0.05*sin(t*1.0 + 1.0);
  col = pow(min(col, 1.0), vec3(1.0/1.2));
  float brightness = max(max(col.r, col.g), col.b);
  float alpha = smoothstep(0.18, 0.74, brightness);
  fragColor = vec4(uColorA, alpha);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }`;

const defaultColors = ["#000000", "#000000"];

export function SiriWave({
  size = 128,
  renderScale = 1,
  className = "",
  style,
  colors = defaultColors,
  agentState = null,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
  manualInput,
  manualOutput,
  seed,
  volumeMode = "auto",
  ...props
}) {
  const canvasRef = React.useRef(null);
  const livePropsRef = React.useRef({});

  React.useEffect(() => {
    livePropsRef.current = {
      agentState,
      colors,
      getInputVolume,
      getOutputVolume,
      inputVolumeRef,
      manualInput,
      manualOutput,
      outputVolumeRef,
      volumeMode,
    };
  }, [agentState, colors, getInputVolume, getOutputVolume, inputVolumeRef, manualInput, manualOutput, outputVolumeRef, volumeMode]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return undefined;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(log || "shader compile error");
      }
      return shader;
    };

    const program = gl.createProgram();
    const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, FLUID_DOTS_SHADER);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "shader link error");
    }
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "iResolution"),
      time: gl.getUniformLocation(program, "iTime"),
      energy: gl.getUniformLocation(program, "uEnergy"),
      state: gl.getUniformLocation(program, "uState"),
      colorA: gl.getUniformLocation(program, "uColorA"),
      colorB: gl.getUniformLocation(program, "uColorB"),
    };

    const dim = Math.round(size * renderScale);
    canvas.width = dim;
    canvas.height = dim;
    gl.viewport(0, 0, dim, dim);

    const start = performance.now();
    let animationFrame = 0;
    let smoothEnergy = 0;
    let smoothState = 0;

    const frame = () => {
      const current = livePropsRef.current;
      const input = readVolume(current.getInputVolume?.() ?? current.inputVolumeRef?.current ?? current.manualInput);
      const output = readVolume(current.getOutputVolume?.() ?? current.outputVolumeRef?.current ?? current.manualOutput);
      const stateTarget = current.agentState === "talking" ? 1 : current.agentState === "listening" ? 0.7 : current.agentState === "thinking" ? 0.42 : 0.08;
      smoothEnergy += (Math.max(input, output, 0.03) - smoothEnergy) * 0.08;
      smoothState += (stateTarget - smoothState) * 0.06;

      const [colorA, colorB] = current.colors || defaultColors;
      const rgbA = hexToRgb(colorA || defaultColors[0]);
      const rgbB = hexToRgb(colorB || defaultColors[1]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.resolution, dim, dim);
      gl.uniform1f(uniforms.time, (performance.now() - start) / 1000);
      gl.uniform1f(uniforms.energy, smoothEnergy);
      gl.uniform1f(uniforms.state, smoothState);
      gl.uniform3f(uniforms.colorA, rgbA[0], rgbA[1], rgbA[2]);
      gl.uniform3f(uniforms.colorB, rgbB[0], rgbB[1], rgbB[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animationFrame = requestAnimationFrame(frame);
    };

    frame();

    return () => {
      cancelAnimationFrame(animationFrame);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };
  }, [renderScale, size]);

  return (
    <canvas
      ref={canvasRef}
      className={["siri-wave", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
}

export function Orb({ className = "", ...props }) {
  return (
    <div className={["orb", className].filter(Boolean).join(" ")}>
      <SiriWave size={224} renderScale={1} {...props} />
    </div>
  );
}

function readVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function hexToRgb(hex) {
  const value = String(hex).replace("#", "").trim();
  const expanded = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const parsed = Number.parseInt(expanded, 16);
  if (Number.isNaN(parsed)) return [1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
}

export default SiriWave;
