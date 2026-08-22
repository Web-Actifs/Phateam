import { notFound } from "next/navigation";
import { findAccount, listPartners } from "@/lib/data";
import { Welcome } from "./Welcome";

export const dynamic = "force-dynamic";

export default async function BienvenuePage({ params }: PageProps<"/bienvenue/[token]">) {
  const { token } = await params;
  const account = await findAccount(token);
  if (!account) notFound();
  const partners = await listPartners();

  return (
    <Welcome
      token={account.account_token}
      shortCode={account.short_code}
      partners={partners.map((p) => ({ id: p.id, name: p.name, address: p.address }))}
    />
  );
}
