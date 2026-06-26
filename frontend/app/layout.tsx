import React from "react";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";

export const metadata = {
  title: "AttendEase",
  description: "Gateway camera attendance system",
  icons: {
    icon: "/logo/logo-1x1.png",
    shortcut: "/logo/logo-1x1.png",
    apple: "/logo/logo-1x1.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        {/* Sync theme from localStorage before paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
