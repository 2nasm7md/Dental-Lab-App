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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { hasPermission } from '@/lib/auth/permissions';
import type { Role, VisitType } from '@/lib/types/db';
import {
  createVisitType,
  deleteVisitType,
  updateVisitType,
} from '@/server/actions/visit-types';

interface Props {
  items: VisitType[];
  role: Role;
  hideList?: boolean;
}

export function VisitTypesManager({ items, role, hideList }: Props) {
  const canManage = hasPermission(role, 'visit_types.manage');
  const t = useTranslations('visit_types');
  const tc = useTranslations('common');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VisitType | null>(null);
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
        <div className="rounded-lg border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('duration')}</TableHead>
                <TableHead>{tc('active')}</TableHead>
                {canManage && <TableHead className="text-end">{tc('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.duration_minutes}</TableCell>
                  <TableCell>
                    <Badge variant={v.active ? 'success' : 'secondary'}>
                      {v.active ? tc('active') : tc('inactive')}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => start(() => deleteVisitType(v.id))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <VisitTypeDialog
        open={creating}
        onOpenChange={setCreating}
        title={t('new')}
        onSubmit={async (data) => {
          await createVisitType(data);
          setCreating(false);
        }}
      />
      <VisitTypeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={tc('edit')}
        initial={editing ?? undefined}
        onSubmit={async (data) => {
          if (!editing) return;
          await updateVisitType(editing.id, data);
          setEditing(null);
        }}
      />
    </div>
  );
}

function VisitTypeDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: VisitType;
  onSubmit: (data: { name: string; duration_minutes: number; active: boolean }) => Promise<void>;
}) {
  const t = useTranslations('visit_types');
  const tc = useTranslations('common');
  const [active, setActive] = useState(initial?.active ?? true);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                duration_minutes: Number(fd.get('duration_minutes') ?? 30),
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
            <Label htmlFor="duration_minutes">{t('duration')}</Label>
            <Input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              min={5}
              max={480}
              step={5}
              required
              defaultValue={initial?.duration_minutes ?? 30}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="active">{tc('active')}</Label>
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
