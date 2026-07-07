import { describe, it, expect } from 'vitest';
import { stepStatus, PROSPECT_STEPS } from './prospectSteps';

describe('PROSPECT_STEPS', () => {
  it('lists the four phases in order', () => {
    expect(PROSPECT_STEPS.map((s) => s.key)).toEqual(['gathering', 'synthesizing', 'critiquing', 'sharpening']);
  });
});

describe('stepStatus', () => {
  it('returns pending for every step when no phase is active', () => {
    expect(stepStatus('gathering', null)).toBe('pending');
    expect(stepStatus('sharpening', null)).toBe('pending');
  });

  it('marks earlier steps done, the current step active, and later steps pending', () => {
    expect(stepStatus('gathering', 'critiquing')).toBe('done');
    expect(stepStatus('synthesizing', 'critiquing')).toBe('done');
    expect(stepStatus('critiquing', 'critiquing')).toBe('active');
    expect(stepStatus('sharpening', 'critiquing')).toBe('pending');
  });

  it('treats the very first phase as active-only, never done, when it is current', () => {
    expect(stepStatus('gathering', 'gathering')).toBe('active');
  });
});
