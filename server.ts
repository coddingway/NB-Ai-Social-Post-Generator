import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' })); // Increase limit for potential image uploads

const ai = new GoogleGenAI({ apiKey: process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY });

// 1. Text to Social Media
app.post('/api/generate', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!url.startsWith('https://www.netbramha.com/work/')) {
     return res.status(400).json({ error: 'Please enter a valid NetBramha work page URL (e.g. https://www.netbramha.com/work/tira-design-case-study)' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
       throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    
    $('script, style, noscript, iframe, img, svg, video, header, footer, nav').remove();
    const mainContent = $('main').text() || $('body').text();
    const cleanText = mainContent.replace(/\s+/g, ' ').trim();
    const truncatedText = cleanText.substring(0, 15000);

    const prompt = `You are an expert social media manager and copywriter for a top-tier UI/UX design agency, NetBramha Studios. 
I am going to give you the extracted text from one of our design case study pages.
I want you to generate 4 different formats of content based on this case study, as well as highly detailed image/video generation prompts. The visuals should align with NetBramha's brand (modern, sleek UI/UX, tech-forward, yellow/black/white accents).

1. Behance Case Study:
- copy: A detailed, visually descriptive structure (Intro, Challenge, Approach, Solution, Impact).
- imagePrompt: A prompt for an ultra-high-quality hero shot image representing this project.

2. Instagram Carousel (6-7 slides):
- copy: A punchy, visual-first caption with hashtags.
- imagePrompts: An array of exactly 6 to 7 image generation prompts, one for each carousel slide, depicting the project's story visually.

3. LinkedIn Post:
- copy: A professional, insightful post aimed at industry professionals and founders.
- imagePrompt: A prompt for an engaging, professional cover image or sleek device mockup visual.

4. Reel Script:
- script: A short 30-45 second video script with visual cues and voiceover.
- videoPrompt: A prompt for a dynamic 5-second cinematic B-roll video opening hook for this reel.

Here is the extracted text from the case study:
"""
${truncatedText}
"""`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
         responseMimeType: 'application/json',
         responseSchema: {
           type: 'OBJECT',
           properties: {
             behance: {
               type: 'OBJECT',
               properties: { copy: { type: 'STRING' }, imagePrompt: { type: 'STRING' } },
               required: ['copy', 'imagePrompt']
             },
             instagram: {
               type: 'OBJECT',
               properties: {
                 copy: { type: 'STRING' },
                 imagePrompts: { type: 'ARRAY', items: { type: 'STRING' } }
               },
               required: ['copy', 'imagePrompts']
             },
             linkedin: {
               type: 'OBJECT',
               properties: { copy: { type: 'STRING' }, imagePrompt: { type: 'STRING' } },
               required: ['copy', 'imagePrompt']
             },
             reel: {
               type: 'OBJECT',
               properties: { script: { type: 'STRING' }, videoPrompt: { type: 'STRING' } },
               required: ['script', 'videoPrompt']
             }
           },
           required: ['behance', 'instagram', 'linkedin', 'reel']
         }
      }
    });

    let generatedText = result.text;
    
    if (!generatedText) throw new Error("Failed to generate content from Gemini");

    if (generatedText.startsWith('```json')) {
      generatedText = generatedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (generatedText.startsWith('```')) {
      generatedText = generatedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    res.json(JSON.parse(generatedText));
  } catch (error: any) {
    console.error('Error generating content:', error);
    
    // Handle specific rate limit / billing errors
    const errorMessage = error.message || '';
    if (errorMessage.includes('429') || error.status === 429) {
      return res.status(429).json({ error: 'API quota exceeded or credits depleted. Please check your Gemini API billing/quota.' });
    }
    
    res.status(500).json({ error: error.message || 'An error occurred during generation' });
  }
});

// 2. Generate Image
app.post('/api/generate-image', async (req, res) => {
  const { prompt, base64Image } = req.body;
  
  try {
    let input: any = prompt;
    
    if (base64Image) {
        // Edit mode
        input = [
            {
                type: "image",
                data: base64Image.split(',')[1] || base64Image, // remove data:image/...;base64, if present
                mime_type: "image/png",
            },
            {
                type: "text",
                text: prompt,
            }
        ];
    }
    
    const interaction = await ai.interactions.create({
      model: 'gemini-3.1-flash-image-preview', // The user specifically requested this model alias
      input,
      response_modalities: ['image', 'text'],
      generation_config: {
        image_config: {
          aspect_ratio: "16:9",
          image_size: "1K"
        },
      },
    });

    let imageUrl = '';
    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const imageContent = step.content?.find(c => c.type === 'image');
        if (imageContent && imageContent.data) {
          const base64EncodeString = imageContent.data;
          const mimeType = imageContent.mime_type || 'image/png';
          imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
        }
      }
    }
    
    if (!imageUrl) throw new Error('No image was generated');
    res.json({ imageUrl });
  } catch (error: any) {
    console.error('Error generating image:', error);
    
    // Check if it's a rate limit error
    const errorMessage = error.message || '';
    if (errorMessage.includes('429') || error.status === 429) {
       return res.status(429).json({ error: 'Rate limit or quota exceeded. Please check your API quota or try again in a few minutes.' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate Video
app.post('/api/generate-video', async (req, res) => {
  const { prompt } = req.body;
  try {
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview', // User explicitly asked for this model alias
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: '16:9'
      }
    });
    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error('Error starting video generation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/video-status', async (req, res) => {
  const { operationName } = req.body;
  try {
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    res.json({ done: updated.done });
  } catch (error: any) {
    console.error('Error checking video status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/video-download', async (req, res) => {
  const { operationName } = req.body;
  try {
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) throw new Error('Video URI not found');

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY as string },
    });
    res.setHeader('Content-Type', 'video/mp4');
    videoRes.body!.pipeTo(
      new WritableStream({
        write(chunk) { res.write(chunk); },
        close() { res.end(); },
      })
    );
  } catch (error: any) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Generate Music (Lyria)
app.post('/api/generate-music', async (req, res) => {
  const { prompt } = req.body;
  try {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    const response = await ai.models.generateContentStream({
      model: "lyria-3-clip-preview", 
      contents: prompt,
    });

    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      
      for (const part of parts) {
        if (part.inlineData?.data) {
           res.write(JSON.stringify({
              type: 'audio',
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || mimeType
           }) + '\n');
        }
        if (part.text) {
           res.write(JSON.stringify({
              type: 'lyrics',
              text: part.text
           }) + '\n');
        }
      }
    }
    res.end();
  } catch (error: any) {
    console.error('Error generating music:', error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
