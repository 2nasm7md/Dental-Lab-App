import { LookupForm } from './lookup-form';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LookupPage(props: Props) {
  const { slug } = await props.params;
  return (
    <main className="container py-10">
      <LookupForm slug={slug} />
    </main>
  );
}
