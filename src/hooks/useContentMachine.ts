/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, ChangeEvent, FormEvent } from 'react';
import { ProjectBrief, BrandSurfaceOutput, PresetBrief, ToneAnalysis, VisualDevResult, UsageInfo, BrainstormResult, PitchResult } from '../types';
import { buildMarkdown, downloadTextFile, slugify } from '../lib/exportMarkdown';
import { downloadHtmlFile } from '../lib/exportHtml';
import { downloadDeckFile } from '../lib/exportDeck';
import { downloadDocx } from '../lib/exportDocx';
import { saveSession, loadSession } from '../lib/session';
import { loadHistory, pushHistory, clearHistory, type HistoryItem } from '../lib/history';
import { httpErrorMessage } from './httpError';
import { useTheme } from './useTheme';
import { useClipboard } from './useClipboard';
import { useImageGeneration } from './useImageGeneration';
import { useVideoGeneration } from './useVideoGeneration';
import { useAvatarGeneration } from './useAvatarGeneration';
import { useHumanizer } from './useHumanizer';
import { useLogo } from './useLogo';
import { useCreativeFunnel } from './useCreativeFunnel';
import { useBureauMode } from './useBureauMode';
import { useCodeDepartment } from './useCodeDepartment';
import { useFunnelArchive } from './useFunnelArchive';
import { useProspectScan } from './useProspectScan';
import {
  type FunnelDoc, bundleFunnelDocs,
  culturalToDoc, strategyToDoc, bigIdeaToDoc, pressureTestToDoc,
  channelMatrixToDoc, effectivenessToDoc, brainstormToDoc, visualToDoc,
} from '../lib/funnelDoc';

export const PRESETS: PresetBrief[] = [
  {
    name: "Modaxo Move 2026 (Konference / 3D Maskot)",
    brief: {
      client: "Modaxo",
      project: "Modaxo Move 2026",
      description: "Vi udviklede visuelt indhold til en international konference i København. Vi lavede speaker presentations, dynamiske visuals til LED-skærm, dinner visuals, awards visuals og content til liveoptrædener.",
      details: "350 deltagere fra hele verden, deltagere fra 37 lande, 24x4 meter LED-skærm. Vi var også med til at udvikle Moxi, Modaxos nye lille maskot. Hun blev skabt med udgangspunkt i Modaxos logo og vækket til live som en 3D-karakter.",
      audience: "Virksomheder der holder events, konferencer, messer og keynotes.",
      tone: "Professionel, menneskelig, kreativ, ikke barnlig.",
      language: "Dansk",
      channels: ["Hjemmeside", "LinkedIn", "Nyhedsbrev"],
      notes: "Vi skal fremstå som en kreativ og praktisk samarbejdspartner, der kan løfte visuelle oplevelser i stor skala."
    }
  },
  {
    name: "B&O Beolab Launch (Eksklusiv Event / 3D)",
    brief: {
      client: "Bang & Olufsen",
      project: "Beolab Theatre Launch Event",
      description: "Vi leverede komplet 3D-visualisering og scenekonstruktion til den skandinaviske produktlancering. Vi designede et ultra-high-end digitalt univers, herunder live 3D eksploderede tegninger af produktkomponenter på scenen synkroniseret med lys-show.",
      details: "Afholdt i et historisk teater i København for 150 VIP arkitekter og lyd-anmeldere. Ekstremt luksuriøs finish og fotorealistisk 3D visualisering.",
      audience: "High-end lyd-entusiaster, arkitekter, tech-medier og top-forhandlere.",
      tone: "Sofistikeret, design-fokuseret, eksklusiv, præcis.",
      language: "Dansk",
      channels: ["LinkedIn", "Hjemmeside", "Nyhedsbrev"],
      notes: "Vi skal fremhæves som den præcise kreative teknologiske kraft, der gør det muligt at forstå akustisk storhed visuelt."
    }
  },
  {
    name: "Ørsted Wind Summit (Data / Infografik / Web)",
    brief: {
      client: "Ørsted",
      project: "Green Wind Summit Copenhagen",
      description: "Produktion af digital grafik, interaktive infografikker til touch-screens og en komplet nyhedsbrev-kampagne i forbindelse med det globale vindtopmøde.",
      details: "5 interaktive info-standere på messestanden, 12 animerede infografik-loops. Fokus på vindmølle-teknologiens fremtid på havbunden.",
      audience: "Industrispecialister, investorer, journalister og grønne rådgivere.",
      tone: "Visionær, troværdig, professionel, grøn og skarp.",
      language: "Dansk",
      channels: ["Nyhedsbrev", "LinkedIn"],
      notes: "Vi skal formidle indviklede tekniske klimadata enkelt, visuelt stærkt og inspirerende."
    }
  }
];

function applyLockedSections(
  fresh: BrandSurfaceOutput,
  locked: string[],
  existing: BrandSurfaceOutput,
): BrandSurfaceOutput {
  if (locked.length === 0) return fresh;
  const m = { ...fresh };
  for (const key of locked) {
    if (key === 'shortCaseText') m.shortCaseText = existing.shortCaseText;
    else if (key === 'longCaseText') m.longCaseText = existing.longCaseText;
    else if (key === 'linkedinPost') m.linkedinPost = existing.linkedinPost;
    else if (key === 'creativeNewsletterSection' && m.production && existing.production) {
      m.production = { ...m.production, newsletterSection: existing.production.newsletterSection };
    }
  }
  return m;
}

