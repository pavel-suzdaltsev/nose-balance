const DEFAULT_CONSTRAINTS = {
  audio: false,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: "user",
  },
};

async function getStream(constraints = DEFAULT_CONSTRAINTS) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Webcam not supported in this browser");
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function initialiseCamera(videoEl, { onError } = {}) {
  try {
    const stream = await getStream();
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}

export function stopStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function getVideoDims(videoEl) {
  return {
    width: videoEl.videoWidth,
    height: videoEl.videoHeight,
  };
}

