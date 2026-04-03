import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Image as ImageIcon, Loader2, Download, BookOpen, Calendar, Lightbulb, Sparkles, Send, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';

type AidType = 'diagram' | 'explain' | 'plan' | 'mnemonic';

export default function StudyAids() {
  const [activeAid, setActiveAid] = useState<AidType>('explain');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aids = [
    { id: 'explain', name: 'Concept Explainer', icon: BookOpen, description: 'Simplify complex IGCSE topics', color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 'diagram', name: 'Diagram Generator', icon: ImageIcon, description: 'Visual aids for revision', color: 'text-purple-600', bg: 'bg-purple-100' },
    { id: 'plan', name: 'Study Plan', icon: Calendar, description: 'Topic-specific revision plans', color: 'text-green-600', bg: 'bg-green-100' },
    { id: 'mnemonic', name: 'Mnemonic Maker', icon: Lightbulb, description: 'Memory tricks for facts', color: 'text-amber-600', bg: 'bg-amber-100' },
  ];

  const generateAid = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setImageUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      if (activeAid === 'diagram') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [{ text: `Educational diagram for IGCSE student: ${prompt}. Make it clear, labeled, and scientifically accurate.` }],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
              imageSize: "1K"
            }
          }
        });

        let foundImage = false;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            setImageUrl(`data:image/png;base64,${base64EncodeString}`);
            foundImage = true;
            break;
          }
        }
        if (!foundImage) setError("Could not generate diagram. Try a different prompt.");
      } else {
        let systemInstruction = "";
        if (activeAid === 'explain') {
          systemInstruction = "You are an expert IGCSE tutor. Explain the given topic in simple, clear terms suitable for a 15-16 year old. Use analogies where helpful. Highlight key terms that examiners look for.";
        } else if (activeAid === 'plan') {
          systemInstruction = "Create a 3-day intensive revision plan for the given IGCSE topic. Break it down into morning, afternoon, and evening sessions. Include specific sub-topics and practice question types.";
        } else if (activeAid === 'mnemonic') {
          systemInstruction = "Create 2-3 memorable mnemonics (acronyms or sentences) to help an IGCSE student remember the key facts or steps for the given topic.";
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: { systemInstruction }
        });

        setResult(response.text || "No response generated.");
      }
    } catch (err) {
      console.error("Error generating aid:", err);
      setError("Failed to generate study aid. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-10">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter flex items-center justify-center">
          <Sparkles className="w-12 h-12 mr-4 text-brand-600 animate-pulse" />
          AI Study Aids
        </h1>
        <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">Smart, AI-powered tools to supercharge your IGCSE revision and master complex topics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {aids.map((aid) => (
          <button
            key={aid.id}
            onClick={() => {
              setActiveAid(aid.id as AidType);
              setResult(null);
              setImageUrl(null);
              setError(null);
            }}
            className={`stitch-card p-8 text-left group relative overflow-hidden transition-all duration-500 ${
              activeAid === aid.id 
                ? 'ring-4 ring-brand-500/10 border-brand-500 bg-brand-50/30' 
                : 'hover:border-brand-200'
            }`}
          >
            <div className={`${aid.bg} ${aid.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
              <aid.icon className="w-7 h-7" />
            </div>
            <h3 className={`text-lg font-bold mb-2 tracking-tight ${activeAid === aid.id ? 'text-brand-900' : 'text-slate-900'}`}>{aid.name}</h3>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">{aid.description}</p>
            
            {activeAid === aid.id && (
              <div className="absolute top-4 right-4 w-2 h-2 bg-brand-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="stitch-card overflow-hidden bg-white shadow-2xl shadow-slate-200/50">
        <div className="p-10 border-b border-slate-50 bg-slate-50/30">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 relative group">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  activeAid === 'explain' ? "What concept should I explain?" :
                  activeAid === 'diagram' ? "What should I draw for you?" :
                  activeAid === 'plan' ? "Which topic do you need a plan for?" :
                  "What do you need a mnemonic for?"
                }
                className="w-full px-8 py-5 bg-white border border-slate-200 rounded-[28px] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 text-lg font-bold text-slate-900 placeholder:text-slate-300 shadow-sm transition-all"
                onKeyDown={(e) => e.key === 'Enter' && generateAid()}
              />
            </div>
            <button
              onClick={generateAid}
              disabled={isGenerating || !prompt.trim()}
              className="px-10 py-5 bg-brand-600 text-white font-bold rounded-[28px] hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center transition-all shadow-xl shadow-brand-100 active:scale-95"
            >
              {isGenerating ? (
                <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Crafting...</>
              ) : (
                <><Send className="w-6 h-6 mr-3" /> Generate Aid</>
              )}
            </button>
          </div>
        </div>

        <div className="p-10 min-h-[500px] relative">
          {error && (
            <div className="p-8 bg-red-50 text-red-700 rounded-[32px] border border-red-100 flex items-center shadow-sm animate-in fade-in zoom-in duration-300">
              <AlertCircle className="w-8 h-8 mr-4 flex-shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <div className="relative">
                <Loader2 className="w-20 h-20 mb-8 animate-spin text-brand-500 opacity-20" />
                <Sparkles className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-500 animate-pulse" />
              </div>
              <p className="animate-pulse font-black text-slate-900 text-xl tracking-tight">AI is crafting your study aid...</p>
              <p className="text-sm font-medium mt-2">This usually takes about 5-10 seconds</p>
            </div>
          )}

          {imageUrl && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="rounded-[40px] overflow-hidden border border-slate-100 shadow-2xl bg-white group">
                <div className="relative overflow-hidden">
                  <img src={imageUrl} alt={prompt} className="w-full h-auto transform group-hover:scale-[1.02] transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-10 bg-white border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">{prompt}</h4>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Scientifically Accurate Diagram</p>
                  </div>
                  <a 
                    href={imageUrl} 
                    download={`igcse-diagram-${Date.now()}.png`}
                    className="flex items-center px-10 py-5 bg-brand-600 text-white rounded-[24px] hover:bg-brand-700 font-bold transition-all shadow-xl shadow-brand-100 active:scale-95"
                  >
                    <Download className="w-6 h-6 mr-3" />
                    Download PNG
                  </a>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="bg-white rounded-[40px] p-12 shadow-sm border border-slate-100 prose prose-slate prose-lg max-w-none prose-headings:font-black prose-headings:tracking-tight prose-brand prose-strong:text-brand-700 prose-strong:font-black">
                <Markdown>{result}</Markdown>
              </div>
            </div>
          )}

          {!result && !imageUrl && !isGenerating && !error && (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-300">
              <div className="bg-slate-50 w-32 h-32 rounded-[48px] flex items-center justify-center mb-10 shadow-inner group">
                {activeAid === 'explain' && <BookOpen className="w-16 h-16 text-slate-200 group-hover:text-brand-200 transition-colors" />}
                {activeAid === 'diagram' && <ImageIcon className="w-16 h-16 text-slate-200 group-hover:text-brand-200 transition-colors" />}
                {activeAid === 'plan' && <Calendar className="w-16 h-16 text-slate-200 group-hover:text-brand-200 transition-colors" />}
                {activeAid === 'mnemonic' && <Lightbulb className="w-16 h-16 text-slate-200 group-hover:text-brand-200 transition-colors" />}
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Ready to start?</h3>
              <p className="text-slate-400 font-medium">Enter a topic above and let AI help you master it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
