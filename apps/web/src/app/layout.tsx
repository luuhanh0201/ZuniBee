import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter, Quicksand } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast-provider";
import "./globals.css";

// Đọc theme đã lưu trước khi React hydrate để tránh flash sai theme.
// Không có key trong localStorage = mặc định light, không đọc prefers-color-scheme của OS.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('zunibee-theme');if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}})();`;

// Typography: editorial heading + highly legible body; wordmark keeps its
// familiar rounded character. Every family includes Vietnamese glyphs.
const editorial = Be_Vietnam_Pro({
  variable: "--font-editorial",
  subsets: ["vietnamese", "latin"],
  weight: ["500", "600", "700", "800"],
});

const interfaceFont = Inter({
  variable: "--font-interface",
  subsets: ["vietnamese", "latin"],
});

const brandFont = Quicksand({
  variable: "--font-wordmark",
  subsets: ["vietnamese", "latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "ZuniBee — AI Learning Workspace",
  description:
    "Biến tài liệu thành hành trình học có cấu trúc, hoạt động thực hành và tiến bộ có thể theo dõi.",
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
      className={`${editorial.variable} ${interfaceFont.variable} ${brandFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
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
