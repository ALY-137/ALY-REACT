import { useCallback, useEffect, useRef } from "react";

const DEFAULT_EDGE_SIZE = 42;
const DEFAULT_MIN_SPEED = 3;
const DEFAULT_MAX_SPEED = 18;
const PAGE_SCROLLBAR_REVEAL_CLASS = "is-page-vertical-scrollbar-revealed";
const PAGE_SCROLLBAR_RAIL_CLASS = "page-edge-vertical-scrollbar";
const PAGE_SCROLLBAR_THUMB_CLASS = "page-edge-vertical-scrollbar__thumb";

let pageVerticalScrollbarRail = null;
let pageVerticalScrollbarTarget = null;
let pageVerticalScrollbarCleanup = null;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function getScrollableDocumentElement() {
  if (typeof document === "undefined") return null;
  return document.scrollingElement || document.documentElement;
}

function getMaxScrollLeft(element) {
  if (!element) return 0;
  return Math.max(0, element.scrollWidth - element.clientWidth);
}

function getMaxScrollTop(element) {
  if (!element) return 0;
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function getElementScrollLeft(element) {
  if (!element) return 0;
  return Number(element.scrollLeft || 0);
}

function getElementScrollTop(element) {
  if (!element) return 0;
  return Number(element.scrollTop || 0);
}

function setElementScrollLeft(element, value) {
  if (!element) return;
  element.scrollLeft = value;
}

function setElementScrollTop(element, value) {
  if (!element) return;
  element.scrollTop = value;
}

function ensurePageVerticalScrollbarRail() {
  if (typeof document === "undefined") return null;
  if (pageVerticalScrollbarRail?.isConnected) return pageVerticalScrollbarRail;

  const rail = document.createElement("div");
  rail.className = PAGE_SCROLLBAR_RAIL_CLASS;
  rail.setAttribute("aria-hidden", "true");

  const thumb = document.createElement("div");
  thumb.className = PAGE_SCROLLBAR_THUMB_CLASS;
  rail.appendChild(thumb);

  document.body?.appendChild(rail);
  pageVerticalScrollbarRail = rail;
  return rail;
}

function removePageVerticalScrollbarRail() {
  if (pageVerticalScrollbarCleanup) {
    pageVerticalScrollbarCleanup();
    pageVerticalScrollbarCleanup = null;
  }
  pageVerticalScrollbarTarget = null;
  pageVerticalScrollbarRail?.remove();
  pageVerticalScrollbarRail = null;
}

function getPageVerticalScrollbarMetrics(target) {
  if (!target || typeof window === "undefined") {
    return {
      railTop: 8,
      railHeight: 0,
      thumbTop: 0,
      thumbHeight: 0,
    };
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const isDocumentTarget = target === getScrollableDocumentElement();
  const rect =
    !isDocumentTarget && typeof target.getBoundingClientRect === "function"
      ? target.getBoundingClientRect()
      : { top: 0, bottom: viewportHeight };
  const railTop = Math.max(8, Number(rect.top || 0) + 8);
  const railBottom = Math.min(viewportHeight - 8, Number(rect.bottom || viewportHeight) - 8);
  const railHeight = Math.max(36, railBottom - railTop);
  const scrollHeight = Math.max(1, Number(target.scrollHeight || 0));
  const clientHeight = Math.max(1, Number(target.clientHeight || viewportHeight || 1));
  const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
  const thumbHeight = clamp(clientHeight / scrollHeight, 0.12, 1) * railHeight;
  const thumbTop = clamp(Number(target.scrollTop || 0) / maxScrollTop, 0, 1) * (railHeight - thumbHeight);

  return {
    railTop,
    railHeight,
    thumbTop,
    thumbHeight,
  };
}

function updatePageVerticalScrollbarRail(target) {
  const rail = ensurePageVerticalScrollbarRail();
  if (!rail) return;

  const metrics = getPageVerticalScrollbarMetrics(target || getScrollableDocumentElement());
  rail.style.setProperty("--page-edge-scrollbar-top", `${Math.round(metrics.railTop)}px`);
  rail.style.setProperty("--page-edge-scrollbar-height", `${Math.round(metrics.railHeight)}px`);
  rail.style.setProperty("--page-edge-scrollbar-thumb-top", `${Math.round(metrics.thumbTop)}px`);
  rail.style.setProperty("--page-edge-scrollbar-thumb-height", `${Math.max(24, Math.round(metrics.thumbHeight))}px`);
}

function attachPageVerticalScrollbarListeners(target) {
  if (pageVerticalScrollbarTarget === target) {
    updatePageVerticalScrollbarRail(target);
    return;
  }

  if (pageVerticalScrollbarCleanup) {
    pageVerticalScrollbarCleanup();
    pageVerticalScrollbarCleanup = null;
  }

  pageVerticalScrollbarTarget = target;
  const update = () => updatePageVerticalScrollbarRail(target);
  const scrollSource = target === getScrollableDocumentElement() ? window : target;
  scrollSource?.addEventListener?.("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();

  pageVerticalScrollbarCleanup = () => {
    scrollSource?.removeEventListener?.("scroll", update);
    window.removeEventListener("resize", update);
  };
}

function setPageVerticalScrollbarReveal(active, target = null) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(PAGE_SCROLLBAR_REVEAL_CLASS, active);
  document.body?.classList.toggle(PAGE_SCROLLBAR_REVEAL_CLASS, active);

  if (active) {
    attachPageVerticalScrollbarListeners(target || getScrollableDocumentElement());
  } else {
    removePageVerticalScrollbarRail();
  }
}

function canScrollHorizontally(element) {
  return getMaxScrollLeft(element) > 1;
}

function canScrollVertically(element) {
  return getMaxScrollTop(element) > 1;
}

function isVisibleAtY(element, clientY) {
  if (!element || typeof element.getBoundingClientRect !== "function") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && clientY >= rect.top && clientY <= rect.bottom;
}

function isVisibleAtPoint(element, clientX, clientY) {
  if (!element || typeof element.getBoundingClientRect !== "function") return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function canScrollOnAxis(element, axis = "x") {
  return axis === "y" ? canScrollVertically(element) : canScrollHorizontally(element);
}

function findScrollableAncestor(element, axis = "x") {
  let current = element;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current instanceof HTMLElement && canScrollOnAxis(current, axis)) return current;
    current = current.parentElement;
  }
  return null;
}

function findVisibleScrollableElement(axis, clientX, clientY) {
  if (typeof document === "undefined" || typeof window === "undefined") return null;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const elements = Array.from(document.querySelectorAll("body *"));
  let bestElement = null;
  let bestScore = -Infinity;

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    if (!canScrollOnAxis(element, axis)) continue;
    if (typeof element.getBoundingClientRect !== "function") continue;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth) continue;

    const containsPoint =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    const sameRow = clientY >= rect.top && clientY <= rect.bottom;
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const distanceToRightEdge = Math.abs(viewportWidth - rect.right);
    const score =
      (containsPoint ? 10000 : 0) +
      (sameRow ? 2500 : 0) +
      visibleHeight -
      Math.min(distanceToRightEdge, viewportWidth) * 0.25;

    if (score > bestScore) {
      bestScore = score;
      bestElement = element;
    }
  }

  return bestElement;
}

