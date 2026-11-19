import { useTranslation } from 'react-i18next';
import type { StoreCategory, StoreTone } from '../../lib/types';
import { CATEGORIES, CategoryGlyph, TONES } from './StoreIcon';

export function CategoryPicker({ value, onChange, label }: { value: StoreCategory | null; onChange: (c: StoreCategory | null) => void; label: string }) {
  const { t } = useTranslation();
  return (
    <div className="picker" role="radiogroup" aria-label={label}>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(value === c ? null : c)}
        >
          <CategoryGlyph category={c} />
          {t(`category.${c}`)}
        </button>
      ))}
    </div>
  );
}

export function TonePicker({ value, onChange, label }: { value: StoreTone; onChange: (t: StoreTone) => void; label: string }) {
  const { t } = useTranslation();
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {(Object.keys(TONES) as StoreTone[]).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          aria-label={t(`tone.${k}`)}
          style={{ background: TONES[k].bg }}
          onClick={() => onChange(k)}
        />
      ))}
    </div>
  );
}
