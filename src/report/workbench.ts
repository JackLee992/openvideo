import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildAnalysisPlaybook, normalizeVideoCategory, type AnalysisPlaybook } from '../analysis/playbook.js';

export interface AnalysisWorkbenchInput {
  runDir: string;
  outDir?: string;
}

export interface AnalysisWorkbenchResult {
  reportDir: string;
  indexPath: string;
}

interface WorkbenchData {
  metadata: Record<string, unknown>;
  storyboard: Record<string, unknown>;
  transitions: Record<string, unknown>;
  motion: Record<string, unknown>;
  playbook: AnalysisPlaybook;
  captions: Record<string, unknown>;
  transcript: Record<string, unknown>;
  videoStyle: string;
  hyperframesBrief: string;
  frames: string[];
}

export async function createAnalysisWorkbench(input: AnalysisWorkbenchInput): Promise<AnalysisWorkbenchResult> {
  const runDir = path.resolve(input.runDir);
  const reportDir = path.resolve(input.outDir ?? path.join(runDir, 'report'));
  const indexPath = path.join(reportDir, 'index.html');
  const data = await readWorkbenchData(runDir);
  await mkdir(reportDir, { recursive: true });
  await writeFile(indexPath, renderWorkbenchHtml(runDir, reportDir, data), 'utf8');
  return { reportDir, indexPath };
}

async function readWorkbenchData(runDir: string): Promise<WorkbenchData> {
  const analysisDir = path.join(runDir, 'analysis');
  const metadata = await readRequiredJson(path.join(analysisDir, 'metadata.json'), 'metadata.json');
  const playbook =
    (await readOptionalJson<AnalysisPlaybook>(path.join(analysisDir, 'playbook.json'))) ??
    buildAnalysisPlaybook(normalizeVideoCategory(metadata.category), {
      runId: stringValue(metadata.runId, path.basename(runDir)),
    });
  return {
    metadata,
    storyboard: (await readOptionalJson(path.join(analysisDir, 'storyboard.json'))) ?? {},
    transitions: (await readOptionalJson(path.join(analysisDir, 'transition-analysis.json'))) ?? {},
    motion: (await readOptionalJson(path.join(analysisDir, 'motion-analysis.json'))) ?? {},
    playbook,
    captions: (await readOptionalJson(path.join(analysisDir, 'captions.json'))) ?? {},
    transcript: (await readOptionalJson(path.join(analysisDir, 'transcript.json'))) ?? {},
    videoStyle: await readOptionalText(path.join(runDir, 'VIDEO_STYLE.md')),
    hyperframesBrief: await readOptionalText(path.join(runDir, 'hyperframes-brief.md')),
    frames: Array.isArray(metadata.frameSample) ? metadata.frameSample.filter((item): item is string => typeof item === 'string') : [],
  };
}

async function readRequiredJson(filePath: string, label: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    throw new Error(`Missing analyzed run file: ${label}`);
  }
}

