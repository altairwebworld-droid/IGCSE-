import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, Target, Award, AlertCircle, FileText, Share2, Sparkles } from 'lucide-react';
import { getGrade } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Progress() {
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

  if (loading) return <div className="flex h-screen items-center justify-center">Loading progress...</div>;

  // Process data for charts
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const chartData = last7Days.map(date => {
    const dayAttempts = attempts.filter(a => a.timestamp?.startsWith(date));
    const totalMarks = dayAttempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
    const maxMarks = dayAttempts.reduce((sum, a) => sum + (a.maxMarks || 0), 0);
    const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
    return {
      date: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
      percentage: Math.round(percentage),
    };
  });

  const subjectPerformance = attempts.reduce((acc: any, curr) => {
    const subject = curr.subject || 'Unknown';
    if (!acc[subject]) acc[subject] = { total: 0, max: 0, count: 0 };
    acc[subject].total += curr.marksAwarded || 0;
    acc[subject].max += curr.maxMarks || 0;
    acc[subject].count += 1;
    return acc;
  }, {});

  const subjectChartData = Object.keys(subjectPerformance).map(subject => ({
    subject: subject.split(' – ')[0],
    percentage: Math.round((subjectPerformance[subject].total / subjectPerformance[subject].max) * 100),
  }));

  const overallPercentage = attempts.reduce((sum, a) => sum + (a.maxMarks || 0), 0) > 0 
    ? Math.round((attempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0) / attempts.reduce((sum, a) => sum + (a.maxMarks || 0), 0)) * 100)
    : 0;

  const predictedGrade = getGrade(overallPercentage);

  const stats = {
    today: attempts.filter(a => {
      const d = new Date(a.timestamp || '');
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length,
    month: attempts.filter(a => {
      const d = new Date(a.timestamp || '');
      const today = new Date();
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length,
    overall: attempts.length
  };

  const handleGenerateReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(40);
    doc.text('IGCSE Performance Report', 14, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Student: ${userData?.displayName || 'Unknown'}`, 14, 35);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 41);
    
    doc.setLineWidth(0.5);
    doc.line(14, 46, pageWidth - 14, 46);

    // Overall Stats
    doc.setFontSize(16);
    doc.setTextColor(40);
    doc.text('Overall Summary', 14, 58);
    
    autoTable(doc, {
      startY: 63,
      head: [['Metric', 'Value']],
      body: [
        ['Learning Progress', `${overallPercentage}%`],
        ['Overall Predicted Grade', predictedGrade],
        ['Questions Answered Today', stats.today.toString()],
        ['Questions Answered This Month', stats.month.toString()],
        ['Total Questions Answered', stats.overall.toString()],
        ['Focus Areas Identified', (userData?.weakTopics?.length || 0).toString()],
        ['Strong Areas Identified', (userData?.strongTopics?.length || 0).toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181] }
    });

    // Subject Breakdown
    doc.setFontSize(16);
    doc.text('Subject Performance Breakdown', 14, (doc as any).lastAutoTable.finalY + 15);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Subject', 'Progress %', 'Grade', 'Attempts']],
      body: Object.keys(subjectPerformance).map(subject => {
        const perc = Math.round((subjectPerformance[subject].total / subjectPerformance[subject].max) * 100);
        return [
          subject,
          `${perc}%`,
          getGrade(perc),
          subjectPerformance[subject].count.toString()
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] }
    });

    // Recommendations
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(16);
    doc.text('Strategic Recommendations', 14, finalY);
    
    doc.setFontSize(11);
    doc.setTextColor(60);
    const recommendations = [
      `1. Focus on ${userData?.weakTopics?.slice(0, 3).join(', ') || 'identifying weak areas'} to improve the predicted ${predictedGrade} grade.`,
      "2. Maintain a daily practice of at least 20 questions per subject.",
      "3. Review examiner feedback regularly to master Cambridge-specific keywords.",
      "4. Use the Flashcards feature to memorize essential definitions."
    ];
    
    recommendations.forEach((rec, i) => {
      doc.text(rec, 14, finalY + 10 + (i * 7));
    });

    doc.save(`IGCSE_Progress_Report_${userData?.displayName || 'Student'}.pdf`);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Performance Analytics</h1>
          <p className="text-xl text-slate-500 font-medium">Track your journey towards Cambridge IGCSE excellence with deep insights.</p>
        </div>
        <button
          onClick={handleGenerateReport}
          className="flex items-center px-10 py-5 bg-brand-600 text-white rounded-[28px] font-bold hover:bg-brand-700 transition-all shadow-xl shadow-brand-100 active:scale-95 group"
        >
          <FileText className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
          Generate Parent Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="stitch-card p-10 group hover:bg-brand-50/30 transition-colors duration-500">
          <div className="flex items-center text-brand-600 mb-6">
            <div className="bg-brand-50 p-3 rounded-2xl mr-4 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Learning Progress</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-6xl font-black text-slate-900 tracking-tighter">{overallPercentage}%</p>
            <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse" />
          </div>
          <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest">Overall subject knowledge</p>
        </div>

        <div className="stitch-card p-10 group hover:bg-purple-50/30 transition-colors duration-500">
          <div className="flex items-center text-purple-600 mb-6">
            <div className="bg-purple-50 p-3 rounded-2xl mr-4 group-hover:scale-110 transition-transform">
              <Award className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Predicted Grade</span>
          </div>
          <p className="text-6xl font-black text-slate-900 tracking-tighter">{predictedGrade}</p>
          <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest">Cambridge Estimate</p>
        </div>

        <div className="stitch-card p-10 group hover:bg-emerald-50/30 transition-colors duration-500">
          <div className="flex items-center text-emerald-600 mb-6">
            <div className="bg-emerald-50 p-3 rounded-2xl mr-4 group-hover:scale-110 transition-transform">
              <Target className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Questions Answered</span>
          </div>
          <div className="flex items-baseline space-x-3">
            <p className="text-6xl font-black text-slate-900 tracking-tighter">{stats.today}</p>
            <p className="text-xl font-bold text-slate-300 uppercase tracking-widest">Today</p>
          </div>
          <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest">{stats.month} this month | {stats.overall} overall</p>
        </div>

        <div className="stitch-card p-10 group hover:bg-amber-50/30 transition-colors duration-500">
          <div className="flex items-center text-amber-600 mb-6">
            <div className="bg-amber-50 p-3 rounded-2xl mr-4 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Focus Needed</span>
          </div>
          <div className="space-y-2">
            {userData?.weakTopics?.length > 0 ? (
              userData.weakTopics.slice(0, 2).map((topic: string, i: number) => (
                <p key={i} className="text-lg font-black text-slate-900 truncate tracking-tight">{topic}</p>
              ))
            ) : (
              <p className="text-6xl font-black text-slate-900 tracking-tighter">0</p>
            )}
          </div>
          <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest">Topics requiring attention</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="stitch-card p-12">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">7-Day Performance Trend</h2>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-brand-500 rounded-full" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mastery %</span>
            </div>
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} 
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                    padding: '20px'
                  }}
                  itemStyle={{ fontWeight: 900, color: '#0f172a' }}
                  labelStyle={{ fontWeight: 700, color: '#64748b', marginBottom: '4px' }}
                  formatter={(value: number) => [`${value}%`, 'Mastery']}
                />
                <Line 
                  type="monotone" 
                  dataKey="percentage" 
                  stroke="#3b82f6" 
                  strokeWidth={6} 
                  dot={{ r: 6, fill: '#3b82f6', strokeWidth: 4, stroke: '#fff' }} 
                  activeDot={{ r: 10, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stitch-card p-12">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Performance by Subject</h2>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject Mastery</span>
            </div>
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="subject" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 800 }} 
                  width={120} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                    padding: '20px'
                  }}
                  itemStyle={{ fontWeight: 900, color: '#0f172a' }}
                  labelStyle={{ fontWeight: 700, color: '#64748b', marginBottom: '4px' }}
                  formatter={(value: number) => [`${value}%`, 'Mastery']}
                />
                <Bar 
                  dataKey="percentage" 
                  fill="#8b5cf6" 
                  radius={[0, 12, 12, 0]} 
                  barSize={32} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grade Predictor & Advice */}
      <div className="bg-slate-900 rounded-[48px] shadow-2xl p-16 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-600/20 to-transparent pointer-events-none" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <div className="inline-flex items-center px-6 py-2 bg-brand-500/20 rounded-full border border-brand-500/30">
              <Sparkles className="w-4 h-4 text-brand-400 mr-2" />
              <span className="text-xs font-black uppercase tracking-widest text-brand-400">AI Strategic Insight</span>
            </div>
            <h2 className="text-5xl font-black tracking-tighter leading-tight">
              You are on track for a <span className="text-brand-400 underline decoration-brand-400/30 decoration-8 underline-offset-8">{predictedGrade}</span> grade.
            </h2>
            <p className="text-xl text-slate-400 font-medium leading-relaxed">
              Based on your current performance across all subjects, we've analyzed your learning patterns to predict your final Cambridge IGCSE outcome.
            </p>
            <div className="flex items-center p-8 bg-white/5 rounded-[32px] border border-white/10 group-hover:bg-white/10 transition-colors duration-500">
              <div className="bg-brand-500 p-4 rounded-2xl mr-6 shadow-xl shadow-brand-500/20">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-black tracking-tight">To reach an A* grade:</h4>
                <p className="text-slate-400 font-medium mt-1">Focus on subjects where you are below 85%. Consistency in daily practice is key.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 rounded-[40px] p-12 border border-white/10 backdrop-blur-xl">
            <h4 className="text-2xl font-black mb-8 tracking-tight flex items-center">
              <Target className="w-8 h-8 text-brand-400 mr-4" />
              Top Recommendations
            </h4>
            <ul className="space-y-8">
              {[
                "Complete at least 20 questions per subject daily.",
                "Review examiner feedback on \"Focus Areas\" page.",
                "Prepare for the full-length mock exam this weekend."
              ].map((rec, i) => (
                <li key={i} className="flex items-start group/item">
                  <div className="w-8 h-8 bg-brand-500/20 rounded-xl flex items-center justify-center mr-6 group-hover/item:bg-brand-500 transition-colors duration-300">
                    <span className="text-brand-400 font-black group-hover/item:text-white transition-colors">{i + 1}</span>
                  </div>
                  <p className="text-lg font-bold text-slate-300 leading-snug group-hover/item:text-white transition-colors">{rec}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
