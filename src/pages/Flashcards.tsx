import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronLeft, ChevronRight, RotateCcw, Sparkles, AlertCircle, List, Play, Search } from 'lucide-react';
import { IGCSE_SUBJECTS } from '../constants';

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  subject: string;
}

const DEFAULT_FLASHCARDS: Flashcard[] = [
  // Biology
  { id: 'b1', subject: 'Biology – 0610', term: 'Osmosis', definition: 'The net movement of water molecules from a region of higher water potential to a region of lower water potential, through a partially permeable membrane.' },
  { id: 'b2', subject: 'Biology – 0610', term: 'Active Transport', definition: 'The movement of particles through a cell membrane from a region of lower concentration to a region of higher concentration using energy from respiration.' },
  { id: 'b3', subject: 'Biology – 0610', term: 'Enzyme', definition: 'A protein that functions as a biological catalyst, speeding up chemical reactions without being changed.' },
  { id: 'b4', subject: 'Biology – 0610', term: 'Photosynthesis', definition: 'The process by which plants manufacture carbohydrates from raw materials using energy from light.' },
  { id: 'b5', subject: 'Biology – 0610', term: 'Transpiration', definition: 'The loss of water vapour from plant leaves by evaporation of water at the surfaces of the mesophyll cells followed by diffusion of water vapour through the stomata.' },
  // Chemistry
  { id: 'c1', subject: 'Chemistry – 0620', term: 'Isotopes', definition: 'Atoms of the same element which have the same number of protons but different numbers of neutrons.' },
  { id: 'c2', subject: 'Chemistry – 0620', term: 'Catalyst', definition: 'A substance that increases the rate of a chemical reaction and is unchanged at the end of the reaction.' },
  { id: 'c3', subject: 'Chemistry – 0620', term: 'Electrolysis', definition: 'The decomposition of an ionic compound, when molten or in aqueous solution, by the passage of an electric current.' },
  { id: 'c4', subject: 'Chemistry – 0620', term: 'Exothermic Reaction', definition: 'A reaction that transfers thermal energy to the surroundings, leading to an increase in the temperature of the surroundings.' },
  { id: 'c5', subject: 'Chemistry – 0620', term: 'Mole', definition: 'The amount of substance that contains the same number of particles as there are atoms in exactly 12g of carbon-12.' },
  // Physics
  { id: 'p1', subject: 'Physics – 0625', term: 'Refraction', definition: 'The change in direction of a wave as it passes from one medium to another of different optical density, causing a change in speed.' },
  { id: 'p2', subject: 'Physics – 0625', term: 'Specific Heat Capacity', definition: 'The energy required per unit mass per unit temperature increase.' },
  { id: 'p3', subject: 'Physics – 0625', term: 'Acceleration', definition: 'The rate of change of velocity.' },
  { id: 'p4', subject: 'Physics – 0625', term: 'Work Done', definition: 'The product of the force and the distance moved in the direction of the force.' },
  { id: 'p5', subject: 'Physics – 0625', term: 'Half-life', definition: 'The time taken for half the nuclei of a radioactive isotope in a sample to decay.' }
];