async function readOptionalJson<T = Record<string, unknown>>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readOptionalText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function renderWorkbenchHtml(runDir: string, reportDir: string, data: WorkbenchData): string {
  const metadata = data.metadata;
  const video = asRecord(metadata.video);
  const runId = stringValue(metadata.runId, path.basename(runDir));
  const category = stringValue(metadata.category, 'unknown');
  const durationSec = numberValue(video.durationSec, 0);
  const aspectRatio = stringValue(video.aspectRatio, 'unknown');
  const storyboardBeats = arrayValue(data.storyboard.beats);
  const transitions = arrayValue(data.transitions.transitions);
  const captions = arrayValue(data.captions.observations);
  const transcriptWords = arrayValue(data.transcript.words);
  const frameLinks = data.frames.map((frame) => pathRelative(reportDir, path.join(runDir, 'frames', frame)));

  return `<!doctype html>
<html lang="en" data-run-id="${escapeAttr(runId)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenVideo Workbench - ${escapeText(runId)}</title>
  <style>${workbenchCss()}</style>
</head>
<body>
  <aside class="rail">
    <div class="brand"><span class="mark"></span><strong>OpenVideo</strong></div>
    <section>
      <h2>Run Metadata</h2>
      ${metaRow('Run ID', runId)}
      ${metaRow('Category', category)}
      ${metaRow('Duration', `${durationSec.toFixed(2)}s`)}
      ${metaRow('Format', aspectRatio)}
      ${metaRow('Audio', stringValue(video.hasAudio, false) === 'true' ? 'yes' : 'no')}
    </section>
    <nav>
      <a href="#overview">Overview</a>
      <a href="#storyboard">Storyboard</a>
      <a href="#playbook">Playbook</a>
      <a href="#transitions">Transitions</a>
      <a href="#motion">Motion</a>
      <a href="#ocr">OCR</a>
      <a href="#asr">ASR</a>
      <a href="#hyperframes">HyperFrames</a>
    </nav>
  </aside>
  <main>
    <header class="topbar">
      <div>
        <h1>Run: ${escapeText(runId)}</h1>
        <p>${escapeText(category)} · ${escapeText(aspectRatio)} · ${durationSec.toFixed(2)}s</p>
      </div>
      <span class="status">Analysis workbench</span>
    </header>
    <section id="overview" class="panel hero-panel">
      <div id="storyboard">
        <h2>Storyboard Timeline</h2>
        <div class="timeline">${renderTimeline(storyboardBeats)}</div>
      </div>
      <div class="summary-grid">
        ${metricCard('Scenes', String(storyboardBeats.length))}
        ${metricCard('Cuts', String(transitions.length))}
        ${metricCard('OCR Items', String(captions.length))}
        ${metricCard('ASR Words', String(transcriptWords.length))}
      </div>
    </section>
    <section id="playbook" class="panel">
      <h2>Category Playbook</h2>
      ${renderPlaybook(data.playbook)}
    </section>
    <section class="grid">
      <article id="transitions" class="panel">
        <h2>Transition Table</h2>
        ${renderTransitions(transitions)}
      </article>
      <article id="motion" class="panel">
        <h2>Motion / Camera</h2>
        ${renderMotion(data.motion)}
      </article>
    </section>
    <section class="grid">
      <article id="ocr" class="panel">
        <h2>OCR Evidence</h2>
        ${renderCaptions(captions)}
      </article>
      <article id="asr" class="panel">
        <h2>ASR Transcript</h2>
        ${renderTranscript(data.transcript)}
      </article>
    </section>
    <section id="hyperframes" class="panel">
      <h2>HyperFrames Brief</h2>
      <pre>${escapeText(excerpt(data.hyperframesBrief || data.videoStyle, 1400))}</pre>
    </section>
  </main>
  <aside class="frames">
    <h2>Frames</h2>
    ${frameLinks.map((src, index) => `<figure><figcaption>${String(index + 1).padStart(2, '0')}</figcaption><img src="${escapeAttr(src)}" alt="Sample frame ${index + 1}"></figure>`).join('')}
  </aside>
</body>
</html>
`;
}

function workbenchCss(): string {
  return `
:root { color-scheme: light; --bg:#f7faf9; --surface:#ffffff; --line:#dbe5e2; --text:#17211f; --muted:#64736f; --accent:#087d79; --cut:#f3a312; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; grid-template-columns: 260px minmax(0, 1fr) 220px; font-family: Inter, Arial, sans-serif; color: var(--text); background: var(--bg); }
.rail, .frames { background: #fbfdfc; border-right: 1px solid var(--line); padding: 22px 18px; }
.frames { border-right: 0; border-left: 1px solid var(--line); overflow: auto; }
.brand { display: flex; gap: 10px; align-items: center; font-size: 20px; margin-bottom: 32px; }
.mark { width: 18px; height: 22px; border: 4px solid var(--accent); border-left-color: transparent; transform: skew(-6deg); display: inline-block; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 22px; line-height: 1.2; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 14px; }
p, td, th, .meta { font-size: 13px; }
main { padding: 22px; overflow: auto; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
.topbar p { color: var(--muted); margin-top: 6px; }
.status { border: 1px solid #b8ded6; background: #e9f7f3; color: #06645f; border-radius: 6px; padding: 7px 10px; font-size: 12px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin-bottom: 14px; box-shadow: 0 6px 20px rgba(30,55,50,.05); }
.hero-panel { display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 18px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-content: start; }
.metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 78px; }
.metric span { color: var(--muted); font-size: 12px; }
.metric strong { display: block; margin-top: 8px; font-size: 24px; }
.meta-row { display: grid; grid-template-columns: 86px 1fr; gap: 10px; padding: 7px 0; border-bottom: 1px solid #edf2f0; }
.meta-row span:first-child { color: var(--muted); }
nav { display: grid; gap: 4px; margin-top: 28px; }
nav a { color: var(--text); text-decoration: none; padding: 10px 9px; border-radius: 6px; font-size: 13px; }
nav a:first-child, nav a:hover { background: #e8f4f2; color: var(--accent); }
.timeline { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.beat { border: 1px solid var(--line); border-top: 3px solid var(--accent); border-radius: 8px; padding: 10px; min-height: 112px; }
.beat strong { display: block; margin-bottom: 6px; }
.beat small { color: var(--muted); display: block; margin-bottom: 8px; }
.focus-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-top: 10px; }
.focus { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fbfdfc; }
.focus strong { display: block; margin-bottom: 8px; }
.focus ul { margin: 0; padding-left: 18px; color: var(--muted); font-size: 12px; line-height: 1.45; }
table { width: 100%; border-collapse: collapse; }
th { color: var(--muted); text-align: left; font-weight: 600; }
th, td { padding: 8px 6px; border-bottom: 1px solid #edf2f0; vertical-align: top; }
.tag { color: #8a5a00; background: #fff4d8; border-radius: 5px; padding: 3px 6px; display: inline-block; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f8fbfa; border: 1px solid var(--line); border-radius: 8px; padding: 14px; font-size: 12px; line-height: 1.55; }
figure { margin: 0 0 14px; }
figcaption { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
img { width: 100%; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); background: #101514; }
@media (max-width: 1100px) { body { grid-template-columns: 220px minmax(0, 1fr); } .frames { display: none; } .hero-panel, .grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { body { display: block; } .rail { border-right: 0; border-bottom: 1px solid var(--line); } main { padding: 14px; } }
`;
}

