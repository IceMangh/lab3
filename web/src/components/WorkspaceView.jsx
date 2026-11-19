import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from './Icon';

export function useWorkspaceView() {
  const [gridEnabled, setGridEnabled] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(374);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function escape(event) {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) setExpanded(false);
    }
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  return {
    gridEnabled, inspectorOpen, expanded, inspectorWidth, setInspectorWidth,
    toggleGrid: () => setGridEnabled(value => !value),
    toggleInspector: () => setInspectorOpen(value => !value),
    toggleExpanded: () => setExpanded(value => !value),
    className: `workspace ${inspectorOpen ? 'has-inspector' : ''} ${expanded ? 'workspace-expanded' : ''}`,
    style: { '--inspector-width': `${inspectorWidth}px` },
  };
}

export function WorkspaceViewActions({ view }) {
  return <div className="workspace-view-actions">
    <IconButton icon="grid" label="Сетка доски" active={view.gridEnabled} onClick={view.toggleGrid} />
    <IconButton icon="panel" label="Панель параметров" active={view.inspectorOpen} onClick={view.toggleInspector} />
    <IconButton icon={view.expanded ? 'collapse' : 'expand'} label={view.expanded ? 'Свернуть доску' : 'Развернуть доску'}
      active={view.expanded} onClick={view.toggleExpanded} />
  </div>;
}

export function PanelResizer({ view }) {
  const drag = useRef(null);
  const { inspectorWidth, setInspectorWidth } = view;
  const min = 260, max = 480;
  const bound = width => Math.max(min, Math.min(max, width));

  return <div className="panel-resizer" role="separator" tabIndex="0" aria-label="Ширина панели параметров"
    aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={inspectorWidth}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag.current = { x: event.clientX, width: inspectorWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (drag.current) setInspectorWidth(bound(drag.current.width + drag.current.x - event.clientX));
    }}
    onPointerUp={event => {
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { drag.current = null; }}
    onKeyDown={event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      setInspectorWidth(value => bound(value + (event.key === 'ArrowLeft' ? 16 : -16)));
    }} />;
}
