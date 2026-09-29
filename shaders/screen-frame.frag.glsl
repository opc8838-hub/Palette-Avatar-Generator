/**
 * [INPUT]: 依赖锁屏合成纹理；数值来自 Apple FramePass（QMo/ajkYoIsS74YAN6Q/）。
 * [OUTPUT]: GPU 合成人像与背景色，再输出 0.9 framing、圆角和外围供后续 BlurPass 采样。
 * [POS]: shaders 的 framing 阶段；必须位于 UI 合成之后、模糊之前。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
precision highp float;
uniform sampler2D map;
uniform vec3 backgroundColor;
uniform bool tintMode;
uniform float tintStrength;
uniform bool compareMode;
in vec2 vUv;
out vec4 fragColor;

vec3 linearToSrgb(vec3 value) {
  vec3 low = value * 12.92;
  vec3 high = 1.055 * pow(max(value, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(high, low, lessThanEqual(value, vec3(0.0031308)));
}

vec3 srgbToLinear(vec3 value) {
  vec3 low = value / 12.92;
  vec3 high = pow(max((value + 0.055) / 1.055, vec3(0.0)), vec3(2.4));
  return mix(high, low, lessThanEqual(value, vec3(0.04045)));
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  vec2 uv = (vUv - 0.5) / 0.9 + 0.5;
  vec2 imgSize = vec2(textureSize(map, 0));
  vec2 aspect = vec2(imgSize.x / imgSize.y, 1.0);
  float maxBounds = min(imgSize.x, imgSize.y);
  float corners = 110.0 / maxBounds;
  if (imgSize.x < imgSize.y && uv.x < 0.5) corners = 0.0;
  vec2 center = vec2(0.5) * aspect;
  float area = sdRoundedBox(uv * aspect - center, center, corners);
  vec4 portraitSample = texture(map, uv);
  vec3 portrait = portraitSample.rgb;
  if (tintMode && (!compareMode || vUv.x < 0.5)) {
    vec3 sourceSrgb = linearToSrgb(portrait);
    vec3 backgroundSrgb = linearToSrgb(backgroundColor);
    float luminance = dot(sourceSrgb, vec3(0.2126, 0.7152, 0.0722));
    float backgroundLuminance = dot(backgroundSrgb, vec3(0.2126, 0.7152, 0.0722));
    float weight = pow(max(sin(3.14159265 * luminance), 0.0), 0.65) * tintStrength;
    portrait = srgbToLinear(clamp(vec3(luminance) + (backgroundSrgb - backgroundLuminance) * weight, 0.0, 1.0));
  }
  vec3 screenColor = mix(backgroundColor, portrait, portraitSample.a);
  vec3 color = screenColor * smoothstep(0.0, 2.0 / maxBounds, -area);
  // SOURCE: MeshBasicMaterial 的 opaque FramePass 输出 alpha=1，不继承壁纸 UI matte。
  fragColor = vec4(color, 1.0);
}
