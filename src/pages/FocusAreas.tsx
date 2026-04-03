import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, ChevronRight, BookOpen, Target, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { IGCSE_SUBJECTS } from '../constants';

export default function FocusAreas() {
  const { user, userData } = useAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttempts = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'attempts'), where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const fetchedAttempts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAttempts(fetchedAttempts);
      } catch (error) {
        console.error("Error fetching attempts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, [user]);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading focus areas...</div>;

  // Group attempts by subject and identify weak topics
  const subjectAnalysis = IGCSE_SUBJECTS.map(subject => {
    const subjectAttempts = attempts.filter(a => a.subject === subject.name);
    const totalMarks = subjectAttempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
    const maxMarks = subjectAttempts.reduce((sum, a) => sum + (a.maxMarks || 0), 0);
    const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
    
    // Identify weak topics based on feedback or low scores
    const weakPoints = subjectAttempts
      .filter(a => !a.isCorrect)
      .map(a => ({
        question: a.questionText,
        feedback: a.feedback,
        improvementTip: a.improvementTip,
        date: a.timestamp
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    return {
      ...subject,
      percentage: Math.round(percentage),
      weakPoints,
      isWeak: percentage < 60 && subjectAttempts.length > 0,
      isStrong: percentage >= 80 && subjectAttempts.length > 0,
    };
  });

  const weakSubjects = subjectAnalysis.filter(s => s.isWeak || userData?.weakTopics?.includes(s.name));
  const strongSubjects = subjectAnalysis.filter(s => s.isStrong || userData?.strongTopics?.includes(s.name));

  return (
    <div className="max-w-[1600px] mx-auto space-y-10">
      <header className="stitch-card p-12 relative overflow-hidden group">
        <div className="relative z-10">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4 flex items-center">
            <Target className="w-12 h-12 mr-5 text-brand-600 animate-pulse" />
            Weak Topic Analysis
          </h1>
          <p className="text-xl text-slate-500 font-medium max-w-2xl">Identify and conquer the topics that are holding you back from an A* grade with precision analytics.</p>
        </div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-50 rounded-full blur-3xl opacity-50 group-hover:scale-125 transition-transform duration-1000" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Weak Subjects List */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <AlertCircle className="w-7 h-7 mr-3 text-brand-600" />
              Priority Focus Areas
            </h2>
            <div className="px-4 py-1.5 bg-brand-50 text-brand-600 text-[10px] font-black rounded-full uppercase tracking-widest border border-brand-100">
              {weakSubjects.length} Areas Identified
            </div>
          </div>
          
          {weakSubjects.length > 0 ? (
            weakSubjects.map((subject, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={subject.name} 
                className="stitch-card overflow-hidden group"
              >
                <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-white group-hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-center">
                    <div className={`${subject.bg} p-5 rounded-2xl mr-6 shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                      <subject.icon className={`w-8 h-8 ${subject.color}`} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{subject.name}</h3>
                      <div className="flex items-center mt-3">
                        <div className="w-48 bg-slate-100 h-2.5 rounded-full mr-4 overflow-hidden shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${subject.percentage}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className="bg-brand-500 h-full rounded-full shadow-lg shadow-brand-500/20"
                          />
                        </div>
                        <span className="text-xs font-black text-brand-600 uppercase tracking-widest">{subject.percentage}% Mastery</span>
                      </div>
                    </div>
                  </div>
                  <button className="p-4 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 rounded-2xl transition-all duration-300 border border-transparent hover:border-slate-100 group/btn">
                    <ChevronRight className="w-6 h-6 text-slate-300 group-hover/btn:text-brand-600 transition-colors" />
                  </button>
                </div>
                
                <div className="p-10 bg-slate-50/30 space-y-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
                    <Sparkles className="w-4 h-4 mr-3 text-brand-500" />
                    Key Improvement Areas
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {subject.weakPoints.length > 0 ? (
                      subject.weakPoints.map((point, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group/point">
                          <p className="text-sm font-bold text-slate-900 mb-6 leading-relaxed">"{point.question.substring(0, 120)}..."</p>
                          <div className="bg-brand-50 p-6 rounded-2xl border border-brand-100/50 relative overflow-hidden">
                            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-2">Examiner Insight</p>
                            <p className="text-sm text-brand-950 font-medium leading-relaxed relative z-10">{point.improvementTip || point.feedback}</p>
                            <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-brand-200/20 rounded-full blur-xl" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 font-medium italic col-span-full">No specific weak points identified yet. Keep practicing!</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="stitch-card p-24 text-center">
              <div className="bg-emerald-50 w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">No Weak Subjects Found!</h3>
              <p className="text-slate-500 font-medium text-lg">You're doing great across all subjects. Keep up the high standards!</p>
            </div>
          )}
        </div>

        {/* Strong Subjects / Strengths */}
        <div className="lg:col-span-4 space-y-10">
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <CheckCircle2 className="w-7 h-7 mr-3 text-emerald-500" />
              Your Strengths
            </h2>
            <div className="stitch-card p-8 space-y-4">
              {strongSubjects.length > 0 ? (
                strongSubjects.map(subject => (
                  <div key={subject.name} className="flex items-center justify-between p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 group hover:bg-emerald-50 transition-colors duration-300">
                    <div className="flex items-center">
                      <div className={`${subject.bg} p-3 rounded-xl mr-4 shadow-sm group-hover:scale-110 transition-transform`}>
                        <subject.icon className={`w-5 h-5 ${subject.color}`} />
                      </div>
                      <span className="text-sm font-black text-slate-900 tracking-tight">{subject.name.split(' – ')[0]}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs font-black text-emerald-600 uppercase tracking-widest mr-3">{subject.percentage}%</span>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Keep practicing to build your strengths.</p>
                </div>
              )}
            </div>
          </div>

          {/* Study Resources Link */}
          <div className="bg-slate-900 rounded-[48px] shadow-2xl p-10 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-brand-600/20 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="bg-brand-500/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border border-brand-500/30 group-hover:scale-110 transition-transform duration-500">
                <BookOpen className="w-8 h-8 text-brand-400" />
              </div>
              <h3 className="text-2xl font-black mb-4 tracking-tight">Need more help?</h3>
              <p className="text-slate-400 font-medium mb-10 leading-relaxed">Access curated study aids and revision notes for your weak topics.</p>
              <button 
                onClick={() => window.location.href = '/study-aids'}
                className="w-full py-5 bg-brand-600 text-white rounded-[24px] font-black text-sm hover:bg-brand-700 transition-all shadow-xl shadow-brand-100 active:scale-95"
              >
                Go to Study Aids
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
