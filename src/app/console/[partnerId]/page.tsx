import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartner, listRewards } from "@/lib/data";
import { Console } from "./Console";

export const dynamic = "force-dynamic";

export default async function ConsolePage({ params }: PageProps<"/console/[partnerId]">) {
  const { partnerId } = await params;
  const partner = await getPartner(partnerId);
  if (!partner) notFound();
  const rewards = await listRewards(partnerId);

  return (
    <main className="mx-auto w-full max-w-xl px-6 pb-16 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/console" className="text-[13px] text-muted hover:text-ink">
            ← Boutiques
          </Link>
          <h1 className="mt-2 font-display text-[30px] leading-tight tracking-[-0.01em]">
            {partner.name}
          </h1>
          <p className="text-[13px] text-muted">{partner.address}</p>
        </div>
      </header>

      <Console partnerId={partner.id} rewards={rewards} />
    </main>
  );
}
