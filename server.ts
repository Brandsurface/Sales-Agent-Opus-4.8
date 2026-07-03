/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';

import { config } from './server/ai/config';
import { anthropic } from './server/ai/anthropic';
import { generateStructured } from './server/ai/structured';
import { buildCviUserContent } from './server/ai/cvi';
import {
  buildGenerate,
  buildAnalyze,
  buildHumanize,
  buildRefine,
  buildVariants,
  buildRegenerate,
  buildBrainstorm,
  buildStrategy,
  buildBigIdea,
  buildChannelMatrix,
  buildEffectiveness,
  type Territory,
  buildLogoPrompt,
  buildImagePrompt,
  buildCritique,
  buildPitch,
  buildPanelSummary,
  buildCodeDepartment,
  ANALYZE_CVI_SYSTEM_ROLE,
  cacheableSystem,
} from './server/ai/prompts';
import {
  generateTool,
  analyzeTool,
  analyzeCviTool,
  humanizeTool,
  variantsTool,
  brainstormTool,
  strategyTool,
  campaignPlatformTool,
  channelMatrixTool,
  effectivenessTool,
  logoPromptTool,
  imagePromptTool,
  critiqueTool,
  pitchTool,
  panelSummaryTool,
} from './server/ai/schemas';
import { runDeliberation } from './server/ai/deliberate';
import { runVisualDeliberation } from './server/ai/deliberateVisual';
import { runCulturalScan } from './server/ai/culturalScan';
import { runIdeaDeliberation } from './server/ai/deliberateIdea';
import { runProspectScan, EXEMPLAR_DEFAULT_SELLER, sanitizeEngineOptions } from './server/ai/prospectScan';
import { getImageProvider } from './server/image/provider';
import { generateLogoSvg } from './server/image/recraftVector';
import { generateVideo } from './server/video/kling';
import { generateSpeech } from './server/audio/tts';
import { generateAvatar } from './server/video/fabric';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const PORT = Number(process.env.PORT) || 3000;

  // API health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      model: config.model,
      imageProvider: config.imageProvider,
      time: new Date().toISOString(),
    });
  });

  // Main generator endpoint
  app.post('/api/generate', async (req, res) => {
    try {
      const { brief, chosenIdea } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }

      const { system, user } = buildGenerate(brief, chosenIdea || null);
      let usageInfo: any = null;
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: generateTool,
        maxTokens: config.maxTokens,
        onUsage: (u) => { usageInfo = u; },
      });

      // Let runtime-shape-tjek så vi fejler tydeligt frem for at sende et halvt objekt.
      if (!parsed || !parsed.shortCaseText || !parsed.longCaseText) {
        throw new Error('Ufuldstændigt output fra Claude. Prøv igen.');
      }

      res.json({ ...parsed, _usage: usageInfo });
    } catch (error: any) {
      console.error('Fejl under generering:', error);
      res.status(500).json({ error: error.message || 'Internt server fejl under generering.' });
    }
  });

  // Refine text endpoint (streaming via SSE)
  app.post('/api/refine', async (req, res) => {
    try {
      const { text, command, brief } = req.body;
      if (!text || !command) {
        return res.status(400).json({ error: 'Text og command er påkrævet.' });
      }

      const { system, user } = buildRefine(text, command, brief);

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // deaktivér proxy-buffering (Render/nginx) så SSE flyder
      res.flushHeaders?.();

      const stream = anthropic.messages.stream({
        model: config.fastModel,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      });

      let full = '';
      stream.on('text', (delta) => {
        full += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      });

      await stream.finalMessage();

      res.write(`data: ${JSON.stringify({ done: true, refinedText: full.trim() })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error('Fejl under raffinering:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Kunne ikke raffinere teksten.' });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // Deep "redaktionsmøde" generation: multi-AI deliberation loop (streaming via SSE)
  app.post('/api/generate-deep', async (req, res) => {
    const { brief, chosenIdea } = req.body;
    if (!brief) {
      return res.status(400).json({ error: 'Brief er påkrævet.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // deaktivér proxy-buffering (Render/nginx) så SSE flyder
    res.flushHeaders?.();
    res.write(': connected\n\n'); // åbn streamen straks, så proxyen ikke buffer-venter på første byte

    // Heartbeat holder forbindelsen i live. Bevidst INGEN abort på forbindelses-luk:
    // Renders proxy kan droppe en lang SSE, og en abort dér dræbte lovlige kørsler.
    // Kørslen er kort + omkostnings-bundet, så den får altid lov at gøre færdig.
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': keep-alive\n\n');
    }, 15000);

    try {
      const result = await runDeliberation({ brief, chosenIdea: chosenIdea || null }, (e) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`);
      });

      res.write(
        `data: ${JSON.stringify({
          done: true,
          output: result.output,
          draft: result.draft,
          critiqueBefore: result.critiqueBefore,
          critiqueAfter: result.critiqueAfter,
          earlyStopped: result.earlyStopped,
          synthesisTruncated: result.synthesisTruncated,
        })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      console.error('Fejl under dyb generering:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Kunne ikke gennemføre redaktionsmødet.' });
      } else if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  // Visuel redaktion: art direction-deliberation (streaming via SSE)
  app.post('/api/visual-deep', async (req, res) => {
    const { brief } = req.body;
    if (!brief) {
      return res.status(400).json({ error: 'Brief er påkrævet.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // deaktivér proxy-buffering (Render/nginx) så SSE flyder
    res.flushHeaders?.();
    res.write(': connected\n\n'); // åbn streamen straks, så proxyen ikke buffer-venter på første byte

    // Bevidst INGEN abort på forbindelses-luk (samme som /generate-deep): et blip
    // må ikke dræbe en lovlig kørsel. Kørslen er kort + omkostnings-bundet.
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': keep-alive\n\n');
    }, 15000);

    try {
      const result = await runVisualDeliberation({ brief }, (e) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`);
      });

      res.write(
        `data: ${JSON.stringify({
          done: true,
          output: result.output,
          draft: result.draft,
          critiqueBefore: result.critiqueBefore,
          critiqueAfter: result.critiqueAfter,
          earlyStopped: result.earlyStopped,
          synthesisTruncated: result.synthesisTruncated,
        })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      console.error('Fejl under visuel redaktion:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Kunne ikke gennemføre den visuelle redaktion.' });
      } else if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  // A/B variants endpoint
  app.post('/api/variants', async (req, res) => {
    try {
      const { text, count, brief } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text er påkrævet.' });
      }
      const n = Math.min(Math.max(Number(count) || 2, 2), 4);
      const { system, user } = buildVariants(text, n, brief);
      const parsed = await generateStructured<{ variants: string[] }>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: variantsTool,
        model: config.fastModel,
        maxTokens: 4096,
      });
      res.json({ variants: (parsed.variants || []).slice(0, n) });
    } catch (error: any) {
      console.error('Fejl under variant-generering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke generere varianter.' });
    }
  });

  // Analyze text endpoint (tone analysis)
  app.post('/api/analyze', async (req, res) => {
    try {
      const { texts, brief } = req.body;
      if (!texts) {
        return res.status(400).json({ error: 'Tekster er påkrævet for analyse.' });
      }

      const { system, user } = buildAnalyze(texts, brief);
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: analyzeTool,
        model: config.fastModel,
        maxTokens: 4096,
      });

      res.json(parsed);
    } catch (error: any) {
      console.error('Fejl under toneanalyse:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke udføre toneanalyse.' });
    }
  });

  // CVI / Designmanual analysis engine (multimodal)
  app.post('/api/analyze-cvi', async (req, res) => {
    try {
      const { fileType, fileContent } = req.body;
      if (!fileContent) {
        return res.status(400).json({ error: 'Filindhold (base64 eller tekst) er påkrævet.' });
      }

      const userContent = buildCviUserContent(fileContent, fileType);
      const parsed = await generateStructured<any>({
        system: cacheableSystem([ANALYZE_CVI_SYSTEM_ROLE]),
        userContent,
        tool: analyzeCviTool,
        model: config.fastModel,
        maxTokens: 4096,
      });

      res.json(parsed);
    } catch (error: any) {
      console.error('Fejl under CVI analyse:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke fuldføre scanningen af designmanualen.' });
    }
  });

  // Humanize & bypass AI detection endpoint
  app.post('/api/humanize', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Tekst er påkrævet.' });
      }

      const { system, user } = buildHumanize(text);
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: humanizeTool,
        model: config.fastModel,
        maxTokens: 4096,
      });

      res.json(parsed);
    } catch (error: any) {
      console.error('Fejl under humanisering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke fuldføre humanisering af teksten.' });
    }
  });

  // Strategi-fundament: indsigt der fodrer Den Store Idé-motor
  // Kulturel antenne: web-grounding scan af branche, konkurrenter og kulturelle øjeblikke
  app.post('/api/cultural-scan', async (req, res) => {
    try {
      const { brief } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }

      const ac = new AbortController();
      if (req.socket.destroyed) {
        ac.abort();
      } else {
        req.socket.once('close', () => ac.abort());
      }
      const signal = ac.signal;

      const result = await runCulturalScan(brief, signal);

      if (!result || !result.groundingNarrative) {
        throw new Error('Ufuldstændig scanning. Prøv igen.');
      }

      res.json(result);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(499).json({ error: 'Annulleret.' });
      }
      console.error('Fejl under kulturel scanning:', error);
      res.status(500).json({ error: error.message || 'Kulturel scanning fejlede.' });
    }
  });

  // Prospect Radar: dyb salgs-research af én målvirksomhed (streaming via SSE)
  app.post('/api/prospect-scan', async (req, res) => {
    const { company, sellerProfile, market, engineOptions } = req.body;
    if (!company || !String(company).trim()) {
      return res.status(400).json({ error: 'Firmanavn eller website er påkrævet.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': keep-alive\n\n');
    }, 15000);

    try {
      const validMarket = ['DK', 'SE', 'DE', 'NO'].includes(market) ? market : 'DK';
      const brief = await runProspectScan(
        String(company).trim(),
        sellerProfile ?? EXEMPLAR_DEFAULT_SELLER,
        validMarket,
        (e) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`); },
        undefined,
        sanitizeEngineOptions(engineOptions),
      );
      res.write(`data: ${JSON.stringify({ done: true, brief })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      console.error('Fejl under prospect-scan:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Prospect-scan fejlede.' });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.write('data: [DONE]\n\n');
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  app.post('/api/strategy', async (req, res) => {
    try {
      const { brief, culturalIntel } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }

      const { system, user } = buildStrategy(brief, culturalIntel ?? null);
      let usageInfo: any = null;
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: strategyTool,
        model: config.model,
        maxTokens: config.maxTokens,
        onUsage: (u) => { usageInfo = u; },
      });

      if (!parsed || !parsed.singleMindedProposition) {
        throw new Error('Ufuldstændigt output fra Claude. Prøv igen.');
      }

      res.json({ ...parsed, _usage: usageInfo });
    } catch (error: any) {
      console.error('Fejl under Strategi-fundament:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke bygge det strategiske fundament.' });
    }
  });

  // Den Store Idé: tre konkurrerende kampagne-platforme ud fra briefet
  app.post('/api/big-idea', async (req, res) => {
    try {
      const { brief, strategy, revisionNotes } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }

      const { system, user } = buildBigIdea(brief, strategy || null, revisionNotes || []);
      let usageInfo: any = null;
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: campaignPlatformTool,
        model: config.model,
        maxTokens: config.maxTokens,
        onUsage: (u) => { usageInfo = u; },
      });

      if (!parsed || !Array.isArray(parsed.territories) || parsed.territories.length === 0) {
        throw new Error('Ufuldstændigt output fra Claude. Prøv igen.');
      }

      res.json({ ...parsed, _usage: usageInfo });
    } catch (error: any) {
      console.error('Fejl under Den Store Idé:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke udvikle kampagne-platforme.' });
    }
  });

  // ECD pres-test: pres-test og skærp én valgt kreativ rute
  app.post('/api/sharpen-idea', async (req, res) => {
    const { brief, territory, strategy } = req.body;
    if (!brief) {
      return res.status(400).json({ error: 'Brief er påkrævet.' });
    }
    if (!territory || !territory.bigIdea) {
      return res.status(400).json({ error: 'En kreativ rute (med en stor idé) er påkrævet.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': keep-alive\n\n');
    }, 15000);

    try {
      let totalUsage: any = null;
      const result = await runIdeaDeliberation({
        brief,
        territory: territory as Territory,
        strategy: strategy || null,
        onUsage: (u) => {
          if (!totalUsage) {
            totalUsage = { ...u };
          } else {
            for (const k of Object.keys(u) as (keyof typeof u)[]) {
              totalUsage[k] = (totalUsage[k] ?? 0) + u[k];
            }
          }
        },
        onProgress: (stage) => {
          if (!res.writableEnded) res.write(`data: ${JSON.stringify({ stage })}\n\n`);
        },
      });

      res.write(`data: ${JSON.stringify({ done: true, ...result, _usage: totalUsage })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      console.error('Fejl under ECD pres-test:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Kunne ikke pres-teste ruten.' });
      } else if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  // Bureau-kritik: intern overlevering-kritik af et kreativt artefakt
  app.post('/api/critique', async (req, res) => {
    try {
      const { role, artifact, context, language } = req.body;
      if (!role || !artifact) {
        return res.status(400).json({ error: 'role og artifact er påkrævet.' });
      }

      const { system, user } = buildCritique({ role, artifact, context: context || '', language: language || 'Dansk' });
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: critiqueTool,
        model: config.creativeModel,
        maxTokens: 2048,
      });

      res.json(parsed);
    } catch (error: any) {
      console.error('Fejl under bureau-kritik:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke gennemføre bureau-kritikken.' });
    }
  });

  // Resumé af et funnel-panel: destillér indholdet til 3-5 punkter (hurtig model)
  app.post('/api/summarize', async (req, res) => {
    try {
      const { title, content } = req.body;
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: 'Indhold er påkrævet.' });
      }

      const { system, user } = buildPanelSummary(String(title || 'Dokument'), String(content));
      const parsed = await generateStructured<{ summary: string[] }>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: panelSummaryTool,
        model: config.fastModel,
        maxTokens: 1024,
      });

      res.json({ summary: parsed.summary || [] });
    } catch (error: any) {
      console.error('Fejl under resumé:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke lave resumé.' });
    }
  });

  // Pitch-afdeling: anbefalings-narrativ, talenoter og indvendingshåndtering
  app.post('/api/pitch', async (req, res) => {
    try {
      const { brief, strategy, bigIdea, channelMatrixSummary, effectivenessSummary } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }

      const { system, user } = buildPitch({
        brief,
        strategy: strategy || null,
        bigIdea: bigIdea || null,
        channelMatrixSummary: channelMatrixSummary || '',
        effectivenessSummary: effectivenessSummary || '',
      });
      let usageInfo: any = null;
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: pitchTool,
        model: config.creativeModel,
        maxTokens: 4096,
        onUsage: (u) => { usageInfo = u; },
      });

      if (!parsed || !parsed.narrative) {
        throw new Error('Ufuldstændigt pitch-output fra Claude. Prøv igen.');
      }

      res.json({ ...parsed, _usage: usageInfo });
    } catch (error: any) {
      console.error('Fejl under pitch-generering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke generere pitch-materialet.' });
    }
  });

  // Code Department: generér en prisvindende Claude Code-prompt (streaming via SSE)
  app.post('/api/code-department', async (req, res) => {
    try {
      const { brief, target, strategy, bigIdea, extraNotes } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }
      const validTargets = ['app', 'website', 'landing', 'game', 'experience'];
      if (!target || !validTargets.includes(target)) {
        return res.status(400).json({ error: 'Vælg et gyldigt byg-mål (app, website, landing, game eller experience).' });
      }

      const { system, user } = buildCodeDepartment({
        brief,
        target,
        strategy: strategy || null,
        bigIdea: bigIdea || null,
        extraNotes: extraNotes || '',
      });

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const stream = anthropic.messages.stream({
        model: config.creativeModel,
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: user }],
      });

      let full = '';
      stream.on('text', (delta) => {
        full += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      });

      const final = await stream.finalMessage();
      const usage = final.usage
        ? { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens }
        : null;

      res.write(`data: ${JSON.stringify({ done: true, codePrompt: full.trim(), _usage: usage })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error('Fejl under code-department-generering:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Kunne ikke generere Claude Code-prompten.' });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // Omni-channel matrix: skalér den valgte store idé til en eksekvering pr. kanal
  app.post('/api/channel-matrix', async (req, res) => {
    try {
      const { brief, chosenIdea, strategy } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }
      if (!chosenIdea || !chosenIdea.bigIdea) {
        return res.status(400).json({ error: 'Vælg en kampagne-platform (rute) først for at skalere den til kanaler.' });
      }

      const { system, user } = buildChannelMatrix(brief, chosenIdea, strategy || null);
      let usageInfo: any = null;
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: channelMatrixTool,
        model: config.model,
        maxTokens: config.maxTokens,
        onUsage: (u) => { usageInfo = u; },
      });

      if (!parsed || !Array.isArray(parsed.channels) || parsed.channels.length === 0) {
        throw new Error('Ufuldstændigt output fra Claude. Prøv igen.');
      }

      res.json({ ...parsed, _usage: usageInfo });
    } catch (error: any) {
      console.error('Fejl under omni-channel matrix:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke skalere idéen til kanaler.' });
    }
  });

  // Effekt-lag: mål-hierarki, KPI'er og måleplan for den valgte kampagne
  app.post('/api/effectiveness', async (req, res) => {
    try {
      const { brief, chosenIdea, strategy, channels } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }
      if (!chosenIdea || !chosenIdea.bigIdea) {
        return res.status(400).json({ error: 'Vælg en kampagne-platform (rute) først for at bygge effekt-laget.' });
      }

      const { system, user } = buildEffectiveness(brief, chosenIdea, strategy || null, channels);
      let usageInfo: any = null;
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: effectivenessTool,
        model: config.model,
        maxTokens: config.maxTokens,
        onUsage: (u) => { usageInfo = u; },
      });

      if (!parsed || !parsed.businessObjective || !Array.isArray(parsed.objectives)) {
        throw new Error('Ufuldstændigt output fra Claude. Prøv igen.');
      }

      res.json({ ...parsed, _usage: usageInfo });
    } catch (error: any) {
      console.error('Fejl under effekt-lag:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke bygge effekt-laget.' });
    }
  });

  // Brainstorm: kreativ idé-eksplosion ud fra briefet (hurtig, struktureret)
  app.post('/api/brainstorm', async (req, res) => {
    try {
      const { brief } = req.body;
      if (!brief) {
        return res.status(400).json({ error: 'Brief er påkrævet.' });
      }

      const { system, user } = buildBrainstorm(brief);
      const parsed = await generateStructured<any>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: brainstormTool,
        model: config.fastModel,
        maxTokens: 4096,
      });

      res.json(parsed);
    } catch (error: any) {
      console.error('Fejl under brainstorm:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke gennemføre brainstorm.' });
    }
  });

  // Regenerate a single output section from scratch (streaming via SSE)
  app.post('/api/regenerate-section', async (req, res) => {
    try {
      const { brief, sectionKey, currentText } = req.body;
      if (!sectionKey) {
        return res.status(400).json({ error: 'sectionKey er påkrævet.' });
      }

      const { system, user } = buildRegenerate(brief || {}, sectionKey, currentText || '');

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const stream = anthropic.messages.stream({
        model: config.fastModel,
        max_tokens: 4096,
        system: [{ type: 'text', text: system }],
        messages: [{ role: 'user', content: user }],
      });

      let full = '';
      stream.on('text', (delta) => {
        full += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      });

      await stream.finalMessage();

      res.write(`data: ${JSON.stringify({ done: true, regeneratedText: full.trim() })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error('Fejl under sektion-regenerering:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Kunne ikke regenerere sektionen.' });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // Optimér/oversæt en logo-prompt til Recraft text-to-vector via AI
  app.post('/api/logo-prompt', async (req, res) => {
    try {
      const { brief, currentPrompt, mode } = req.body;
      const safeMode = mode === 'refine' ? 'refine' : 'translate';
      if (safeMode === 'refine' && !currentPrompt?.trim()) {
        return res.status(400).json({ error: 'En eksisterende prompt er påkrævet for forfining.' });
      }

      const { system, user } = buildLogoPrompt(brief || {}, currentPrompt || '', safeMode);
      const parsed = await generateStructured<{ prompt: string }>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: logoPromptTool,
        model: config.fastModel,
        maxTokens: 1024,
      });

      res.json({ prompt: (parsed.prompt || '').trim() });
    } catch (error: any) {
      console.error('Fejl under logo-prompt optimering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke optimere logo-prompten.' });
    }
  });

  // Optimér/oversæt en billed-prompt via AI (oversæt til engelsk / forfin)
  app.post('/api/image-prompt', async (req, res) => {
    try {
      const { brief, currentPrompt, mode } = req.body;
      const safeMode = mode === 'refine' ? 'refine' : 'translate';
      if (safeMode === 'refine' && !currentPrompt?.trim()) {
        return res.status(400).json({ error: 'En eksisterende prompt er påkrævet for forfining.' });
      }

      const { system, user } = buildImagePrompt(brief || {}, currentPrompt || '', safeMode);
      const parsed = await generateStructured<{ prompt: string }>({
        system,
        userContent: [{ type: 'text', text: user }],
        tool: imagePromptTool,
        model: config.fastModel,
        maxTokens: 1024,
      });

      res.json({ prompt: (parsed.prompt || '').trim() });
    } catch (error: any) {
      console.error('Fejl under billed-prompt optimering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke optimere billed-prompten.' });
    }
  });

  // Logo generator via Recraft V4 Pro text-to-vector (SVG output)
  app.post('/api/generate-logo', async (req, res) => {
    try {
      const { prompt, style, colors } = req.body;
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'Prompt er påkrævet.' });
      }

      const result = await generateLogoSvg({
        prompt: prompt.trim(),
        style: style || undefined,
        colors: Array.isArray(colors) && colors.length > 0 ? colors : undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Fejl under logo-generering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke generere logo.' });
    }
  });

  // Generate image from prompt via the configured image provider (default: Flux/fal.ai)
  app.post('/api/generate-image', async (req, res) => {
    try {
      const { prompt, aspectRatio, model } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt er påkrævet.' });
      }
      const allowed = ['flux', 'nano-banana-pro', 'gpt-image-2'];
      const safeModel = allowed.includes(model) ? model : 'flux';

      const { imageUrl } = await getImageProvider().generate({
        prompt,
        aspectRatio: aspectRatio || '16:9',
        model: safeModel,
      });

      res.json({ imageUrl });
    } catch (error: any) {
      console.error('Fejl under billedgenerering:', error);
      res
        .status(500)
        .json({ error: error.message || 'Kunne ikke generere billede. Kontroller din API konfiguration.' });
    }
  });

  // Video-generering via Kling image-to-video (fal.ai)
  app.post('/api/generate-video', async (req, res) => {
    try {
      const { imageUrl, prompt, negativePrompt, duration, cfgScale, tailImageUrl } = req.body;
      if (!prompt || !imageUrl) {
        return res.status(400).json({ error: 'Både prompt og et inputbillede er påkrævet.' });
      }
      const safeDuration = duration === '10' ? '10' : '5';
      const safeCfgScale = Math.min(1, Math.max(0, Number(cfgScale)) || 0.5);
      const { videoUrl } = await generateVideo({ imageUrl, prompt, negativePrompt, duration: safeDuration, cfgScale: safeCfgScale, tailImageUrl });
      res.json({ videoUrl });
    } catch (error: any) {
      console.error('Fejl under video-generering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke generere video. Kontroller din API konfiguration.' });
    }
  });

  // Tale-generering via Gemini TTS (fal.ai)
  app.post('/api/generate-speech', async (req, res) => {
    try {
      const { prompt, voice, styleInstructions, temperature } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Tekst (prompt) er påkrævet.' });
      }
      const { audioUrl } = await generateSpeech({ prompt, voice, styleInstructions, temperature });
      res.json({ audioUrl });
    } catch (error: any) {
      console.error('Fejl under tale-generering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke generere tale. Kontroller din API konfiguration.' });
    }
  });

  // Avatar-generering (talking-head) via VEED Fabric (fal.ai)
  app.post('/api/generate-avatar', async (req, res) => {
    try {
      const { imageUrl, audioUrl, resolution } = req.body;
      if (!imageUrl || !audioUrl) {
        return res.status(400).json({ error: 'Både et billede og en lyd er påkrævet.' });
      }
      const { videoUrl } = await generateAvatar({ imageUrl, audioUrl, resolution });
      res.json({ videoUrl });
    } catch (error: any) {
      console.error('Fejl under avatar-generering:', error);
      res.status(500).json({ error: error.message || 'Kunne ikke generere avatar. Kontroller din API konfiguration.' });
    }
  });

  // Serve static assets
  if (process.env.NODE_ENV !== 'production') {
    // Vite indlæses kun i udvikling (holdes helt ude af produktions-bundtet).
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server lytter på port ${PORT}`);
  });
  // SSE-endpoints holder forbindelsen i live via heartbeats. Ikke-streaming endpoints
  // bør aldrig tage mere end ~120 sek; 240 sek er et konservativt safety net.
  httpServer.setTimeout(240_000);
}

startServer();
