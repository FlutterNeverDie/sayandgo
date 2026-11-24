import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { GlobeIcon } from './Icons';
import { passwordStrength } from '../../lib/validation';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** 칸 바로 아래 (오류 · 안내보다 위)에 붙일 것: 메일 주소 추천 등 */
  below?: ReactNode;
}

/** 라벨은 칸 위에, 규칙 안내와 오류는 칸 아래에 붙여 aria-describedby로 연결 */
export function TextField({ label, hint, error, below, ...rest }: FieldProps) {
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
      {below}
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

/** 자주 쓰는 메일 (한국에서 많이 쓰는 순서) */
const MAIL_DOMAINS = ['naver.com', 'gmail.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com', 'icloud.com', 'outlook.com'];

/** 아이디만 치면 @naver.com 같은 주소를 눌러서 바로 채운다 */
export function mailSuggestions(value: string): string[] {
  const v = value.trim();
  const at = v.indexOf('@');
  const local = at < 0 ? v : v.slice(0, at);
  if (!local || /\s/.test(local)) return [];
  if (at < 0) return MAIL_DOMAINS.map((d) => `${local}@${d}`);
  const typed = v.slice(at + 1).toLowerCase();
  const list = MAIL_DOMAINS.filter((d) => d.startsWith(typed) && d !== typed);
  return list.map((d) => `${local}@${d}`);
}

type EmailFieldProps = Omit<FieldProps, 'value' | 'onChange' | 'type' | 'below'> & {
  value: string;
  onValue: (v: string) => void;
};

export function EmailField({ value, onValue, onFocus, onBlur, ...rest }: EmailFieldProps) {
  const [focused, setFocused] = useState(false);
  const list = focused ? mailSuggestions(value) : [];
  return (
    <TextField
      type="email"
      inputMode="email"
      autoCapitalize="none"
      spellCheck={false}
      {...rest}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      below={
        list.length > 0 && (
          <div className="mail-suggest" role="listbox" aria-label="메일 주소 추천">
            {list.map((m) => (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={false}
                className="mail-suggest__item"
                // 누르는 순간 칸이 포커스를 잃어 목록이 사라지지 않게
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onValue(m)}
              >
                <span className="mail-suggest__at">@</span>
                {m.slice(m.indexOf('@') + 1)}
              </button>
            ))}
          </div>
        )
      }
    />
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

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
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
