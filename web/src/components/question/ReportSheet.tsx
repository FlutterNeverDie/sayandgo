import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LIMITS } from '../../lib/validation';
import { REPORT_REASONS, type ReportReason } from '../../lib/types';
import { Sheet } from '../ui/Overlay';
import { useLock } from '../../lib/useLock';

export function ReportSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: ReportReason, detail: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>('abuse');
  const [detail, setDetail] = useState('');
  const { busy, run } = useLock();
  return (
    <Sheet title={t('report.title')} desc={t('report.desc')} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await run(() => onSubmit(reason, detail.trim()));
        }}
      >
        <div className="radio-list" role="radiogroup">
          {REPORT_REASONS.map((r) => (
            <label key={r}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              {t(`report.reasons.${r}`)}
            </label>
          ))}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="report-detail">
            {t('report.detail')}
          </label>
          <textarea id="report-detail" className="textarea" rows={3} maxLength={LIMITS.reportDetail} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--ink" disabled={busy}>
            {t('report.submit')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
