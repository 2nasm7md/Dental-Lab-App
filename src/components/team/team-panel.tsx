'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Copy, Plus, UserPlus, ShieldCheck, ShieldOff } from 'lucide-react';
import type { AppUser, UserRole } from '@/lib/types/db';
import { cn, initials } from '@/lib/utils';
import {
  addTeamMemberAction,
  deactivateMemberAction,
  reactivateMemberAction,
} from '@/server/actions/team';

interface Props {
  orgType: 'clinic' | 'lab';
  members: AppUser[];
  currentUserId: string;
  doctors: { id: string; name: string }[];
}

const ROLES_BY_TYPE: Record<'clinic' | 'lab', UserRole[]> = {
  clinic: ['clinic_admin', 'doctor', 'secretary'],
  lab: ['lab_admin', 'technician'],
};

export function TeamPanel({ orgType, members, currentUserId, doctors }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
    generated: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const allowedRoles = ROLES_BY_TYPE[orgType];

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(
    orgType === 'clinic' ? 'doctor' : 'technician'
  );
  const [password, setPassword] = useState('');
  const [assists, setAssists] = useState<string[]>([]);

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await addTeamMemberAction({
        email,
        fullName,
        phone,
        role,
        password: password || undefined,
        assistsDoctorIds: role === 'secretary' ? assists : undefined,
      });
      if (!r.ok) {
        setError(r.error ?? 'error');
        return;
      }
      setCredentials({
        email: r.email,
        password: r.password,
        generated: r.generatedPassword,
      });
      setEmail('');
      setFullName('');
      setPhone('');
      setPassword('');
      setAssists([]);
      setShowForm(false);
      router.refresh();
    });
  };

  const onDeactivate = (id: string) =>
    start(async () => {
      const r = await deactivateMemberAction(id);
      if (!r.ok) setError(r.error ?? 'error');
      else router.refresh();
    });

  const onReactivate = (id: string) =>
    start(async () => {
      const r = await reactivateMemberAction(id);
      if (!r.ok) setError(r.error ?? 'error');
      else router.refresh();
    });

  const copy = async () => {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      `${credentials.email} / ${credentials.password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      ) : null}

      {credentials ? (
        <div className="card p-4 border-emerald-200 bg-emerald-50/50 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-emerald-900">
                {t('team.credentialsTitle')}
              </div>
              <div className="text-sm text-emerald-900/80">
                {credentials.generated
                  ? t('team.credentialsGeneratedHint')
                  : t('team.credentialsHint')}
              </div>
            </div>
            <button className="btn-secondary" onClick={copy}>
              <Copy className="size-4" />
              {copied ? t('connections.linkCopied') : t('actions.save')}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-white border border-emerald-200 p-2">
              <div className="text-xs text-ink-subtle">{t('auth.email')}</div>
              <div className="font-mono">{credentials.email}</div>
            </div>
            <div className="rounded-lg bg-white border border-emerald-200 p-2">
              <div className="text-xs text-ink-subtle">{t('auth.password')}</div>
              <div className="font-mono">{credentials.password}</div>
            </div>
          </div>
          <button
            className="text-sm text-emerald-900 hover:underline"
            onClick={() => setCredentials(null)}
          >
            {t('actions.cancel')}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          {t('team.intro', { count: members.length })}
        </p>
        {!showForm ? (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            {t('team.addMember')}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-brand-600" />
            <h2 className="font-semibold text-ink">{t('team.addMember')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('auth.fullName')}</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t('auth.email')}</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t('auth.phone')}</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t('team.role')}</label>
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">
                {t('auth.password')} ({t('common.optional')})
              </label>
              <input
                type="text"
                className="input font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('team.passwordPlaceholder')}
              />
              <p className="text-xs text-ink-subtle mt-1">
                {t('team.passwordHint')}
              </p>
            </div>
            {role === 'secretary' && doctors.length > 0 ? (
              <div className="md:col-span-2">
                <label className="label">{t('team.assistsDoctors')}</label>
                <div className="flex flex-wrap gap-2">
                  {doctors.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() =>
                        setAssists((prev) =>
                          prev.includes(d.id)
                            ? prev.filter((x) => x !== d.id)
                            : [...prev, d.id]
                        )
                      }
                      className={cn(
                        'chip',
                        assists.includes(d.id) && 'chip-active'
                      )}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink-subtle mt-1">
                  {t('team.assistsHint')}
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={pending || !email || !fullName}
              onClick={submit}
            >
              {t('team.addMember')}
            </button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className={cn(
              'card p-4 flex items-center justify-between gap-3',
              !m.is_active && 'opacity-70'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-full bg-brand-100 text-brand-800 grid place-items-center text-sm font-semibold shrink-0">
                {initials(m.full_name)}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">
                  {m.full_name || t('team.unnamed')}
                  {m.id === currentUserId ? (
                    <span className="ms-2 text-xs text-ink-subtle">
                      ({t('team.you')})
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-ink-subtle">
                  {m.role ? t(`roles.${m.role}`) : ''}
                  {m.phone ? ` · ${m.phone}` : ''}
                </div>
              </div>
            </div>
            {m.id !== currentUserId ? (
              m.is_active ? (
                <button
                  type="button"
                  className="btn-ghost text-red-700"
                  disabled={pending}
                  onClick={() => onDeactivate(m.id)}
                >
                  <ShieldOff className="size-4" />
                  {t('team.deactivate')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={pending}
                  onClick={() => onReactivate(m.id)}
                >
                  <ShieldCheck className="size-4" />
                  {t('team.reactivate')}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
