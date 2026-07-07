/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProspectBrief } from '../types';
import { downloadTextFile, slugify } from './exportMarkdown';
import { marketLabel } from './market';

export function prospectBriefToMarkdown(brief: ProspectBrief): string {
  const c = brief.company;
  const lines: string[] = [];

  lines.push(`# Prospect Radar — ${c.name}`);
  lines.push('');
  lines.push(`*Researchet ${new Date(brief.researchedAt).toLocaleString('da-DK')} · Konfidens: ${brief.confidence.level}*`);
  lines.push(`*Marked: ${marketLabel(brief.market)}*`);
  lines.push('');
  lines.push(`## Grund til at ringe`);
  lines.push(brief.reasonToCall);
  lines.push('');
  lines.push(`**Åbningsreplik:** ${brief.openingLine}`);
  if (brief.whyNow) lines.push(`**Hvorfor nu:** ${brief.whyNow}`);
  lines.push('');

  lines.push(`## Firma`);
  lines.push(`- **Website:** ${c.website}`);
  lines.push(`- **Kategori:** ${c.category}`);
  lines.push(`- **Hvad de laver:** ${c.whatTheyDo}`);
  lines.push(`- **Størrelse:** ${c.sizeSignal}`);
  lines.push(`- **Nøgleprodukter:** ${c.keyProducts.join(', ') || 'ukendt'}`);
  lines.push(`- **Emballage-situation:** ${c.packagingContext}`);
  lines.push('');

  if (brief.callAngles.length) {
    lines.push(`## Ringe-vinkler`);
    brief.callAngles.forEach((a) => lines.push(`- **${a.angle}:** "${a.openingLine}" — ${a.rationale}`));
    lines.push('');
  }

  lines.push(`## Mangler & behov`);
  brief.gaps.forEach((g, i) => {
    lines.push(`${i + 1}. **${g.gap}**`);
    lines.push(`   - Bevis: ${g.evidence}`);
    lines.push(`   - Sælgervinkel: ${g.sellerAngle}`);
    lines.push(`   - Værdi for dem: ${g.valueForThem}`);
  });
  lines.push('');

  lines.push(`## Signaler`);
  brief.signals.forEach((s) => {
    lines.push(`- **${s.signal}** (${s.timeframe}) — ${s.whyItMatters}${s.sourceUrl ? ` [kilde](${s.sourceUrl})` : ''}`);
  });
  lines.push('');

  lines.push(`## Talking points`);
  brief.talkingPoints.forEach((t) => lines.push(`- ${t}`));
  lines.push('');

  lines.push(`## Smarte spørgsmål`);
  brief.smartQuestions.forEach((q) => lines.push(`- ${q}`));
  lines.push('');

  if (brief.objections.length) {
    lines.push(`## Sandsynlige indvendinger`);
    brief.objections.forEach((o) => lines.push(`- **${o.objection}** → ${o.response}`));
    lines.push('');
  }

  lines.push(`## Beslutningstagere`);
  brief.decisionMakers.forEach((d) => lines.push(`- **${d.role}**${d.name ? ` (${d.name})` : ''} — ${d.rationale}`));
  lines.push('');

  if (brief.competitors.length) {
    lines.push(`## Konkurrenter`);
    brief.competitors.forEach((k) => lines.push(`- **${k.name}** — ${k.packagingNote}`));
    lines.push('');
  }

  lines.push(`## Kilder`);
  brief.sources.forEach((u) => lines.push(`- ${u}`));
  lines.push('');
  lines.push(`> Konfidens-note: ${brief.confidence.note}`);

  return lines.join('\n');
}

export function downloadProspectMarkdown(brief: ProspectBrief): void {
  const md = prospectBriefToMarkdown(brief);
  downloadTextFile(`prospect-${slugify(brief.company.name)}.md`, md);
}
