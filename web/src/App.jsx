import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { GraphCanvas } from './components/GraphCanvas';
import { Inspector } from './components/Inspector';
import { Playback } from './components/Playback';
import { GraphDialog, HelpDialog } from './components/Dialogs';
import { Icon } from './components/Icon';
import { PanelResizer, WorkspaceViewActions, useWorkspaceView } from './components/WorkspaceView';
import { MODES, circleNodes, downloadFile, exportCSV, generateGraph } from './lib/graph';
import { useLab } from './lib/useLab';
import { useTheme } from './lib/theme';
import { PowerSupply } from './power/PowerSupply';

export default function App() {
  const appearance = useTheme();
  const [page, setPage] = useState(() => window.location.hash);
  useEffect(() => {
    const onNavigate = () => setPage(window.location.hash);
    window.addEventListener('hashchange', onNavigate);
    return () => window.removeEventListener('hashchange', onNavigate);
  }, []);

  return page === '#power'
    ? <PowerSupply {...appearance} />
    : <GraphLab {...appearance} />;
}

function GraphLab({ theme, setTheme }) {
  const lab = useLab();
  const [dialog, setDialog] = useState(null);
  const [tool, setTool] = useState('select');
  const [nextWeight, setNextWeight] = useState(1);
  const [generationCount, setGenerationCount] = useState(() => lab.graph.nodes.length || 8);
  const [viewRevision, setViewRevision] = useState(0);
  const view = useWorkspaceView();
  const { gridEnabled, inspectorOpen } = view;
  const svgRef = useRef(null);

  function createGraph(graph) {
    lab.updateGraph(graph); lab.setSelected(null); lab.setStart(0); lab.setTarget(Math.max(0, graph.nodes.length - 1));
    setGenerationCount(graph.nodes.length); setViewRevision(value => value + 1); setTool('select'); setDialog(null);
  }

  function quickGenerate() {
    const count = Number(generationCount);
    if (generationCount === '' || !Number.isInteger(count) || count < 0 || count > 100) {
      lab.setError('Количество вершин — целое число от 0 до 100.'); return;
    }
    createGraph(generateGraph(count, Math.min(18, 160 / Math.max(1, count)), lab.mode === 'components' ? 'disconnected' : 'random', { directed: lab.graph.directed, weighted: lab.graph.weighted }));
  }

  function exportGraph(format) {
    if (format === 'json') downloadFile('graph-lab.json', JSON.stringify({ version: 1, graph: lab.graph, result: lab.result }, null, 2), 'application/json');
    else if (format === 'csv') downloadFile('graph-lab.csv', exportCSV(lab.graph, lab.result), 'text/csv;charset=utf-8');
    else {
      const original = svgRef.current;
      const clone = original.cloneNode(true);
      const palette = getComputedStyle(document.documentElement);
      const resolveColor = value => value.replace(/var\((--[\w-]+)\)/g, (_, name) => palette.getPropertyValue(name).trim());
      const [, , viewWidth, viewHeight] = original.getAttribute('viewBox').split(' ').map(Number);
      clone.setAttribute('width', '1400');
      clone.setAttribute('height', String(Math.round(1400 * viewHeight / viewWidth)));
      const background = getComputedStyle(document.querySelector('.graph-area')).backgroundColor || palette.getPropertyValue('--board');
      clone.setAttribute('style', `background:${resolveColor(background)};font-family:monospace`);
      clone.querySelector('.svg-grid')?.setAttribute('opacity', gridEnabled ? '1' : '0');
      const sourceElements = original.querySelectorAll('*'), clones = clone.querySelectorAll('*');
      sourceElements.forEach((element, index) => {
        const style = getComputedStyle(element);
        clones[index].style.fontFamily = resolveColor(style.fontFamily);
        for (const property of ['fill', 'stroke']) {
          const value = style[property] || element.getAttribute(property);
          if (value) {
            clones[index].setAttribute(property, resolveColor(value));
            clones[index].style[property] = resolveColor(value);
          }
        }
        clones[index].style.strokeWidth = style.strokeWidth;
        if (element.tagName === 'text') { clones[index].style.fontSize = style.fontSize; clones[index].style.fontWeight = style.fontWeight; }
      });
      downloadFile('graph-lab.svg', new XMLSerializer().serializeToString(clone), 'image/svg+xml');
    }
  }

  return <div className="app-shell">
    <Header onHelp={() => setDialog('help')} onExport={exportGraph} theme={theme} onThemeChange={setTheme} />
    <main id="main">
      <h1 className="sr-only">Лаборатория графов</h1>
      <section className={view.className} aria-label="Лаборатория графов" style={view.style}>
        <div className="workspace-toolbar"><div className="mode-tabs" role="tablist" aria-label="Задача">{MODES.map(mode => <button key={mode.id} role="tab" aria-selected={lab.mode === mode.id}
          aria-controls="task-panel" id={`tab-${mode.id}`} onClick={() => { if (mode.id !== lab.mode) { lab.changeMode(mode.id); setTool('select'); } }}><i />{mode.label}</button>)}</div>
          <div className="workspace-actions"><button className="button new-graph" onClick={() => setDialog('graph')}><Icon name="plus" size={17} />Новый граф</button>
            <WorkspaceViewActions view={view} />
          </div>
        </div>
        <div className="workspace-body" id="task-panel" role="tabpanel" aria-labelledby={`tab-${lab.mode}`}>
          <GraphCanvas lab={lab} svgRef={svgRef} tool={tool} setTool={setTool} nextWeight={nextWeight} viewRevision={viewRevision} gridEnabled={gridEnabled} theme={theme} onArrange={() => {
            lab.updateGraph(previous => ({ ...previous, nodes: circleNodes(previous.nodes.length) }), false); setViewRevision(value => value + 1);
          }} />
          {inspectorOpen && <><PanelResizer view={view} />
          <Inspector lab={lab} onGenerate={quickGenerate} generationCount={generationCount} setGenerationCount={setGenerationCount} nextWeight={nextWeight} setNextWeight={setNextWeight} /></>}
        </div>
        <Playback lab={lab} />
      </section>
    </main>
    {dialog === 'graph' && <GraphDialog graph={lab.graph} initialCount={generationCount} initialPreset={lab.mode === 'components' ? 'disconnected' : 'random'} onClose={() => setDialog(null)} onCreate={createGraph} />}
    {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
  </div>;
}
