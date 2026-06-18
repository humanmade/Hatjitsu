import { chooseCardPack } from '@hmpp/shared';
import { Card } from './Card';

export function Deck({ cardPack, myVote, onPick, disabled }: {
  cardPack: string; myVote: string | number | null; onPick: (v: string) => void; disabled: boolean;
}) {
  const cards = chooseCardPack(cardPack);
  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {cards.map((c) => (
        <Card key={String(c)} value={c} selected={String(myVote) === String(c)} disabled={disabled} onClick={() => onPick(String(c))} />
      ))}
    </div>
  );
}
