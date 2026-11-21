import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriDose Lite — Pharmaceutical Anti-Counterfeit on Base",
  description:
    "Rolling NFC SUN cryptography + Ethereum Attestation Service for authentic pharma supply-chain verification on Base Sepolia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
