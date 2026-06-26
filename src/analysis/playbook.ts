import type { VideoCategory } from './artifacts.js';

export interface PlaybookFocusArea {
  id: string;
  label: string;
  questions: string[];
  evidenceFiles: string[];
}

export interface AnalysisPlaybook {
  runId?: string;
  category: VideoCategory;
  archetype: string;
  focusAreas: PlaybookFocusArea[];
  directorAngles: string[];
  editorAngles: string[];
  hyperframesGuidance: string[];
}

const VIDEO_CATEGORIES = new Set<VideoCategory>([
  'auto',
  'product-demo',
  'talking-head',
  'knowledge',
  'commerce',
  'lifestyle',
  'story',
  'cinematic-ad',
  'motion-graphic',
]);

export function normalizeVideoCategory(value: unknown): VideoCategory {
  return typeof value === 'string' && VIDEO_CATEGORIES.has(value as VideoCategory) ? (value as VideoCategory) : 'auto';
}

export function buildAnalysisPlaybook(category: VideoCategory, options: { runId?: string } = {}): AnalysisPlaybook {
  const normalizedCategory = normalizeVideoCategory(category);
  const playbook = playbookFor(normalizedCategory);
  return {
    runId: options.runId,
    category: normalizedCategory,
    ...playbook,
  };
}

export function renderPlaybookMarkdown(playbook: AnalysisPlaybook): string {
  const focusAreas = playbook.focusAreas
    .map(
      (area) => `### ${area.label}

${area.questions.map((question) => `- ${question}`).join('\n')}

Evidence: ${area.evidenceFiles.join(', ')}
`,
    )
    .join('\n');

  return `# Category Playbook

- Category: ${playbook.category}
- Archetype: ${playbook.archetype}

## Focus Areas

${focusAreas}
## Director Angles

${playbook.directorAngles.map((item) => `- ${item}`).join('\n')}

## Editor Angles

${playbook.editorAngles.map((item) => `- ${item}`).join('\n')}

## HyperFrames Guidance

${playbook.hyperframesGuidance.map((item) => `- ${item}`).join('\n')}
`;
}