export default function Flashcards() {
  const { user, userData } = useAuth();
  const [allFlashcards, setAllFlashcards] = useState<Flashcard[]>([]);
  const [filteredCards, setFilteredCards] = useState<Flashcard[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [view, setView] = useState<'study' | 'bank'>('bank');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchFlashcards = async () => {
      if (!user) return;
      try {
        const flashcardsRef = collection(db, 'flashcards');
        const snap = await getDocs(flashcardsRef);
        
        let fetchedCards = snap.docs.map(d => ({ id: d.id, ...d.data() } as Flashcard));

        if (fetchedCards.length === 0) {
          fetchedCards = DEFAULT_FLASHCARDS;
        }

        setAllFlashcards(fetchedCards);
      } catch (error) {
        console.error("Error fetching flashcards:", error);
        setAllFlashcards(DEFAULT_FLASHCARDS);
      } finally {
        setLoading(false);
      }
    };

    fetchFlashcards();
  }, [user]);

  useEffect(() => {
    let cards = allFlashcards;
    if (selectedSubject !== 'All') {
      cards = cards.filter(c => c.subject === selectedSubject);
    }
    if (searchQuery) {
      cards = cards.filter(c => 
        c.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.definition.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Prioritize weak topics if in "All" view
    if (selectedSubject === 'All' && userData?.weakTopics?.length > 0) {
      cards = [...cards].sort((a, b) => {
        const aIsWeak = userData.weakTopics.some((t: string) => a.subject.includes(t));
        const bIsWeak = userData.weakTopics.some((t: string) => b.subject.includes(t));
        if (aIsWeak && !bIsWeak) return -1;
        if (!aIsWeak && bIsWeak) return 1;
        return 0;
      });
    }

    setFilteredCards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [allFlashcards, selectedSubject, searchQuery, userData]);

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length);
    }, 150);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Brain className="animate-pulse text-blue-600 w-12 h-12" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center space-x-4 bg-white p-2 rounded-[32px] border border-slate-100 shadow-sm">
          <button
            onClick={() => setView('bank')}
            className={`flex items-center px-8 py-4 rounded-[24px] text-sm font-bold transition-all duration-300 ${
              view === 'bank' ? 'bg-brand-600 text-white shadow-xl shadow-brand-100' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <List className="w-5 h-5 mr-3" />
            Bank View
          </button>
          <button
            onClick={() => setView('study')}
            className={`flex items-center px-8 py-4 rounded-[24px] text-sm font-bold transition-all duration-300 ${
              view === 'study' ? 'bg-brand-600 text-white shadow-xl shadow-brand-100' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Play className="w-5 h-5 mr-3" />
            Study Mode
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 pr-8 py-4 bg-white border border-slate-200 rounded-[28px] text-sm font-medium focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 w-80 shadow-sm transition-all"
            />
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-8 py-4 bg-white border border-slate-200 rounded-[28px] text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 shadow-sm transition-all cursor-pointer"
          >
            <option value="All">All Subjects</option>
            {IGCSE_SUBJECTS.map(s => (
              <option key={s.name} value={s.name}>{s.name.split(' – ')[0]}</option>
            ))}
          </select>
        </div>
      </div>

      {view === 'bank' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredCards.map((card, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={card.id}
              className="stitch-card p-10 group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="px-4 py-1.5 bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full uppercase tracking-widest border border-brand-100">
                  {card.subject.split(' – ')[0]}
                </span>
                <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-brand-50 transition-colors">
                  <Brain className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-6 leading-tight tracking-tight group-hover:text-brand-600 transition-colors">{card.term}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{card.definition}</p>
              
              {/* Decorative background element */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-brand-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
          {filteredCards.length === 0 && (
            <div className="col-span-full py-32 text-center stitch-card">
              <div className="bg-slate-50 w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Search className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">No flashcards found</h3>
              <p className="text-slate-500 font-medium">Try adjusting your search or subject filter.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto py-16">
          {filteredCards.length > 0 ? (
            <div className="space-y-16">
              <div className="relative h-[500px] perspective-2000">
                <motion.div
                  className="w-full h-full relative preserve-3d cursor-pointer"
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.8, type: "spring", stiffness: 200, damping: 25 }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden stitch-card p-16 flex flex-col items-center justify-center text-center bg-gradient-to-br from-white to-brand-50/50 border-2 border-brand-100 shadow-2xl shadow-brand-100/20">
                    <div className="absolute top-10 left-10 flex items-center">
                      <div className="w-1.5 h-6 bg-brand-500 rounded-full mr-3" />
                      <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">
                        {filteredCards[currentIndex].subject.split(' – ')[0]}
                      </span>
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">{filteredCards[currentIndex].term}</h2>
                    <div className="absolute bottom-10 flex items-center text-slate-400">
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin-slow" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Click to reveal definition</p>
                    </div>
                  </div>
                  {/* Back */}
                  <div className="absolute inset-0 backface-hidden stitch-card p-16 flex flex-col items-center justify-center text-center bg-brand-600 text-white rotate-y-180 shadow-2xl shadow-brand-600/30">
                    <Sparkles className="w-12 h-12 text-yellow-300 mb-10 opacity-50" />
                    <p className="text-3xl font-bold leading-snug tracking-tight">{filteredCards[currentIndex].definition}</p>
                    <div className="absolute bottom-10 flex items-center text-white/60">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Click to see term</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="flex items-center justify-between px-8">
                <button
                  onClick={handlePrev}
                  className="p-6 bg-white border border-slate-200 rounded-[32px] text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all shadow-xl shadow-slate-100 active:scale-95"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <div className="text-center">
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{currentIndex + 1} <span className="text-slate-300 text-2xl">/</span> {filteredCards.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cards in Session</p>
                </div>
                <button
                  onClick={handleNext}
                  className="p-6 bg-white border border-slate-200 rounded-[32px] text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all shadow-xl shadow-slate-100 active:scale-95"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-32 stitch-card">
              <div className="bg-slate-50 w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto mb-8">
                <Brain className="w-12 h-12 text-slate-200" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">No cards to study</h3>
              <p className="text-slate-500 font-medium">Add some flashcards or change your filters to start studying.</p>
            </div>
          )}
        </div>
      )}

      <div className="stitch-card p-10 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 relative overflow-hidden group">
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center tracking-tight">
            <Sparkles className="w-6 h-6 mr-3 text-amber-500" />
            Pro Tip for Cambridge IGCSE
          </h3>
          <p className="text-amber-800 text-base leading-relaxed font-medium max-w-4xl">
            Cambridge examiners look for specific <span className="text-amber-950 font-black">"trigger words"</span> in your definitions. For example, in Osmosis, you MUST mention <span className="underline decoration-amber-400 decoration-2 underline-offset-4">"partially permeable membrane"</span> and <span className="underline decoration-amber-400 decoration-2 underline-offset-4">"water potential"</span> to get full marks. Use these cards to memorize those exact phrases!
          </p>
        </div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/40 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
      </div>

      <style>{`
        .perspective-2000 { perspective: 2000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
