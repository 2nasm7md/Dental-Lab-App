'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, List, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { hasPermission } from '@/lib/auth/permissions';
import { formatDateTime } from '@/lib/utils';
import type {
  Appointment,
  AppointmentStatus,
  Doctor,
  Role,
  VisitType,
} from '@/lib/types/db';
import {
  cancelAppointment,
  createAppointment,
  updateAppointment,
} from '@/server/actions/appointments';
import { getAvailability } from '@/server/actions/availability';

interface Props {
  role: Role;
  appointments: Appointment[];
  doctors: Doctor[];
  visitTypes: VisitType[];
  filters: { doctor?: string; status?: AppointmentStatus; q?: string; date?: string };
}

const STATUSES: AppointmentStatus[] = ['confirmed', 'completed', 'cancelled', 'no_show'];

export function AppointmentsView({ role, appointments, doctors, visitTypes, filters }: Props) {
  const canManage = hasPermission(role, 'appointments.manage');
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState(filters.q ?? '');

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value.length > 0) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  useEffect(() => {
    const handle = setTimeout(() => updateParam('q', q), 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search_ph')}
            className="ps-9 w-72"
          />
        </div>
        <Select
          value={filters.doctor ?? ''}
          onValueChange={(v) => updateParam('doctor', v || null)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder={t('filter_doctor')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filter_doctor')}</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? ''}
          onValueChange={(v) => updateParam('status', v || null)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('filter_status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filter_status')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-44"
          value={filters.date ?? ''}
          onChange={(e) => updateParam('date', e.target.value || null)}
        />
        <div className="ms-auto">
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> {t('new')}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">
            <List className="me-1 h-4 w-4" /> {t('list')}
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="me-1 h-4 w-4" /> {t('calendar')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <ListView
            appointments={appointments}
            doctors={doctors}
            visitTypes={visitTypes}
            canManage={canManage}
          />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView appointments={appointments} doctors={doctors} />
        </TabsContent>
      </Tabs>

      <AppointmentDialog
        open={creating}
        onOpenChange={setCreating}
        doctors={doctors}
        visitTypes={visitTypes}
      />
    </div>
  );
}

function statusVariant(s: AppointmentStatus) {
  switch (s) {
    case 'completed': return 'success' as const;
    case 'cancelled': return 'destructive' as const;
    case 'no_show':   return 'warning' as const;
    default:          return 'default' as const;
  }
}

function ListView({
  appointments,
  doctors,
  visitTypes,
  canManage,
}: {
  appointments: Appointment[];
  doctors: Doctor[];
  visitTypes: VisitType[];
  canManage: boolean;
}) {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const [pending, start] = useTransition();
  const doctorMap = useMemo(
    () => new Map(doctors.map((d) => [d.id, d.name])),
    [doctors]
  );
  const visitMap = useMemo(
    () => new Map(visitTypes.map((v) => [v.id, v.name])),
    [visitTypes]
  );

  if (appointments.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('patient')}</TableHead>
            <TableHead>{t('phone')}</TableHead>
            <TableHead>{t('doctor')}</TableHead>
            <TableHead>{t('visit_type')}</TableHead>
            <TableHead>{t('date')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            {canManage && <TableHead className="text-end">{tc('actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.patient_name}</TableCell>
              <TableCell>{a.patient_phone}</TableCell>
              <TableCell>{doctorMap.get(a.doctor_id) ?? '—'}</TableCell>
              <TableCell>{visitMap.get(a.visit_type_id) ?? '—'}</TableCell>
              <TableCell>{formatDateTime(a.start_at)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(a.status)}>{t(`status_${a.status}`)}</Badge>
              </TableCell>
              {canManage && (
                <TableCell className="text-end">
                  <Select
                    value={a.status}
                    onValueChange={(v) =>
                      start(() => updateAppointment(a.id, { status: v as AppointmentStatus }))
                    }
                  >
                    <SelectTrigger className="ms-auto w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`status_${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CalendarView({ appointments, doctors }: { appointments: Appointment[]; doctors: Doctor[] }) {
  // Lightweight day-grouped view — keeps the UI clean without pulling in a calendar lib.
  const t = useTranslations('appointments');
  const doctorMap = useMemo(
    () => new Map(doctors.map((d) => [d.id, d.name])),
    [doctors]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = new Date(a.start_at).toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([day, items]) => (
        <div key={day} className="rounded-lg border bg-card shadow-card">
          <div className="border-b px-4 py-3 text-sm font-semibold">
            {new Date(day).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{a.patient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.start_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {doctorMap.get(a.doctor_id) ?? '—'}
                  </p>
                </div>
                <Badge variant={statusVariant(a.status)}>{t(`status_${a.status}`)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doctors: Doctor[];
  visitTypes: VisitType[];
}

function AppointmentDialog({ open, onOpenChange, doctors, visitTypes }: DialogProps) {
  const t = useTranslations('appointments');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const [doctor, setDoctor] = useState<string>(doctors[0]?.id ?? '');
  const [visitType, setVisitType] = useState<string>(visitTypes[0]?.id ?? '');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<{ startAt: string }[]>([]);
  const [slot, setSlot] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setSlot('');
    if (!doctor || !visitType || !date) {
      setSlots([]);
      return;
    }
    const v = visitTypes.find((x) => x.id === visitType);
    if (!v) return;
    getAvailability(doctor, new Date(date).toISOString(), v.duration_minutes).then(setSlots);
  }, [doctor, visitType, date, visitTypes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('new')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              try {
                await createAppointment({
                  doctor_id: doctor,
                  visit_type_id: visitType,
                  start_at: slot,
                  patient_name: String(fd.get('patient_name')),
                  patient_phone: String(fd.get('patient_phone')),
                  patient_age: Number(fd.get('patient_age')) || undefined,
                  patient_gender:
                    (fd.get('patient_gender') as 'male' | 'female') || undefined,
                  patient_email: String(fd.get('patient_email') ?? ''),
                  notes: String(fd.get('notes') ?? ''),
                });
                onOpenChange(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'error');
              }
            });
          }}
          className="grid gap-3 md:grid-cols-2"
        >
          <div className="space-y-1">
            <Label>{t('doctor')}</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t('visit_type')}</Label>
            <Select value={visitType} onValueChange={setVisitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visitTypes.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} ({v.duration_minutes}m)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t('date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>{t('time')}</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger>
                <SelectValue placeholder={slots.length ? '—' : tb('no_slots')} />
              </SelectTrigger>
              <SelectContent>
                {slots.map((s) => (
                  <SelectItem key={s.startAt} value={s.startAt}>
                    {new Date(s.startAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="patient_name">{tb('patient_name')}</Label>
            <Input id="patient_name" name="patient_name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="patient_phone">{tb('patient_phone')}</Label>
            <Input id="patient_phone" name="patient_phone" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="patient_age">{tb('patient_age')}</Label>
            <Input id="patient_age" name="patient_age" type="number" min={0} max={130} />
          </div>
          <div className="space-y-1">
            <Label>{tb('patient_gender')}</Label>
            <Select name="patient_gender" defaultValue="">
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{tb('male')}</SelectItem>
                <SelectItem value="female">{tb('female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="patient_email">{tb('patient_email')}</Label>
            <Input id="patient_email" name="patient_email" type="email" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="notes">{tb('patient_notes')}</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {error ? (
            <p className="md:col-span-2 text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending || !slot}>
              {pending ? '…' : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
