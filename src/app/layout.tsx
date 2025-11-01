"use client";
import localFont from "next/font/local";
import "@/styles/globals.css";
import type { ReactNode } from "react";

const geistSans = localFont({
  src: [
    {
      path: "./fonts/GeistVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: [
    {
      path: "./fonts/GeistMonoVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-geist-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
