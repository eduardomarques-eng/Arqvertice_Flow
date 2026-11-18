import * as THREE from "three";

export type SkyPresetId = "morning" | "noon" | "golden" | "blue" | "overcast";

export interface SkyPresetMeta {
  id: SkyPresetId;
  label: string;
  shortLabel: string;
  timeLabel: string;
  defaultAzimuth: number;
  defaultElevation: number;
  topColor: string;
  horizonColor: string;
  sunColor: string;
  sunIntensity: number;
  ambientIntensity: number;
  cloudDensity: number;
  envIntensity: number;
}

export const SKY_PRESETS: SkyPresetMeta[] = [
  {
    id: "morning",
    label: "Manhã Costeira (08:30)",
    shortLabel: "Manhã",
    timeLabel: "08:30",
    defaultAzimuth: 72,
    defaultElevation: 28,
    topColor: "#3B82F6",
    horizonColor: "#FDE68A",
    sunColor: "#FFF3D1",
    sunIntensity: 2.3,
    ambientIntensity: 0.75,
    cloudDensity: 0.28,
    envIntensity: 1.0,
  },
  {
    id: "noon",
    label: "Meio-Dia Solar (12:00)",
    shortLabel: "Meio-Dia",
    timeLabel: "12:00",
    defaultAzimuth: 145,
    defaultElevation: 68,
    topColor: "#1D4ED8",
    horizonColor: "#BAE6FD",
    sunColor: "#FFFFFF",
    sunIntensity: 2.7,
    ambientIntensity: 0.85,
    cloudDensity: 0.2,
    envIntensity: 1.15,
  },
  {
    id: "golden",
    label: "Golden Hour / Fim de Tarde (17:15)",
    shortLabel: "Golden",
    timeLabel: "17:15",
    defaultAzimuth: 258,
    defaultElevation: 11,
    topColor: "#1E3A8A",
    horizonColor: "#FB923C",
    sunColor: "#FDBA74",
    sunIntensity: 2.4,
    ambientIntensity: 0.6,
    cloudDensity: 0.35,
    envIntensity: 0.95,
  },
  {
    id: "blue",
    label: "Hora Azul / Crepúsculo (18:15)",
    shortLabel: "Hora Azul",
    timeLabel: "18:15",
    defaultAzimuth: 285,
    defaultElevation: 3,
    topColor: "#0F172A",
    horizonColor: "#3B82F6",
    sunColor: "#93C5FD",
    sunIntensity: 1.0,
    ambientIntensity: 0.7,
    cloudDensity: 0.25,
    envIntensity: 0.75,
  },
  {
    id: "overcast",
    label: "Céu Nublado Difuso (Estúdio Natural)",
    shortLabel: "Nublado",
    timeLabel: "Difuso",
    defaultAzimuth: 120,
    defaultElevation: 55,
    topColor: "#94A3B8",
    horizonColor: "#E2E8F0",
    sunColor: "#F8FAFC",
    sunIntensity: 1.25,
    ambientIntensity: 1.05,
    cloudDensity: 0.75,
    envIntensity: 1.0,
  },
];

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldDirection;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldDirection = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uCloudDensity;
varying vec3 vWorldDirection;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldDirection);
  float h = clamp(dir.y, 0.0, 1.0);

  // Rayleigh gradient from horizon to zenith
  vec3 sky = mix(uHorizonColor, uTopColor, pow(h, 0.55));

  // Mie scattering + solar disc
  float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
  float mieGlow = pow(sunDot, 8.0) * 0.45 + pow(sunDot, 64.0) * 0.55;
  float sunDisc = smoothstep(0.9992, 0.9997, sunDot) * 2.2;
  sky += uSunColor * (mieGlow + sunDisc);

  // Soft procedural clouds above horizon
  if (dir.y > 0.02 && uCloudDensity > 0.01) {
    vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.4;
    float c = fbm(cloudUv);
    float mask = smoothstep(1.0 - uCloudDensity, 1.0, c) * smoothstep(0.02, 0.25, dir.y);
    vec3 cloudColor = mix(vec3(0.96, 0.97, 0.99), uSunColor, 0.2);
    sky = mix(sky, cloudColor, mask * 0.55);
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;

export function computeSunVector(
  azimuthDeg: number,
  elevationDeg: number,
  distance = 40
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  const vec = new THREE.Vector3();
  vec.setFromSphericalCoords(distance, phi, theta);
  return vec;
}

export function createAtmosphericSkyDome() {
  const geo = new THREE.SphereGeometry(180, 48, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color("#3B82F6") },
      uHorizonColor: { value: new THREE.Color("#FDE68A") },
      uSunDirection: { value: new THREE.Vector3(10, 15, 10).normalize() },
      uSunColor: { value: new THREE.Color("#FFF3D1") },
      uCloudDensity: { value: 0.28 },
    },
  });
  return new THREE.Mesh(geo, mat);
}

export function applySkyEnvironment(params: {
  skyMesh: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  pmremGenerator: THREE.PMREMGenerator;
  scene: THREE.Scene;
  preset: SkyPresetMeta;
  azimuthDeg: number;
  elevationDeg: number;
}) {
  const {
    skyMesh,
    sunLight,
    hemiLight,
    pmremGenerator,
    scene,
    preset,
    azimuthDeg,
    elevationDeg,
  } = params;

  const sunPos = computeSunVector(azimuthDeg, elevationDeg, 40);
  const sunDir = sunPos.clone().normalize();

  const mat = skyMesh.material as THREE.ShaderMaterial;
  mat.uniforms.uTopColor.value.set(preset.topColor);
  mat.uniforms.uHorizonColor.value.set(preset.horizonColor);
  mat.uniforms.uSunDirection.value.copy(sunDir);
  mat.uniforms.uSunColor.value.set(preset.sunColor);
  mat.uniforms.uCloudDensity.value = preset.cloudDensity;

  sunLight.position.copy(sunPos);
  sunLight.color.set(preset.sunColor);
  sunLight.intensity = preset.sunIntensity;

  hemiLight.color.set(preset.topColor).lerp(new THREE.Color("#FFFFFF"), 0.55);
  hemiLight.groundColor.set(preset.horizonColor).multiplyScalar(0.5);
  hemiLight.intensity = preset.ambientIntensity;

  scene.fog = new THREE.FogExp2(preset.horizonColor, 0.0085);

  // Update dynamic PMREM environment map for realistic PBR reflections on glass & metals
  const envScene = new THREE.Scene();
  const envDome = createAtmosphericSkyDome();
  const envMat = envDome.material as THREE.ShaderMaterial;
  envMat.uniforms.uTopColor.value.copy(mat.uniforms.uTopColor.value);
  envMat.uniforms.uHorizonColor.value.copy(mat.uniforms.uHorizonColor.value);
  envMat.uniforms.uSunDirection.value.copy(sunDir);
  envMat.uniforms.uSunColor.value.copy(mat.uniforms.uSunColor.value);
  envMat.uniforms.uCloudDensity.value = preset.cloudDensity;
  envScene.add(envDome);

  const prevEnv = scene.environment;
  const rt = pmremGenerator.fromScene(envScene, 0.04);
  scene.environment = rt.texture;
  if (prevEnv && prevEnv !== rt.texture) {
    prevEnv.dispose();
  }
  envDome.geometry.dispose();
  envMat.dispose();
}
