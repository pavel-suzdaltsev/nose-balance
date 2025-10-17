import { clamp } from "./util.js";

export function createRenderer({ canvas, video }) {
  const ctx = canvas.getContext("2d");

  return {
    draw({
      gameState,
      nosePx,
      faceWidthPx,
      roll,
      roller,
      scoreMs,
      bestMs,
      ballEmoji,
    }) {
      const width = canvas.width;
      const height = canvas.height;

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      ctx.translate(width, 0);
      ctx.scale(-1, 1);

      if (video.readyState >= 2) {
        const aspectCanvas = width / height;
        const aspectVideo = video.videoWidth / video.videoHeight;
        if (aspectVideo > aspectCanvas) {
          const drawWidth = height * aspectVideo;
          const dx = (drawWidth - width) / 2;
          ctx.drawImage(video, -dx, 0, drawWidth, height);
        } else {
          const drawHeight = width / aspectVideo;
          const dy = (drawHeight - height) / 2;
          ctx.drawImage(video, 0, -dy, width, drawHeight);
        }
      } else {
        drawFallbackBackground(ctx, { width, height });
      }

      if (nosePx && faceWidthPx) {
        drawPlayfield(ctx, {
          nosePx,
          faceWidthPx,
          roll,
          roller,
          ballEmoji,
        });
      }

      ctx.restore();

      drawHUD(canvas, {
        scoreMs,
        bestMs,
        state: gameState,
      });
    },
  };
}

function drawFallbackBackground(ctx, dims) {
  const gradient = ctx.createLinearGradient(0, 0, dims.width, dims.height);
  gradient.addColorStop(0, "#1b1f2b");
  gradient.addColorStop(1, "#090b12");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, dims.width, dims.height);
}

function drawPlayfield(ctx, { nosePx, faceWidthPx, roll, roller, ballEmoji }) {
  const L = roller.L ?? 1.6 * faceWidthPx;
  const R = roller.R ?? 0.11 * faceWidthPx;

  ctx.save();
  ctx.translate(nosePx.x, nosePx.y);
  ctx.rotate(-roll);

  drawStick(ctx, { L, R });
  drawBall(ctx, {
    x: roller.x,
    y: -R,
    R,
    emoji: ballEmoji,
  });

  ctx.restore();
}

function drawStick(ctx, { L, R }) {
  const thickness = clamp(R * 0.6, 6, 28);
  const radius = thickness / 2;
  const halfLength = L / 2;

  ctx.beginPath();
  roundRect(ctx, -halfLength, -radius, L, thickness, radius);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawBall(ctx, { x, y, R, emoji }) {
  ctx.save();
  ctx.translate(x, y);

  const outer = ctx.createRadialGradient(0, -R * 0.4, R * 0.3, 0, 0, R);
  outer.addColorStop(0, "rgba(255,255,255,0.95)");
  outer.addColorStop(0.3, "rgba(220,220,220,0.9)");
  outer.addColorStop(1, "rgba(40,40,40,0.95)");

  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = outer;
  ctx.fill();

  if (emoji) {
    ctx.scale(1, -1);
    ctx.font = `${R * 1.4}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 0, 0);
  }

  ctx.restore();
}

function drawHUD(canvas, { scoreMs, bestMs }) {
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  if (scoreEl && Number.isFinite(scoreMs)) {
    scoreEl.textContent = (scoreMs / 1000).toFixed(1);
  }
  if (bestEl && Number.isFinite(bestMs)) {
    bestEl.textContent = (bestMs / 1000).toFixed(1);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

