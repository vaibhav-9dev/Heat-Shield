/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
});

// Translation / Advisory endpoint using server-side Gemini API
app.post('/api/agent/translate', async (req, res) => {
  const { text, targetLang } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      translated: null,
      mode: 'template',
      message: 'Translation needs the LLM (GEMINI_API_KEY missing)',
    });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const langName = targetLang === 'kn' ? 'Kannada' : 'Hindi';

    const prompt = `Translate the following official emergency heat advisory into ${langName}.
CRITICAL CONSTRAINT: You must preserve EVERY single number in Latin Arabic digits (0-9). Do not translate numbers into regional numerals or change their values.

Advisory text:
"""
${text}
"""

Return only the translated advisory text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      translated: response.text?.trim() || null,
      mode: 'llm',
    });
  } catch (err: any) {
    console.error('Gemini translation error:', err.message);
    res.status(200).json({
      translated: null,
      mode: 'template',
      error: err.message,
    });
  }
});

// AI City Recommendations endpoint using server-side Gemini 3.8 Flash
app.post('/api/agent/recommendations', async (req, res) => {
  const {
    cityName,
    latitude,
    longitude,
    peakApparentC,
    severeCount,
    totalWards,
    scenario = 'live',
    elninoProfile,
    topWards,
    gridDemand,
    coolingSitesCount,
  } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      recommendation: null,
      mode: 'deterministic',
      message: 'GEMINI_API_KEY is not set. Using local deterministic city recommendations.',
    });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const isElNino = scenario === 'stress_plus_2c';
    const prompt = isElNino
      ? `You are the Lead Urban Heat & Disaster Management Senior Advisor for Indian Urban Local Bodies and National Disaster Management Authority (NDMA).
Generate an authoritative, highly specific, actionable Heat Action & El Niño Response Strategy tailored specifically for the city of "${cityName}" (Coordinates: ${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}).

CURRENT DIAGNOSTIC SNAPSHOT FOR ${cityName}:
- Peak Feels-Like Temperature: ${peakApparentC?.toFixed(1) || '38.0'} °C
- Severe Risk Sectors: ${severeCount || 0} of ${totalWards || 12} wards/zones
- Top High-Risk Wards/Areas: ${JSON.stringify(topWards || [])}
- Live El Niño Regional Zone: ${elninoProfile?.regionalZone || 'Continental Heat Basin'}
- El Niño Projected Anomaly Surge: +${elninoProfile?.cityProjectedSurgeC || '2.0'} °C
- Dry Spell Probability: ${elninoProfile?.drySpellProbabilityPct || 75}%
- Grid Cooling Strain Window: ${gridDemand?.stressWindow || '14:00 - 17:00'} (Peak: ${gridDemand?.peak_mw || '2850'} MW)
- Available Candidate Cooling Facilities: ${coolingSitesCount || 10} public buildings

