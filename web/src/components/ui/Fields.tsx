import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { GlobeIcon } from './Icons';
import { passwordStrength } from '../../lib/validation';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

/** 라벨은 칸 위에, 규칙 안내와 오류는 칸 아래에 붙여 aria-describedby로 연결 */
export function TextField({ label, hint, error, ...rest }: FieldProps) {
  const id = useId();
  const { t } = useTranslation();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        aria-invalid={!!error}
        aria-describedby={`${id}-hint ${id}-err`}
        {...rest}
      />
      {error && (
        <p className="field__error" id={`${id}-err`}>
          {t(error)}
        </p>
      )}
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ label, hint, error, showStrength, ...rest }: FieldProps & { showStrength?: boolean }) {
  const id = useId();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const value = String(rest.value ?? '');
  const level = passwordStrength(value);
  const labels = t('signup.strength', { returnObjects: true }) as string[];
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="pw">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint ${id}-err`}
          {...rest}
        />
        <button type="button" className="btn btn--text btn--sm pw__toggle" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? t('common.hide') : t('common.show')}
        </button>
      </div>
      {showStrength && value && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div className="strength" data-level={level} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="field__hint">{labels[level]}</span>
        </div>
      )}
      {error && (
        <p className="field__error" id={`${id}-err`}>
          {t(error)}
        </p>
      )}
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </span>
  );
}

/** 화면에 보이는 언어 표시 (ko → KR, en → EN) */
const LANG_SHORT: Record<string, string> = { ko: 'KR', en: 'EN' };

/** 지구본 + 현재 언어(KR · EN). 누르면 기기의 기본 선택창이 뜬다 */
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? 'ko';
  return (
    <label className="lang-btn">
      <GlobeIcon />
      <span>{LANG_SHORT[current] ?? current.toUpperCase()}</span>
      <select value={current} onChange={(e) => i18n.changeLanguage(e.target.value)} aria-label={t('lang.label')}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
