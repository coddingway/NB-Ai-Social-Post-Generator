import React, { useState } from 'react';
import { Loader2, Film, AlertCircle, PlayCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState('A neon hologram of a cat driving at top speed');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const pollVideoStatus = async (operationName: string) => {
    try {
      const res = await fetch('/api/video-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to check status');

      if (data.done) {
        setStatus('Downloading video...');
        // Start download
        const downloadRes = await fetch('/api/video-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName }),
        });
        if (!downloadRes.ok) throw new Error('Failed to download video');
        
        const blob = await downloadRes.blob();
        setVideoUrl(URL.createObjectURL(blob));
        setLoading(false);
      } else {
        // Continue polling
        setTimeout(() => pollVideoStatus(operationName), 10000);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setStatus('Starting generation (this may take a few minutes)...');
    
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate video');
      
      setStatus('Generating video... this takes several minutes. Feel free to wait.');
      pollVideoStatus(data.operationName);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Film className="text-[#ffd105]" size={24} />
        <h3 className="text-xl font-medium">Video Generation</h3>
      </div>
      
      <form onSubmit={handleGenerate} className="flex gap-4 mb-6">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a video..."
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

      {loading && status && (
         <div className="mb-6 flex items-center gap-3 text-neutral-400">
           <Loader2 size={16} className="animate-spin text-[#ffd105]" />
           <p className="text-sm">{status}</p>
         </div>
      )}

      {videoUrl && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 aspect-video relative">
          <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
        </motion.div>
      )}
    </div>
  );
}
