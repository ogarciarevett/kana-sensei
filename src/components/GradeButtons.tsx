import type { Grade } from '../lib/types';

type Props = {
  onGrade: (g: Grade) => void;
  disabled?: boolean;
};

const BUTTONS: { grade: Grade; label: string; cls: string; key: string }[] = [
  { grade: 'again', label: 'Otra vez', cls: 'bg-rose-500 text-white hover:bg-rose-600', key: '1' },
  { grade: 'hard',  label: 'Difícil',  cls: 'bg-amber-500 text-white hover:bg-amber-600', key: '2' },
  { grade: 'good',  label: 'Bien',     cls: 'bg-neutral-800 text-white hover:bg-neutral-900', key: '3' },
  { grade: 'easy',  label: 'Fácil',    cls: 'bg-emerald-500 text-white hover:bg-emerald-600', key: '4' }
];

export function GradeButtons({ onGrade, disabled }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {BUTTONS.map(b => (
        <button
          key={b.grade}
          disabled={disabled}
          onClick={() => onGrade(b.grade)}
          className={`${b.cls} rounded-md px-3 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className="block">{b.label}</span>
          <span className="block text-xs opacity-70">{b.key}</span>
        </button>
      ))}
    </div>
  );
}
