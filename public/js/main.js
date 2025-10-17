import { initialiseCamera } from "./camera.js";
import { Roller } from "./game.js";
import { createRenderer } from "./renderer.js";
import { LandmarkTracker } from "./tracker.js";
import { getTuningParams } from "./util.js";
import {
  FilesetResolver,
  FaceLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.js";

const canvas = document.getElementById("view");
const overlayEl = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayBody = document.getElementById("overlay-body");
const overlayAction = document.getElementById("overlay-action");
const statusEl = document.getElementById("status");

const BEST_KEY = "nose-balance-best-ms";

const tuning = getTuningParams();
const config = {
  kL: tuning.kL ?? 1.6,
  kR: tuning.kR ?? 0.11,
  g: tuning.hard ? 220 : 180,
  mu: tuning.hard ? 0.993 : 0.995,
  ballEmoji: tuning.ballEmoji ?? null,
};

const video = document.createElement("video");
video.setAttribute("playsinline", "");
video.setAttribute("autoplay", "");
video.muted = true;

const renderer = createRenderer({ canvas, video });
const roller = new Roller({ g: config.g, mu: config.mu });

const dims = { width: canvas.width, height: canvas.height };

let faceLandmarker = null;
let faceLandmarkerPromise = null;
let tracker = null;
let stream = null;
let animationHandle = null;

let state = null;
let calibrateStart = null;
let countdownStart = null;
let lastFrameTime = performance.now();
let lastScoreMs = 0;
let bestMs = readBest();

overlayAction.addEventListener("click", () => {
  if (state === "INIT" || state === "GAME_OVER") {
    beginGameFlow();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    lastFrameTime = performance.now();
  }
});

window.addEventListener("beforeunload", () => {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
  }
  if (faceLandmarker) {
    faceLandmarker.close?.();
  }
});

setState("INIT");
startLoop();

async function beginGameFlow() {
  if (state !== "INIT" && state !== "GAME_OVER") return;

  setState("LOADING");
  showOverlay({
    title: "Preparing",
    body: "Loading face tracker…",
    actionText: null,
  });

  try {
    await ensureFaceLandmarker();
    updateOverlayBody("Connecting to your camera…");
    await ensureCamera();
    await waitForVideoReady(video);
    syncCanvasDimensions();

    if (!tracker) {
      tracker = new LandmarkTracker(faceLandmarker);
    }

    roller.reset();
    lastScoreMs = 0;
    setState("CALIBRATE");
  } catch (error) {
    console.error(error);
    setState("INIT");
    showOverlay({
      title: "Camera Needed",
      body: formatErrorMessage(error),
      actionText: "Try Again",
    });
  }
}

function startLoop() {
  function frame(now) {
    animationHandle = requestAnimationFrame(frame);
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    let detection = null;
    if (tracker && faceLandmarker && video.readyState >= 2) {
      detection = tracker.update(video, now, state, dims);
    }

    handleStateProgression(now, detection);

    let nosePx = null;
    let faceWidthPx = null;
    let roll = 0;

    if (detection) {
      nosePx = detection.nosePx;
      faceWidthPx = detection.faceWidthPx;
      roll = detection.roll;

      roller.configure({
        L: faceWidthPx * config.kL,
        R: faceWidthPx * config.kR,
      });

      if (state === "LIVE") {
        roller.step(dt, roll);
        lastScoreMs = roller.scoreMs();
      }
    }

    const scoreForHud = state === "LIVE" ? lastScoreMs : state === "GAME_OVER" ? lastScoreMs : 0;

    renderer.draw({
      gameState: state,
      nosePx,
      faceWidthPx,
      roll,
      roller,
      scoreMs: scoreForHud,
      bestMs,
      ballEmoji: config.ballEmoji,
    });

    if (state === "LIVE" && roller.over) {
      concludeRun();
    }
  }

  animationHandle = requestAnimationFrame(frame);
}

