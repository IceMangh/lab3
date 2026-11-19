import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fitCamera, zoomAt } from './camera';

export function useBoardCamera(viewportRef, nodes, resetKey) {
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const [camera, setCamera] = useState({ x: 500, y: 250, zoom: 1 });
  const initialFit = useRef(false);
  const lastReset = useRef(resetKey);
  const latest = useRef({ size, camera, nodes });
  latest.current = { size, camera, nodes };

  useLayoutEffect(() => {
    const element = viewportRef.current;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const next = { width: rect.width, height: rect.height };
      latest.current.size = next;
      setSize(next);
      if (!initialFit.current) {
        initialFit.current = true;
        setCamera(fitCamera(latest.current.nodes, next));
      }
    };
    resize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef]);

  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    setCamera(fitCamera(latest.current.nodes, latest.current.size));
  }, [resetKey]);

  useEffect(() => {
    const element = viewportRef.current;
    const wheel = event => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? latest.current.size.height : 1);
      setCamera(previous => zoomAt(previous, point, latest.current.size, Math.exp(-delta * .0018)));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [viewportRef]);

  const fit = useCallback(() => setCamera(fitCamera(latest.current.nodes, latest.current.size)), []);
  const zoomBy = useCallback(factor => {
    const current = latest.current;
    setCamera(previous => zoomAt(previous, { x: current.size.width / 2, y: current.size.height / 2 }, current.size, factor));
  }, []);

  return { camera, setCamera, size, fit, zoomBy };
}
