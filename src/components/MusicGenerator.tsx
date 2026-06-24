import React, { useState } from 'react';
import { Loader2, Music, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function MusicGenerator() {
  const [prompt, setPrompt] = useState('Generate a 30-second cinematic orchestral track.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string>('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setLyrics('');
    
    try {
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let audioBase64 = '';
      let mimeType = 'audio/wav';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunkStr = decoder.decode(value, { stream: true });
        // The server sends newline-separated JSON objects
        const lines = chunkStr.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
           try {
              const data = JSON.parse(line);
              if (data.type === 'audio') {
                 audioBase64 += data.data;
                 mimeType = data.mimeType;
              } else if (data.type === 'lyrics') {
                 setLyrics(data.text);
              }
           } catch (e) {
              console.error('Failed to parse chunk line', line);
           }
        }
      }

      if (!audioBase64) throw new Error('No audio was generated');

      // Decode base64 to Blob
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      setAudioUrl(URL.createObjectURL(blob));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Music className="text-[#ffd105]" size={24} />
        <h3 className="text-xl font-medium">Music Generation</h3>
      </div>
      
      <form onSubmit={handleGenerate} className="flex gap-4 mb-6">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a track..."
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 focus:outline-none focus:border-[#ffd105]"
        />
        <button
          type="submit"
          disabled={loading || !prompt}
          className="px-6 py-3 bg-[#ffd105] text-black font-medium rounded-lg hover:bg-[#ffcf00]/90 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : 'Generate'}
        </button>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {audioUrl && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg p-6 border border-neutral-800 bg-neutral-950 flex flex-col gap-4">
          <audio src={audioUrl} controls className="w-full" />
          {lyrics && (
            <div className="mt-4 p-4 bg-neutral-900 rounded-lg">
              <h4 className="text-sm text-neutral-400 font-medium mb-2 uppercase tracking-wider">Lyrics</h4>
              <p className="whitespace-pre-wrap text-sm">{lyrics}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
