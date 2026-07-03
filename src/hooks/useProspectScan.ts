/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ProspectBrief, ProspectMarket, SellerProfile } from '../types';
import { httpErrorMessage } from './httpError';
import { loadSellerProfile, saveSellerProfile, EXEMPLAR_DEFAULT_SELLER } from '../lib/sellerProfile';
import { detectMarketFromInput } from '../lib/market';
import { ProspectPhase } from '../lib/prospectSteps';

const PROGRESS_LABELS: Record<string, string> = {
  gathering: 'Graver efter fund …',
  synthesizing: 'Syntetiserer briefing …',
  critiquing: 'Pres-tester briefingen …',
  sharpening: 'Skærper briefingen …',
};

/**
 * Prospect Radar som selvstændigt domæne: input er kun et firmanavn/website,
 * så hooket er uafhængigt af det kreative brief. Sælger-profilen persisteres
 * lokalt, så den kun skal redigeres én gang.
 */
export function useProspectScan(setErrorMsg: (m: string | null) => void) {
  const [company, setCompanyState] = useState('');
  const [market, setMarket] = useState<ProspectMarket>('DK');
  const [sellerProfile, setSellerProfileState] = useState<SellerProfile>(() => loadSellerProfile());
  const [brief, setBrief] = useState<ProspectBrief | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [phase, setPhase] = useState<ProspectPhase | null>(null);
  const [synthesisModel, setSynthesisModel] = useState<string | undefined>(undefined);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);

  const setCompany = (v: string) => {
    setCompanyState(v);
    const detected = detectMarketFromInput(v);
    if (detected) setMarket(detected);
  };

  const setSellerProfile = (p: SellerProfile) => {
    setSellerProfileState(p);
    saveSellerProfile(p);
  };
  const resetSellerProfile = () => setSellerProfile(EXEMPLAR_DEFAULT_SELLER);

  const handleResearch = async () => {
    if (!company.trim()) {
      setErrorMsg('Skriv et firmanavn eller website for at researche.');
      return;
    }
    setIsResearching(true);
    setErrorMsg(null);
    setPhase('gathering');
    setProgress(PROGRESS_LABELS.gathering);
    try {
      const response = await fetch('/api/prospect-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(), sellerProfile, market,
          engineOptions: { synthesisModel, maxTokens },
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalBrief: ProspectBrief | null = null;
      let streamErr: string | null = null;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break outer;
          let parsed: any;
          try { parsed = JSON.parse(payload); } catch { continue; }
          if (parsed.phase) {
            setPhase(parsed.phase);
            setProgress(
              parsed.phase === 'gathering' && parsed.step
                ? parsed.step
                : (PROGRESS_LABELS[parsed.phase] ?? parsed.phase),
            );
          }
          if (parsed.error) streamErr = parsed.error;
          if (parsed.done && parsed.brief) finalBrief = parsed.brief as ProspectBrief;
        }
      }

      if (streamErr) throw new Error(streamErr);
      if (!finalBrief) throw new Error('Ingen briefing modtaget fra serveren.');
      setBrief(finalBrief);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Prospect-scan fejlede.');
    } finally {
      setIsResearching(false);
      setProgress(null);
      setPhase(null);
    }
  };

  const handleClearBrief = () => setBrief(null);

  return {
    company, setCompany,
    market, setMarket,
    sellerProfile, setSellerProfile, resetSellerProfile,
    synthesisModel, setSynthesisModel, maxTokens, setMaxTokens,
    brief, isResearching, progress, phase,
    handleResearch, handleClearBrief,
  };
}
