export async function captureFirstFrame(src: string): Promise<string | null> {
  if (
    typeof window === "undefined"
    || typeof document === "undefined"
    || !src
    || /jsdom/i.test(window.navigator.userAgent)
  ) {
    return null;
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      resolve(null);
      return;
    }

    let settled = false;

    const settle = (result: string | null) => {
      if (settled) {
        return;
      }

      settled = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => settle(null), 1500);

    const cleanupAndSettle = (result: string | null) => {
      window.clearTimeout(timeoutId);
      video.onloadeddata = null;
      video.onerror = null;
      settle(result);
    };

    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.onloadeddata = () => {
      try {
        const width = video.videoWidth || 320;
        const height = video.videoHeight || 180;
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        cleanupAndSettle(canvas.toDataURL("image/png"));
      } catch {
        cleanupAndSettle(null);
      }
    };

    video.onerror = () => cleanupAndSettle(null);
    video.src = src;
  });
}