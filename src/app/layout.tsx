import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TopNav } from "@/components/app/top-nav";
import { getPublicAppUrl } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: "SpecAgent Lab | 智能体运行与结果中心",
  description:
    "用于配置智能体、试运行任务、批量比较结果并回看运行记录的 SpecAgent Lab。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        <div className="min-h-screen">
          <TopNav />
          <main className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
