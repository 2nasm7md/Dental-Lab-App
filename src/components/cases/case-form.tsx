'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ToothSelector } from './tooth-selector';
import { RESTORATION_TYPES, MATERIAL_TYPES, VITA_CLASSICAL } from '@/lib/dental';
import type { UserRole, RestorationType, MaterialType } from '@/lib/types/db';
import { createCaseAction } from '@/server/actions/cases';

interface Option {
  id: string;
  name: string;
}

interface Props {
  labs: Option[];
  doctors: Option[];
  currentUserId: string;
  currentRole: UserRole;
}

export function CaseForm({ labs, doctors, currentUserId, currentRole }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [ownerDoctorId, setOwnerDoctorId] = useState<string>(() => {
    if (currentRole === 'doctor') return currentUserId;
    // For clinic_admin, prefer themselves as the case owner — handles the
    // solo-clinic case where no doctor user exists yet.
    if (currentRole === 'clinic_admin' && doctors.some((d) => d.id === currentUserId)) {
      return currentUserId;
    }
    return doctors[0]?.id ?? '';
  });
  const [labId, setLabId] = useState<string>(labs[0]?.id ?? '');
  const [patientName, setPatientName] = useState('');
  const [patientRef, setPatientRef] = useState('');
  const [teeth, setTeeth] = useState<string[]>([]);
  const [restoration, setRestoration] = useState<RestorationType | ''>('');
  const [material, setMaterial] = useState<MaterialType | ''>('');
  const [shade, setShade] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');

  const submit = (send: boolean) => {
    setError(null);
    start(async () => {
      const result = await createCaseAction({
        owner_doctor_id: ownerDoctorId,
        lab_org_id: labId || null,
        patient_name: patientName,
        patient_ref: patientRef,
        tooth_numbers: teeth,
        restoration_type: (restoration || undefined) as RestorationType | undefined,
        material: (material || undefined) as MaterialType | undefined,
        shade,
        due_date: dueDate || null,
        doctor_notes: notes,
        price: price ? Number(price) : null,
        send,
      });
      if (!result.ok) {
        setError(result.error ?? 'error');
        return;
      }
      router.push(`/cases/${result.caseId}`);
    });
  };

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 space-y-2">
          <div className="font-semibold">{t('common.error')}</div>
          {error.startsWith('{') ? (
            <pre className="text-xs whitespace-pre-wrap break-words bg-white border border-red-200 rounded-xl p-2 max-h-[50vh] overflow-auto">
              {error}
            </pre>
          ) : (
            <div>{error}</div>
          )}
        </div>
      ) : null}

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentRole !== 'doctor' ? (
            <div>
              <label className="label">{t('case.selectDoctor')}</label>
              <select
                className="input"
                value={ownerDoctorId}
                onChange={(e) => setOwnerDoctorId(e.target.value)}
                required
              >
                <option value="" disabled>
                  {t('case.selectDoctor')}
                </option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="label">{t('case.selectLab')}</label>
            <select
              className="input"
              value={labId}
              onChange={(e) => setLabId(e.target.value)}
            >
              <option value="">{t('common.optional')}</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{t('case.patientName')}</label>
            <input
              className="input"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('case.patientRef')}</label>
            <input
              className="input"
              value={patientRef}
              onChange={(e) => setPatientRef(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <ToothSelector value={teeth} onChange={setTeeth} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">{t('case.restoration')}</label>
            <select
              className="input"
              value={restoration}
              onChange={(e) => setRestoration(e.target.value as RestorationType | '')}
            >
              <option value="">—</option>
              {RESTORATION_TYPES.map((r) => (
                <option key={r} value={r}>
                  {t(`restoration.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('case.material')}</label>
            <select
              className="input"
              value={material}
              onChange={(e) => setMaterial(e.target.value as MaterialType | '')}
            >
              <option value="">—</option>
              {MATERIAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {t(`material.${m}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('case.shade')}</label>
            <input
              list="vita-shades"
              className="input"
              value={shade}
              onChange={(e) => setShade(e.target.value)}
            />
            <datalist id="vita-shades">
              {VITA_CLASSICAL.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{t('case.dueDate')}</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('payment.price')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">{t('case.notes')}</label>
          <textarea
            className="input min-h-[100px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse md:flex-row md:justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => submit(false)}
        >
          {t('actions.saveDraft')}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending || !labId}
          onClick={() => submit(true)}
        >
          {t('actions.send')}
        </button>
      </div>
    </div>
  );
}
