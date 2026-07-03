/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProspectPhase = 'gathering' | 'synthesizing' | 'critiquing' | 'sharpening';

export interface ProspectStepDef {
  key: ProspectPhase;
  label: string;
}

export const PROSPECT_STEPS: ProspectStepDef[] = [
  { key: 'gathering', label: 'Indsamler' },
  { key: 'synthesizing', label: 'Syntetiserer' },
  { key: 'critiquing', label: 'Pres-tester' },
  { key: 'sharpening', label: 'Skærper' },
];

export type StepStatus = 'pending' | 'active' | 'done';

export function stepStatus(stepKey: ProspectPhase, currentPhase: ProspectPhase | null): StepStatus {
  if (!currentPhase) return 'pending';
  const stepIndex = PROSPECT_STEPS.findIndex((s) => s.key === stepKey);
  const currentIndex = PROSPECT_STEPS.findIndex((s) => s.key === currentPhase);
  if (currentIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}
