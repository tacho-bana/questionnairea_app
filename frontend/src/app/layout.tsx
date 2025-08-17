import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import ClientLayout from '@/components/ClientLayout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gakurisa - 学生向けアンケートプラットフォーム',
  description: 'アンケート作成・回答・データ交換がすべてポイントでできるプラットフォーム',
  icons: {
    icon: '/icon.png',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" style={{ colorScheme: 'light' }}>
      <head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </head>
      <body className={inter.className} style={{ colorScheme: 'light' }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}