function playbookFor(category: VideoCategory): Omit<AnalysisPlaybook, 'runId' | 'category'> {
  if (category === 'product-demo') {
    return {
      archetype: 'product-demonstration',
      focusAreas: [
        focus('problem-setup', 'Problem setup', [
          'What pain, inefficiency, or before-state is established before the product appears?',
          'Is the first frame a problem statement, a screen state, or a result tease?',
        ]),
        focus('workflow-proof', 'Workflow proof', [
          'Which actions prove the product actually works?',
          'Where do screen changes, cursor moves, or UI states replace verbal explanation?',
        ]),
        focus('result-reveal', 'Result reveal', [
          'When is the finished result shown, and how long is it held?',
          'Does the payoff land as a visual before the script explains it?',
        ]),
        focus('screen-legibility', 'Screen legibility', [
          'Are UI details readable on a vertical phone viewport?',
          'Which captions compete with or clarify the screen evidence?',
        ]),
      ],
      directorAngles: [
        'Track the handoff between problem, product surface, and visible result.',
        'Mark whether authority comes from the demo itself, a narrator, or comparison shots.',
      ],
      editorAngles: [
        'Separate setup, workflow proof, and result reveal with visible cut or caption beats.',
        'Preserve readable holds around UI state changes instead of over-cutting the demo.',
      ],
      hyperframesGuidance: [
        'Rebuild the workflow with original screens, labels, and copy.',
        'Use kinetic captions to frame the problem and result, while letting the product proof stay readable.',
      ],
    };
  }

  if (category === 'knowledge') {
    return {
      archetype: 'knowledge-explainer',
      focusAreas: [
        focus('hook-thesis', 'Hook thesis', [
          'What claim, question, contradiction, or promise appears in the first 3 seconds?',
          'Does the visual establish authority before or after the first spoken claim?',
        ]),
        focus('proof-chain', 'Proof chain', [
          'Which examples, numbers, screenshots, or comparisons make the claim believable?',
          'Does each proof beat advance the logic or repeat the same point?',
        ]),
        focus('caption-retention', 'Caption retention', [
          'Which words are emphasized for scanning without sound?',
          'Do captions summarize, tease the next beat, or restate the voiceover?',
        ]),
        focus('script-compression', 'Script compression', [
          'Where does the script compress context into short declarative lines?',
          'Which sentence should be rewritten first for an original HyperFrames version?',
        ]),
      ],
      directorAngles: [
        'Identify the teacher stance: expert, peer, investigator, or contrarian.',
        'Track how visual authority is created through screens, documents, examples, or face-to-camera framing.',
      ],
      editorAngles: [
        'Map every cut to claim, proof, objection, or payoff.',
        'Watch for caption-led transitions that reset attention before dense explanation.',
      ],
      hyperframesGuidance: [
        'Keep the claim/proof/payoff logic, but rewrite every example and line.',
        'Use large scanning captions for the thesis and lighter captions for supporting evidence.',
      ],
    };
  }

  if (category === 'commerce') {
    return {
      archetype: 'commerce-conversion',
      focusAreas: [
        focus('product-reveal', 'Product reveal', [
          'When does the product first become visually unmistakable?',
          'Is the reveal built through desire, pain, contrast, or direct display?',
        ]),
        focus('trust-proof', 'Trust proof', [
          'Which details create trust: usage demo, review, credential, material, packaging, or comparison?',
          'Does the video show enough proof before asking for action?',
        ]),
        focus('offer-mechanics', 'Offer mechanics', [
          'Where are price, discount, scarcity, bundle, or guarantee signals introduced?',
          'Are offer details carried by voice, captions, props, or UI overlays?',
        ]),
        focus('conversion-cta', 'Conversion CTA', [
          'What exact action is requested at the end?',
          'Does the CTA feel like a payoff, reminder, or hard sell?',
        ]),
      ],
      directorAngles: [
        'Track product handoff, handling, scale, texture, and before/after credibility.',
        'Mark whether trust comes from demonstration, social proof, or presenter authority.',
      ],
      editorAngles: [
        'Align product benefit, price signal, and CTA into separate readable beats.',
        'Preserve holds for offer details so viewers can read price, bundle, or guarantee claims.',
      ],
      hyperframesGuidance: [
        'Generate original product claims and proof assets; do not reuse source offer language.',
        'Build a clear benefit-proof-CTA arc with vertical-safe offer captions.',
      ],
    };
  }

  if (category === 'story') {
    return {
      archetype: 'story-skit',
      focusAreas: [
        focus('setup-context', 'Setup context', [
          'Who wants what at the start, and what situation is instantly readable?',
          'Which prop, caption, or line explains the premise fastest?',
        ]),
        focus('turning-point', 'Turning point', [
          'Where does the expectation flip, escalate, or become awkward?',
          'Is the turn driven by performance, reveal, edit, sound, or caption?',
        ]),
        focus('reaction-payoff', 'Reaction payoff', [
          'Which reaction shot, pause, or line carries the payoff?',
          'Does the ending resolve, loop, or invite comments?',
        ]),
      ],
      directorAngles: [
        'Mark each performance beat: setup, hesitation, turn, reaction, and payoff.',
        'Track blocking and eyelines so the original remake keeps story clarity without copying faces or staging.',
      ],
      editorAngles: [
        'Protect reaction timing; do not cut away before the audience reads the emotional beat.',
        'Use sound or caption punctuation to clarify the turn without over-explaining it.',
      ],
      hyperframesGuidance: [
        'Rebuild the setup-turn-payoff rhythm with new characters, setting, and dialogue.',
        'Use original reaction captions and avoid reenacting distinctive source staging.',
      ],
    };
  }

  if (category === 'talking-head') {
    return {
      archetype: 'talking-head-authority',
      focusAreas: [
        focus('face-authority', 'Face authority', [
          'How quickly does the speaker establish credibility, vulnerability, or urgency?',
          'What expression or posture anchors the first hook?',
        ]),
        focus('jump-cut-rhythm', 'Jump-cut rhythm', [
          'Where do cuts remove pauses, reset emphasis, or introduce a new argument?',
          'Are captions compensating for static framing?',
        ]),
        focus('cta-relationship', 'CTA relationship', [
          'Does the ending ask for trust, comments, follows, purchase, or reflection?',
          'Is the CTA delivered personally or through text overlay?',
        ]),
      ],
      directorAngles: [
        'Analyze speaker distance, gaze, posture, and emotional temperature without copying identity.',
        'Track how background and framing support authority or intimacy.',
      ],
      editorAngles: [
        'Map jump cuts to argument pivots and emphasis resets.',
        'Use captions as structure, not just transcription.',
      ],
      hyperframesGuidance: [
        'Translate the authority pattern into original avatar, voice, or faceless presenter choices.',
        'Keep the argument rhythm while rewriting all wording.',
      ],
    };
  }

  if (category === 'lifestyle') {
    return {
      archetype: 'lifestyle-observation',
      focusAreas: [
        focus('scene-atmosphere', 'Scene atmosphere', [
          'What location, texture, activity, or mood is established first?',
          'Is the hook aspirational, surprising, useful, or sensory?',
        ]),
        focus('routine-sequence', 'Routine sequence', [
          'Which actions create a repeatable routine or recommendation?',
          'Where do cuts compress time or preserve realism?',
        ]),
        focus('taste-signal', 'Taste signal', [
          'Which details signal taste, identity, quality, or point of view?',
          'Are captions descriptive, evaluative, or instruction-led?',
        ]),
      ],
      directorAngles: [
        'Track environment, texture, hand movement, and lived-in detail.',
        'Separate genuine observation from decorative atmosphere.',
      ],
      editorAngles: [
        'Use cuts to compress routine while preserving sensory proof.',
        'Mark detail shots that carry recommendation value.',
      ],
      hyperframesGuidance: [
        'Create original scenes and details that preserve the taste logic without copying locations.',
        'Use restrained captions that point to sensory or practical details.',
      ],
    };
  }

  if (category === 'cinematic-ad') {
    return {
      archetype: 'cinematic-ad',
      focusAreas: [
        focus('brand-premise', 'Brand premise', [
          'What promise or emotional territory is established before product detail?',
          'Which image or line makes the brand world legible?',
        ]),
        focus('visual-escalation', 'Visual escalation', [
          'How do shots increase scale, intensity, beauty, or clarity?',
          'Where does motion carry emotion instead of information?',
        ]),
        focus('end-card-payoff', 'End-card payoff', [
          'What final memory, logo moment, line, or CTA closes the ad?',
          'Does the ending clarify the offer or just the feeling?',
        ]),
      ],
      directorAngles: [
        'Analyze lighting, composition, camera path, and emotional escalation.',
        'Separate brand mood from exact source imagery.',
      ],
      editorAngles: [
        'Map image escalation, music rise, and title-card timing.',
        'Hold the final product or message long enough for recall.',
      ],
      hyperframesGuidance: [
        'Create a new visual world with the same emotional arc, not the same shots.',
        'Use typography and motion to land the brand premise clearly.',
      ],
    };
  }

  if (category === 'motion-graphic') {
    return {
      archetype: 'motion-graphic-explainer',
      focusAreas: [
        focus('information-hierarchy', 'Information hierarchy', [
          'Which concept, number, or object owns the first frame?',
          'How many visual levels compete for attention?',
        ]),
        focus('animation-grammar', 'Animation grammar', [
          'Are reveals based on masks, slides, scale, morphs, counters, or camera moves?',
          'Which motion motif repeats as a visual language?',
        ]),
        focus('readability-windows', 'Readability windows', [
          'How long are dense labels, charts, or key phrases held?',
          'Where does motion pause to let the viewer read?',
        ]),
      ],
      directorAngles: [
        'Treat layout, hierarchy, and motion motif as the primary direction system.',
        'Identify which graphic object carries the main idea in each beat.',
      ],
      editorAngles: [
        'Map reveal timing to narration or caption beats.',
        'Reserve pauses after dense visual information.',
      ],
      hyperframesGuidance: [
        'Build original graphics with equivalent hierarchy and timing rules.',
        'Use repeated motion motifs to create coherence across scenes.',
      ],
    };
  }

  return {
    archetype: 'short-video-general',
    focusAreas: [
      focus('hook', 'Hook', [
        'What does the first 3 seconds ask the viewer to notice, believe, or feel?',
        'Which visual or audio signal creates the first retention beat?',
      ]),
      focus('evidence', 'Evidence', [
        'What proves the promise after the hook?',
        'Which frames, captions, words, or sounds should be reviewed before writing a new version?',
      ]),
      focus('payoff', 'Payoff', [
        'How does the video resolve: result, CTA, reveal, joke, or loop?',
        'What should be preserved as an abstract structure rather than copied?',
      ]),
    ],
    directorAngles: [
      'Identify the subject, viewpoint, and emotional progression before writing new copy.',
      'Review sampled frames for shot scale, blocking, motion, and caption-safe composition.',
    ],
    editorAngles: [
      'Map cuts and holds to hook, evidence, and payoff.',
      'Check whether captions, transcript, and audio cues agree on emphasis.',
    ],
    hyperframesGuidance: [
      'Use the observed structure as a style abstraction only.',
      'Generate original visuals, copy, examples, and voice.',
    ],
  };
}

function focus(id: string, label: string, questions: string[]): PlaybookFocusArea {
  return {
    id,
    label,
    questions,
    evidenceFiles: [
      'analysis/storyboard.json',
      'analysis/transition-analysis.json',
      'analysis/motion-analysis.json',
      'analysis/captions.json',
      'analysis/transcript.json',
    ],
  };
}