function findPageScrollTarget(axis, clientX, clientY) {
  if (typeof document === "undefined") return null;

  const elementsFromPoint =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [];

  for (const element of elementsFromPoint) {
    const target = findScrollableAncestor(element, axis);
    if (target) return target;
  }

  if (axis === "x") {
    const markedTargets = Array.from(
      document.querySelectorAll('[data-edge-horizontal-scroll="true"], .edge-horizontal-scroll')
    );
    const markedVisible = markedTargets.find(
      (element) => element instanceof HTMLElement && canScrollHorizontally(element) && isVisibleAtY(element, clientY)
    );
    if (markedVisible) return markedVisible;
  } else {
    const markedTargets = Array.from(
      document.querySelectorAll('[data-edge-vertical-scroll="true"], .edge-vertical-scroll, .page-edge-scroll-target')
    );
    const markedVisible = markedTargets.find(
      (element) => element instanceof HTMLElement && canScrollVertically(element) && isVisibleAtPoint(element, clientX, clientY)
    );
    if (markedVisible) return markedVisible;

    const visibleScrollable = findVisibleScrollableElement(axis, clientX, clientY);
    if (visibleScrollable) return visibleScrollable;
  }

  const pageElement = getScrollableDocumentElement();
  if (canScrollOnAxis(pageElement, axis)) return pageElement;

  return null;
}

