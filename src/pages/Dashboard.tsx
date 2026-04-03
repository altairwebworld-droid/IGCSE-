import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Play, TrendingUp, AlertCircle, CheckCircle2, Search, Loader2, Plus, Dna, FlaskConical, Atom, Coins, Briefcase, LineChart, BookA, Calculator, Globe, Code, Activity, Sparkles, Calendar as CalendarIcon, MessageSquare, Send, RotateCcw } from 'lucide-react';
import { askGeneralQuestion, generateIGCSEQuestions } from '../services/gemini';
import Markdown from 'react-markdown';
import { IGCSE_SUBJECTS, getGrade } from '../constants';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Calculate upcoming exams (mock data for now, could be fetched from settings/user profile)
  const upcomingExams = [
    { subject: 'Biology', date: '2026-05-15', daysLeft: 42 },
    { subject: 'Chemistry', date: '2026-05-18', daysLeft: 45 },
    { subject: 'Physics', date: '2026-05-22', daysLeft: 49 },
  ];

  const [isGeneratingTask, setIsGeneratingTask] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [defaultQuestionCount, setDefaultQuestionCount] = useState(20);

  const [stats, setStats] = useState({
    today: 0,
    month: 0,
    overall: 0
  });

  // Generate a realistic schedule based on the student's weak topics and the current day
  const getDailyTasks = () => {
    // Use Zimbabwe time (UTC+2)
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Africa/Harare', weekday: 'long' };
    const today = new Intl.DateTimeFormat('en-US', options).format(new Date());
    
    // Every day, the student should do ALL subjects
    const dailySubjects = IGCSE_SUBJECTS.map(s => s.name);
    
    // Exam Day: Student's preferred day (default to Friday if not set)
    const preferredDay = userData?.preferredExamDay || 'Friday';
    const isExamDay = today === preferredDay;

    return { today, dailySubjects, isExamDay, preferredDay };
  };

  const { today, dailySubjects, isExamDay, preferredDay } = getDailyTasks();

  const [isUpdatingExamDay, setIsUpdatingExamDay] = useState(false);
  const [didYouKnow, setDidYouKnow] = useState('');

  const IGCSE_FACTS = [
    "Fractional distillation is used to separate a mixture of liquids with different boiling points.",
    "The rate of reaction increases with temperature because particles have more kinetic energy and collide more frequently with energy ≥ activation energy.",
    "Enzymes are biological catalysts that speed up chemical reactions without being used up.",
    "In a series circuit, the current is the same at all points.",
    "The Haber process is used to manufacture ammonia from nitrogen and hydrogen.",
    "Mitosis produces two genetically identical daughter cells, while meiosis produces four genetically different gametes.",
    "A balanced diet includes carbohydrates, proteins, fats, vitamins, minerals, water, and fiber.",
    "The pH scale measures how acidic or alkaline a substance is, ranging from 0 to 14.",
    "Electrolysis is the breakdown of an ionic compound, molten or in aqueous solution, by the passage of electricity.",
    "Newton's Second Law states that Force = mass × acceleration (F = ma)."
  ];

  const updatePreferredExamDay = async (day: string) => {
    if (!user) return;
    setIsUpdatingExamDay(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferredExamDay: day
      });
      setUserData((prev: any) => ({ ...prev, preferredExamDay: day }));
    } catch (error) {
      console.error("Error updating exam day:", error);
    } finally {
      setIsUpdatingExamDay(false);
    }
  };

  const handleResetAccount = async () => {
    if (!user) return;
    if (window.confirm("Are you sure you want to reset your account? This will clear your progress and you will need to complete onboarding again.")) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          onboardingCompleted: false,
          masteryPercentage: 0,
          weeklyImprovement: 0,
          weakTopics: [],
          strongTopics: [],
          studentCode: null
        });
        window.location.reload();
      } catch (error) {
        console.error("Error resetting account:", error);
      }
    }
  };

  const fetchData = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
      }

      const settingsRef = doc(db, 'settings', 'general');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        setDefaultQuestionCount(settingsSnap.data().defaultQuestionCount || 5);
      }

      const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedTasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(fetchedTasks);

      const attemptsQ = query(collection(db, 'attempts'), where('userId', '==', user.uid));
      const attemptsSnap = await getDocs(attemptsQ);
      const allAttempts = attemptsSnap.docs.map(doc => doc.data());
      
      const today = new Date();
      setStats({
        today: allAttempts.filter(a => {
          const d = new Date(a.timestamp || '');
          return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }).length,
        month: allAttempts.filter(a => {
          const d = new Date(a.timestamp || '');
          return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }).length,
        overall: allAttempts.length
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setDidYouKnow(IGCSE_FACTS[Math.floor(Math.random() * IGCSE_FACTS.length)]);
  }, [user]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult('');
    try {
      const result = await askGeneralQuestion(searchQuery);
      setSearchResult(result);
    } catch (error) {
      setSearchResult("Sorry, I couldn't find an answer right now.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateTask = async (subjectName: string) => {
    if (!user) return;
    setSelectedSubject(subjectName);
    setIsGeneratingTask(true);
    try {
      const questions = await generateIGCSEQuestions(
        subjectName, 
        defaultQuestionCount,
        userData?.weakTopics,
        userData?.strongTopics,
        selectedDifficulty
      );
      if (questions.length > 0) {
        const durationSeconds = questions.length * 120; // 2 mins per question
        const expiresAt = Date.now() + (durationSeconds * 1000);

        const docRef = await addDoc(collection(db, 'tasks'), {
          userId: user.uid,
          subject: subjectName,
          totalQuestions: questions.length,
          completedQuestions: 0,
          isExamMode: true, // Set to true to enable the timer and anti-cheating by default
          status: 'pending',
          questions: questions,
          expiresAt: expiresAt,
          durationSeconds: durationSeconds,
          createdAt: new Date().toISOString()
        });
        await fetchData();
        navigate(`/task/${docRef.id}`);
      } else {
        alert("Failed to generate questions. Please try again.");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      alert("An error occurred while creating the task.");
    } finally {
      setIsGeneratingTask(false);
      setSelectedSubject('');
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  const activeTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const completedTasks = tasks
    .filter(t => t.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const tasksCompletedToday = completedTasks.filter(t => {
    const taskDate = new Date(t.createdAt);
    const todayDate = new Date();
    return taskDate.getDate() === todayDate.getDate() &&
           taskDate.getMonth() === todayDate.getMonth() &&
           taskDate.getFullYear() === todayDate.getFullYear();
  }).length;

  const totalDailyTarget = dailySubjects.length;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10">
      {/* Personalized Welcome */}
      <section className="stitch-card p-10 flex flex-col md:flex-row items-center justify-between bg-gradient-to-br from-white to-brand-50/30">
        <div className="flex items-center space-x-8">
          <div className="hidden md:flex w-24 h-24 bg-brand-600 rounded-3xl items-center justify-center text-white shadow-2xl shadow-brand-200 transform hover:scale-105 transition-transform duration-500">
            <span className="text-4xl font-bold">{userData?.displayName?.[0] || 'S'}</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">Welcome back, {userData?.displayName?.split(' ')[0] || 'Student'}! 👋</h1>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-slate-500 text-lg font-medium">Today is <span className="text-brand-600 font-bold">{today}</span></p>
              <div className="flex items-center bg-orange-50 px-4 py-1.5 rounded-2xl border border-orange-100 shadow-sm">
                <Sparkles className="w-4 h-4 text-orange-500 mr-2" />
                <span className="text-sm font-bold text-orange-700">{userData?.streak || 0} Day Streak</span>
              </div>
              <div className="flex items-center bg-brand-50 px-4 py-1.5 rounded-2xl border border-brand-100 shadow-sm">
                <Activity className="w-4 h-4 text-brand-500 mr-2" />
                <span className="text-sm font-bold text-brand-700">{userData?.xp || 0} XP Earned</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 md:mt-0 flex items-center space-x-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="text-center">
            <p className="text-4xl font-bold text-brand-600">{tasksCompletedToday}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Completed</p>
          </div>
          <div className="w-px h-12 bg-slate-100"></div>
          <div className="text-center">
            <p className="text-4xl font-bold text-amber-500">{Math.max(0, totalDailyTarget - tasksCompletedToday)}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Remaining</p>
          </div>
        </div>
      </section>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Schedule (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          <section className="stitch-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
                  <CalendarIcon className="w-6 h-6 mr-3 text-brand-600" />
                  {isExamDay ? 'Mock Exam Day' : 'Daily Practice Schedule'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">Your personalized path for {today}</p>
              </div>
              {isExamDay && (
                <span className="px-4 py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full uppercase tracking-widest border border-red-100 animate-pulse">
                  Full Exam Mode
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dailySubjects.map((subjectName, idx) => {
                const subjectInfo = IGCSE_SUBJECTS.find(s => s.name === subjectName);
                if (!subjectInfo) return null;
                const Icon = subjectInfo.icon;
                
                const activeTask = activeTasks.find(t => t.subject === subjectName);
                const completedToday = completedTasks.find(t => {
                  const taskDate = new Date(t.createdAt).toLocaleDateString('en-US', { timeZone: 'Africa/Harare' });
                  const todayDate = new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Harare' });
                  return t.subject === subjectName && taskDate === todayDate;
                });
                
                return (
                  <div key={idx} className={`group p-6 rounded-[32px] border transition-all duration-300 ${
                    completedToday 
                      ? 'bg-emerald-50/50 border-emerald-100 shadow-sm' 
                      : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1'
                  }`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center">
                        <div className={`${subjectInfo.bg} p-4 rounded-2xl mr-4 shadow-sm group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-6 h-6 ${subjectInfo.color}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{subjectName.split(' – ')[0]}</h4>
                          <p className="text-xs font-medium text-slate-400">
                            {isExamDay ? 'Full Mock Exam' : '20 Questions Practice'}
                          </p>
                        </div>
                      </div>
                      {completedToday && (
                        <div className="bg-emerald-500 p-1.5 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-auto">
                      {activeTask ? (
                        <button
                          onClick={() => navigate(`/task/${activeTask.id}`)}
                          className="w-full py-3.5 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center justify-center text-sm"
                        >
                          <Play className="w-4 h-4 mr-2 fill-current" /> Resume Session
                        </button>
                      ) : !completedToday ? (
                        <button
                          onClick={() => handleCreateTask(subjectName)}
                          disabled={isGeneratingTask}
                          className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 flex items-center justify-center disabled:opacity-50 text-sm"
                        >
                          {isGeneratingTask && selectedSubject === subjectName ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Start Practice
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/revision/${completedToday.id}`)}
                          className="w-full py-3.5 bg-white text-slate-700 border border-slate-200 font-bold rounded-2xl hover:bg-slate-50 transition-all text-sm flex items-center justify-center"
                        >
                          <BookA className="w-4 h-4 mr-2" /> Review Sheet
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Progress & Focus Areas (Bento Style) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="stitch-card p-8 bg-gradient-to-br from-white to-brand-50/20">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                  <div className="bg-brand-100 p-2.5 rounded-xl mr-3">
                    <TrendingUp className="w-5 h-5 text-brand-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Learning Progress</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Predicted Grade</p>
                  <p className="text-2xl font-black text-brand-600">{getGrade(userData?.masteryPercentage || 0)}</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-sm font-bold text-slate-500">Subject Knowledge</p>
                    <p className="text-2xl font-black text-slate-900">{userData?.masteryPercentage || 0}%</p>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                      style={{ width: `${userData?.masteryPercentage || 0}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-900">{stats.today}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Today</p>
                  </div>
                  <div className="text-center border-x border-slate-50">
                    <p className="text-xl font-bold text-slate-900">{stats.month}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Month</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-900">{stats.overall}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Total</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="stitch-card p-8 bg-gradient-to-br from-white to-red-50/20">
              <div className="flex items-center mb-8">
                <div className="bg-red-100 p-2.5 rounded-xl mr-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Focus Needed</h2>
              </div>
              <div className="space-y-3">
                {userData?.weakTopics?.length > 0 ? (
                  userData.weakTopics.slice(0, 4).map((topic: string, i: number) => (
                    <div key={i} className="flex items-center p-3.5 bg-white border border-red-100 rounded-2xl shadow-sm hover:translate-x-1 transition-transform">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-3" />
                      <span className="text-sm font-bold text-slate-700">{topic}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Sparkles className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">No weak topics identified yet!</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Right Column: AI & Schedule (4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          {/* AI Assistant */}
          <section className="stitch-card p-8 bg-slate-900 text-white overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex items-center mb-6">
                <div className="bg-brand-500 p-2.5 rounded-xl mr-3 shadow-lg shadow-brand-500/50">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">AI Assistant</h2>
              </div>

              {activeTasks.length > 0 ? (
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-sm text-slate-300">
                  <AlertCircle className="w-6 h-6 text-amber-400 mb-3" />
                  <p className="leading-relaxed">The AI Assistant is disabled while you have active tasks to prevent cheating. Complete your session to unlock it.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSearch()}
                      placeholder="Ask anything about IGCSE..."
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none h-32 text-sm text-white placeholder:text-slate-500 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="w-full py-4 bg-brand-600 text-white rounded-2xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-lg shadow-brand-600/20 flex items-center justify-center"
                  >
                    {isSearching ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                    {isSearching ? 'Thinking...' : 'Ask AI'}
                  </button>
                  {searchResult && (
                    <div className="mt-6 p-6 bg-white/5 rounded-2xl border border-white/10 text-sm text-slate-300 max-h-64 overflow-y-auto custom-scrollbar">
                      <Markdown>{searchResult}</Markdown>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-600/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
          </section>

          {/* Upcoming Exams */}
          <section className="stitch-card p-8">
            <div className="flex items-center mb-8">
              <div className="bg-indigo-100 p-2.5 rounded-xl mr-3">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Exam Countdown</h2>
            </div>
            <div className="space-y-4">
              {upcomingExams.map((exam, idx) => (
                <div key={idx} className="group flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center">
                    <div className="w-1.5 h-8 bg-indigo-500 rounded-full mr-4 group-hover:h-10 transition-all" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{exam.subject}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(exam.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-black text-indigo-600">{exam.daysLeft}</span>
                    <span className="text-[9px] uppercase tracking-widest font-black text-indigo-400">Days</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Fact */}
          <section className="stitch-card p-8 bg-brand-600 text-white relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 text-yellow-300 mr-2" />
                  <h3 className="font-bold text-sm tracking-widest uppercase">Quick Fact</h3>
                </div>
                <button 
                  onClick={() => setDidYouKnow(IGCSE_FACTS[Math.floor(Math.random() * IGCSE_FACTS.length)])}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-lg font-bold leading-relaxed italic">"{didYouKnow}"</p>
            </div>
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          </section>
        </div>
      </div>

      {/* Archive Section */}
      {completedTasks.length > 0 && (
        <section className="pt-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Recent Activity</h2>
            <button className="text-sm font-bold text-brand-600 hover:text-brand-700">View All Tasks</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {completedTasks.slice(0, 4).map(task => {
              const subjectInfo = IGCSE_SUBJECTS.find(s => s.name === task.subject) || IGCSE_SUBJECTS[0];
              return (
                <div key={task.id} className="stitch-card p-6 group cursor-pointer" onClick={() => navigate(`/task/${task.id}`)}>
                  <div className="flex items-center mb-6">
                    <div className={`${subjectInfo.bg} p-3 rounded-2xl mr-4 group-hover:scale-110 transition-transform`}>
                      <subjectInfo.icon className={`w-5 h-5 ${subjectInfo.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{task.subject.split(' – ')[0]}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(task.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{task.completedQuestions} / {task.totalQuestions} Correct</span>
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/revision/${task.id}`);
                        }}
                        className="p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors"
                        title="Revision Sheet"
                      >
                        <BookA className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
