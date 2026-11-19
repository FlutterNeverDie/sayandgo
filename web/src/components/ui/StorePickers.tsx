import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoreCategory } from '../../lib/types';
import { CATEGORIES_MAIN, CATEGORIES_MORE, CategoryGlyph, HEX_RE, PRESET_TONES } from './StoreIcon';

export function CategoryPicker({ value, onChange, label }: { value: StoreCategory | null; onChange: (c: StoreCategory | null) => void; label: string }) {
  const { t } = useTranslation();
  const [more, setMore] = useState(() => !!value && CATEGORIES_MORE.includes(value));
  const list = more ? [...CATEGORIES_MAIN, ...CATEGORIES_MORE] : CATEGORIES_MAIN;
  return (
    <div>
      <div className="picker" role="radiogroup" aria-label={label}>
        {list.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} onClick={() => onChange(value === c ? null : c)}>
            <CategoryGlyph category={c} />
            {t(`category.${c}`)}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--text btn--sm" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setMore((m) => !m)} aria-expanded={more}>
        {more ? t('settings.iconsLess') : t('settings.iconsMore')}
      </button>
    </div>
  );
}

export function TonePicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const { t } = useTranslation();
  const custom = HEX_RE.test(value) && !PRESET_TONES.includes(value.toLowerCase());
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {PRESET_TONES.map((hex) => (
        <button key={hex} type="button" role="radio" aria-checked={value.toLowerCase() === hex} aria-label={hex} style={{ background: hex }} onClick={() => onChange(hex)} />
      ))}
      <label className={`swatch-custom${custom ? ' swatch-custom--on' : ''}`} style={custom ? { background: value } : undefined}>
        <input type="color" value={HEX_RE.test(value) ? value : '#3ccfae'} onChange={(e) => onChange(e.target.value.toLowerCase())} aria-label={t('settings.customColor')} />
        {!custom && <span aria-hidden="true">+</span>}
      </label>
    </div>
  );
}
