// scroll.js -- scroll tracking + video hijack system

export const scrollState = {
  progress: 0,
  rawProgress: 0,
  velocity: 0,
  hijackingVideo: false,
};

let _cleanupFn = null;

export function initScroll() {
  const spacer = document.querySelector('.scroll-spacer');
  if (!spacer) return;

  const VIDEO_LOCK = { start: 0.258, end: 0.402 };
  const LOCK_RANGE = VIDEO_LOCK.end - VIDEO_LOCK.start;
  const LOCK_TRIGGER = 0.006;
  const LOCK_RELEASE_NUDGE = 0.0015;
  const WHEEL_TO_PROGRESS = LOCK_RANGE / 2200;
  let maxScroll = 1;
  let hijackScrollTop = 0;
  let hijackProgress = VIDEO_LOCK.start;
  let hijackRafId = 0;
  let smoothRafId = 0;

  function syncMaxScroll() {
    maxScroll = Math.max(1, spacer.offsetHeight - window.innerHeight);
  }

  function setScrollTop(top) {
    window.scrollTo(0, Math.max(0, Math.min(maxScroll, top)));
  }

  function progressToScrollTop(progress) {
    return Math.max(0, Math.min(maxScroll, progress * maxScroll));
  }

  function releaseHijack(forward) {
    scrollState.hijackingVideo = false;
    const nextProgress = forward
      ? Math.min(1, VIDEO_LOCK.end + LOCK_RELEASE_NUDGE)
      : Math.max(0, VIDEO_LOCK.start - LOCK_RELEASE_NUDGE);
    scrollState.rawProgress = nextProgress;
    scrollState.progress = nextProgress;
    hijackProgress = nextProgress;
    hijackScrollTop = progressToScrollTop(nextProgress);
    setScrollTop(hijackScrollTop);
  }

  function beginHijack(direction) {
    scrollState.hijackingVideo = true;
    hijackScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    hijackProgress = direction === 'forward' ? VIDEO_LOCK.start : VIDEO_LOCK.end;
    scrollState.rawProgress = hijackProgress;
    scrollState.progress = hijackProgress;
    setScrollTop(hijackScrollTop);
  }

  function onScroll() {
    syncMaxScroll();
    if (scrollState.hijackingVideo) {
      setScrollTop(hijackScrollTop);
      scrollState.rawProgress = hijackProgress;
      return;
    }
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    scrollState.rawProgress = Math.max(0, Math.min(1, scrollTop / maxScroll));
  }

  function onWheel(event) {
    syncMaxScroll();
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const actualProgress = Math.max(0, Math.min(1, scrollTop / maxScroll));
    const scrollingForward = event.deltaY > 0;
    const scrollingBackward = event.deltaY < 0;

    if (!scrollState.hijackingVideo) {
      const enteringForward = scrollingForward
        && actualProgress >= VIDEO_LOCK.start - LOCK_TRIGGER
        && actualProgress < VIDEO_LOCK.end;
      const enteringBackward = scrollingBackward
        && actualProgress <= VIDEO_LOCK.end + LOCK_TRIGGER
        && actualProgress > VIDEO_LOCK.start;
      if (!enteringForward && !enteringBackward) return;
      event.preventDefault();
      beginHijack(enteringForward ? 'forward' : 'backward');
      return;
    }

    event.preventDefault();
    const normalizedDelta = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 72);
    hijackProgress = Math.max(
      VIDEO_LOCK.start,
      Math.min(VIDEO_LOCK.end, hijackProgress + normalizedDelta * WHEEL_TO_PROGRESS),
    );
    scrollState.rawProgress = hijackProgress;
    setScrollTop(hijackScrollTop);

    if (hijackProgress >= VIDEO_LOCK.end - 0.0005 && scrollingForward) releaseHijack(true);
    else if (hijackProgress <= VIDEO_LOCK.start + 0.0005 && scrollingBackward) releaseHijack(false);
  }

  // keep scroll locked during hijack
  function maintainHijack() {
    if (scrollState.hijackingVideo) setScrollTop(hijackScrollTop);
    hijackRafId = requestAnimationFrame(maintainHijack);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', syncMaxScroll);
  syncMaxScroll();
  onScroll();
  hijackRafId = requestAnimationFrame(maintainHijack);

  // smooth lerp in separate loop
  let lastProgress = 0;
  function smoothTick() {
    if (scrollState.hijackingVideo) {
      scrollState.progress = scrollState.rawProgress;
    } else {
      scrollState.progress += (scrollState.rawProgress - scrollState.progress) * 0.08;
    }
    scrollState.velocity = scrollState.progress - lastProgress;
    lastProgress = scrollState.progress;
    smoothRafId = requestAnimationFrame(smoothTick);
  }
  smoothRafId = requestAnimationFrame(smoothTick);

  // cleanup (not used yet, but prevents leaks if we ever need it)
  _cleanupFn = () => {
    cancelAnimationFrame(hijackRafId);
    cancelAnimationFrame(smoothRafId);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', syncMaxScroll);
  };
}

export function destroyScroll() {
  if (_cleanupFn) _cleanupFn();
}

// map value from [inMin, inMax] to [outMin, outMax]
export function mapRange(value, inMin, inMax, outMin = 0, outMax = 1, clampIt = true) {
  const t = (value - inMin) / (inMax - inMin);
  const clamped = clampIt ? Math.max(0, Math.min(1, t)) : t;
  return outMin + clamped * (outMax - outMin);
}
