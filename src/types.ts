/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CviManual {
  brandColors: string[];
  fonts: {
    primaryHeadings: string;
    bodyText: string;
    description: string;
  };
  imageStyleGuidelines: string;
  graphicElementsRules: string;
  generalBrandIdentitySummary: string;
  logoUsageRules: string;
}

export interface ProjectBrief {
  client: string;
  project: string;
  description: string;
  details: string;
  audience: string;
  tone: string;
  language: string;
  channels: string[];
  notes: string;
  /** Strategisk intake — forretningsmål & KPI (fx "+5% salg, +10pp kendskab"). */
  businessGoal?: string;
  /** Navngivne konkurrenter, så scanning/strategi kan undgå deres positioner. */
  competitors?: string;
  /** Mandatories: ting der SKAL med, eller absolut ikke må bruges. */
  mandatories?: string;
  /** Budget-ramme, så kanal-valg og produktion kalibreres til virkeligheden. */
  budget?: string;
  cviManual?: CviManual | null;
}

export interface DirectUsable {
  bestHeadline: string;
  bestShortText: string;
  bestCta: string;
  bestLinkedinStart: string;
}

export interface ImagePrompts {
  hero: string;
  detail: string;
  abstract: string;
}

export interface ProductionSuggestions {
  missingImages: string[];
  suggestedFormats: string[];
  heroVisual: string;
  someFormat: string;
  newsletterSection: string;
  cta: string;
}

export interface EnglishVersion {
  shortCaseText: string;
  longCaseText: string;
  linkedinPost: string;
  headlines: string[];
}

export interface RuleEvaluation {
  ruleName: string;
  status: 'passed' | 'warning' | 'failed';
  score: number;
  feedback: string;
}

export interface BrandColorDetail {
  hex: string;
  name: string;
  useCase: string;
}

export interface CviSuggestion {
  brandColors: BrandColorDetail[];
  fonts: {
    primaryHeadings: string;
    bodyText: string;
    description: string;
  };
  imageStyleGuidelines: string;
  graphicElementsRules: string;
  generalBrandIdentitySummary: string;
  logoUsageRules: string;
  visualIdentityConcept: string;
}

export interface ToneAnalysis {
  clichesFound: string[];
  clicheScore: number;
  concretenessScore: number;
  humanScore: number;
  evaluations: RuleEvaluation[];
  overallReview: string;
}

export interface BrandSurfaceOutput {
  shortCaseText: string;
  longCaseText: string;
  linkedinPost: string;
  headlines: string[];
  keywords: string[];
  cta: string[];
  english: EnglishVersion;
  imagePrompts: ImagePrompts;
  mailchimpSubjects: string[];
  productionProposed: boolean;
  production: ProductionSuggestions | null;
  directUsable: DirectUsable;
  toneAnalysis?: ToneAnalysis;
  cviSuggestion?: CviSuggestion | null;
}

