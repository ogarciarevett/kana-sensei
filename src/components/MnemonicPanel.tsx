import type { KanaInfo } from '../lib/types';

type Props = {
  info: KanaInfo;
};

export function MnemonicPanel({ info }: Props) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-relaxed">
      <p className="text-neutral-800">{info.mnemonic}</p>
      {info.anime_ref && (
        <p className="mt-2 text-xs text-neutral-500">Referencia: {info.anime_ref}</p>
      )}
      <div className="mt-3 border-t border-neutral-100 pt-3">
        <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Ejemplo</p>
        <p>
          <span className="font-ja text-lg">{info.example_word.word}</span>
          <span className="ml-2 text-neutral-500">({info.example_word.reading})</span>
          <span className="ml-2 text-neutral-700">— {info.example_word.meaning}</span>
        </p>
      </div>
    </div>
  );
}
