import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Printer, CheckCircle2, XCircle, FileDown, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function RevisionSheet() {
  const { taskId } = useParams();
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!taskId || !user) return;
      
      try {
        const taskRef = doc(db, 'tasks', taskId);
        const taskSnap = await getDoc(taskRef);
        
        if (taskSnap.exists()) {
          setTask(taskSnap.data());
        }

        const attemptsQuery = query(collection(db, 'attempts'), where('taskId', '==', taskId));
        const attemptsSnap = await getDocs(attemptsQuery);
        setAttempts(attemptsSnap.docs.map(d => d.data()));
      } catch (error) {
        console.error("Error fetching revision data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [taskId, user]);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading revision sheet...</div>;
  if (!task) return <div className="flex h-screen items-center justify-center">Task not found.</div>;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text('IGCSE Revision Sheet', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Student: ${userData?.displayName || 'Unknown'}`, 14, 32);
    doc.text(`Subject: ${task.subject}`, 14, 38);
    doc.text(`Date: ${new Date(task.createdAt).toLocaleDateString()}`, 14, 44);
    doc.text(`Score: ${attempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0)} / ${task.questions?.reduce((sum: number, q: any) => sum + (q.maxMarks || 0), 0)}`, 14, 50);
    
    doc.setLineWidth(0.5);
    doc.line(14, 55, pageWidth - 14, 55);

    let yPos = 65;

    task.questions?.forEach((q: any, idx: number) => {
      const attempt = attempts.find(a => a.questionId === q.id);
      
      // Check for page overflow
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(40);
      doc.setFont('helvetica', 'bold');
      doc.text(`Question ${idx + 1} [${q.maxMarks} marks]`, 14, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      const splitText = doc.splitTextToSize(q.text, pageWidth - 28);
      doc.text(splitText, 14, yPos);
      yPos += (splitText.length * 5) + 5;

      // Table for answers
      autoTable(doc, {
        startY: yPos,
        head: [['Student Answer', 'Model Answer']],
        body: [[attempt?.studentAnswer || 'No answer', q.correctAnswer]],
        theme: 'striped',
        headStyles: { fillColor: [63, 81, 181] },
        styles: { fontSize: 10, cellPadding: 5 },
        margin: { left: 14, right: 14 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      if (attempt?.feedback) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100);
        const feedbackText = doc.splitTextToSize(`Feedback: ${attempt.feedback}`, pageWidth - 28);
        doc.text(feedbackText, 14, yPos);
        yPos += (feedbackText.length * 5) + 15;
      }
    });

    doc.save(`IGCSE_Revision_${task.subject}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-8 md:p-16 print:bg-white print:p-0">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 print:hidden">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-[24px] font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 mr-3" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExportPDF} 
              className="flex items-center px-8 py-4 bg-white text-brand-600 border border-brand-100 rounded-[24px] font-bold hover:bg-brand-50 transition-all shadow-sm active:scale-95"
            >
              <FileDown className="w-5 h-5 mr-3" />
              Export PDF
            </button>
            <button 
              onClick={handlePrint} 
              className="flex items-center px-8 py-4 bg-brand-600 text-white rounded-[24px] font-bold hover:bg-brand-700 transition-all shadow-xl shadow-brand-100 active:scale-95"
            >
              <Printer className="w-5 h-5 mr-3" />
              Print Sheet
            </button>
          </div>
        </div>

        <div className="stitch-card p-12 print:shadow-none print:border-none print:p-0 bg-white">
          {/* Header */}
          <div className="border-b border-slate-100 pb-10 mb-12">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Revision Sheet</h1>
              <div className="px-6 py-2 bg-brand-50 text-brand-600 text-xs font-black rounded-full uppercase tracking-widest border border-brand-100">
                Official Record
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Student Name</span>
                  <span className="text-sm font-bold text-slate-900">{userData?.displayName || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Student Code</span>
                  <span className="text-sm font-bold text-slate-900">{userData?.studentCode || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">School</span>
                  <span className="text-sm font-bold text-slate-900">{userData?.school || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Subject</span>
                  <span className="text-sm font-bold text-slate-900">{task.subject}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Date</span>
                  <span className="text-sm font-bold text-slate-900">{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-brand-50 rounded-2xl border border-brand-100">
                  <span className="text-xs font-black text-brand-600 uppercase tracking-widest">Final Score</span>
                  <span className="text-sm font-black text-brand-600">
                    {attempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0)} / {task.questions?.reduce((sum: number, q: any) => sum + (q.maxMarks || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-16">
            {task.questions?.map((q: any, idx: number) => {
              const attempt = attempts.find(a => a.questionId === q.id);
              return (
                <div key={q.id} className="break-inside-avoid group">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black mr-4 shadow-lg shadow-slate-200">
                        {idx + 1}
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Question {idx + 1}</h3>
                    </div>
                    <span className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-widest border border-slate-200">
                      {q.maxMarks} Marks Available
                    </span>
                  </div>
                  
                  <div className="p-8 bg-slate-50/50 rounded-[32px] border border-slate-100 mb-8 group-hover:bg-slate-50 transition-colors">
                    <p className="text-lg font-bold text-slate-900 leading-relaxed">{q.text}</p>
                    
                    {q.imageUrl && (
                      <div className="mt-8 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white p-4">
                        <img src={q.imageUrl} alt="Question diagram" className="max-h-64 mx-auto object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Student Answer */}
                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                      <div className="flex items-center justify-between mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student's Response</p>
                        {attempt && (
                          <div className={`p-2 rounded-xl ${attempt.isCorrect ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                            {attempt.isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                          </div>
                        )}
                      </div>
                      <p className="text-slate-900 font-bold leading-relaxed whitespace-pre-wrap min-h-[100px]">
                        {attempt?.studentAnswer || <span className="text-slate-300 italic">No answer provided</span>}
                      </p>
                      {attempt && (
                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Marks Awarded</span>
                          <span className={`text-lg font-black ${attempt.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                            {attempt.marksAwarded} / {q.maxMarks}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Model Answer */}
                    <div className="bg-brand-50 p-8 rounded-[32px] border border-brand-100/50 relative overflow-hidden">
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-6">Model Answer / Mark Scheme</p>
                      <p className="text-brand-950 font-bold leading-relaxed whitespace-pre-wrap min-h-[100px]">{q.correctAnswer}</p>
                      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-brand-200/20 rounded-full blur-3xl" />
                    </div>
                  </div>

                  {/* Feedback */}
                  {attempt?.feedback && (
                    <div className="mt-8 bg-amber-50 p-8 rounded-[32px] border border-amber-100 relative overflow-hidden group/feedback">
                      <div className="flex items-center mb-4">
                        <Sparkles className="w-5 h-5 text-amber-500 mr-3" />
                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Examiner Feedback</p>
                      </div>
                      <p className="text-amber-950 font-bold leading-relaxed relative z-10">{attempt.feedback}</p>
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/40 rounded-full blur-3xl group-hover/feedback:scale-150 transition-transform duration-1000" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
