import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskSession from './pages/TaskSession';
import StudyAids from './pages/StudyAids';
import AdminDashboard from './pages/AdminDashboard';
import Onboarding from './pages/Onboarding';
import RevisionSheet from './pages/RevisionSheet';
import Progress from './pages/Progress';
import FocusAreas from './pages/FocusAreas';
import Flashcards from './pages/Flashcards';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userData, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-xl">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // If user data is loaded but onboarding is not completed, force them to onboarding
  if (userData && userData.onboardingCompleted === false && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="study-aids" element={<StudyAids />} />
            <Route path="progress" element={<Progress />} />
            <Route path="focus-areas" element={<FocusAreas />} />
            <Route path="flashcards" element={<Flashcards />} />
            <Route path="task/:taskId" element={<TaskSession />} />
            <Route path="revision/:taskId" element={<RevisionSheet />} />
            <Route path="admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
