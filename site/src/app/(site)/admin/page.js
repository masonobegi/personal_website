import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, usingDefaultPassword } from "@/lib/auth";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const metadata = {
  title: { absolute: "Admin | Oswego Legacy Partners" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  const authed = verifySessionToken(jar.get(SESSION_COOKIE)?.value);

  return (
    <section style={{ background: "var(--cream)", minHeight: "70vh" }}>
      <div className="container" style={{ paddingBlock: 60 }}>
        {authed ? <AdminDashboard insecure={usingDefaultPassword()} /> : <AdminLogin />}
      </div>
    </section>
  );
}
