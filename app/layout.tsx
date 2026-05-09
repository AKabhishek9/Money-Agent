import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { SWRConfig } from 'swr';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Money Agent — Smart Personal Finance Manager",
  description:
    "Take control of your finances with Money Agent. Smart tracking, deep analytics, and AI-powered insights for your personal wealth management.",
  keywords: ["finance", "expense tracker", "budget", "AI", "personal finance", "money management"],
  openGraph: {
    title: "Money Agent — Smart Personal Finance Manager",
    description: "Smart tracking, deep analytics, and AI-powered financial insights.",
    type: "website",
    locale: "en_IN",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  robots: { index: true, follow: true },
  other: {
    "theme-color": "#0b0e14",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased">
        <SWRConfig 
          value={{
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 10000,
            keepPreviousData: true,
          }}
        >
          <AuthProvider>
            <DataProvider>
              {children}
            </DataProvider>
          </AuthProvider>
        </SWRConfig>
      </body>
    </html>
  );
}
