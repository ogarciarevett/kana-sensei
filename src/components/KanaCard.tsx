type Props = {
  char: string;
  size?: 'sm' | 'lg';
};

export function KanaCard({ char, size = 'lg' }: Props) {
  const cls = size === 'lg' ? 'text-[96px] leading-none' : 'text-4xl';
  return (
    <div className={`font-ja ${cls} text-neutral-900 select-none`}>
      {char}
    </div>
  );
}