export default function useEdgeHorizontalScroll({
  edgeSize = DEFAULT_EDGE_SIZE,
  minSpeed = DEFAULT_MIN_SPEED,
  maxSpeed = DEFAULT_MAX_SPEED,
} = {}) {
  const elementRef = useRef(null);
  const frameRef = useRef(0);
  const directionRef = useRef(0);
  const speedRef = useRef(0);

  const setActiveState = useCallback((active, direction = 0) => {
    const element = elementRef.current;
    if (!element) return;

    element.classList.toggle("is-edge-scroll-active", active);
    if (active && direction < 0) {
      element.dataset.edgeScrollDirection = "left";
    } else if (active && direction > 0) {
      element.dataset.edgeScrollDirection = "right";
    } else {
      delete element.dataset.edgeScrollDirection;
    }
  }, []);

  const stopScroll = useCallback(() => {
    directionRef.current = 0;
    speedRef.current = 0;
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    setActiveState(false);
  }, [setActiveState]);

  const tick = useCallback(() => {
    const element = elementRef.current;
    const direction = directionRef.current;

    if (!element || !direction) {
      frameRef.current = 0;
      setActiveState(false);
      return;
    }

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const reachedLeft = direction < 0 && element.scrollLeft <= 0;
    const reachedRight = direction > 0 && element.scrollLeft >= maxScrollLeft - 1;

    if (reachedLeft || reachedRight || maxScrollLeft <= 0) {
      stopScroll();
      return;
    }

    element.scrollLeft += direction * speedRef.current;
    frameRef.current = window.requestAnimationFrame(tick);
  }, [setActiveState, stopScroll]);

  const startScroll = useCallback(
    (direction, intensity) => {
      const safeIntensity = Math.max(0, Math.min(1, intensity));
      directionRef.current = direction;
      speedRef.current = minSpeed + (maxSpeed - minSpeed) * safeIntensity;
      setActiveState(true, direction);

      if (!frameRef.current) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    },
    [maxSpeed, minSpeed, setActiveState, tick]
  );

  const onMouseMove = useCallback(
    (event) => {
      const element = elementRef.current;
      if (!element) return;

      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      const canScroll = maxScrollLeft > 1;
      element.classList.toggle("is-edge-scrollable", canScroll);

      if (!canScroll) {
        stopScroll();
        return;
      }

      const rect = element.getBoundingClientRect();
      const leftDistance = event.clientX - rect.left;
      const rightDistance = rect.right - event.clientX;
      const leftAvailable = element.scrollLeft > 1;
      const rightAvailable = element.scrollLeft < maxScrollLeft - 1;

      if (leftDistance <= edgeSize && leftAvailable) {
        startScroll(-1, clamp((edgeSize - Math.max(0, leftDistance)) / edgeSize));
        return;
      }

      if (rightDistance <= edgeSize && rightAvailable) {
        startScroll(1, clamp((edgeSize - Math.max(0, rightDistance)) / edgeSize));
        return;
      }

      stopScroll();
    },
    [edgeSize, startScroll, stopScroll]
  );

  useEffect(() => stopScroll, [stopScroll]);

  return {
    ref: elementRef,
    onMouseEnter: onMouseMove,
    onMouseMove,
    onMouseLeave: stopScroll,
    onBlur: stopScroll,
  };
}

