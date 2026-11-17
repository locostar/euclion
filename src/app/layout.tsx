import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Euclion | 학원 관리",
  description: "학원의 하루를 편리하게 관리하는 유클리온",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