export function useContentMachine() {
  const [brief, setBrief] = useState<ProjectBrief>({
    client: '',
    project: '',
    description: '',
    details: '',
    audience: 'Virksomheder der holder events, konferencer, messer og keynotes.',
    tone: 'Professionel, menneskelig, kreativ, ikke barnlig.',
    language: 'Dansk',
    channels: ['Hjemmeside', 'LinkedIn', 'Nyhedsbrev'],
    notes: 'Vi skal fremstå som en kreativ og praktisk samarbejdspartner, der kan løfte visuelle oplevelser i stor skala.'
  });

  const [activeTab, setActiveTab] = useState<string>('case');
  const [output, setOutput] = useState<BrandSurfaceOutput | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [variants, setVariants] = useState<{ key: string; options: string[] } | null>(null);
  const [isVariating, setIsVariating] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  const [deepMode, setDeepMode] = useState<boolean>(false);
  const [deepCritique, setDeepCritique] = useState<{
    before: ToneAnalysis;
    after?: ToneAnalysis | null;
    earlyStopped?: boolean;
    synthesisTruncated?: boolean;
  } | null>(null);
  const [isVisualDeveloping, setIsVisualDeveloping] = useState<boolean>(false);
  const [visualResult, setVisualResult] = useState<VisualDevResult | null>(null);

  const [selectedTextKey, setSelectedTextKey] = useState<string>('shortCaseText');
  const [customRefinementPrompt, setCustomRefinementPrompt] = useState<string>('');
  const [terminalCommand, setTerminalCommand] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refinementHistory, setRefinementHistory] = useState<Array<{ key: string; original: string }>>([]);
  const [revisions, setRevisions] = useState<Record<string, string[]>>({});
  const [activeCompareIndex, setActiveCompareIndex] = useState<Record<string, number | null>>({});

  const [brainstormResult, setBrainstormResult] = useState<BrainstormResult | null>(null);
  const [isBrainstorming, setIsBrainstorming] = useState<boolean>(false);

  const [cviFileName, setCviFileName] = useState<string | null>(null);
  const [isAnalyzingCvi, setIsAnalyzingCvi] = useState<boolean>(false);

  const [printMode, setPrintMode] = useState<'all' | 'cvi' | 'case'>('all');

  const [lastUsage, setLastUsage] = useState<UsageInfo | null>(null);
  const [lockedSections, setLockedSections] = useState<string[]>(() => loadSession()?.lockedSections ?? []);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);

  // --- Komponér domæne-hooks (afhængigheder gives ind; offentlig API er uændret) ---
  const { theme, setTheme } = useTheme();
  const { copiedKey, handleCopyToClipboard } = useClipboard();
  const { generatedImages, setGeneratedImages, handleGenerateImage, handleAspectChange, isOptimizingImagePrompt, handleOptimizeImagePrompt } = useImageGeneration();
  const { videoResult, setVideoResult, handleGenerateVideo } = useVideoGeneration();
  const { speechResult, avatarResult, handleGenerateSpeech, handleGenerateAvatar } = useAvatarGeneration();
  const {
    externalText, setExternalText, humanizerResult, setHumanizerResult,
    isHumanizing, handleHumanizeText,
  } = useHumanizer({ setErrorMsg });
  const {
    logoResult, setLogoResult, isGeneratingLogo, handleGenerateLogo,
    isOptimizingLogoPrompt, handleOptimizeLogoPrompt,
  } = useLogo({ brief, setErrorMsg });
  // Stable ref så useCreativeFunnel kan kalde bureau.clearPitch selvom bureau initialiseres efter funnel
  const clearPitchRef = useRef<(() => void) | undefined>(undefined);
  const onClearPitch = useCallback(() => clearPitchRef.current?.(), []);

  const {
    culturalIntel, setCulturalIntel, isScanning, handleCulturalScan, handleClearCulturalIntel,
    strategy, setStrategy, isGeneratingStrategy, handleGenerateStrategy, handleClearStrategy,
    campaignPlatform, setCampaignPlatform, isGeneratingCampaign, handleGenerateBigIdea,
    selectedTerritory, handleSelectTerritory, handleClearTerritory,
    pressureTest, isSharpening, sharpeningTarget,
    handleSharpenIdea, handleAdoptSharpened, handleClearPressureTest,
    channelMatrix, setChannelMatrix, isGeneratingMatrix, handleGenerateChannelMatrix, handleClearChannelMatrix,
    effectiveness, setEffectiveness, isGeneratingEffectiveness, handleGenerateEffectiveness, handleClearEffectiveness,
    funnelBriefKey, handleClearAllFunnel,
  } = useCreativeFunnel({ brief, setLastUsage, setErrorMsg, onClearPitch });

  const prospect = useProspectScan(setErrorMsg);

  const bureau = useBureauMode({
    brief,
    setLastUsage,
    setErrorMsg,
    setCulturalIntel,
    setStrategy,
    strategy,
    setCampaignPlatform,
    handleSelectTerritory,
    selectedTerritory,
    setChannelMatrix,
    channelMatrix,
    setEffectiveness,
    effectiveness,
    setOutput,
  });

  // Hold ref opdateret — gør det muligt for funnel at rydde pitch uden cirkulær afhængighed
  clearPitchRef.current = bureau.clearPitch;

  const codeDept = useCodeDepartment({
    brief,
    strategy,
    selectedTerritory,
    setLastUsage,
    setErrorMsg,
  });

  const funnelArchive = useFunnelArchive({ brief, setErrorMsg });

  // Saml alle genererede funnel-paneler til ét dokument ("hele forløbet").
  const collectFunnelDocs = useCallback((): FunnelDoc[] => {
    const docs: FunnelDoc[] = [];
    if (culturalIntel) docs.push(culturalToDoc(culturalIntel));
    if (strategy) docs.push(strategyToDoc(strategy));
    if (campaignPlatform) docs.push(bigIdeaToDoc(campaignPlatform));
    if (pressureTest) docs.push(pressureTestToDoc(pressureTest.original, pressureTest.result));
    if (channelMatrix) docs.push(channelMatrixToDoc(channelMatrix));
    if (effectiveness) docs.push(effectivenessToDoc(effectiveness));
    if (brainstormResult) docs.push(brainstormToDoc(brainstormResult));
    if (visualResult) docs.push(visualToDoc(visualResult));
    return docs;
  }, [culturalIntel, strategy, campaignPlatform, pressureTest, channelMatrix, effectiveness, brainstormResult, visualResult]);

  const funnelDocCount = collectFunnelDocs().length;

  const handleArchiveAllFunnel = useCallback(() => {
    const docs = collectFunnelDocs();
    if (docs.length === 0) return;
    funnelArchive.openDoc(bundleFunnelDocs(docs, `Hele forløbet — ${brief.client || 'Neura Studio'}`));
  }, [collectFunnelDocs, funnelArchive, brief.client]);

  const [customPresets, setCustomPresets] = useState<PresetBrief[]>(() => {
    const local = localStorage.getItem('brand_surface_presets');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error("Fejl under indlæsning af presets:", e);
      }
    }
    return PRESETS;
  });

  useEffect(() => {
    const saved = loadSession();
    if (saved && (saved.output || saved.brief?.client)) {
      if (saved.brief) setBrief(saved.brief);
      if (saved.output) setOutput(saved.output);
      if (saved.revisions) setRevisions(saved.revisions);
      if (saved.activeCompareIndex) setActiveCompareIndex(saved.activeCompareIndex);
      if (saved.generatedImages) setGeneratedImages(prev => ({ ...prev, ...(saved.generatedImages as any) }));
      if (saved.cviFileName !== undefined) setCviFileName(saved.cviFileName ?? null);
      if (saved.activeTab) setActiveTab(saved.activeTab);
      return;
    }
    if (customPresets && customPresets.length > 0) {
      handleLoadPreset(customPresets[0]);
    } else {
      setBrief({
        client: '',
        project: '',
        description: '',
        details: '',
        audience: '',
        tone: 'Professionel, menneskelig, kreativ',
        language: 'Dansk',
        channels: [],
        notes: '',
        cviManual: null
      });
    }
  }, []);

  useEffect(() => {
    if (!output && !brief.client) return;
    saveSession({ brief, output, revisions, activeCompareIndex, generatedImages, cviFileName, activeTab, lockedSections, campaignPlatform, selectedTerritory, strategy, channelMatrix, culturalIntel, effectiveness, funnelBriefKey });
  }, [brief, output, revisions, activeCompareIndex, generatedImages, cviFileName, activeTab, lockedSections, campaignPlatform, selectedTerritory, strategy, channelMatrix, culturalIntel, effectiveness, funnelBriefKey]);

  const handleClearPresets = () => {
    setCustomPresets([]);
    localStorage.setItem('brand_surface_presets', JSON.stringify([]));
    setErrorMsg("Alle presets er nu ryddet. Du kan bygge og pinne dine egne jobs!");
  };

  const handleRestorePresets = () => {
    setCustomPresets(PRESETS);
    localStorage.setItem('brand_surface_presets', JSON.stringify(PRESETS));
    handleLoadPreset(PRESETS[0]);
    setErrorMsg(null);
  };

  const handleCviUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingCvi(true);
    setCviFileName(file.name);
    setErrorMsg(null);

    const checkCviResult = (base64String: string) => {
      fetch('/api/analyze-cvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileType: file.type, fileContent: base64String, fileName: file.name })
      })
      .then(async res => {
        if (!res.ok) {
          const text = await res.json().catch(() => ({}));
          throw new Error(httpErrorMessage(res.status, text.error));
        }
        return res.json();
      })
      .then(result => {
        setBrief(prev => ({ ...prev, cviManual: result }));
        setErrorMsg(`CVI og designmanual "${file.name}" er scannet og indlæst! Din AI vil nu bruge disse regler.`);
      })
      .catch(err => {
        console.error("CVI error:", err);
        setErrorMsg(`Scanning mislykkedes: ${err.message || 'AI-modellen kunne ikke afkode filen.'}`);
        setCviFileName(null);
      })
      .finally(() => {
        setIsAnalyzingCvi(false);
      });
    };

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        checkCviResult(base64);
      };
      reader.onerror = () => {
        setErrorMsg("Fejl under indlæsning af designmanualen.");
        setIsAnalyzingCvi(false);
        setCviFileName(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(`Filfejl: ${err.message}`);
      setIsAnalyzingCvi(false);
      setCviFileName(null);
    }
  };

  const handleRemoveCvi = () => {
    setBrief(prev => ({ ...prev, cviManual: null }));
    setCviFileName(null);
    setErrorMsg("Designmanualen er fjernet.");
  };

  const handlePinCurrentBrief = () => {
    if (!brief.client.trim() || !brief.project.trim()) {
      setErrorMsg("Udfyld venligst mindst 'Kunde' og 'Projekt' for at pinne dette job.");
      return;
    }
    const name = `${brief.client} - ${brief.project}`;
    const exists = customPresets.some(
      p => p.brief.project.toLowerCase() === brief.project.toLowerCase() &&
           p.brief.client.toLowerCase() === brief.client.toLowerCase()
    );
    if (exists) {
      setErrorMsg("Et job med denne kunde og dette projekt-navn er allerede pined i dine presets.");
      return;
    }
    const newPreset: PresetBrief = { name, brief: { ...brief } };
    const updated = [newPreset, ...customPresets];
    setCustomPresets(updated);
    localStorage.setItem('brand_surface_presets', JSON.stringify(updated));
    setErrorMsg(`Jobbet "${name}" er blevet pined til genveje!`);
  };

  useEffect(() => {
    if (activeTab === 'case') {
      setSelectedTextKey('shortCaseText');
    } else if (activeTab === 'linkedin') {
      setSelectedTextKey('linkedinPost');
    } else if (activeTab === 'newsletter') {
      setSelectedTextKey('newsletterSection');
    } else if (activeTab === 'english') {
      setSelectedTextKey('englishShortCaseText');
    }
  }, [activeTab]);

  const handleBriefChange = <K extends keyof ProjectBrief>(field: K, value: ProjectBrief[K]) => {
    setBrief(prev => ({ ...prev, [field]: value }));
  };

  const handleChannelToggle = (channel: string) => {
    setBrief(prev => {
      const current = prev.channels;
      if (current.includes(channel)) {
        return { ...prev, channels: current.filter(c => c !== channel) };
      } else {
        return { ...prev, channels: [...current, channel] };
      }
    });
  };

  const handleLoadPreset = (preset: PresetBrief) => {
    setBrief({ ...preset.brief });
    setCviFileName(preset.brief.cviManual ? "Aktive CVI retningslinjer" : null);
    setErrorMsg(null);
  };

  const handleExportSingleSection = (mode: 'all' | 'cvi' | 'case') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode('all'), 1000);
    }, 150);
  };

  const handleExportMarkdown = () => {
    if (!output) return;
    const md = buildMarkdown(output, brief);
    downloadTextFile(`${slugify(brief.client || 'brand-surface')}-case.md`, md);
  };

  const handleCopyAllMarkdown = () => {
    if (!output) return;
    handleCopyToClipboard(buildMarkdown(output, brief), 'export_all_md');
  };

  const handleExportHtml = () => {
    if (!output) return;
    downloadHtmlFile(output, brief);
  };

  const handleExportDocx = async () => {
    if (!output) return;
    try {
      await downloadDocx(`${slugify(brief.client || 'brand-surface')}-case.docx`, output, brief);
    } catch (e: any) {
      setErrorMsg(e.message || 'Kunne ikke generere Word-dokument.');
    }
  };

  const handleExportDeck = async () => {
    if (!selectedTerritory) return;
    // Guard: Inkludér kun pitch hvis den er genereret i denne session (pitchResult er in-memory)
    // og funnel-data tilhører det aktuelle brief (undgår nyt+gammelt-blanding)
    const currentBriefKey = `${brief.client}|${brief.project}`;
    const pitchBelongsToBrief = bureau.pitchResult !== null && (funnelBriefKey === currentBriefKey || funnelBriefKey === null);
    try {
      await downloadDeckFile({
        brief,
        territory: selectedTerritory,
        strategy,
        channelMatrix,
        effectiveness,
        output,
        pitch: pitchBelongsToBrief ? bureau.pitchResult : null,
        logoSrc: logoResult?.imageUrl,
        logoSvg: logoResult?.svg,
        images: {
          hero: generatedImages.hero?.url || undefined,
          detail: generatedImages.detail?.url || undefined,
          abstract: generatedImages.abstract?.url || undefined,
        },
      });
    } catch (e: any) {
      setErrorMsg(e.message || 'Kunne ikke generere pitch-deck.');
    }
  };

  const handleResetProject = () => {
    setBrief({ client: '', project: '', description: '', details: '', audience: '', tone: '', language: 'Dansk', channels: [], notes: '', cviManual: null });
    setOutput(null);
    setRevisions({});
    setActiveCompareIndex({});
    handleClearAllFunnel();
    bureau.clearPitch();
    setErrorMsg(null);
    setActiveTab('case');
  };

  const handleLoadHistory = (item: HistoryItem) => {
    setBrief(item.brief);
    setOutput(item.output);
    setRevisions({
      shortCaseText: [item.output.shortCaseText],
      longCaseText: [item.output.longCaseText],
      linkedinPost: [item.output.linkedinPost],
      creativeNewsletterSection: item.output.production?.newsletterSection
        ? [item.output.production.newsletterSection]
        : []
    });
    setActiveCompareIndex({ shortCaseText: null, longCaseText: null, linkedinPost: null, creativeNewsletterSection: null });
    setRefinementHistory([]);
    setCviFileName(item.brief.cviManual ? 'Aktive CVI retningslinjer' : null);
    setActiveTab('case');
    setErrorMsg(null);
  };

  const handleClearHistory = () => {
    setHistory(clearHistory());
  };

  const resolveMainText = (key: string): string => {
    if (!output) return '';
    if (key === 'shortCaseText') return output.shortCaseText;
    if (key === 'longCaseText') return output.longCaseText;
    if (key === 'linkedinPost') return output.linkedinPost;
    return '';
  };

  const handleGenerateVariants = async (targetKey: string) => {
    const text = resolveMainText(targetKey);
    if (!text) return;
    setIsVariating(true);
    setErrorMsg(null);
    setVariants({ key: targetKey, options: [] });
    try {
      const res = await fetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, count: 2, brief })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(httpErrorMessage(res.status, e.error));
      }
      const data = await res.json();
      setVariants({ key: targetKey, options: data.variants || [] });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Kunne ikke generere varianter.');
      setVariants(null);
    } finally {
      setIsVariating(false);
    }
  };

  const handleApplyVariant = (targetKey: string, value: string) => {
    const original = resolveMainText(targetKey);
    setRefinementHistory(prev => [...prev, { key: targetKey, original }]);
    setRevisions(prev => {
      const list = [...(prev[targetKey] || [])];
      if (list.length === 0) list.push(original);
      if (list[list.length - 1] !== value) list.push(value);
      return { ...prev, [targetKey]: list };
    });
    setActiveCompareIndex(prev => ({ ...prev, [targetKey]: null }));
    setOutput(prev => {
      if (!prev) return null;
      const u: BrandSurfaceOutput = { ...prev };
      if (targetKey === 'shortCaseText') u.shortCaseText = value;
      else if (targetKey === 'longCaseText') u.longCaseText = value;
      else if (targetKey === 'linkedinPost') u.linkedinPost = value;
      if (targetKey === 'shortCaseText' && u.directUsable) {
        u.directUsable = { ...u.directUsable, bestShortText: value };
      }
      return u;
    });
    setVariants(null);
  };

  const handleToggleLock = (key: string) => {
    setLockedSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleRegenerateSection = async (sectionKey: string) => {
    if (!output) return;

    const currentText = (() => {
      if (sectionKey === 'shortCaseText') return output.shortCaseText;
      if (sectionKey === 'longCaseText') return output.longCaseText;
      if (sectionKey === 'linkedinPost') return output.linkedinPost;
      if (sectionKey === 'creativeNewsletterSection') return output.production?.newsletterSection ?? '';
      return '';
    })();

    setRegeneratingKey(sectionKey);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, sectionKey, currentText })
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }

      const applyLiveText = (value: string) => {
        setOutput(prev => {
          if (!prev) return null;
          const u = {
            ...prev,
            production: prev.production ? { ...prev.production } : prev.production,
            directUsable: prev.directUsable ? { ...prev.directUsable } : prev.directUsable,
          };
          if (sectionKey === 'shortCaseText') {
            u.shortCaseText = value;
            if (u.directUsable) u.directUsable.bestShortText = value;
          } else if (sectionKey === 'longCaseText') {
            u.longCaseText = value;
          } else if (sectionKey === 'linkedinPost') {
            u.linkedinPost = value;
          } else if (sectionKey === 'creativeNewsletterSection' && u.production) {
            u.production.newsletterSection = value;
          }
          return u;
        });
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      let streamErr: string | null = null;

      while (true) {
        const { value, done: rdDone } = await reader.read();
        if (rdDone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          const isErrEvent = part.includes('event: error');
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (isErrEvent && evt.error) streamErr = evt.error;
            else if (typeof evt.delta === 'string') { acc += evt.delta; applyLiveText(acc); }
            else if (evt.done && typeof evt.regeneratedText === 'string') acc = evt.regeneratedText;
          } catch { /* ignorér ukomplette/uventede linjer */ }
        }
      }

      if (streamErr) throw new Error(streamErr);
      const finalText = (acc || currentText).trim();

      setRefinementHistory(prev => [...prev, { key: sectionKey, original: currentText }]);
      setRevisions(prev => {
        const list = [...(prev[sectionKey] || [])];
        if (list.length === 0) list.push(currentText);
        if (list[list.length - 1] !== finalText) list.push(finalText);
        return { ...prev, [sectionKey]: list };
      });
      setActiveCompareIndex(prev => ({ ...prev, [sectionKey]: null }));
      applyLiveText(finalText);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Kunne ikke regenerere sektionen.');
    } finally {
      setRegeneratingKey(null);
    }
  };

  const handleGenerateAll = async () => {
    if (!brief.client || !brief.project || !brief.description) {
      setErrorMsg("Udfyld venligst mindst Kunde, Projekt og Hvad lavede vi for at køre Neura Studio.");
      return;
    }
    if (deepMode) {
      return handleGenerateDeep();
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setRefinementHistory([]);
    setDeepCritique(null);

    const steps = [
      "Analyserer projekt-brief...",
      "Udtrækker nøgleleverancer...",
      "Udelukker generiske marketing-floskler...",
      "Bygger kort og lang case-tekst...",
      "Skriver professionelt LinkedIn opslag...",
      "Formulerer fængende Mailchimp subject lines...",
      "Designer målrettede AI-billedprompts...",
      "Sammensætter tekniske produktionsforslag...",
      "Færdiggør den engelske oversættelse..."
    ];

    let currentStep = 0;
    setGenerationStep(steps[0]);
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) setGenerationStep(steps[currentStep]);
    }, 800);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, chosenIdea: selectedTerritory })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }
      const raw = await response.json();
      const { _usage, ...outputData } = raw as any;
      if (_usage) setLastUsage(_usage);
      const data = outputData as BrandSurfaceOutput;

      const mergedData: BrandSurfaceOutput = output
        ? applyLockedSections(data, lockedSections, output)
        : data;

      setOutput(mergedData);
      setHistory(prev => pushHistory(prev, brief, mergedData));
      if (mergedData) {
        setRevisions({
          shortCaseText: [mergedData.shortCaseText],
          longCaseText: [mergedData.longCaseText],
          linkedinPost: [mergedData.linkedinPost],
          creativeNewsletterSection: mergedData.production?.newsletterSection ? [mergedData.production.newsletterSection] : []
        });
        setActiveCompareIndex({ shortCaseText: null, longCaseText: null, linkedinPost: null, creativeNewsletterSection: null });
      }
      setActiveTab('case');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Der skete en fejl under AI-genereringen.');
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
    }
  };

  const handleGenerateDeep = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setRefinementHistory([]);
    setDeepCritique(null);
    setGenerationStep('Starter redaktionsmøde …');

    try {
      const response = await fetch('/api/generate-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, chosenIdea: selectedTerritory })
      });
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErr: string | null = null;
      let finalEvt: any = null;

      while (true) {
        const { value, done: rdDone } = await reader.read();
        if (rdDone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          const isErrEvent = part.includes('event: error');
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (isErrEvent && evt.error) streamErr = evt.error;
            else if (evt.done && evt.output) finalEvt = evt;
            else if (evt.phase && typeof evt.label === 'string') setGenerationStep(evt.label);
          } catch { /* ignorér ukomplette/uventede linjer */ }
        }
      }

      if (streamErr) throw new Error(streamErr);
      if (!finalEvt || !finalEvt.output) throw new Error('Redaktionsmødet returnerede intet resultat.');

      const data: BrandSurfaceOutput = finalEvt.output;
      const draft: BrandSurfaceOutput = finalEvt.draft || data;

      const mergedData: BrandSurfaceOutput = output
        ? applyLockedSections(data, lockedSections, output)
        : data;

      setOutput(mergedData);
      setHistory(prev => pushHistory(prev, brief, mergedData));

      const seed = (a?: string, b?: string): string[] =>
        a && b && a !== b ? [a, b] : b ? [b] : a ? [a] : [];
      setRevisions({
        shortCaseText: seed(draft.shortCaseText, mergedData.shortCaseText),
        longCaseText: seed(draft.longCaseText, mergedData.longCaseText),
        linkedinPost: seed(draft.linkedinPost, mergedData.linkedinPost),
        creativeNewsletterSection: mergedData.production?.newsletterSection ? [mergedData.production.newsletterSection] : []
      });
      setActiveCompareIndex({ shortCaseText: null, longCaseText: null, linkedinPost: null, creativeNewsletterSection: null });

      if (finalEvt.critiqueBefore) {
        setDeepCritique({
          before: finalEvt.critiqueBefore,
          after: finalEvt.critiqueAfter ?? null,
          earlyStopped: !!finalEvt.earlyStopped,
          synthesisTruncated: !!finalEvt.synthesisTruncated
        });
      }
      setActiveTab('case');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Der skete en fejl under redaktionsmødet.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVisualDevelop = async () => {
    setIsVisualDeveloping(true);
    setErrorMsg(null);
    setVisualResult(null);
    setGenerationStep('Starter visuel udvikling …');

    try {
      const response = await fetch('/api/visual-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief })
      });
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErr: string | null = null;
      let finalEvt: any = null;

      while (true) {
        const { value, done: rdDone } = await reader.read();
        if (rdDone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          const isErrEvent = part.includes('event: error');
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (isErrEvent && evt.error) streamErr = evt.error;
            else if (evt.done && evt.output) finalEvt = evt;
            else if (evt.phase && typeof evt.label === 'string') setGenerationStep(evt.label);
          } catch { /* ignorér ukomplette linjer */ }
        }
      }

      if (streamErr) throw new Error(streamErr);
      if (!finalEvt || !finalEvt.output) throw new Error('Den visuelle redaktion returnerede intet resultat.');

      setVisualResult({
        concept: finalEvt.output,
        critiqueBefore: finalEvt.critiqueBefore,
        critiqueAfter: finalEvt.critiqueAfter ?? null,
        earlyStopped: !!finalEvt.earlyStopped,
        synthesisTruncated: !!finalEvt.synthesisTruncated
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Der skete en fejl under den visuelle udvikling.');
    } finally {
      setIsVisualDeveloping(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!output) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: {
            shortCaseText: output.shortCaseText,
            longCaseText: output.longCaseText,
            linkedinPost: output.linkedinPost
          },
          brief
        })
      });
      if (!response.ok) throw new Error(httpErrorMessage(response.status));
      const analysisData = await response.json();
      setOutput(prev => prev ? { ...prev, toneAnalysis: analysisData } : null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Kunne ikke gennemføre toneanalysen.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBrainstorm = async () => {
    if (!brief.client || !brief.project || !brief.description) {
      setErrorMsg("Udfyld venligst mindst Kunde, Projekt og Hvad lavede vi for at køre Brainstorm.");
      return;
    }
    setIsBrainstorming(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }
      const data = await response.json();
      setBrainstormResult(data as BrainstormResult);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Kunne ikke gennemføre brainstorm.');
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleRefine = async (command: string, targetKey: string) => {
    if (!output) return;

    let textToRefine = "";
    let isEnglishObj = false;
    let isProductionObj = false;

    if (targetKey === 'shortCaseText') textToRefine = output.shortCaseText;
    else if (targetKey === 'longCaseText') textToRefine = output.longCaseText;
    else if (targetKey === 'linkedinPost') textToRefine = output.linkedinPost;
    else if (targetKey === 'englishShortCaseText') { textToRefine = output.english?.shortCaseText || ""; isEnglishObj = true; }
    else if (targetKey === 'englishLongCaseText') { textToRefine = output.english?.longCaseText || ""; isEnglishObj = true; }
    else if (targetKey === 'englishLinkedinPost') { textToRefine = output.english?.linkedinPost || ""; isEnglishObj = true; }
    else if (targetKey === 'creativeHeroVisual') { textToRefine = output.production?.heroVisual || ""; isProductionObj = true; }
    else if (targetKey === 'creativeSomeFormat') { textToRefine = output.production?.someFormat || ""; isProductionObj = true; }
    else if (targetKey === 'creativeNewsletterSection') { textToRefine = output.production?.newsletterSection || ""; isProductionObj = true; }

    if (!textToRefine) {
      setErrorMsg("Kunne ikke finde tekst at raffinere for denne sektion.");
      return;
    }

    setIsRefining(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRefine, command, brief })
      });
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }

      const applyLiveText = (value: string) => {
        setOutput(prev => {
          if (!prev) return null;
          const u: BrandSurfaceOutput = {
            ...prev,
            english: prev.english ? { ...prev.english } : prev.english,
            production: prev.production ? { ...prev.production } : prev.production,
            directUsable: prev.directUsable ? { ...prev.directUsable } : prev.directUsable,
          };
          if (targetKey === 'shortCaseText') u.shortCaseText = value;
          else if (targetKey === 'longCaseText') u.longCaseText = value;
          else if (targetKey === 'linkedinPost') u.linkedinPost = value;
          else if (isEnglishObj && u.english) {
            if (targetKey === 'englishShortCaseText') u.english.shortCaseText = value;
            if (targetKey === 'englishLongCaseText') u.english.longCaseText = value;
            if (targetKey === 'englishLinkedinPost') u.english.linkedinPost = value;
          } else if (isProductionObj && u.production) {
            if (targetKey === 'creativeHeroVisual') u.production.heroVisual = value;
            if (targetKey === 'creativeSomeFormat') u.production.someFormat = value;
            if (targetKey === 'creativeNewsletterSection') u.production.newsletterSection = value;
          }
          if (targetKey === 'shortCaseText' && u.directUsable) u.directUsable.bestShortText = value;
          return u;
        });
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      let streamErr: string | null = null;

      while (true) {
        const { value, done: rdDone } = await reader.read();
        if (rdDone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          const isErrEvent = part.includes('event: error');
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (isErrEvent && evt.error) streamErr = evt.error;
            else if (typeof evt.delta === 'string') { acc += evt.delta; applyLiveText(acc); }
            else if (evt.done && typeof evt.refinedText === 'string') acc = evt.refinedText;
          } catch { /* ignorér ukomplette/uventede linjer */ }
        }
      }

      if (streamErr) throw new Error(streamErr);
      const refinedText = (acc || textToRefine).trim();

      setRefinementHistory(prev => [...prev, { key: targetKey, original: textToRefine }]);
      setRevisions(prev => {
        const currentList = prev[targetKey] || [];
        const updatedList = [...currentList];
        if (updatedList.length === 0) updatedList.push(textToRefine);
        if (updatedList[updatedList.length - 1] !== refinedText) updatedList.push(refinedText);
        return { ...prev, [targetKey]: updatedList };
      });
      setActiveCompareIndex(prev => ({ ...prev, [targetKey]: null }));
      applyLiveText(refinedText);
      setCustomRefinementPrompt('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Der opstod en fejl under raffinering af teksten.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleUndoRefine = (targetKey: string) => {
    const historicalItem = [...refinementHistory].reverse().find(h => h.key === targetKey);
    if (!historicalItem) return;

    setOutput(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      if (targetKey === 'shortCaseText') updated.shortCaseText = historicalItem.original;
      else if (targetKey === 'longCaseText') updated.longCaseText = historicalItem.original;
      else if (targetKey === 'linkedinPost') updated.linkedinPost = historicalItem.original;
      else if (targetKey === 'englishShortCaseText' && updated.english) updated.english.shortCaseText = historicalItem.original;
      else if (targetKey === 'englishLongCaseText' && updated.english) updated.english.longCaseText = historicalItem.original;
      else if (targetKey === 'englishLinkedinPost' && updated.english) updated.english.linkedinPost = historicalItem.original;
      else if (targetKey === 'creativeHeroVisual' && updated.production) updated.production.heroVisual = historicalItem.original;
      else if (targetKey === 'creativeSomeFormat' && updated.production) updated.production.someFormat = historicalItem.original;
      else if (targetKey === 'creativeNewsletterSection' && updated.production) updated.production.newsletterSection = historicalItem.original;
      if (targetKey === 'shortCaseText' && updated.directUsable) {
        updated.directUsable.bestShortText = historicalItem.original;
      }
      return updated;
    });

    setRefinementHistory(prev => {
      const idx = prev.findIndex(h => h.key === targetKey && h.original === historicalItem.original);
      if (idx !== -1) {
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      }
      return prev;
    });
  };

  const TAB_COMMANDS: Record<string, string> = {
    '/case': 'case', '/linkedin': 'linkedin', '/newsletter': 'newsletter',
    '/headlines': 'headlines', '/keywords': 'keywords', '/prompts': 'prompts',
    '/english': 'english', '/cvi': 'cvi', '/production': 'production',
    '/produktionsforslag': 'production',
  };

  const handleExecuteTerminalCommand = (e: FormEvent) => {
    e.preventDefault();
    if (!terminalCommand.trim()) return;

    const cmd = terminalCommand.trim().toLowerCase();
    setTerminalCommand('');

    if (TAB_COMMANDS[cmd]) { setActiveTab(TAB_COMMANDS[cmd]); return; }
    if (cmd === '/run' || cmd === '/generate') { handleGenerateAll(); return; }
    handleRefine(terminalCommand, selectedTextKey);
  };

  return {
    // Brief
    brief, setBrief,
    // Navigation
    activeTab, setActiveTab,
    // Output
    output, setOutput,
    // History
    history, historyOpen, setHistoryOpen,
    // Variants
    variants, setVariants, isVariating,
    // Loading states
    isGenerating, isRefining, isAnalyzing, isHumanizing, isVisualDeveloping, isAnalyzingCvi,
    generationStep,
    // Deep mode
    deepMode, setDeepMode, deepCritique,
    // Visual
    visualResult, setVisualResult,
    // Refinement
    selectedTextKey, setSelectedTextKey,
    customRefinementPrompt, setCustomRefinementPrompt,
    terminalCommand, setTerminalCommand,
    errorMsg, setErrorMsg,
    refinementHistory,
    revisions, setRevisions,
    activeCompareIndex, setActiveCompareIndex,
    // Copy state
    copiedKey,
    // Humanizer
    externalText, setExternalText,
    humanizerResult, setHumanizerResult,
    // Brainstorm
    brainstormResult, setBrainstormResult,
    isBrainstorming,
    handleBrainstorm,
    // Kulturel antenne
    culturalIntel, isScanning, handleCulturalScan, handleClearCulturalIntel,
    // Strategi-fundament
    strategy, setStrategy,
    isGeneratingStrategy, handleGenerateStrategy, handleClearStrategy,
    // Den Store Idé / kampagne-platform
    campaignPlatform, setCampaignPlatform,
    isGeneratingCampaign, handleGenerateBigIdea,
    selectedTerritory, handleSelectTerritory, handleClearTerritory,
    // ECD pres-test af Idéen
    pressureTest, isSharpening, sharpeningTarget,
    handleSharpenIdea, handleAdoptSharpened, handleClearPressureTest,
    // Omni-channel matrix
    channelMatrix, setChannelMatrix,
    isGeneratingMatrix, handleGenerateChannelMatrix, handleClearChannelMatrix,
    // Effekt-lag
    effectiveness, isGeneratingEffectiveness,
    handleGenerateEffectiveness, handleClearEffectiveness,
    // Forstør & arkivér funnel-paneler
    expandedDoc: funnelArchive.expandedDoc,
    onExpandFunnel: funnelArchive.openDoc,
    onCloseFunnelDoc: funnelArchive.closeDoc,
    funnelSummaryFor: funnelArchive.summaryFor,
    isGeneratingFunnelSummary: funnelArchive.isGeneratingSummary,
    onGenerateFunnelSummary: funnelArchive.handleGenerateSummary,
    onArchiveFunnelDoc: funnelArchive.handleArchive,
    funnelDocCount,
    onArchiveAllFunnel: handleArchiveAllFunnel,
    // Bureau-mode
    bureauModeActive: bureau.bureauModeActive,
    setBureauModeActive: bureau.setBureauModeActive,
    bureauStages: bureau.stages,
    isBureauRunning: bureau.isRunning,
    runBureau: bureau.runBureau,
    abortBureau: bureau.abortBureau,
    pitchResult: bureau.pitchResult,
    isGeneratingPitch: bureau.isGeneratingPitch,
    handleGeneratePitch: bureau.handleGeneratePitch,
    // Code Department
    codeDeptOpen: codeDept.codeDeptOpen,
    setCodeDeptOpen: codeDept.setCodeDeptOpen,
    codeTarget: codeDept.codeTarget,
    setCodeTarget: codeDept.setCodeTarget,
    codeNotes: codeDept.codeNotes,
    setCodeNotes: codeDept.setCodeNotes,
    codePrompt: codeDept.codePrompt,
    isGeneratingCode: codeDept.isGeneratingCode,
    handleGenerateCodePrompt: codeDept.handleGenerateCodePrompt,
    abortCodePrompt: codeDept.abortCodePrompt,
    // Logo
    logoResult, setLogoResult,
    isGeneratingLogo,
    handleGenerateLogo,
    isOptimizingLogoPrompt,
    handleOptimizeLogoPrompt,
    // CVI
    cviFileName,
    // Print
    printMode,
    // Images
    generatedImages,
    isOptimizingImagePrompt,
    handleOptimizeImagePrompt,
    // Video
    videoResult, setVideoResult, handleGenerateVideo,
    // Avatar
    speechResult, avatarResult, handleGenerateSpeech, handleGenerateAvatar,
    // Theme
    theme, setTheme,
    // Presets
    customPresets,
    // Usage
    lastUsage,
    // Lås & regenerér
    lockedSections, handleToggleLock,
    regeneratingKey, handleRegenerateSection,
    // Handlers
    handleBriefChange,
    handleChannelToggle,
    handleLoadPreset,
    handleClearPresets,
    handleRestorePresets,
    handlePinCurrentBrief,
    handleCviUpload,
    handleRemoveCvi,
    handleCopyToClipboard,
    handleExportSingleSection,
    handleExportMarkdown,
    handleCopyAllMarkdown,
    handleExportHtml,
    handleExportDocx,
    handleExportDeck,
    handleResetProject,
    handleLoadHistory,
    handleClearHistory,
    handleGenerateVariants,
    handleApplyVariant,
    handleGenerateAll,
    handleVisualDevelop,
    handleTriggerAnalysis,
    handleHumanizeText,
    handleRefine,
    handleUndoRefine,
    handleGenerateImage,
    handleAspectChange,
    handleExecuteTerminalCommand,
    // Prospect Radar
    prospectCompany: prospect.company,
    setProspectCompany: prospect.setCompany,
    prospectMarket: prospect.market,
    setProspectMarket: prospect.setMarket,
    prospectSellerProfile: prospect.sellerProfile,
    setProspectSellerProfile: prospect.setSellerProfile,
    resetProspectSellerProfile: prospect.resetSellerProfile,
    prospectSynthesisModel: prospect.synthesisModel,
    setProspectSynthesisModel: prospect.setSynthesisModel,
    prospectMaxTokens: prospect.maxTokens,
    setProspectMaxTokens: prospect.setMaxTokens,
    prospectBrief: prospect.brief,
    isResearchingProspect: prospect.isResearching,
    prospectProgress: prospect.progress,
    prospectPhase: prospect.phase,
    handleProspectResearch: prospect.handleResearch,
    handleClearProspectBrief: prospect.handleClearBrief,
  };
}
