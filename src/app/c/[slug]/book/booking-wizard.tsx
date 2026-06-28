'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, initials } from '@/lib/utils';
import type { Doctor, VisitType } from '@/lib/types/db';
import { publicAvailability, publicBook } from '@/server/actions/public-booking';

interface Props {
  slug: string;
  doctors: Doctor[];
  visitTypes: VisitType[];
}

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS: { key: 'step_doctor' | 'step_visit' | 'step_date' | 'step_time' | 'step_patient' | 'step_review' }[] = [
  { key: 'step_doctor' },
  { key: 'step_visit' },
  { key: 'step_date' },
  { key: 'step_time' },
  { key: 'step_patient' },
  { key: 'step_review' },
];

export function BookingWizard({ slug, doctors, visitTypes }: Props) {
  const t = useTranslations('booking');
  const tc = useTranslations('common');

  const [step, setStep] = useState<Step>(0);
  const [doctorId, setDoctorId] = useState<string>('');
  const [visitTypeId, setVisitTypeId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [slot, setSlot] = useState<string>('');
  const [patient, setPatient] = useState({
    name: '',
    phone: '',
    age: '',
    gender: '' as '' | 'male' | 'female',
    email: '',
    notes: '',
  });
  const [slots, setSlots] = useState<{ startAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<null | { id: string; startAt: string }>(null);
  const [error, setError] = useState<string | null>(null);

  const doctor = doctors.find((d) => d.id === doctorId);
  const visitType = visitTypes.find((v) => v.id === visitTypeId);

  useEffect(() => {
    if (step !== 3 || !doctorId || !visitTypeId || !date) return;
    setLoading(true);
    setSlot('');
    publicAvailability(slug, doctorId, visitTypeId, new Date(date).toISOString())
      .then(setSlots)
      .finally(() => setLoading(false));
  }, [step, slug, doctorId, visitTypeId, date]);

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border bg-card p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold">{t('confirmed_title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('confirmed_body')}</p>
        <p className="mt-4 text-sm">
          {new Date(done.startAt).toLocaleString()}
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href={`/c/${slug}`}>{t('back_to_site')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Stepper step={step} />

      <div className="mt-6 rounded-lg border bg-card p-6 shadow-card">
        <h1 className="text-xl font-bold">{t(STEPS[step].key)}</h1>

        {step === 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {doctors.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDoctorId(d.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-4 text-start transition-colors hover:bg-accent',
                  doctorId === d.id && 'border-primary bg-primary/5'
                )}
              >
                <Avatar className="h-10 w-10">
                  {d.photo_url ? <AvatarImage src={d.photo_url} alt={d.name} /> : null}
                  <AvatarFallback>{initials(d.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.specialty}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {visitTypes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisitTypeId(v.id)}
                className={cn(
                  'rounded-lg border p-4 text-start transition-colors hover:bg-accent',
                  visitTypeId === v.id && 'border-primary bg-primary/5'
                )}
              >
                <p className="font-semibold">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('duration_minutes', { minutes: v.duration_minutes })}
                </p>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="mt-4">
            <Label htmlFor="date">{t('step_date')}</Label>
            <Input
              id="date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        {step === 3 && (
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">{tc('loading')}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('no_slots')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s.startAt}
                    type="button"
                    onClick={() => setSlot(s.startAt)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent',
                      slot === s.startAt && 'border-primary bg-primary text-primary-foreground'
                    )}
                  >
                    {new Date(s.startAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FormField label={t('patient_name')}>
              <Input
                value={patient.name}
                onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                required
              />
            </FormField>
            <FormField label={t('patient_phone')}>
              <Input
                value={patient.phone}
                onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                required
              />
            </FormField>
            <FormField label={t('patient_age')}>
              <Input
                type="number"
                min={0}
                max={130}
                value={patient.age}
                onChange={(e) => setPatient({ ...patient, age: e.target.value })}
              />
            </FormField>
            <FormField label={t('patient_gender')}>
              <Select
                value={patient.gender}
                onValueChange={(v) => setPatient({ ...patient, gender: v as 'male' | 'female' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('male')}</SelectItem>
                  <SelectItem value="female">{t('female')}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('patient_email')} className="sm:col-span-2">
              <Input
                type="email"
                value={patient.email}
                onChange={(e) => setPatient({ ...patient, email: e.target.value })}
              />
            </FormField>
            <FormField label={t('patient_notes')} className="sm:col-span-2">
              <Textarea
                rows={3}
                value={patient.notes}
                onChange={(e) => setPatient({ ...patient, notes: e.target.value })}
              />
            </FormField>
          </div>
        )}

        {step === 5 && (
          <div className="mt-4 space-y-3 text-sm">
            <Row label={t('step_doctor')}>{doctor?.name}</Row>
            <Row label={t('step_visit')}>
              {visitType?.name} · {visitType?.duration_minutes}m
            </Row>
            <Row label={t('step_date')}>
              {slot ? new Date(slot).toLocaleString() : ''}
            </Row>
            <Row label={t('patient_name')}>{patient.name}</Row>
            <Row label={t('patient_phone')}>{patient.phone}</Row>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
        >
          <ArrowLeft className="h-4 w-4" /> {tc('previous')}
        </Button>
        {step < 5 ? (
          <Button
            disabled={!canAdvance(step, { doctorId, visitTypeId, date, slot, patient })}
            onClick={() => setStep((s) => ((s + 1) as Step))}
          >
            {tc('next')} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const result = await publicBook({
                  tenant_slug: slug,
                  doctor_id: doctorId,
                  visit_type_id: visitTypeId,
                  start_at: slot,
                  patient_name: patient.name,
                  patient_phone: patient.phone,
                  patient_age: patient.age ? Number(patient.age) : undefined,
                  patient_gender: patient.gender || undefined,
                  patient_email: patient.email,
                  notes: patient.notes,
                });
                if (result.ok) {
                  setDone({ id: result.appointmentId, startAt: result.startAt });
                } else {
                  setError(result.error);
                }
              });
            }}
          >
            {pending ? '…' : t('confirm')}
          </Button>
        )}
      </div>
    </div>
  );
}

function canAdvance(
  step: Step,
  s: {
    doctorId: string;
    visitTypeId: string;
    date: string;
    slot: string;
    patient: { name: string; phone: string };
  }
) {
  switch (step) {
    case 0: return Boolean(s.doctorId);
    case 1: return Boolean(s.visitTypeId);
    case 2: return Boolean(s.date);
    case 3: return Boolean(s.slot);
    case 4: return Boolean(s.patient.name.trim() && s.patient.phone.trim());
    default: return true;
  }
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1',
            i === step
              ? 'border-primary bg-primary text-primary-foreground'
              : i < step
                ? 'border-primary/40 text-primary'
                : 'text-muted-foreground'
          )}
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]">
            {i + 1}
          </span>
        </li>
      ))}
    </ol>
  );
}

function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
