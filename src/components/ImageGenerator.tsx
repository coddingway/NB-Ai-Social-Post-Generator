import React, { useState } from 'react';
import { Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('A neon hologram of a cat driving at top speed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate image');
      setImageUrl(data.imageUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <ImageIcon className="text-[#ffd105]" size={24} />
        <h3 className="text-xl font-medium">Image Generation</h3>
      </div>
      
      <form onSubmit={handleGenerate} className="flex gap-4 mb-6">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe an image..."
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

      {imageUrl && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
          <img src={imageUrl} alt={prompt} className="w-full h-auto object-cover" />
        </motion.div>
      )}
    </div>
  );
}
