export class Roller {
  constructor(constants = {}) {
    this.constants = {
      g: 160,
      mu: 0.997,
      ...constants,
    };
    this.reset();
  }

  configure({ L, R }) {
    this.L = L;
    this.R = R;
  }

  reset() {
    this.x = 0;
    this.v = 0;
    this.over = false;
    this.t0 = performance.now();
    this._score = 0;
  }

  step(dt, slopeRad) {
    if (this.over) return;

    const { g, mu } = this.constants;
    const a = -g * Math.sin(slopeRad);
    this.v = (this.v + a * dt) * mu;
    this.x += this.v * dt;

    const margin = this.R * 0.5;
    if (this.x < -this.L / 2 - margin || this.x > this.L / 2 + margin) {
      this.over = true;
      this._score = performance.now() - this.t0;
    }
  }

  scoreMs() {
    return this.over ? this._score : performance.now() - this.t0;
  }
}