function handleStateProgression(now, detection) {
  if (state === "CALIBRATE") {
    if (detection) {
      if (!calibrateStart) calibrateStart = now;
      if (now - calibrateStart >= 1000) {
        calibrateStart = null;
        beginCountdown(now);
      }
      showStatus("Calibrating… hold steady");
    } else {
      calibrateStart = null;
      showStatus("Find your face in frame");
    }
  }

  if (state === "COUNTDOWN") {
    if (!countdownStart) countdownStart = now;
    const elapsed = now - countdownStart;
    const remaining = Math.max(0, 3000 - elapsed);
    const secondsLeft = Math.ceil(remaining / 1000);
    updateOverlayBody(String(secondsLeft || ""));

    if (remaining <= 0) {
      countdownStart = null;
      setState("LIVE");
    }
  }
}

function beginCountdown(now) {
  setState("COUNTDOWN");
  countdownStart = now;
  showOverlay({
    title: "Get Ready",
    body: "3",
    actionText: null,
  });
}

function concludeRun() {
  lastScoreMs = roller.scoreMs();
  if (lastScoreMs > bestMs) {
    bestMs = lastScoreMs;
    localStorage.setItem(BEST_KEY, String(bestMs));
  }

  setState("GAME_OVER");
  showOverlay({
    title: "Game Over",
    body: `You lasted ${(lastScoreMs / 1000).toFixed(1)} seconds`,
    actionText: "Play Again",
  });
}

function setState(next) {
  if (state === next) return;
  state = next;

  switch (state) {
    case "INIT":
      showOverlay({
        title: "Nose Balance",
        body: "Balance the ball by tilting your head.",
        actionText: "Play",
      });
      hideStatus();
      break;
    case "LOADING":
      hideStatus();
      break;
    case "CALIBRATE":
      hideOverlay();
      if (tracker) tracker.rollTracker.resetBaseline();
      calibrateStart = null;
      showStatus("Calibrating… hold steady");
      break;
    case "COUNTDOWN":
      hideStatus();
      break;
    case "LIVE":
      hideOverlay();
      hideStatus();
      roller.reset();
      lastScoreMs = 0;
      break;
    case "GAME_OVER":
      hideStatus();
      break;
    default:
      break;
  }
}

function showOverlay({ title, body, actionText }) {
  if (title !== undefined) overlayTitle.textContent = title;
  if (body !== undefined) overlayBody.textContent = body;

  if (actionText) {
    overlayAction.textContent = actionText;
    overlayAction.disabled = false;
    overlayAction.style.display = "inline-flex";
  } else {
    overlayAction.style.display = "none";
  }

  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function updateOverlayBody(text) {
  overlayBody.textContent = text;
}

function showStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.remove("hidden");
}

function hideStatus() {
  statusEl.classList.add("hidden");
  statusEl.textContent = "";
}

function readBest() {
  const stored = localStorage.getItem(BEST_KEY);
  const value = stored ? Number(stored) : 0;
  return Number.isFinite(value) ? value : 0;
}

async function ensureFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "./models/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    })();
  }

  faceLandmarker = await faceLandmarkerPromise;
  return faceLandmarker;
}

async function ensureCamera() {
  if (stream) return stream;
  stream = await initialiseCamera(video, {
    onError: (error) => {
      console.error(error);
    },
  });
  return stream;
}

function waitForVideoReady(videoEl) {
  if (videoEl.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    videoEl.addEventListener("loadeddata", resolve, { once: true });
  });
}

function syncCanvasDimensions() {
  if (video.videoWidth && video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    dims.width = canvas.width;
    dims.height = canvas.height;
  }
}

function formatErrorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error.name === "NotAllowedError") {
    return "Camera access was denied. Enable it to play.";
  }
  if (error.name === "NotFoundError") {
    return "No camera was found. Connect one and try again.";
  }
  return error.message || "Unexpected error occurred.";
}

