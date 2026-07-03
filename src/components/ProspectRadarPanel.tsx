/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Radar, Search, Copy, Download, X } from 'lucide-react';
import { ProspectBrief, SellerProfile, ProspectMarket } from '../types';
import { MARKETS } from '../lib/market';
import { prospectBriefToMarkdown, downloadProspectMarkdown } from '../lib/prospectExport';

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'claude-opus-4-8', label: 'Opus 4.8 — bedst kvalitet' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — balanceret' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 — hurtigst/billigst' },
];

interface ProspectRadarPanelProps {
  company: string;
  setCompany: (v: string) => void;
  market: ProspectMarket;
  setMarket: (m: ProspectMarket) => void;
  sellerProfile: SellerProfile;
  setSellerProfile: (p: SellerProfile) => void;
  resetSellerProfile: () => void;
  synthesisModel: string | undefined;
  setSynthesisModel: (m: string | undefined) => void;
  maxTokens: number | undefined;
  setMaxTokens: (n: number | undefined) => void;
  brief: ProspectBrief | null;
  isResearching: boolean;
  progress: string | null;
  onResearch: () => void;
  onClearBrief: () => void;
}

export function ProspectRadarPanel({
  company, setCompany, market, setMarket,
  sellerProfile, setSellerProfile, resetSellerProfile,
  synthesisModel, setSynthesisModel, maxTokens, setMaxTokens,
  brief, isResearching, progress, onResearch, onClearBrief,
}: ProspectRadarPanelProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showEngine, setShowEngine] = useState(false);

  const copyAll = () => {
    if (brief) navigator.clipboard.writeText(prospectBriefToMarkdown(brief)).catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">Prospect Radar</h2>
        <span className="text-[11px] text-slate-500">· varm grund til at ringe</span>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isResearching) onResearch(); }}
          placeholder="Firmanavn eller website (fx exemplar.dk)"
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
          disabled={isResearching}
        />
        <button
          onClick={onResearch}
          disabled={isResearching}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {isResearching ? 'Researcher…' : 'Research'}
        </button>
      </div>

      {/* Marked-vælger */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Marked:</span>
        {MARKETS.map((m) => (
          <button
            key={m.code}
            onClick={() => setMarket(m.code)}
            disabled={isResearching}
            title={m.label}
            className={`px-2 py-1 rounded text-xs border transition-colors disabled:opacity-50 ${
              market === m.code
                ? 'border-orange-500 bg-orange-500/15 text-orange-200'
                : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {m.flag} {m.code}
          </button>
        ))}
      </div>

      {progress && <p className="text-xs text-orange-300 font-mono animate-pulse">{progress}</p>}

      {/* Sælger-profil (foldbar) */}
      <div className="text-xs">
        <button onClick={() => setShowProfile((v) => !v)} className="text-slate-400 hover:text-slate-200 underline underline-offset-2">
          {showProfile ? 'Skjul' : 'Rediger'} sælger-profil ({sellerProfile.company})
        </button>
        {showProfile && (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <label className="block">
              <span className="text-slate-400">Firma</span>
              <input
                value={sellerProfile.company}
                onChange={(e) => setSellerProfile({ ...sellerProfile, company: e.target.value })}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Tilbud</span>
              <textarea
                value={sellerProfile.offering}
                onChange={(e) => setSellerProfile({ ...sellerProfile, offering: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Emballage-typer (komma-adskilt)</span>
              <input
                value={sellerProfile.packagingTypes.join(', ')}
                onChange={(e) => setSellerProfile({ ...sellerProfile, packagingTypes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Købs-triggers (komma-adskilt)</span>
              <input
                value={sellerProfile.triggers.join(', ')}
                onChange={(e) => setSellerProfile({ ...sellerProfile, triggers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <button onClick={resetSellerProfile} className="text-slate-400 hover:text-orange-300 underline underline-offset-2">
              Nulstil til Exemplar-standard
            </button>
          </div>
        )}
      </div>

      {/* Avanceret: model + max tokens (foldbar) */}
      <div className="text-xs">
        <button onClick={() => setShowEngine((v) => !v)} className="text-slate-400 hover:text-slate-200 underline underline-offset-2">
          {showEngine ? 'Skjul' : 'Vis'} avancerede indstillinger
        </button>
        {showEngine && (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <label className="block">
              <span className="text-slate-400">Claude-model (syntese)</span>
              <select
                value={synthesisModel ?? ''}
                onChange={(e) => setSynthesisModel(e.target.value || undefined)}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              >
                <option value="">Standard (Opus 4.8)</option>
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Max tokens (2.000–16.000)</span>
              <input
                type="number"
                min={2000}
                max={16000}
                step={500}
                value={maxTokens ?? ''}
                onChange={(e) => setMaxTokens(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="6000 (standard)"
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
          </div>
        )}
      </div>

      {/* Resultat */}
      {brief && (
        <div className="space-y-4 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">{brief.company.name}</h3>
            <div className="flex items-center gap-2">
              <button onClick={copyAll} title="Kopiér alt" className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><Copy className="w-4 h-4" /></button>
              <button onClick={() => downloadProspectMarkdown(brief)} title="Download .md" className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><Download className="w-4 h-4" /></button>
              <button onClick={onClearBrief} title="Ryd" className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
          </div>

          <section className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-3">
            <p className="text-[11px] font-mono uppercase tracking-wider text-orange-300">Grund til at ringe</p>
            <p className="mt-1 text-sm text-slate-100">{brief.reasonToCall}</p>
            <p className="mt-2 text-sm italic text-slate-300">"{brief.openingLine}"</p>
            {brief.whyNow && <p className="mt-2 text-xs text-orange-200">Hvorfor nu: {brief.whyNow}</p>}
          </section>

          <ProspectList title="Ringe-vinkler" items={brief.callAngles.map((a) => `${a.angle}: "${a.openingLine}" — ${a.rationale}`)} />
          <ProspectList title="Mangler & behov" items={brief.gaps.map((g) => `${g.gap} — ${g.sellerAngle} (bevis: ${g.evidence})`)} />
          <ProspectList title="Signaler" items={brief.signals.map((s) => `${s.signal} (${s.timeframe}) — ${s.whyItMatters}`)} />
          <ProspectList title="Talking points" items={brief.talkingPoints} />
          <ProspectList title="Smarte spørgsmål" items={brief.smartQuestions} />
          <ProspectList title="Sandsynlige indvendinger" items={brief.objections.map((o) => `${o.objection} → ${o.response}`)} />
          <ProspectList title="Beslutningstagere" items={brief.decisionMakers.map((d) => `${d.role}${d.name ? ` (${d.name})` : ''} — ${d.rationale}`)} />

          {brief.sources.length > 0 && (
            <section>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Kilder</p>
              <ul className="mt-1 space-y-1">
                {brief.sources.map((u, i) => (
                  <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 break-all">{u}</a></li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[11px] text-slate-500">Konfidens: <span className="text-slate-300">{brief.confidence.level}</span> · {brief.confidence.note}</p>
        </div>
      )}
    </div>
  );
}

function ProspectList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="mt-1 space-y-1 list-disc list-inside">
        {items.map((it, i) => <li key={i} className="text-sm text-slate-200">{it}</li>)}
      </ul>
    </section>
  );
}
