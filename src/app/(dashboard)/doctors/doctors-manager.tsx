'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { hasPermission } from '@/lib/auth/permissions';
import type { Doctor, Role } from '@/lib/types/db';
import { initials } from '@/lib/utils';
import { createDoctor, deleteDoctor, updateDoctor } from '@/server/actions/doctors';

interface Props {
  doctors: Doctor[];
  role: Role;
  hideList?: boolean;
}

export function DoctorsManager({ doctors, role, hideList }: Props) {
  const canManage = hasPermission(role, 'doctors.manage');
  const t = useTranslations('doctors');
  const tc = useTranslations('common');
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> {t('new')}
          </Button>
        </div>
      )}

      {!hideList && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <div key={d.id} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {d.photo_url ? <AvatarImage src={d.photo_url} alt={d.name} /> : null}
                  <AvatarFallback>{initials(d.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.specialty || '—'}
                  </p>
                </div>
                <Badge variant={d.active ? 'success' : 'secondary'}>
                  {d.active ? tc('active') : tc('inactive')}
                </Badge>
              </div>
              {d.bio ? (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{d.bio}</p>
              ) : null}
              {canManage && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
                    <Pencil className="h-3.5 w-3.5" /> {tc('edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(t('delete_confirm'))) {
                        start(() => deleteDoctor(d.id));
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <DoctorDialog
        open={creating}
        onOpenChange={setCreating}
        title={t('new')}
        onSubmit={async (data) => {
          await createDoctor(data);
          setCreating(false);
        }}
      />
      <DoctorDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={tc('edit')}
        initial={editing ?? undefined}
        onSubmit={async (data) => {
          if (!editing) return;
          await updateDoctor(editing.id, data);
          setEditing(null);
        }}
      />
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: Doctor;
  onSubmit: (data: {
    name: string;
    specialty: string;
    photo_url: string;
    bio: string;
    active: boolean;
  }) => Promise<void>;
}

function DoctorDialog({ open, onOpenChange, title, initial, onSubmit }: DialogProps) {
  const t = useTranslations('doctors');
  const tc = useTranslations('common');
  const [pending, start] = useTransition();
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <span />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(() =>
              onSubmit({
                name: String(fd.get('name') ?? ''),
                specialty: String(fd.get('specialty') ?? ''),
                photo_url: String(fd.get('photo_url') ?? ''),
                bio: String(fd.get('bio') ?? ''),
                active,
              })
            );
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" name="name" required defaultValue={initial?.name ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialty">{t('specialty')}</Label>
            <Input
              id="specialty"
              name="specialty"
              defaultValue={initial?.specialty ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo_url">{t('photo')}</Label>
            <Input
              id="photo_url"
              name="photo_url"
              type="url"
              defaultValue={initial?.photo_url ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">{t('bio')}</Label>
            <Textarea id="bio" name="bio" rows={3} defaultValue={initial?.bio ?? ''} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="active">{t('active')}</Label>
            <Switch id="active" checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? '…' : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
