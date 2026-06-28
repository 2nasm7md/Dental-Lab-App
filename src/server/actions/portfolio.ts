'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { portfolioSchema, type PortfolioInput } from '@/lib/validation/portfolio';

export async function createPortfolioCase(input: PortfolioInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'portfolio.manage');
  const data = portfolioSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('portfolio_cases').insert({
    tenant_id: session.tenantId,
    title: data.title,
    category: data.category || null,
    description: data.description || null,
    before_image_url: data.before_image_url,
    after_image_url: data.after_image_url,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/portfolio');
}

export async function updatePortfolioCase(id: string, input: PortfolioInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'portfolio.manage');
  const data = portfolioSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('portfolio_cases')
    .update({
      title: data.title,
      category: data.category || null,
      description: data.description || null,
      before_image_url: data.before_image_url,
      after_image_url: data.after_image_url,
    })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/portfolio');
}

export async function deletePortfolioCase(id: string) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'portfolio.manage');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('portfolio_cases')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/portfolio');
}
