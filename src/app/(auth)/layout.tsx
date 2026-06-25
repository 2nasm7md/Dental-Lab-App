export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-12 bg-surface-muted">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
