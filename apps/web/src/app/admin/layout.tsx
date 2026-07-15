import { Inter } from "next/font/google";
import { AdminShell } from "@/components/admin/admin-shell";
import styles from "./admin-theme.module.css";

const adminFont = Inter({
  variable: "--font-admin",
  subsets: ["latin", "vietnamese"],
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${adminFont.variable} ${styles.theme}`}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
