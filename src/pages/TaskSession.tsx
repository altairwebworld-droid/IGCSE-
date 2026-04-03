import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { evaluateAnswer, GradingResult, analyzeStudentPerformance } from '../services/gemini';
import { Clock, AlertTriangle, ArrowRight, CheckCircle2, XCircle, RotateCcw, ArrowLeft, Share2, Sparkles, Trophy, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { getGrade } from '../constants';

export default function TaskSession() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState<string | string[]>('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [cheatingLogs, setCheatingLogs] = useState<string[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [completedAttempts, setCompletedAttempts] = useState<any[]>([]);
  
  const startTimeRef = useRef(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId) return;
      const taskRef = doc(db, 'tasks', taskId);
      const snap = await getDoc(taskRef);
      if (snap.exists()) {
        const data = snap.data();
        setTask(data);
        setCurrentQuestionIndex(data.completedQuestions || 0);
        
        if (data.status === 'completed') {
          setTimeLeft(0);
          return;
        }

        if (data.expiresAt) {
          const remaining = Math.floor((data.expiresAt - Date.now()) / 1000);
          if (remaining <= 0) {
            await updateDoc(taskRef, { status: 'completed' });
            setTask(prev => ({ ...prev, status: 'completed' }));
            setTimeLeft(0);
          } else {
            setTimeLeft(remaining);
          }
        } else {
          setTimeLeft(data.isExamMode ? data.totalQuestions * 120 : 300);
        }
      }
    };
    fetchTask();
  }, [taskId]);

  useEffect(() => {
    if (task && task.questions) {
      const q = task.questions[currentQuestionIndex];
      if (q && q.type === 'multiple-select') {
        setAnswer([]);
      } else {
        setAnswer('');
      }
    }
  }, [task, currentQuestionIndex]);

  useEffect(() => {
    if (task?.status === 'completed' && taskId) {
      const fetchAttempts = async () => {
        const attemptsQuery = query(collection(db, 'attempts'), where('taskId', '==', taskId));
        const attemptsSnap = await getDocs(attemptsQuery);
        setCompletedAttempts(attemptsSnap.docs.map(d => d.data()));
      };
      fetchAttempts();
    }
  }, [task?.status, taskId]);

  const handleSubmit = useCallback(async () => {
    if (!user || !task || !taskId) return;
    setIsSubmitting(true);
    
    const question = task.questions?.[currentQuestionIndex];
    if (!question) {
      setIsSubmitting(false);
      return;
    }

    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const studentAnswerText = Array.isArray(answer) ? answer.join(', ') : answer;
    
    // Fast answer check
    if (timeTaken < 5 && studentAnswerText.length > 50) {
      setCheatingLogs(prev => [...prev, 'Suspiciously fast answer for length']);
    }

    const grading = await evaluateAnswer(question.text, studentAnswerText, question.correctAnswer, question.maxMarks);
    setResult(grading);

    // Save attempt
    await addDoc(collection(db, 'attempts'), {
      userId: user.uid,
      taskId: taskId,
      questionId: question.id,
      questionText: question.text,
      studentAnswer: studentAnswerText,
      isCorrect: grading.isCorrect,
      marksAwarded: grading.marksAwarded,
      feedback: grading.feedback,
      improvementTip: grading.improvementTip,
      timeTakenSeconds: timeTaken,
      suspiciousBehavior: cheatingLogs.length > 0,
      antiCheatingLogs: cheatingLogs,
      createdAt: new Date().toISOString()
    });

    // Update task
    const newTaskCompleted = currentQuestionIndex + 1;
    const isCompleted = newTaskCompleted >= task.totalQuestions;
    
    await updateDoc(doc(db, 'tasks', taskId), {
      completedQuestions: newTaskCompleted,
      status: isCompleted ? 'completed' : 'in-progress'
    });

    if (isCompleted) {
      // Run analysis in background
      (async () => {
        try {
          const attemptsQuery = query(collection(db, 'attempts'), where('taskId', '==', taskId));
          const attemptsSnap = await getDocs(attemptsQuery);
          const attempts = attemptsSnap.docs.map(d => d.data());
          
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const currentStats = userSnap.exists() ? userSnap.data() : {};

          const analysis = await analyzeStudentPerformance(attempts, currentStats);

          // Calculate XP and Streak
          const correctAnswers = attempts.filter(a => a.isCorrect).length;
          const totalMarksAwarded = attempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
          const maxPossibleMarks = task.questions.reduce((sum: number, q: any) => sum + (q.maxMarks || 0), 0);
          const xpGained = correctAnswers * 10;
          
          const today = new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Harare' });
          const lastActiveDate = currentStats.lastActiveDate || '';
          let newStreak = currentStats.streak || 0;

          if (lastActiveDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toLocaleDateString('en-US', { timeZone: 'Africa/Harare' });
            
            if (lastActiveDate === yesterdayStr) {
              newStreak += 1;
            } else {
              newStreak = 1;
            }
          }

          await updateDoc(userRef, {
            masteryPercentage: analysis.masteryPercentage,
            weeklyImprovement: analysis.weeklyImprovement,
            weakTopics: analysis.weakTopics,
            strongTopics: analysis.strongTopics,
            lastAnalyzed: new Date().toISOString(),
            xp: (currentStats.xp || 0) + xpGained,
            streak: newStreak,
            lastActiveDate: today
          });

          // AUTO-GENERATE WHATSAPP REPORT
          if (currentStats.parentPhone) {
            const struggledQuestions = attempts
              .filter(a => (a.marksAwarded || 0) < (task.questions.find((q: any) => q.id === a.questionId)?.maxMarks || 0))
              .map(a => a.questionText);
            
            const improvementNotes = attempts
              .filter(a => a.feedback)
              .map(a => a.feedback)
              .slice(0, 3) // Take top 3 feedback points
              .join('\n');

            const answeringSuggestions = attempts
              .filter(a => a.improvementTip)
              .map(a => a.improvementTip)
              .slice(0, 3) // Take top 3 tips
              .join('\n');

            const percentage = maxPossibleMarks > 0 ? Math.round((totalMarksAwarded / maxPossibleMarks) * 100) : 0;

            if (currentStats.parentPhone) {
              await fetch('/api/reports/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  studentName: currentStats.displayName || user.email,
                  parentPhone: currentStats.parentPhone,
                  subject: task.subject,
                  score: totalMarksAwarded,
                  totalMarks: maxPossibleMarks,
                  percentage,
                  isExam: task.isExamMode,
                  struggledQuestions,
                  improvementNotes,
                  answeringSuggestions
                })
              });
            }

            // AUTO-GENERATE TELEGRAM REPORT
            if (currentStats.telegramChatId) {
              const message = `
<b>IGCSE Prep Daily Report</b>
<b>Student:</b> ${currentStats.displayName || user.email}
<b>Date:</b> ${new Date().toLocaleDateString()}
<b>Subject:</b> ${task.subject}
<b>Score:</b> ${totalMarksAwarded}/${maxPossibleMarks} (${percentage}%)
<b>Grade:</b> ${getGrade(percentage)}
<b>Type:</b> ${task.isExamMode ? 'Exam' : 'Practice'}

<b>Struggled Questions:</b>
${struggledQuestions.length > 0 ? struggledQuestions.map(q => `• ${q}`).join('\n') : 'None! Great job!'}

<b>Improvement Notes:</b>
${improvementNotes || 'Keep up the good work!'}

<b>Revision Suggestions:</b>
${answeringSuggestions || 'Review the textbook chapters for this topic.'}
              `.trim();

              await fetch('/api/reports/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chatId: currentStats.telegramChatId,
                  message: message
                })
              });
            }
          }
        } catch (e) {
          console.error("Error analyzing performance or sending report:", e);
        }
      })();
    }

    setIsSubmitting(false);
  }, [user, task, taskId, currentQuestionIndex, answer, cheatingLogs]);

  const handleTimeUp = useCallback(async () => {
    if (!task || !taskId || isSubmitting) return;
    setIsSubmitting(true);
    await updateDoc(doc(db, 'tasks', taskId), { status: 'completed' });
    setTask(prev => ({ ...prev, status: 'completed' }));
    setIsSubmitting(false);
  }, [task, taskId, isSubmitting]);

  // Timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!result && !isSubmitting && task && task.status !== 'completed') {
        handleTimeUp();
      }
      return;
    }
    if (result || task?.status === 'completed') return;
    
    const timer = setInterval(() => setTimeLeft(t => (t !== null ? t - 1 : null)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, result, isSubmitting, task, handleTimeUp]);

  // Anti-cheating
  useEffect(() => {
    if (!task?.isExamMode) return;

    const handleBlur = () => {
      setCheatingLogs(prev => [...prev, `Tab switched at ${new Date().toLocaleTimeString()}`]);
    };
    
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setCheatingLogs(prev => [...prev, `Right-click attempted at ${new Date().toLocaleTimeString()}`]);
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [task]);

  const handleCopyPaste = (e: React.ClipboardEvent) => {
    if (task?.isExamMode) {
      e.preventDefault();
      setCheatingLogs(prev => [...prev, `Copy/Paste attempted at ${new Date().toLocaleTimeString()}`]);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex + 1 >= (task?.totalQuestions || 0)) {
      navigate('/');
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setResult(null);
      setCheatingLogs([]);
      startTimeRef.current = Date.now();
    }
  };

  const handleLeave = () => {
    navigate('/');
  };

  const shareToWhatsApp = () => {
    if (!task || !completedAttempts.length) return;
    
    const totalMarks = completedAttempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
    const maxMarks = task.questions.reduce((sum: number, q: any) => sum + (q.maxMarks || 0), 0);
    const percentage = Math.round((totalMarks / maxMarks) * 100);
    const grade = getGrade(percentage);
    
    const text = `*IGCSE Prep Result*\n\n*Subject:* ${task.subject}\n*Score:* ${totalMarks}/${maxMarks} (${percentage}%)\n*Grade:* ${grade}\n\nKeep practicing! 🚀`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!task) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (task.status === 'completed') {
    const totalMarks = completedAttempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
    const maxMarks = task.questions.reduce((sum: number, q: any) => sum + (q.maxMarks || 0), 0);
    const percentage = Math.round((totalMarks / maxMarks) * 100);
    const grade = getGrade(percentage);

    return (
      <div className="min-h-screen bg-slate-50/50 p-8 md:p-16">
        <div className="max-w-5xl mx-auto space-y-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="stitch-card overflow-hidden relative"
          >
            <div className="bg-slate-900 p-16 text-white text-center relative overflow-hidden">
              <div className="absolute top-8 left-8 z-20">
                <button onClick={() => navigate('/')} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-95 border border-white/10">
                  <ArrowLeft className="w-6 h-6" />
                </button>
              </div>
              
              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, delay: 0.2 }}
                  className="w-32 h-32 bg-brand-500 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-500/40"
                >
                  <CheckCircle2 className="w-16 h-16 text-white" />
                </motion.div>
                
                <h1 className="text-5xl font-black mb-4 tracking-tighter">Practice Completed!</h1>
                <p className="text-slate-400 text-xl font-medium max-w-xl mx-auto">Excellent work on your {task.subject} session. Here's your performance breakdown.</p>
                
                <div className="mt-12 flex flex-wrap justify-center gap-12">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Total Score</p>
                    <p className="text-5xl font-black tracking-tighter">{totalMarks} <span className="text-slate-600 text-2xl">/ {maxMarks}</span></p>
                  </div>
                  <div className="w-px h-16 bg-slate-800 self-center hidden md:block"></div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Predicted Grade</p>
                    <p className="text-5xl font-black tracking-tighter text-brand-400">{grade}</p>
                  </div>
                </div>

                <div className="mt-16 flex flex-wrap justify-center gap-6">
                  <button 
                    onClick={() => navigate('/')}
                    className="px-10 py-5 bg-white text-slate-900 rounded-[24px] font-black text-sm hover:bg-slate-50 transition-all shadow-xl active:scale-95"
                  >
                    Back to Dashboard
                  </button>
                  <button 
                    onClick={shareToWhatsApp}
                    className="px-10 py-5 bg-emerald-500 text-white rounded-[24px] font-black text-sm hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center active:scale-95"
                  >
                    <Share2 className="w-5 h-5 mr-3" /> Share Result
                  </button>
                </div>
              </div>
              
              {/* Abstract background elements */}
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-600/20 rounded-full blur-3xl" />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-400/10 rounded-full blur-3xl" />
            </div>
          </motion.div>

          <div className="space-y-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center px-4">
              <RotateCcw className="w-7 h-7 mr-3 text-brand-600" />
              Review Your Answers
            </h2>
            {task.questions?.map((q: any, idx: number) => {
              const attempt = completedAttempts.find(a => a.questionId === q.id);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={q.id} 
                  className="stitch-card p-10 group hover:bg-slate-50/30 transition-colors"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black mr-4 shadow-lg shadow-slate-200">
                        {idx + 1}
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Question {idx + 1}</h3>
                    </div>
                    {attempt && (
                      <div className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border ${attempt.isCorrect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {attempt.marksAwarded} / {q.maxMarks} Marks
                      </div>
                    )}
                  </div>
                  <p className="text-lg font-bold text-slate-900 mb-10 leading-relaxed">{q.text}</p>
                  
                  {attempt ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Your Response</p>
                        <p className="text-slate-900 font-bold leading-relaxed whitespace-pre-wrap">
                          {attempt.studentAnswer || <span className="text-slate-300 italic">No answer provided</span>}
                        </p>
                      </div>
                      
                      <div className="bg-brand-50 p-8 rounded-[32px] border border-brand-100/50 relative overflow-hidden">
                        <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-6">Model Answer</p>
                        <p className="text-brand-950 font-bold leading-relaxed whitespace-pre-wrap">{q.correctAnswer}</p>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-brand-200/20 rounded-full blur-3xl" />
                      </div>

                      <div className="md:col-span-2 space-y-6">
                        <div className="pt-8 border-t border-slate-50">
                          <div className="flex items-center mb-4">
                            <Sparkles className="w-5 h-5 text-brand-500 mr-3" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Examiner Feedback</p>
                          </div>
                          <p className="text-slate-900 font-bold leading-relaxed">{attempt.feedback}</p>
                        </div>
                        
                        {attempt.improvementTip && (
                          <div className="bg-amber-50 p-8 rounded-[32px] border border-amber-100 relative overflow-hidden">
                            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-4">Improvement Strategy</p>
                            <p className="text-amber-950 font-bold leading-relaxed relative z-10">{attempt.improvementTip}</p>
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/40 rounded-full blur-3xl" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 text-slate-400 font-bold italic text-center">
                      No attempt recorded for this question.
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = task.questions?.[currentQuestionIndex];
  
  if (!currentQuestion) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-100 px-10 py-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-8">
          <button 
            onClick={() => setShowLeaveModal(true)} 
            className="p-4 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90 border border-transparent hover:border-slate-100"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-2">{task.subject}</h1>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {task.totalQuestions}</span>
              <div className="flex gap-1">
                {Array.from({ length: task.totalQuestions }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === currentQuestionIndex ? 'w-8 bg-brand-600' : i < currentQuestionIndex ? 'w-3 bg-brand-200' : 'w-3 bg-slate-100'}`} 
                  />
                ))}
              </div>
            </div>
          </div>
          {task.isExamMode && (
            <div className="px-4 py-1.5 bg-red-50 text-red-600 text-[10px] font-black rounded-full flex items-center border border-red-100 animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-2" /> EXAM MODE
            </div>
          )}
        </div>
        <div className={`flex items-center px-8 py-4 bg-slate-50 rounded-[24px] border border-slate-100 font-mono text-2xl font-black ${timeLeft !== null && timeLeft < 60 ? 'text-red-600 animate-pulse bg-red-50 border-red-100' : 'text-slate-900'}`}>
          <Clock className="w-6 h-6 mr-3 text-brand-600" />
          {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full p-8 md:p-12 flex flex-col">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left: Question Card */}
          <div className="lg:col-span-7 flex flex-col">
            <motion.div 
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="stitch-card p-12 flex flex-col h-full relative overflow-hidden group"
            >
              <div className="flex justify-between items-start mb-10 relative z-10">
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em]">Question {currentQuestionIndex + 1}</span>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight tracking-tighter">
                    {currentQuestion.text}
                  </h2>
                </div>
                <div className="bg-brand-50 text-brand-600 font-black px-6 py-3 rounded-2xl text-xs whitespace-nowrap ml-8 border border-brand-100 shadow-sm uppercase tracking-widest">
                  {currentQuestion.maxMarks} Marks
                </div>
              </div>

              {currentQuestion.imageUrl && (
                <div className="mb-10 rounded-[32px] overflow-hidden border border-slate-100 bg-slate-50/50 flex justify-center p-8 shadow-inner group-hover:bg-slate-50 transition-colors duration-500">
                  <img 
                    src={currentQuestion.imageUrl} 
                    alt="Question diagram" 
                    className="max-w-full max-h-[500px] object-contain shadow-2xl rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              
              {cheatingLogs.length > 0 && task.isExamMode && (
                <div className="mt-auto bg-red-50 border border-red-100 rounded-[24px] p-8 flex items-center text-red-700 relative z-10">
                  <AlertTriangle className="w-8 h-8 mr-6 flex-shrink-0 animate-bounce" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest mb-1">Security Alert</p>
                    <p className="text-sm font-bold opacity-80">
                      Suspicious activity detected and logged for review.
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:scale-125 transition-transform duration-1000" />
            </motion.div>
          </div>

          {/* Right: Answer Input or Result */}
          <div className="lg:col-span-5 flex flex-col">
            {!result ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 flex flex-col bg-white rounded-[48px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[500px]"
              >
                <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Your Response</h3>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse mr-3" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-saving</span>
                  </div>
                </div>
                <div className="flex-1 p-10 overflow-y-auto">
                {currentQuestion.type === 'multiple-choice' ? (
                  <div className="space-y-4">
                    {currentQuestion.options?.map((opt: string) => (
                      <label key={opt} className={`flex items-center space-x-5 p-6 border-2 rounded-[24px] cursor-pointer transition-all duration-300 group ${answer === opt ? 'border-brand-500 bg-brand-50/50 shadow-lg shadow-brand-500/10' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${answer === opt ? 'border-brand-500 bg-brand-500' : 'border-slate-200 bg-white'}`}>
                          {answer === opt && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <input type="radio" name="mcq" value={opt} checked={answer === opt} onChange={() => setAnswer(opt)} className="hidden" />
                        <span className={`text-lg font-bold transition-colors ${answer === opt ? 'text-brand-900' : 'text-slate-600'}`}>{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : currentQuestion.type === 'multiple-select' ? (
                  <div className="space-y-4">
                    {currentQuestion.options?.map((opt: string) => {
                      const isChecked = Array.isArray(answer) && answer.includes(opt);
                      return (
                        <label key={opt} className={`flex items-center space-x-5 p-6 border-2 rounded-[24px] cursor-pointer transition-all duration-300 group ${isChecked ? 'border-brand-500 bg-brand-50/50 shadow-lg shadow-brand-500/10' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isChecked ? 'border-brand-500 bg-brand-500' : 'border-slate-200 bg-white'}`}>
                            {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                          <input type="checkbox" value={opt} checked={isChecked} 
                            onChange={(e) => {
                              const currentAns = Array.isArray(answer) ? answer : [];
                              if (e.target.checked) setAnswer([...currentAns, opt]);
                              else setAnswer(currentAns.filter(a => a !== opt));
                            }} 
                            className="hidden" />
                          <span className={`text-lg font-bold transition-colors ${isChecked ? 'text-brand-900' : 'text-slate-600'}`}>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : currentQuestion.type === 'fill-in-the-blanks' ? (
                  <div className="space-y-4">
                    <p className="text-slate-600 mb-2 font-bold">Fill in the blanks with the correct words.</p>
                    <textarea
                      ref={textareaRef}
                      value={answer as string}
                      onChange={(e) => setAnswer(e.target.value)}
                      onCopy={handleCopyPaste}
                      onPaste={handleCopyPaste}
                      onCut={handleCopyPaste}
                      placeholder="Type your answers here, separated by commas..."
                      className="w-full min-h-[150px] p-6 border-2 border-slate-100 rounded-[24px] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 resize-none text-lg font-bold text-slate-900 transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                ) : currentQuestion.type === 'matching' ? (
                  <div className="space-y-4">
                    <p className="text-slate-600 mb-2 font-bold">Match the items correctly. Type your answer as pairs (e.g., A-1, B-2).</p>
                    <textarea
                      ref={textareaRef}
                      value={answer as string}
                      onChange={(e) => setAnswer(e.target.value)}
                      onCopy={handleCopyPaste}
                      onPaste={handleCopyPaste}
                      onCut={handleCopyPaste}
                      placeholder="Type your matching pairs here..."
                      className="w-full min-h-[150px] p-6 border-2 border-slate-100 rounded-[24px] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 resize-none text-lg font-bold text-slate-900 transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={answer as string}
                    onChange={(e) => setAnswer(e.target.value)}
                    onCopy={handleCopyPaste}
                    onPaste={handleCopyPaste}
                    onCut={handleCopyPaste}
                    placeholder="Type your answer here..."
                    className="w-full h-full min-h-[200px] resize-none focus:outline-none text-xl font-bold text-slate-900 bg-transparent placeholder:text-slate-200 leading-relaxed"
                    disabled={isSubmitting}
                  />
                )}
              </div>
                <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={(Array.isArray(answer) ? answer.length === 0 : !(answer as string).trim()) || isSubmitting}
                    className="px-12 py-5 bg-brand-600 text-white font-black rounded-[24px] hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-brand-500/20 flex items-center active:scale-95 group"
                  >
                    {isSubmitting ? (
                      <>
                        <RotateCcw className="w-5 h-5 mr-3 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        Submit Answer
                        <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col bg-white rounded-[48px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-12 space-y-10 overflow-y-auto relative overflow-hidden group"
            >
              {/* Subtle background flourish for correct answers */}
              {result.isCorrect && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0.5 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute top-0 left-0 w-full h-full bg-brand-100 rounded-full pointer-events-none z-0"
                  style={{ transformOrigin: 'top left' }}
                />
              )}

              <div className="flex items-center justify-between border-b border-slate-100 pb-10 relative z-10">
                <div className="flex items-center">
                  <div className={`p-5 rounded-[24px] mr-6 ${result.isCorrect ? 'bg-brand-100 text-brand-600' : 'bg-red-100 text-red-600'}`}>
                    {result.isCorrect ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
                  </div>
                  <div>
                    <h3 className={`text-3xl font-black tracking-tighter ${result.isCorrect ? 'text-brand-900' : 'text-red-900'}`}>
                      {result.isCorrect ? 'Brilliant!' : 'Not quite...'}
                    </h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                      {result.marksAwarded} / {currentQuestion.maxMarks} Marks Awarded
                    </p>
                  </div>
                </div>
                <div className={`text-4xl font-black tracking-tighter ${result.isCorrect ? 'text-brand-600' : 'text-red-600'}`}>
                  {Math.round((result.marksAwarded / currentQuestion.maxMarks) * 100)}%
                </div>
              </div>

              <div className="space-y-8 relative z-10">
                <div className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Mastery Feedback</h4>
                  <div className="prose prose-slate prose-lg max-w-none font-bold text-slate-700 leading-relaxed">
                    <Markdown>{result.feedback}</Markdown>
                  </div>
                </div>

                {result.improvementTip && (
                  <div className="bg-brand-50/30 rounded-[32px] p-8 border border-brand-100">
                    <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-4">Improvement Tip</h4>
                    <p className="text-xl font-bold text-brand-900 leading-relaxed">{result.improvementTip}</p>
                  </div>
                )}
              </div>

              <div className="pt-10 mt-auto relative z-10 flex gap-4">
                {!result.isCorrect && (
                  <button
                    onClick={() => { setAnswer(''); setResult(null); }}
                    className="flex-1 py-6 bg-slate-50 text-slate-900 font-black rounded-[24px] hover:bg-slate-100 transition-all flex items-center justify-center active:scale-95 group"
                  >
                    <RotateCcw className="w-6 h-6 mr-3 group-hover:rotate-180 transition-transform duration-500" />
                    Retry
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex-[2] py-6 bg-slate-900 text-white font-black rounded-[24px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center active:scale-95 group"
                >
                  {currentQuestionIndex + 1 >= task.totalQuestions ? (
                    <>
                      Complete Session
                      <CheckCircle2 className="w-6 h-6 ml-3 group-hover:scale-110 transition-transform" />
                    </>
                  ) : (
                    <>
                      Next Challenge
                      <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </main>

      {/* Leave Warning Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[48px] p-16 max-w-xl w-full shadow-2xl border border-slate-100 relative overflow-hidden"
          >
            <div className="w-24 h-24 bg-amber-50 rounded-[32px] flex items-center justify-center mx-auto mb-10 border border-amber-100">
              <AlertTriangle className="w-12 h-12 text-amber-500" />
            </div>
            <h3 className="text-4xl font-black text-slate-900 text-center mb-4 tracking-tighter">Wait! Don't leave yet.</h3>
            <p className="text-slate-500 text-center mb-12 text-lg font-medium leading-relaxed">
              The timer will <span className="font-black text-red-600 underline decoration-red-200 underline-offset-4">NOT</span> stop if you leave. Your progress will be submitted automatically if time runs out.
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-6 bg-brand-600 text-white rounded-[24px] font-black text-lg hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 active:scale-95"
              >
                Continue Practice
              </button>
              <button 
                onClick={handleLeave}
                className="w-full py-6 bg-slate-50 text-slate-400 rounded-[24px] font-black text-lg hover:bg-slate-100 transition-all active:scale-95"
              >
                Go to Dashboard
              </button>
            </div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
