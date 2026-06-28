'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTime, parseTime, WEEKDAYS } from '@/lib/utils';
import { hasPermission } from '@/lib/auth/permissions';
import type {
  Doctor,
  Role,
  ScheduleAbsence,
  ScheduleBreak,
  ScheduleDay,
} from '@/lib/types/db';
import {
  createScheduleAbsence,
  createScheduleBreak,
  createScheduleDay,
  deleteScheduleAbsence,
  deleteScheduleBreak,
  deleteScheduleDay,
} from '@/server/actions/schedules';

interface Props {
  role: Role;
  doctors: Doctor[];
  days: ScheduleDay[];
  breaks: ScheduleBreak[];
  absences: ScheduleAbsence[];
}

export function SchedulesManager({ role, doctors, days, breaks, absences }: Props) {
  const canManage = hasPermission(role, 'schedules.manage');
  const t = useTranslations('schedules');
  const [doctorId, setDoctorId] = useState<string>(doctors[0]?.id ?? '');

  const doctorDays    = useMemo(() => days.filter((d) => d.doctor_id === doctorId), [days, doctorId]);
  const doctorBreaks  = useMemo(() => breaks.filter((b) => b.doctor_id === doctorId), [breaks, doctorId]);
  const doctorAbsences = useMemo(
    () => absences.filter((a) => a.doctor_id === doctorId),
    [absences, doctorId]
  );

  if (doctors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add doctors first before configuring their schedules.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>{t('doctor')}</Label>
        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">{t('working_days')}</TabsTrigger>
          <TabsTrigger value="breaks">{t('breaks')}</TabsTrigger>
          <TabsTrigger value="absences">{t('absences')}</TabsTrigger>
        </TabsList>

        <TabsContent value="hours">
          <HoursTab
            canManage={canManage}
            doctorId={doctorId}
            rows={doctorDays}
            label={t('add_day')}
            onCreate={async (payload) => createScheduleDay(payload)}
            onDelete={async (id) => deleteScheduleDay(id)}
          />
        </TabsContent>
        <TabsContent value="breaks">
          <HoursTab
            canManage={canManage}
            doctorId={doctorId}
            rows={doctorBreaks}
            label={t('add_break')}
            onCreate={async (payload) => createScheduleBreak(payload)}
            onDelete={async (id) => deleteScheduleBreak(id)}
          />
        </TabsContent>
        <TabsContent value="absences">
          <AbsencesTab
            canManage={canManage}
            doctorId={doctorId}
            rows={doctorAbsences}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HoursTab({
  canManage,
  doctorId,
  rows,
  label,
  onCreate,
  onDelete,
}: {
  canManage: boolean;
  doctorId: string;
  rows: { id: string; weekday: number; start_minutes: number; end_minutes: number }[];
  label: string;
  onCreate: (input: {
    doctor_id: string;
    weekday: number;
    start_minutes: number;
    end_minutes: number;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const t = useTranslations('schedules');
  const [weekday, setWeekday] = useState('0');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [pending, startT] = useTransition();

  const grouped: Record<number, typeof rows> = {};
  rows.forEach((r) => {
    (grouped[r.weekday] = grouped[r.weekday] || []).push(r);
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-5">
            <div className="space-y-1">
              <Label>{t('weekday')}</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((w, i) => (
                    <SelectItem key={w} value={String(i)}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('start')}</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('end')}</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="flex items-end md:col-span-2">
              <Button
                className="w-full"
                disabled={pending || !doctorId}
                onClick={() =>
                  startT(() =>
                    onCreate({
                      doctor_id: doctorId,
                      weekday: Number(weekday),
                      start_minutes: parseTime(start),
                      end_minutes: parseTime(end),
                    })
                  )
                }
              >
                <Plus className="h-4 w-4" /> {label}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {WEEKDAYS.map((day, idx) => (
          <Card key={day}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize">{day}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {(grouped[idx] ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                grouped[idx].map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      {formatTime(row.start_minutes)} – {formatTime(row.end_minutes)}
                    </span>
                    {canManage && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startT(() => onDelete(row.id))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AbsencesTab({
  canManage,
  doctorId,
  rows,
}: {
  canManage: boolean;
  doctorId: string;
  rows: ScheduleAbsence[];
}) {
  const t = useTranslations('schedules');
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<'vacation' | 'unavailable'>('vacation');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-5">
            <div className="space-y-1">
              <Label>{t('weekday')}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">{t('kind_vacation')}</SelectItem>
                  <SelectItem value="unavailable">{t('kind_unavailable')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('starts')}</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('ends')}</Label>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('reason')}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={pending || !doctorId || !startAt || !endAt}
                onClick={() =>
                  start(() =>
                    createScheduleAbsence({
                      doctor_id: doctorId,
                      kind,
                      start_at: new Date(startAt).toISOString(),
                      end_at: new Date(endAt).toISOString(),
                      reason,
                    }).then(() => {
                      setStartAt('');
                      setEndAt('');
                      setReason('');
                    })
                  )
                }
              >
                <Plus className="h-4 w-4" /> {t('add_absence')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">—</p>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between rounded-md border bg-card px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium capitalize">{t(row.kind === 'vacation' ? 'kind_vacation' : 'kind_unavailable')}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(row.start_at).toLocaleString()} → {new Date(row.end_at).toLocaleString()}
              </p>
              {row.reason ? <p className="text-xs">{row.reason}</p> : null}
            </div>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => start(() => deleteScheduleAbsence(row.id))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
