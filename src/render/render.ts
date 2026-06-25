import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface RenderPrepareInput {
  runDir: string;
  prompt: string;
  outDir?: string;
}

export interface RenderPrepareResult {
  projectDir: string;
  indexPath: string;
  notesPath: string;
}

interface MetadataDoc {
  runId?: string;
  category?: string;
  video?: {
    aspectRatio?: string;
    durationSec?: number;
  };
}

export async function prepareHyperFramesRender(input: RenderPrepareInput): Promise<RenderPrepareResult> {
  const runDir = path.resolve(input.runDir);
  const generationBriefPath = path.join(runDir, 'generation-brief.md');
  const metadataPath = path.join(runDir, 'analysis', 'metadata.json');
  const generationBrief = await readGenerationBrief(generationBriefPath);
  const metadata = await readOptionalJson<MetadataDoc>(metadataPath);
  const runId = metadata?.runId ?? path.basename(runDir);
  const projectDir = path.resolve(input.outDir ?? 'renders', runId);
  const indexPath = path.join(projectDir, 'index.html');
  const notesPath = path.join(projectDir, 'OPENVIDEO_RENDER.md');

  await mkdir(projectDir, { recursive: true });
  await writeFile(indexPath, renderIndexHtml({ prompt: input.prompt, generationBrief, metadata }));
  await writeFile(notesPath, renderNotes({ runDir, prompt: input.prompt, generationBrief, metadata }));

  return { projectDir, indexPath, notesPath };
}

async function readGenerationBrief(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing generation brief: ${filePath}. Run \`openvideo brief\` first. ${detail}`);
  }
}

async function readOptionalJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function renderIndexHtml(input: { prompt: string; generationBrief: string; metadata: MetadataDoc | null }): string {
  const size = sizeFor(input.metadata?.video?.aspectRatio);
  const duration = suggestedDuration(input.metadata?.video?.durationSec);
  const category = input.metadata?.category ?? 'auto';
  const headline = compactText(input.prompt, 34);
  const supporting = compactText(extractGoal(input.generationBrief) ?? 'Original short video generated from OpenVideo style analysis.', 70);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${size.width}, height=${size.height}" />
    <title>OpenVideo Render</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      html,
      body {
        margin: 0;
        width: ${size.width}px;
        height: ${size.height}px;
        overflow: hidden;
        background: #101216;
        color: #f8fafc;
        font-family: Inter, Arial, sans-serif;
      }

      #root {
        position: relative;
        width: ${size.width}px;
        height: ${size.height}px;
        overflow: hidden;
        background: #101216;
      }

      .scene-fill {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(160deg, rgba(21, 128, 61, 0.95), rgba(15, 23, 42, 0.95) 45%, rgba(220, 38, 38, 0.82)),
          radial-gradient(circle at 24% 18%, rgba(250, 204, 21, 0.3), transparent 34%);
      }

      .clip {
        position: absolute;
        inset: 0;
        display: grid;
        align-content: center;
        gap: 42px;
        padding: 128px 86px;
        box-sizing: border-box;
      }

      .kicker,
      .tag {
        font-size: 38px;
        line-height: 1.15;
        font-weight: 800;
        color: #facc15;
      }

      h1 {
        margin: 0;
        font-size: 104px;
        line-height: 1.02;
        font-weight: 900;
        letter-spacing: 0;
        max-width: 900px;
      }

      p {
        margin: 0;
        font-size: 46px;
        line-height: 1.25;
        font-weight: 650;
        max-width: 860px;
        color: #e2e8f0;
      }

      .panel {
        width: 100%;
        border-left: 12px solid #facc15;
        padding-left: 28px;
      }

      .cta {
        align-self: end;
        font-size: 58px;
        line-height: 1.08;
        font-weight: 900;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="openvideo-main" data-start="0" data-width="${size.width}" data-height="${size.height}" data-duration="${duration}">
      <div class="scene-fill"></div>
      <section id="hook" class="clip" data-start="0" data-duration="3" data-track-index="1">
        <div class="kicker">OPENVIDEO / ${escapeHtml(category)}</div>
        <h1 id="hook-title">${escapeHtml(headline)}</h1>
      </section>
      <section id="proof" class="clip" data-start="3" data-duration="${Math.max(2, duration - 6)}" data-track-index="1">
        <div class="panel">
          <div class="tag">STYLE-LED PROOF</div>
          <p id="proof-copy">${escapeHtml(supporting)}</p>
        </div>
      </section>
      <section id="payoff" class="clip" data-start="${Math.max(5, duration - 3)}" data-duration="3" data-track-index="1">
        <div class="cta" id="payoff-copy">Make the new video original.</div>
      </section>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.from("#hook-title", { y: 80, opacity: 0, duration: 0.55, ease: "power3.out" }, 0.2);
      tl.from("#proof-copy", { y: 50, opacity: 0, duration: 0.45, ease: "power3.out" }, 3.2);
      tl.from("#payoff-copy", { scale: 0.92, opacity: 0, duration: 0.4, ease: "power3.out" }, ${Math.max(5, duration - 2.8)});
      window.__timelines["openvideo-main"] = tl;
    </script>
  </body>
</html>
`;
}

function renderNotes(input: { runDir: string; prompt: string; generationBrief: string; metadata: MetadataDoc | null }): string {
  return `# OpenVideo Render Handoff

## Source

- Run directory: ${input.runDir}
- Category: ${input.metadata?.category ?? 'auto'}
- Prompt: ${input.prompt}

## Next Commands

\`\`\`bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect
npx hyperframes preview
\`\`\`

Render only after preview approval:

\`\`\`bash
npx hyperframes render --quality draft --output out.mp4
\`\`\`

## Generation Brief Excerpt

${input.generationBrief.trim().split(/\r?\n/).slice(0, 80).join('\n')}
`;
}

function sizeFor(aspectRatio: string | undefined): { width: number; height: number } {
  return aspectRatio === '9:16' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
}

function suggestedDuration(sourceDuration: number | undefined): number {
  if (!sourceDuration || Number.isNaN(sourceDuration)) return 8;
  return Math.min(Math.max(Math.round(sourceDuration), 8), 30);
}

function extractGoal(markdown: string): string | null {
  const match = markdown.match(/## Goal\s+([\s\S]*?)(?:\n## |\s*$)/);
  return match?.[1]?.trim() || null;
}

function compactText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
