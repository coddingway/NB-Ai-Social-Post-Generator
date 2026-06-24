import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Link as LinkIcon, Instagram, Linkedin, Video, Palette, Copy, CheckCircle2, AlertCircle, FileText, ImageIcon, Film, Music, Wand2 } from 'lucide-react';
import ImageGenerator from './components/ImageGenerator';
import VideoGenerator from './components/VideoGenerator';
import MusicGenerator from './components/MusicGenerator';

type Format = 'behance' | 'instagram' | 'linkedin' | 'reel';
type AppMode = 'social' | 'image' | 'video' | 'music';

interface GeneratedContent {
  behance: { copy: string; imagePrompt: string };
  instagram: { copy: string; imagePrompts: string[] };
  linkedin: { copy: string; imagePrompt: string };
  reel: { script: string; videoPrompt: string };
}

interface MediaState {
  loading: boolean;
  status?: string;
  error?: string;
  urls?: string[];
  videoUrl?: string;
}

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('social');
  const [url, setUrl] = useState('https://www.netbramha.com/work/tira-design-case-study');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [activeTab, setActiveTab] = useState<Format>('linkedin');
  const [copiedTab, setCopiedTab] = useState<Format | null>(null);
  const [mediaState, setMediaState] = useState<Record<Format, MediaState>>({
    behance: { loading: false },
    instagram: { loading: false },
    linkedin: { loading: false },
    reel: { loading: false },
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setContent(null);
    setMediaState({
      behance: { loading: false },
      instagram: { loading: false },
      linkedin: { loading: false },
      reel: { loading: false },
    });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setContent(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMedia = async (format: Format) => {
    if (!content) return;
    setMediaState(prev => ({ ...prev, [format]: { loading: true, status: 'Starting generation...', error: undefined } }));

    try {
      if (format === 'linkedin' || format === 'behance') {
        const prompt = content[format].imagePrompt;
        const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMediaState(prev => ({ ...prev, [format]: { loading: false, urls: [data.imageUrl] } }));
      } else if (format === 'instagram') {
        const prompts = content.instagram.imagePrompts;
        const urls: string[] = [];
        
        for (let i = 0; i < prompts.length; i++) {
          let success = false;
          let retries = 0;
          
          while (!success && retries < 3) {
            setMediaState(prev => ({ ...prev, [format]: { ...prev[format], loading: true, status: `Generating image ${i + 1} of ${prompts.length}${retries > 0 ? ` (Retry ${retries}/3)` : ''}...` } }));
            
            const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompts[i] }) });
            const data = await res.json();
            
            if (res.status === 429) {
              retries++;
              if (retries >= 3) throw new Error("Rate limit exceeded persistently. Please wait a few minutes and try again.");
              setMediaState(prev => ({ ...prev, [format]: { ...prev[format], status: `Rate limit hit. Cooling down for 15 seconds...` } }));
              await new Promise(resolve => setTimeout(resolve, 15000));
            } else if (!res.ok) {
              throw new Error(data.error);
            } else {
              urls.push(data.imageUrl);
              setMediaState(prev => ({ ...prev, [format]: { ...prev[format], urls: [...urls] } }));
              success = true;
              
              // Add a longer delay between successful requests to avoid hitting rate limits too quickly
              if (i < prompts.length - 1) {
                 setMediaState(prev => ({ ...prev, [format]: { ...prev[format], status: `Cooling down to prevent rate limits...` } }));
                 await new Promise(resolve => setTimeout(resolve, 8000));
              }
            }
          }
        }
        setMediaState(prev => ({ ...prev, [format]: { loading: false, urls } }));
      } else if (format === 'reel') {
        const prompt = content.reel.videoPrompt;
        const res = await fetch('/api/generate-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMediaState(prev => ({ ...prev, [format]: { loading: true, status: 'Generating video... this takes a few minutes.' } }));
        pollVideo(data.operationName, format);
      }
    } catch (err: any) {
      setMediaState(prev => ({ ...prev, [format]: { loading: false, error: err.message } }));
    }
  };

  const pollVideo = async (operationName: string, format: Format) => {
    try {
      const res = await fetch('/api/video-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.done) {
        setMediaState(prev => ({ ...prev, [format]: { loading: true, status: 'Downloading video...' } }));
        const downloadRes = await fetch('/api/video-download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationName }) });
        if (!downloadRes.ok) throw new Error('Failed to download video');
        const blob = await downloadRes.blob();
        setMediaState(prev => ({ ...prev, [format]: { loading: false, videoUrl: URL.createObjectURL(blob) } }));
      } else {
        setTimeout(() => pollVideo(operationName, format), 10000);
      }
    } catch (err: any) {
      setMediaState(prev => ({ ...prev, [format]: { loading: false, error: err.message } }));
    }
  };

  const copyToClipboard = (text: string, format: Format) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(format);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const tabs = [
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, mediaType: 'Image' },
    { id: 'instagram', label: 'Instagram', icon: Instagram, mediaType: 'Carousel' },
    { id: 'behance', label: 'Behance', icon: Palette, mediaType: 'Hero Image' },
    { id: 'reel', label: 'Reel Script', icon: Video, mediaType: 'Video Hook' },
  ] as const;

  const renderSocialGenerator = () => (
    <div className="mb-16">
      <h2 className="text-3xl md:text-5xl font-display font-medium tracking-tight mb-4">
        Turn Case Studies into <span className="text-[#ffd105]">Content.</span>
      </h2>
      <p className="text-neutral-400 text-lg mb-8 max-w-2xl">
        Paste a NetBramha work page URL below. Our AI will analyze the case study and generate optimized copy for LinkedIn, Instagram, Behance, and Reels.
      </p>

      <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500">
            <LinkIcon size={20} />
          </div>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.netbramha.com/work/..."
            className="w-full pl-11 pr-4 py-4 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-[#ffd105] focus:ring-1 focus:ring-[#ffd105] transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url}
          className="px-8 py-4 bg-[#ffd105] text-black font-medium rounded-lg hover:bg-[#ffcf00]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-w-[160px]"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Posts'
          )}
        </button>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-start gap-3"
          >
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Section */}
      {content && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-8 items-start mt-16"
        >
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 flex flex-col gap-2 shrink-0 md:sticky md:top-28">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors relative ${
                    isActive ? 'bg-neutral-900 text-white' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-[#ffd105]' : ''} />
                  <span className="font-medium">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-[#ffd105] rounded-r-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 w-full min-w-0 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden flex flex-col">
            <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ffd105]"></div>
                <h3 className="font-medium text-neutral-300 capitalize">
                  {tabs.find(t => t.id === activeTab)?.label} Content
                </h3>
              </div>
              <button
                onClick={() => copyToClipboard(activeTab === 'reel' ? content[activeTab].script : content[activeTab].copy, activeTab)}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-neutral-800"
              >
                {copiedTab === activeTab ? (
                  <>
                    <CheckCircle2 size={16} className="text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto max-h-[70vh] custom-scrollbar text-neutral-200">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8"
                >
                   {/* Text Content */}
                   <div className="prose prose-invert prose-p:leading-relaxed prose-headings:text-white prose-a:text-[#ffd105] max-w-none whitespace-pre-wrap">
                     {activeTab === 'reel' ? content[activeTab].script : content[activeTab].copy}
                   </div>

                   {/* Media Generation Section */}
                   <div className="pt-8 border-t border-neutral-800">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                       <div>
                         <h4 className="text-lg font-medium text-white mb-1">Generated Visuals</h4>
                         <p className="text-sm text-neutral-400">Create custom {tabs.find(t => t.id === activeTab)?.mediaType.toLowerCase()} based on the generated prompt.</p>
                       </div>
                       <button
                         onClick={() => handleGenerateMedia(activeTab)}
                         disabled={mediaState[activeTab].loading}
                         className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 min-w-[140px]"
                       >
                         {mediaState[activeTab].loading ? (
                           <><Loader2 size={16} className="animate-spin" /> Generating...</>
                         ) : (
                           <><Wand2 size={16} /> Generate {tabs.find(t => t.id === activeTab)?.mediaType}</>
                         )}
                       </button>
                     </div>

                     {mediaState[activeTab].error && (
                       <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-start gap-3">
                         <AlertCircle size={20} className="shrink-0 mt-0.5" />
                         <p className="text-sm">{mediaState[activeTab].error}</p>
                       </div>
                     )}

                     {mediaState[activeTab].status && mediaState[activeTab].loading && (
                       <div className="mb-6 flex items-center gap-3 text-neutral-400">
                         <Loader2 size={16} className="animate-spin text-[#ffd105]" />
                         <p className="text-sm">{mediaState[activeTab].status}</p>
                       </div>
                     )}

                     {/* Media Display */}
                     <div className="grid gap-4">
                        {activeTab !== 'reel' && mediaState[activeTab].urls && mediaState[activeTab].urls.length > 0 && (
                          <div className={activeTab === 'instagram' ? "grid grid-cols-2 sm:grid-cols-3 gap-4" : ""}>
                            {mediaState[activeTab].urls.map((url, i) => (
                              <div key={i} className="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 aspect-square">
                                <img src={url} alt="Generated visual" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}

                        {activeTab === 'reel' && mediaState[activeTab].videoUrl && (
                          <div className="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 aspect-video relative">
                            <video src={mediaState[activeTab].videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                          </div>
                        )}
                     </div>
                   </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-[#ffd105] selection:text-black">
      {/* Header */}
      <header className="border-b border-white/10 bg-black sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#ffd105] flex items-center justify-center font-bold text-black text-xl">
              N
            </div>
            <h1 className="text-xl font-display font-medium tracking-tight">NetBramha Studio AI</h1>
          </div>
          
          <nav className="flex items-center gap-1 bg-neutral-900/50 p-1 rounded-lg border border-neutral-800">
             <button onClick={() => setAppMode('social')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${appMode === 'social' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}>
                <FileText size={16} /> <span className="hidden sm:inline">Social</span>
             </button>
             <button onClick={() => setAppMode('image')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${appMode === 'image' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}>
                <ImageIcon size={16} /> <span className="hidden sm:inline">Image</span>
             </button>
             <button onClick={() => setAppMode('video')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${appMode === 'video' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}>
                <Film size={16} /> <span className="hidden sm:inline">Video</span>
             </button>
             <button onClick={() => setAppMode('music')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${appMode === 'music' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}>
                <Music size={16} /> <span className="hidden sm:inline">Music</span>
             </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
           <motion.div
             key={appMode}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             transition={{ duration: 0.2 }}
           >
             {appMode === 'social' && renderSocialGenerator()}
             {appMode === 'image' && <ImageGenerator />}
             {appMode === 'video' && <VideoGenerator />}
             {appMode === 'music' && <MusicGenerator />}
           </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

