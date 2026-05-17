import React from "react";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