export interface PresetBrief {
  name: string;
  brief: ProjectBrief;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface CampaignChannelExpression {
  channel: string;
  idea: string;
}

export interface CampaignTerritory {
  name: string;
  bigIdea: string;
  tagline: string;
  manifesto: string;
  strategicRoot: string;
  channelExpressions: CampaignChannelExpression[];
  toneDescriptor: string;
  rationale: string;
}

export interface CampaignPlatform {
  territories: CampaignTerritory[];
}

export interface StrategySpringboard {
  title: string;
  insight: string;
}

export interface StrategyFoundation {
  audienceTruth: string;
  tension: string;
  competitiveContext: string;
  singleMindedProposition: string;
  reasonsToBelieve: string[];
  desiredResponse: string;
  springboards: StrategySpringboard[];
  strategicSummary: string;
}

// ---------------------------------------------------------------------------
// Kulturel efterretning (Kulturel antenne)
// ---------------------------------------------------------------------------

export interface CulturalTrend {
  trend: string;
  relevance: string;
  actionableAngle: string;
}

export interface CompetitorSignal {
  brand: string;
  signal: string;
  takeaway: string;
}

export interface CulturalMoment {
  moment: string;
  opportunity: string;
}

export interface CulturalScanResult {
  trends: CulturalTrend[];
  competitorSignals: CompetitorSignal[];
  culturalMoments: CulturalMoment[];
  timingContext: string;
  openingQuestion: string;
  groundingNarrative: string;
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// ECD pres-test af Idéen
// ---------------------------------------------------------------------------

export interface TerritoryCritique {
  distinctivenessScore: number;
  truthScore: number;
  elasticityScore: number;
  memorabilityScore: number;
  weaknesses: string[];
  provocations: string[];
  killCriterion: string;
  verdict: string;
}

export interface SharpenedTerritory {
  name: string;
  bigIdea: string;
  tagline: string;
  manifesto: string;
  strategicRoot: string;
  channelExpressions: CampaignChannelExpression[];
  toneDescriptor: string;
  rationale: string;
  whatChanged: string[];
}

export interface IdeaDeliberationResult {
  critiqueBefore: TerritoryCritique;
  sharpened?: SharpenedTerritory;
  critiqueAfter?: TerritoryCritique;
  earlyStopped: boolean;
}

// ---------------------------------------------------------------------------
// Effekt-lag (KPI/måling)
// ---------------------------------------------------------------------------

export interface EffectivenessObjective {
  level: string;
  objective: string;
  kpi: string;
  target: string;
  benchmark: string;
  measurementMethod: string;
}

export interface ChannelKpi {
  channel: string;
  primaryMetric: string;
  target: string;
  measurementTool: string;
}

export interface EffectivenessBalance {
  shortTermActivation: string;
  longTermBrand: string;
  recommendedSplit: string;
}

export interface EffectivenessFramework {
  businessObjective: string;
  objectives: EffectivenessObjective[];
  channelKpis: ChannelKpi[];
  balance: EffectivenessBalance;
  leadingIndicators: string[];
  laggingIndicators: string[];
  successScenario: string;
  risks: string[];
  measurementCadence: string;
}

export interface ChannelScriptBlock {
  label: string;
  content: string;
}

export interface ChannelAsset {
  channel: string;
  format: string;
  headline: string;
  keyMessage: string;
  script: ChannelScriptBlock[];
  productionNotes: string;
  cta: string;
}

export interface ChannelMatrix {
  channels: ChannelAsset[];
}

export interface LogoResult {
  imageUrl: string;
  contentType: string;
  /** Rå SVG-markup fra serveren — bruges til robust inline-rendering. */
  svg?: string;
  prompt: string;
  style: string;
}

export interface BrainstormAngle {
  title: string;
  headline: string;
  linkedinHook: string;
  reasoning: string;
}

export interface BrainstormResult {
  projectCore: string;
  angles: BrainstormAngle[];
  keyDifferentiators: string[];
  audienceInsights: string[];
  boldQuestion: string;
  briefGaps: string[];
}

export interface HumanizerResult {
  originalAiScore: number;
  clichesDetected: string[];
  humanizedText: string;
  humanizedAiScore: number;
  improvements: string[];
}

// --- Visuel redaktion (art direction-deliberation) ---------------------------

export interface VisualConcept {
  visualConcept: string;
  imagePrompts: ImagePrompts;
  moodKeywords: string[];
}

export interface VisualCritique {
  onBrandScore: number;
  specificityScore: number;
  originalityScore: number;
  weaknesses: string[];
  overallReview: string;
}

export interface VisualDevResult {
  concept: VisualConcept;
  critiqueBefore: VisualCritique;
  critiqueAfter?: VisualCritique | null;
  earlyStopped?: boolean;
  synthesisTruncated?: boolean;
}

// ---------------------------------------------------------------------------
// Bureau-mode typer
// ---------------------------------------------------------------------------

export interface CritiqueResult {
  verdict: 'approved' | 'revise';
  rationale: string;
  revisionNotes: string[];
}

export type BureauStageStatus =
  | 'idle'
  | 'working'
  | 'critiquing'
  | 'revising'
  | 'done'
  | 'error'
  | 'skipped';

export interface BureauStageState {
  id: string;
  role: string;
  title: string;
  status: BureauStageStatus;
  streamText: string;
  error?: string;
  critiqueVerdict?: 'approved' | 'revise';
}

export interface PitchSlideNote {
  slide: string;
  note: string;
  rhetoricalPurpose: string;
}

export interface PitchObjection {
  question: string;
  answer: string;
}

export interface PitchResult {
  narrative: string;
  slideNotes: PitchSlideNote[];
  objections: PitchObjection[];
}


export type CodeDepartmentTarget = 'app' | 'website' | 'landing' | 'game' | 'experience';

// ---------------------------------------------------------------------------
// Prospect Radar (salgs-research)
// ---------------------------------------------------------------------------

export interface SellerProfile {
  company: string;
  offering: string;
  packagingTypes: string[];
  valueMoments: string[];
  triggers: string[];
  idealCustomerHints: string;
}

export interface ProspectSignal {
  signal: string;
  timeframe: string;
  sourceUrl: string;
  whyItMatters: string;
}

export interface ProspectGap {
  gap: string;
  evidence: string;
  sellerAngle: string;
  valueForThem: string;
}

export interface DecisionMaker {
  role: string;
  name?: string;
  rationale: string;
}

export interface ProspectCompetitor {
  name: string;
  packagingNote: string;
}

export interface CallAngle {
  angle: string;
  openingLine: string;
  rationale: string;
}

export interface ProspectObjection {
  objection: string;
  response: string;
}

export interface ProspectConfidence {
  level: 'høj' | 'middel' | 'lav';
  note: string;
}

export interface ProspectCompany {
  name: string;
  website: string;
  category: string;
  whatTheyDo: string;
  sizeSignal: string;
  keyProducts: string[];
  packagingContext: string;
}

export type ProspectMarket = 'DK' | 'SE' | 'DE' | 'NO';

export interface ProspectBrief {
  company: ProspectCompany;
  signals: ProspectSignal[];
  gaps: ProspectGap[];
  reasonToCall: string;
  openingLine: string;
  whyNow: string;
  callAngles: CallAngle[];
  objections: ProspectObjection[];
  talkingPoints: string[];
  smartQuestions: string[];
  decisionMakers: DecisionMaker[];
  competitors: ProspectCompetitor[];
  sources: string[];
  confidence: ProspectConfidence;
  researchedAt: string;
  market: ProspectMarket;
}

export interface ProspectEngineOptions {
  synthesisModel?: string;
  maxTokens?: number;
}
