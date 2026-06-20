import { eq } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { users } from "../../../db/schema";

export async function buildCompanySignature(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) return "";

  // signature field may be "PHARMACIENNE COMMERCIAL Dr AMINA BEN"
  // we split role / name so they appear on separate lines
  const rawSig = user.signature?.trim() ?? "";
  let roleLine = rawSig;
  let nameLine = `Dr ${user.firstName} ${user.lastName}`;

  if (rawSig.includes(" Dr ")) {
    const idx = rawSig.indexOf(" Dr ");
    roleLine = rawSig.slice(0, idx).trim();
    nameLine = rawSig.slice(idx).trim(); // keeps "Dr …"
  }

  const phone = user.phone?.trim();
  const email = user.email?.trim();

  return [
    "SERVICE COMMERCIAL",
    roleLine,
    "",
    nameLine,
    phone ? `:${phone}` : "",
    phone ? `${phone} Viber/whatsapp` : "",
    email ? `:${email}` : "",
    "",
    "SERVICE TECHNIQUE",
    "DIRECTRICE TECHNIQUE",
    "* : (+213) 560 79 53 51",
    ": fkpharm3@gmail.com",
    "",
    "EURL FK PHARM",
    "Gérante",
    "* : (+213) 774 69 26 85",
    "gerantefkpharme@gmail.com",
    "",
    "Distribution Produits Pharmaceutiques et Dispositifs Médicaux",
    "Colline Alzina 2 N° 76 Bordj El Kiffan, Alger",
  ]
    .filter((l) => l !== undefined && l !== null)
    .join("\n");
}
