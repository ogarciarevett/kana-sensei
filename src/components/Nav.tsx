import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';

export function Nav() {
  const streak = useStore(s => s.user.streak);
  const loc = useLocation();
  const linkCls = (path: string) =>
    `text-sm ${loc.pathname === path ? 'text-neutral-900 font-semibold' : 'text-neutral-500 hover:text-neutral-800'}`;
  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="font-semibold tracking-tight">
          Kana<span className="font-ja"> 先生</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/practice" className={linkCls('/practice')}>Repasar</Link>
          <Link to="/learn/new" className={linkCls('/learn/new')}>Aprender</Link>
          <Link to="/learned" className={linkCls('/learned')}>Practicados</Link>
          <Link to="/quest/import" className={linkCls('/quest/import')}>Quest</Link>
          <Link to="/ask-claude" className={linkCls('/ask-claude')}>Preguntar</Link>
          <span className="text-sm text-neutral-500">🔥 {streak}</span>
        </div>
      </div>
    </nav>
  );
}
