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
