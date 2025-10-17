const DEFAULT_ALPHA = 0.4;

export function ema(previous, value, alpha = DEFAULT_ALPHA) {
  if (Number.isNaN(previous) || previous === null || previous === undefined) {
    return value;
  }
  return alpha * value + (1 - alpha) * previous;
}

export class EMA {
  constructor(value = 0, alpha = DEFAULT_ALPHA) {
    this.value = value;
    this.alpha = alpha;
    this.initialised = false;
  }

  update(sample) {
    if (!this.initialised) {
      this.value = sample;
      this.initialised = true;
    } else {
      this.value = ema(this.value, sample, this.alpha);
    }
    return this.value;
  }

  reset(value = 0) {
    this.value = value;
    this.initialised = false;
  }
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatSeconds(ms, decimals = 1) {
  const seconds = ms / 1000;
  return seconds.toFixed(decimals);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function getTuningParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  const result = {};

  if (params.has("L")) {
    const parsed = parseFloat(params.get("L"));
    if (!Number.isNaN(parsed)) result.kL = parsed;
  }

  if (params.has("R")) {
    const parsed = parseFloat(params.get("R"));
    if (!Number.isNaN(parsed)) result.kR = parsed;
  }

  if (params.has("hard")) {
    result.hard = params.get("hard") !== "0";
  }

  if (params.has("ball")) {
    const value = params.get("ball");
    if (value && value.length > 0) {
      result.ballEmoji = value;
    }
  }

  return result;
}

export function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

