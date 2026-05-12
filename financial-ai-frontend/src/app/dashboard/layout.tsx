'use client'

import React, { ReactNode } from 'react'
import { AuthenticatedChatProvider } from '../../contexts/AuthenticatedChatContext'
import { AuthenticatedChatWindow } from '../../components/chat/AuthenticatedChatWindow'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthenticatedChatProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(242,225,188,0.75),_transparent_38%),linear-gradient(180deg,_#f7f1e4_0%,_#f4efe6_52%,_#ebe4d3_100%)] text-black">
        <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </div>
      </div>

      {/* Persistent authenticated chat window — mounted globally across dashboard routes */}
      <AuthenticatedChatWindow />
    </AuthenticatedChatProvider>
  )
}
