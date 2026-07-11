import type { Metadata } from "next";
import { Quicksand, Nunito } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast-provider";
import "./globals.css";

// Đọc theme đã lưu trước khi React hydrate để tránh flash sai theme.
// Không có key trong localStorage = mặc định light, không đọc prefers-color-scheme của OS.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('zunibee-theme');if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}})();`;

// Font bắt buộc có subset "vietnamese" — xem design-system/zunibee/MASTER.md
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["vietnamese", "latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["vietnamese", "latin"],
});

export const metadata: Metadata = {
  title: "ZuniBee — Nền tảng quiz giáo dục AI",
  description:
    "Học vui, nhớ lâu cùng ZuniBee — nền tảng quiz giáo dục được cá nhân hóa bằng AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${quicksand.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ToastProvider>
          <AuthProvider>
            <ThemeToggle />
            {children}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