function renderPlaybook(playbook: AnalysisPlaybook): string {
  const focusAreas =
    playbook.focusAreas.length > 0
      ? playbook.focusAreas
          .map(
            (area) =>
              `<article class="focus"><strong>${escapeText(area.label)}</strong><ul>${area.questions
                .slice(0, 2)
                .map((question) => `<li>${escapeText(question)}</li>`)
                .join('')}</ul></article>`,
          )
          .join('')
      : '<p class="meta">No category playbook available.</p>';
  return `<div class="summary-grid">
    ${metricCard('Archetype', playbook.archetype)}
    ${metricCard('Category', playbook.category)}
  </div>
  <div class="focus-grid">${focusAreas}</div>`;
}

function renderTimeline(beats: unknown[]): string {
  if (beats.length === 0) return '<p class="meta">No storyboard beats found.</p>';
  return beats
    .map((beat) => {
      const item = asRecord(beat);
      const evidence = asRecord(item.evidence);
      return `<div class="beat"><strong>Scene ${escapeText(stringValue(item.sceneIndex, '?'))}: ${escapeText(stringValue(item.role, 'unknown'))}</strong><small>${escapeText(stringValue(item.startSec, '0'))}s - ${escapeText(stringValue(item.endSec, '0'))}s · ${escapeText(stringValue(item.pacing, 'held'))}</small><p>${escapeText(stringValue(evidence.transcript, ''))}</p></div>`;
    })
    .join('');
}

function renderTransitions(transitions: unknown[]): string {
  if (transitions.length === 0) return '<p class="meta">No transitions detected.</p>';
  return table(
    ['Time', 'From → To', 'Type', 'Evidence'],
    transitions.map((transition) => {
      const item = asRecord(transition);
      return [
        `${escapeText(stringValue(item.timestampSec, '0'))}s`,
        `${escapeText(stringValue(item.fromSceneIndex, '?'))} → ${escapeText(stringValue(item.toSceneIndex, '?'))}`,
        `<span class="tag">${escapeText(stringValue(item.type, 'cut'))}</span>`,
        escapeText(stringValue(item.nearbyTranscript, stringValue(item.nearbyCaption, ''))),
      ];
    }),
  );
}

function renderMotion(motion: Record<string, unknown>): string {
  return `<div class="summary-grid">
    ${metricCard('Camera', stringValue(motion.cameraMovement, 'unknown'))}
    ${metricCard('Intensity', stringValue(motion.motionIntensity, 'low'))}
    ${metricCard('Direction', stringValue(motion.dominantDirection, 'none'))}
    ${metricCard('Frames', stringValue(motion.frameCount, '0'))}
  </div>`;
}

function renderCaptions(captions: unknown[]): string {
  if (captions.length === 0) return '<p class="meta">No OCR observations available.</p>';
  return table(
    ['Frame', 'Text', 'Confidence'],
    captions.slice(0, 12).map((caption) => {
      const item = asRecord(caption);
      return [
        escapeText(stringValue(item.frameName, '')),
        escapeText(stringValue(item.text, '')),
        escapeText(stringValue(item.confidence, '')),
      ];
    }),
  );
}

function renderTranscript(transcript: Record<string, unknown>): string {
  const text = stringValue(transcript.text, arrayValue(transcript.words).map((word) => stringValue(asRecord(word).text, '')).join(' '));
  return `<pre>${escapeText(excerpt(text || 'No transcript available.', 1200))}</pre>`;
}

function table(headers: string[], rows: string[][]): string {
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeText(header)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function metricCard(label: string, value: string): string {
  return `<div class="metric"><span>${escapeText(label)}</span><strong>${escapeText(value)}</strong></div>`;
}

function metaRow(label: string, value: string): string {
  return `<div class="meta-row"><span>${escapeText(label)}</span><span>${escapeText(value)}</span></div>`;
}

function pathRelative(fromDir: string, toPath: string): string {
  return path.relative(fromDir, toPath).split(path.sep).join('/');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback: string | boolean): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(fallback);
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function excerpt(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