TASK:
Provide structured, highly specific AI recommendations to solve EACH distinct problem faced by ${cityName}, with heavy focus on El Niño climate stress mitigation.
Address:
1. El Niño Compound Stress & Drought Directives (specific to ${cityName}'s climate zone, aquifer/water reserves, and projected surge).
2. Ward-Specific Tactical Solutions: Explicitly mention the top high-risk wards (${topWards?.map((w: any) => w.name).join(', ') || cityName + ' core'}) and how to mitigate their specific building density, lack of canopy, or heat retention.
3. Power Grid & Load Shifting Strategy: Concrete steps for electricity DISCOMs to prevent substation burnouts during the stress window.
4. Vulnerable Population & Outdoor Labor Protection: Mandatory work hours (e.g. 12-4 PM pause), ORS kiosks, hospital heat stroke beds.
5. Candidate Cooling Shelters Deployment: Activation of libraries, community halls, and schools for public relief.
6. Priority 24-48 Hour Action Checklist for the Municipal Commissioner.

Return ONLY a valid JSON object matching this schema:
{
  "executiveSummary": "Concise 2-sentence executive summary for the Municipal Commissioner of ${cityName}",
  "elninoSpecificDirectives": [
    {
      "title": "Directive title",
      "description": "Specific action addressing El Niño's +${elninoProfile?.cityProjectedSurgeC || '2.0'}°C surge and dry spell",
      "timeframe": "Immediate / Pre-monsoon / 72 hours",
      "impact": "Expected outcome"
    }
  ],
  "problemSolvers": [
    {
      "problem": "Name of the urban heat / grid / water / labor problem in ${cityName}",
      "solution": "Actionable micro-plan with target areas and specifications",
      "targetWardsOrSectors": ["Ward/Sector name 1", "Ward/Sector name 2"],
      "leadDepartment": "BBMP / MCD / BMC / DISCOM / Health Dept"
    }
  ],
  "priorityActions24to48h": [
    "Action item 1",
    "Action item 2",
    "Action item 3",
    "Action item 4",
    "Action item 5"
  ]
}`
      : `You are the Lead Urban Heat & Disaster Management Senior Advisor for Indian Urban Local Bodies and National Disaster Management Authority (NDMA).
Generate an authoritative, highly specific, actionable Live Heat Action Plan (HAP) & Urban Heat Island Mitigation Strategy tailored specifically for the city of "${cityName}" (Coordinates: ${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}).

CURRENT LIVE DIAGNOSTIC SNAPSHOT FOR ${cityName}:
- Current Peak Feels-Like Temperature: ${peakApparentC?.toFixed(1) || '38.0'} °C
- Severe Risk Sectors: ${severeCount || 0} of ${totalWards || 12} wards/zones
- Top High-Risk Wards/Areas: ${JSON.stringify(topWards || [])}
- Regional Climate Zone: ${elninoProfile?.regionalZone || 'Urban Basin'}
- Grid Cooling Strain Window: ${gridDemand?.stressWindow || '14:00 - 17:00'} (Peak: ${gridDemand?.peak_mw || '2850'} MW)
- Available Candidate Cooling Facilities: ${coolingSitesCount || 10} public buildings

TASK:
Provide structured, highly specific AI recommendations to solve EACH distinct problem faced by ${cityName} under current LIVE meteorological conditions and urban heat island (UHI) exposure.
Address:
1. Live Thermal Protection & Public Hydration Directives: Real-time interventions to protect citizens from current ${peakApparentC?.toFixed(1)}°C peak feels-like heat.
2. Ward-Specific Tactical Solutions: Explicitly mention the top high-risk wards (${topWards?.map((w: any) => w.name).join(', ') || cityName + ' core'}) and how to mitigate their specific building density, lack of canopy, or heat retention.
3. Power Grid & Load Shifting Strategy: Concrete steps for electricity DISCOMs to prevent substation burnouts during the peak stress window (${gridDemand?.stressWindow || '14:00 - 17:00'}).
4. Vulnerable Population & Outdoor Labor Protection: Mandatory work hours (e.g. 12-4 PM pause), ORS kiosks, hospital heat stroke beds.
5. Candidate Cooling Shelters Deployment: Immediate activation of ${coolingSitesCount || 10} libraries, community halls, and schools for public relief.
6. Priority 24-48 Hour Action Checklist for the Municipal Commissioner.

Return ONLY a valid JSON object matching this schema:
{
  "executiveSummary": "Concise 2-sentence executive summary for the Municipal Commissioner of ${cityName} regarding current live heatwave risks",
  "elninoSpecificDirectives": [
    {
      "title": "Live Heatwave Response Directive",
      "description": "Specific action addressing current heat levels and microclimate hotspots",
      "timeframe": "Immediate (0-24 Hours) / Next 48 Hours",
      "impact": "Expected outcome"
    }
  ],
  "problemSolvers": [
    {
      "problem": "Name of the urban heat / grid / water / labor problem in ${cityName}",
      "solution": "Actionable micro-plan with target areas and specifications",
      "targetWardsOrSectors": ["Ward/Sector name 1", "Ward/Sector name 2"],
      "leadDepartment": "BBMP / MCD / BMC / DISCOM / Health Dept"
    }
  ],
  "priorityActions24to48h": [
    "Action item 1",
    "Action item 2",
    "Action item 3",
    "Action item 4",
    "Action item 5"
  ]
}`;

    const callModelWithFallback = async () => {
      try {
        return await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
      } catch (e: any) {
        console.warn('Gemini 3.8 Flash spike, retrying with gemini-flash-latest:', e.message);
        return await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
      }
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timeout')), 5000)
    );

    const response: any = await Promise.race([callModelWithFallback(), timeoutPromise]);

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      recommendation: parsed,
      mode: 'llm',
    });
  } catch (err: any) {
    console.error('Gemini recommendations error/timeout:', err.message);
    res.status(200).json({
      recommendation: null,
      mode: 'deterministic',
      error: err.message,
    });
  }
});

// Main development / production server boot
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`HeatShield server listening on port ${port}`);
  });
}

startServer();
