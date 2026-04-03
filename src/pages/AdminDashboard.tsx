import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, count, writeBatch } from 'firebase/firestore';
import { Settings, Save, Loader2, Users, Database, Lock, TrendingUp, BookOpen, DatabaseBackup } from 'lucide-react';
import { IGCSE_SUBJECTS } from '../constants';
import { seedData } from '../services/seedData';

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [isLocked, setIsLocked] = useState(true);
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [defaultQuestionCount, setDefaultQuestionCount] = useState(5);
  const [students, setStudents] = useState<any[]>([]);
  const [subjectStats, setSubjectStats] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Settings
      const settingsRef = doc(db, 'settings', 'general');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        setDefaultQuestionCount(settingsSnap.data().defaultQuestionCount || 5);
      }

      // Fetch Students
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      setStudents(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Question Bank Stats
      const stats: Record<string, number> = {};
      for (const subject of IGCSE_SUBJECTS) {
        const q = query(collection(db, 'questionBank'), where('subject', '==', subject.name));
        const snap = await getDocs(q);
        stats[subject.name] = snap.size;
      }
      setSubjectStats(stats);

    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && !isLocked) {
      fetchData();
    }
  }, [isAdmin, isLocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey === '1111') {
      setIsLocked(false);
    } else {
      alert("Invalid Admin Key");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        defaultQuestionCount
      }, { merge: true });
      alert("Settings saved successfully.");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSeedData = async () => {
    if (!window.confirm("This will populate the question bank and flashcards with initial IGCSE data. Continue?")) return;
    setSeeding(true);
    try {
      await seedData();
      await fetchData();
      alert("Data seeded successfully!");
    } catch (error) {
      console.error("Error seeding data:", error);
      alert("Failed to seed data.");
    } finally {
      setSeeding(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-xl border border-gray-200">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 bg-red-50 rounded-full mb-6">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Panel Locked</h2>
          <p className="text-gray-600 mb-8">Enter the administrative key to access management tools.</p>
          
          <form onSubmit={handleUnlock} className="w-full space-y-4">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter Key"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
            >
              Unlock Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Settings className="w-8 h-8 text-gray-900" />
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        <button 
          onClick={() => setIsLocked(true)}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
        >
          <Lock className="w-4 h-4 mr-2" /> Lock Panel
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center text-blue-600 mb-4">
            <Users className="w-6 h-6 mr-3" />
            <h3 className="font-bold">Total Students</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900">{students.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center text-purple-600 mb-4">
            <Database className="w-6 h-6 mr-3" />
            <h3 className="font-bold">Question Bank Size</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900">
            {Object.values(subjectStats).reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center text-green-600 mb-4">
            <TrendingUp className="w-6 h-6 mr-3" />
            <h3 className="font-bold">Avg. Mastery</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900">
            {students.length > 0 
              ? Math.round(students.reduce((a, b) => a + (b.masteryPercentage || 0), 0) / students.length)
              : 0}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Student List */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Student Progress
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Mastery</th>
                  <th className="px-6 py-4">XP</th>
                  <th className="px-6 py-4">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold mr-3">
                          {student.displayName?.[0] || 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{student.displayName}</p>
                          <p className="text-xs text-gray-500">{student.school}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2 max-w-[60px]">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${student.masteryPercentage || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">{student.masteryPercentage || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-purple-600">{student.xp || 0} XP</td>
                    <td className="px-6 py-4 text-sm font-medium text-orange-600">{student.streak || 0} Days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Question Bank Stats */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Database className="w-5 h-5 mr-2 text-purple-600" />
              Question Bank Distribution
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {IGCSE_SUBJECTS.map((subject) => (
              <div key={subject.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center">
                  <div className={`${subject.bg} p-2 rounded-lg mr-4`}>
                    <subject.icon className={`w-5 h-5 ${subject.color}`} />
                  </div>
                  <span className="font-bold text-gray-800">{subject.name}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-gray-900 mr-2">{subjectStats[subject.name] || 0}</span>
                  <span className="text-xs font-bold text-gray-400 uppercase">Questions</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Global Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-gray-600" />
            Global Configuration
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Number of Questions per Task
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={defaultQuestionCount}
                onChange={(e) => setDefaultQuestionCount(parseInt(e.target.value) || 1)}
                className="w-full max-w-xs px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                This determines how many questions are generated when a student creates a new practice task.
              </p>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-100"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                Save Configuration
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <DatabaseBackup className="w-5 h-5 mr-2 text-purple-600" />
            Maintenance & Seeding
          </h2>
          
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              Populate the question bank and flashcards with high-quality, standard IGCSE content to ensure students have immediate access to study materials.
            </p>

            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs text-purple-700 font-medium">
                Note: This will only add missing data and will not overwrite existing custom questions or cards.
              </p>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="flex items-center px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-lg shadow-purple-100"
              >
                {seeding ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <DatabaseBackup className="w-5 h-5 mr-2" />}
                Seed IGCSE Data Bank
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
