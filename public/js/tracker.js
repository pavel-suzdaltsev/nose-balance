import { EMA, ema } from "./util.js";

const LEFT_EYE_OUT = 33;
const RIGHT_EYE_OUT = 263;
const NOSE_TIP = 1;

export class RollTracker {
  constructor({ alpha = 0.4 } = {}) {
    this.rollRaw = 0;
    this.rollEma = new EMA(0, alpha);
    this.baseline = 0;
    this.hasBaseline = false;
    this.nosePx = { x: 0, y: 0 };
    this.faceWidthPx = 120;
    this.roll = 0;
    this.alpha = alpha;
  }

  resetBaseline() {
    this.baseline = 0;
    this.rollEma.reset();
    this.hasBaseline = false;
  }

  update(landmarks, { phase, dims }) {
    if (!landmarks) return;

    const rawRoll = computeRoll(landmarks);
    this.rollRaw = rawRoll;

    if (phase === "CALIBRATE") {
      this.baseline = ema(this.baseline, rawRoll, this.alpha);
      this.hasBaseline = true;
    }

    const filtered = this.rollEma.update(rawRoll);
    this.roll = filtered - (this.hasBaseline ? this.baseline : filtered);

    this.nosePx = normalisedToPixels(landmarks[NOSE_TIP], dims);
    this.faceWidthPx = estimateFaceWidth(landmarks, dims);
  }

  getRoll() {
    return this.roll;
  }

  getBaseline() {
    return this.baseline;
  }

  getNosePx() {
    return this.nosePx;
  }

  getFaceWidthPx() {
    return this.faceWidthPx;
  }
}

export function computeRoll(landmarks) {
  const L = landmarks[LEFT_EYE_OUT];
  const R = landmarks[RIGHT_EYE_OUT];
  return Math.atan2(R.y - L.y, R.x - L.x);
}

export function normalisedToPixels({ x, y }, { width, height }) {
  return { x: x * width, y: y * height };
}

export function estimateFaceWidth(landmarks, { width, height }) {
  const L = landmarks[LEFT_EYE_OUT];
  const R = landmarks[RIGHT_EYE_OUT];
  const dx = (R.x - L.x) * width;
  const dy = (R.y - L.y) * height;
  return Math.sqrt(dx * dx + dy * dy) || 120;
}

export class LandmarkTracker {
  constructor(faceLandmarker) {
    this.faceLandmarker = faceLandmarker;
    this.rollTracker = new RollTracker();
    this.latest = null;
  }

  update(video, timestamp, phase, dims) {
    const result = this.faceLandmarker.detectForVideo(video, timestamp);
    const landmarks = result?.faceLandmarks?.[0];
    if (!landmarks) {
      this.latest = null;
      return null;
    }

    this.rollTracker.update(landmarks, { phase, dims });
    this.latest = {
      landmarks,
      roll: this.rollTracker.getRoll(),
      nosePx: this.rollTracker.getNosePx(),
      faceWidthPx: this.rollTracker.getFaceWidthPx(),
      baseline: this.rollTracker.getBaseline(),
    };

    return this.latest;
  }
}