export function usePageEdgeHorizontalScroll({
  enabled = true,
  edgeSize = DEFAULT_EDGE_SIZE,
  minSpeed = DEFAULT_MIN_SPEED,
  maxSpeed = DEFAULT_MAX_SPEED,
} = {}) {
  const targetRef = useRef(null);
  const frameRef = useRef(0);
  const axisRef = useRef("x");
  const directionRef = useRef(0);
  const speedRef = useRef(0);

  const clearTargetState = useCallback((target) => {
    if (!target) return;
    target.classList.remove("is-edge-scroll-active", "is-edge-scrollable", "page-edge-scroll-target");
    delete target.dataset.edgeScrollDirection;
    delete target.dataset.edgeScrollAxis;

    if (target === getScrollableDocumentElement()) {
      document.documentElement.classList.remove(
        "is-edge-scroll-active",
        "is-edge-scrollable",
        "page-edge-scroll-target"
      );
      document.body?.classList.remove(
        "is-edge-scroll-active",
        "is-edge-scrollable",
        "page-edge-scroll-target"
      );
      delete document.documentElement.dataset.edgeScrollDirection;
      delete document.documentElement.dataset.edgeScrollAxis;
      if (document.body) delete document.body.dataset.edgeScrollDirection;
      if (document.body) delete document.body.dataset.edgeScrollAxis;
    }
  }, []);

  const setTargetState = useCallback(
    (target, active, axis = "x", direction = 0) => {
      const previousTarget = targetRef.current;
      if (previousTarget && previousTarget !== target) clearTargetState(previousTarget);

      targetRef.current = target;
      if (!target) return;

      target.classList.add("page-edge-scroll-target", "is-edge-scrollable");
      target.classList.toggle("is-edge-scroll-active", active);
      target.dataset.edgeScrollAxis = axis;

      if (target === getScrollableDocumentElement()) {
        document.documentElement.classList.add("page-edge-scroll-target", "is-edge-scrollable");
        document.body?.classList.add("page-edge-scroll-target", "is-edge-scrollable");
        document.documentElement.classList.toggle("is-edge-scroll-active", active);
        document.body?.classList.toggle("is-edge-scroll-active", active);
        document.documentElement.dataset.edgeScrollAxis = axis;
        if (document.body) document.body.dataset.edgeScrollAxis = axis;
      }

      const directionValue =
        axis === "y"
          ? active && direction < 0
            ? "top"
            : active && direction > 0
              ? "bottom"
              : ""
          : active && direction < 0
            ? "left"
            : active && direction > 0
              ? "right"
              : "";
      if (directionValue) {
        target.dataset.edgeScrollDirection = directionValue;
        if (target === getScrollableDocumentElement()) {
          document.documentElement.dataset.edgeScrollDirection = directionValue;
          if (document.body) document.body.dataset.edgeScrollDirection = directionValue;
        }
      } else {
        delete target.dataset.edgeScrollDirection;
        delete target.dataset.edgeScrollAxis;
        if (target === getScrollableDocumentElement()) {
          delete document.documentElement.dataset.edgeScrollDirection;
          delete document.documentElement.dataset.edgeScrollAxis;
          if (document.body) delete document.body.dataset.edgeScrollDirection;
          if (document.body) delete document.body.dataset.edgeScrollAxis;
        }
      }
    },
    [clearTargetState]
  );

  const stopScroll = useCallback(() => {
    axisRef.current = "x";
    directionRef.current = 0;
    speedRef.current = 0;
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    if (targetRef.current) {
      clearTargetState(targetRef.current);
      targetRef.current = null;
    }
  }, [clearTargetState]);

  const stopAll = useCallback(() => {
    setPageVerticalScrollbarReveal(false);
    stopScroll();
  }, [stopScroll]);

  const tick = useCallback(() => {
    const target = targetRef.current;
    const axis = axisRef.current;
    const direction = directionRef.current;

    if (!target || !direction) {
      frameRef.current = 0;
      return;
    }

    const maxScroll = axis === "y" ? getMaxScrollTop(target) : getMaxScrollLeft(target);
    const currentScroll = axis === "y" ? getElementScrollTop(target) : getElementScrollLeft(target);
    const reachedStart = direction < 0 && currentScroll <= 0;
    const reachedEnd = direction > 0 && currentScroll >= maxScroll - 1;

    if (reachedStart || reachedEnd || maxScroll <= 0) {
      stopScroll();
      return;
    }

    if (axis === "y") {
      setElementScrollTop(target, currentScroll + direction * speedRef.current);
    } else {
      setElementScrollLeft(target, currentScroll + direction * speedRef.current);
    }
    frameRef.current = window.requestAnimationFrame(tick);
  }, [stopScroll]);

  const startScroll = useCallback(
    (target, axis, direction, intensity) => {
      axisRef.current = axis;
      directionRef.current = direction;
      speedRef.current = minSpeed + (maxSpeed - minSpeed) * clamp(intensity);
      setTargetState(target, true, axis, direction);

      if (!frameRef.current) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    },
    [maxSpeed, minSpeed, setTargetState, tick]
  );

  const handleMouseMove = useCallback(
    (event) => {
      if (!enabled) {
        stopScroll();
        return;
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const leftDistance = event.clientX;
      const rightDistance = viewportWidth - event.clientX;
      const topDistance = event.clientY;
      const bottomDistance = viewportHeight - event.clientY;
      const nearLeft = leftDistance <= edgeSize;
      const nearRight = rightDistance <= edgeSize;
      const nearTop = topDistance <= edgeSize;
      const nearBottom = bottomDistance <= edgeSize;
      const verticalRevealTarget = nearRight
        ? findPageScrollTarget("y", event.clientX, event.clientY)
        : null;
      const shouldRevealPageVerticalScrollbar = nearRight && Boolean(verticalRevealTarget);

      setPageVerticalScrollbarReveal(shouldRevealPageVerticalScrollbar, verticalRevealTarget);

      if (!nearLeft && !nearRight && !nearTop && !nearBottom) {
        stopScroll();
        return;
      }

      if (shouldRevealPageVerticalScrollbar && !nearLeft && !nearTop && !nearBottom) {
        stopScroll();
        return;
      }

      const eixo = nearTop || nearBottom ? "y" : "x";
      const target = findPageScrollTarget(eixo, event.clientX, event.clientY);
      if (!target) {
        stopScroll();
        return;
      }

      if (eixo === "y") {
        const maxScrollTop = getMaxScrollTop(target);
        const currentScrollTop = getElementScrollTop(target);
        const canGoUp = currentScrollTop > 1;
        const canGoDown = currentScrollTop < maxScrollTop - 1;

        if (nearTop && canGoUp) {
          startScroll(target, "y", -1, (edgeSize - Math.max(0, topDistance)) / edgeSize);
          return;
        }

        if (nearBottom && canGoDown) {
          startScroll(target, "y", 1, (edgeSize - Math.max(0, bottomDistance)) / edgeSize);
          return;
        }

        stopScroll();
        return;
      }

      const maxScrollLeft = getMaxScrollLeft(target);
      const currentScrollLeft = getElementScrollLeft(target);
      const canGoLeft = currentScrollLeft > 1;
      const canGoRight = currentScrollLeft < maxScrollLeft - 1;

      if (nearLeft && canGoLeft) {
        startScroll(target, "x", -1, (edgeSize - Math.max(0, leftDistance)) / edgeSize);
        return;
      }

      if (nearRight && canGoRight) {
        startScroll(target, "x", 1, (edgeSize - Math.max(0, rightDistance)) / edgeSize);
        return;
      }

      stopScroll();
    },
    [edgeSize, enabled, startScroll, stopScroll]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!enabled) {
      setPageVerticalScrollbarReveal(false);
      stopScroll();
      return undefined;
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("blur", stopAll);
    window.addEventListener("mouseleave", stopAll);
    window.addEventListener("resize", stopAll);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("blur", stopAll);
      window.removeEventListener("mouseleave", stopAll);
      window.removeEventListener("resize", stopAll);
      stopAll();
    };
  }, [enabled, handleMouseMove, stopAll, stopScroll]);
}
