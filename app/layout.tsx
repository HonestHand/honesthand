import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HonestHand — Financial Intelligence for Texas Business Owners',
  description: 'Find out what grants, tax credits, and government incentives your Texas business qualifies for.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}