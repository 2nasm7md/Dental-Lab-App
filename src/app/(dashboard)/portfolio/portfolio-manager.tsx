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
import { Textarea } from '@/components/ui/textarea';
import { hasPermission } from '@/lib/auth/permissions';
import type { PortfolioCase, Role } from '@/lib/types/db';
import {
  createPortfolioCase,
  deletePortfolioCase,
  updatePortfolioCase,
} from '@/server/actions/portfolio';

interface Props {
  items: PortfolioCase[];
  role: Role;
  hideList?: boolean;
}

export function PortfolioManager({ items, role, hideList }: Props) {
  const canManage = hasPermission(role, 'portfolio.manage');
  const t = useTranslations('portfolio');
  const tc = useTranslations('common');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PortfolioCase | null>(null);
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
          {items.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card shadow-card overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-muted">
                <img src={p.before_image_url} alt="" className="aspect-square w-full object-cover" />
                <img src={p.after_image_url}  alt="" className="aspect-square w-full object-cover" />
              </div>
              <div className="p-4">
                <p className="font-semibold">{p.title}</p>
                {p.category ? (
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                ) : null}
                {p.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
                {canManage && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => start(() => deletePortfolioCase(p.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PortfolioDialog
        open={creating}
        onOpenChange={setCreating}
        title={t('new')}
        onSubmit={async (data) => {
          await createPortfolioCase(data);
          setCreating(false);
        }}
      />
      <PortfolioDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={tc('edit')}
        initial={editing ?? undefined}
        onSubmit={async (data) => {
          if (!editing) return;
          await updatePortfolioCase(editing.id, data);
          setEditing(null);
        }}
      />
    </div>
  );
}

function PortfolioDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: PortfolioCase;
  onSubmit: (data: {
    title: string;
    category: string;
    description: string;
    before_image_url: string;
    after_image_url: string;
  }) => Promise<void>;
}) {
  const t = useTranslations('portfolio');
  const tc = useTranslations('common');
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
                title: String(fd.get('title') ?? ''),
                category: String(fd.get('category') ?? ''),
                description: String(fd.get('description') ?? ''),
                before_image_url: String(fd.get('before_image_url') ?? ''),
                after_image_url: String(fd.get('after_image_url') ?? ''),
              })
            );
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label>{t('case_title')}</Label>
            <Input name="title" required defaultValue={initial?.title ?? ''} />
          </div>
          <div className="space-y-1">
            <Label>{t('category')}</Label>
            <Input name="category" defaultValue={initial?.category ?? ''} />
          </div>
          <div className="space-y-1">
            <Label>{t('description')}</Label>
            <Textarea name="description" rows={3} defaultValue={initial?.description ?? ''} />
          </div>
          <div className="space-y-1">
            <Label>{t('before')}</Label>
            <Input
              name="before_image_url"
              type="url"
              required
              defaultValue={initial?.before_image_url ?? ''}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('after')}</Label>
            <Input
              name="after_image_url"
              type="url"
              required
              defaultValue={initial?.after_image_url ?? ''}
            />
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
