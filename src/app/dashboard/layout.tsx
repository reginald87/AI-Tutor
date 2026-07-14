import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { serializeUser } from "@/lib/serialize";
import { AuthProvider } from "@/components/AuthProvider";
import DashboardSidebar from "@/components/DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider initialUser={serializeUser(user)}>
      <div className="flex min-h-screen bg-slate-50">
        <DashboardSidebar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </AuthProvider>
  );
}
