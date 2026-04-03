import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { IGCSE_SUBJECTS } from '../constants';
import { CheckCircle2, ChevronRight, GraduationCap } from 'lucide-react';

export default function Onboarding() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState(userData?.displayName || '');
  const [school, setSchool] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [easySubjects, setEasySubjects] = useState<string[]>([]);
  const [hardSubjects, setHardSubjects] = useState<string[]>([]);
  const [preferredExamDay, setPreferredExamDay] = useState('Friday');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubjectToggle = (subject: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (list.includes(subject)) {
      setList(list.filter(s => s !== subject));
    } else {
      setList([...list, subject]);
    }
  };

  const generateStudentCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'STU-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleComplete = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const studentCode = generateStudentCode();
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: name,
        school: school,
        parentPhone: parentPhone,
        telegramChatId: telegramChatId,
        studentCode: studentCode,
        strongTopics: easySubjects,
        weakTopics: hardSubjects,
        preferredExamDay: preferredExamDay,
        onboardingCompleted: true
      });
      // Force reload to update context or just navigate and let it handle
      window.location.href = '/';
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-600 p-8 text-white text-center">
          <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl font-bold mb-2">Welcome to IGCSE Prep!</h1>
          <p className="text-blue-100">Let's personalize your learning experience.</p>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your School</label>
                <input 
                  type="text" 
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Cambridge International School"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parent/Teacher WhatsApp Number</label>
                <input 
                  type="tel" 
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="+263 77 000 0000"
                />
                <p className="mt-1 text-xs text-gray-500 italic">Reports will be auto-generated and sent to this number after each session.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telegram Chat ID (Free Alternative)</label>
                <input 
                  type="text" 
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 123456789"
                />
                <p className="mt-1 text-xs text-gray-500 italic">
                  To get your Chat ID, message <strong>@userinfobot</strong> on Telegram.
                </p>
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!name.trim() || !school.trim() || (!parentPhone.trim() && !telegramChatId.trim())}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
              >
                Next Step <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-gray-900">Which subjects do you find EASY?</h2>
              <p className="text-gray-500 text-sm">Select the subjects you are confident in.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                {IGCSE_SUBJECTS.map(subject => (
                  <button
                    key={subject.name}
                    onClick={() => handleSubjectToggle(subject.name, easySubjects, setEasySubjects)}
                    className={`flex items-center p-3 rounded-xl border text-left transition-all ${
                      easySubjects.includes(subject.name) 
                        ? 'border-green-500 bg-green-50 ring-1 ring-green-500' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
                      easySubjects.includes(subject.name) ? 'border-green-500 bg-green-500' : 'border-gray-300'
                    }`}>
                      {easySubjects.includes(subject.name) && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{subject.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex space-x-4">
                <button 
                  onClick={() => setStep(1)}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center"
                >
                  Next Step <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-gray-900">Which subjects do you want to IMPROVE?</h2>
              <p className="text-gray-500 text-sm">Select the subjects you find challenging.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                {IGCSE_SUBJECTS.filter(s => !easySubjects.includes(s.name)).map(subject => (
                  <button
                    key={subject.name}
                    onClick={() => handleSubjectToggle(subject.name, hardSubjects, setHardSubjects)}
                    className={`flex items-center p-3 rounded-xl border text-left transition-all ${
                      hardSubjects.includes(subject.name) 
                        ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
                      hardSubjects.includes(subject.name) ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                    }`}>
                      {hardSubjects.includes(subject.name) && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{subject.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex space-x-4">
                <button 
                  onClick={() => setStep(2)}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center"
                >
                  Next Step <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-gray-900">When would you like to take your weekly Mock Exam?</h2>
              <p className="text-gray-500 text-sm">We recommend Friday or Saturday to review your week's progress.</p>
              
              <div className="grid grid-cols-2 gap-4">
                {['Friday', 'Saturday'].map(day => (
                  <button
                    key={day}
                    onClick={() => setPreferredExamDay(day)}
                    className={`py-6 px-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-3 ${
                      preferredExamDay === day 
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-offset-2' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      preferredExamDay === day ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}>
                      {preferredExamDay === day && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`text-lg font-bold ${preferredExamDay === day ? 'text-blue-700' : 'text-gray-700'}`}>{day}</span>
                  </button>
                ))}
              </div>

              <div className="flex space-x-4 pt-4">
                <button 
                  onClick={() => setStep(3)}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Complete Setup'} <CheckCircle2 className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
