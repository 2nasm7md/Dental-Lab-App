import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug')
    .eq('id', session.tenantId)
    .single();

  return (
    <div className="flex min-h-screen bg-secondary/40">
      <Sidebar tenantName={tenant?.name ?? ''} tenantSlug={tenant?.slug ?? ''} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          email={session.email}
          fullName={session.membership.full_name}
          role={session.role}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
