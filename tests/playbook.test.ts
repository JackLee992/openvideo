import { describe, expect, it } from 'vitest';
import { buildAnalysisPlaybook } from '../src/analysis/playbook.js';

describe('buildAnalysisPlaybook', () => {
  it('uses knowledge-video review angles for educational Douyin videos', () => {
    const playbook = buildAnalysisPlaybook('knowledge');

    expect(playbook.archetype).toBe('knowledge-explainer');
    expect(playbook.focusAreas.map((area) => area.id)).toEqual([
      'hook-thesis',
      'proof-chain',
      'caption-retention',
      'script-compression',
    ]);
    expect(playbook.directorAngles.join('\n')).toContain('teacher stance');
    expect(playbook.editorAngles.join('\n')).toContain('claim');
  });

  it('uses commerce review angles for product and conversion videos', () => {
    const playbook = buildAnalysisPlaybook('commerce');

    expect(playbook.archetype).toBe('commerce-conversion');
    expect(playbook.focusAreas.map((area) => area.id)).toEqual([
      'product-reveal',
      'trust-proof',
      'offer-mechanics',
      'conversion-cta',
    ]);
    expect(playbook.directorAngles.join('\n')).toContain('product handoff');
    expect(playbook.editorAngles.join('\n')).toContain('price');
  });

  it('uses story review angles for skit or narrative videos', () => {
    const playbook = buildAnalysisPlaybook('story');

    expect(playbook.archetype).toBe('story-skit');
    expect(playbook.focusAreas.map((area) => area.id)).toContain('turning-point');
    expect(playbook.directorAngles.join('\n')).toContain('performance beat');
    expect(playbook.editorAngles.join('\n')).toContain('reaction');
  });
});
