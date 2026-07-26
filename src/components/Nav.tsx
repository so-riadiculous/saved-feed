import Link from "next/link";
import { getCurrentPerson } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function Nav() {
  const person = await getCurrentPerson();
  if (!person) return null;

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/" className="font-medium">
          Feed
        </Link>
        <Link href="/archive" className="text-white/60 hover:text-white">
          Archive
        </Link>
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/40 capitalize">{person}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
