import { Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Dashboard } from './pages/Dashboard';
import { Practice } from './pages/Practice';
import { LearnNew } from './pages/LearnNew';
import { Learned } from './pages/Learned';
import { QuestImport } from './pages/QuestImport';
import { AskClaude } from './pages/AskClaude';

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/learn/new" element={<LearnNew />} />
        <Route path="/learned" element={<Learned />} />
        <Route path="/quest/import" element={<QuestImport />} />
        <Route path="/ask-claude" element={<AskClaude />} />
      </Routes>
    </div>
  );
}
