import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/auth-context";
import { AnnouncementProvider } from "@/contexts/announcement-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { PresenceProvider } from "@/contexts/presence-context";
import { QuickCreateProvider } from "@/contexts/quick-create-context";
import { AnnouncementPopupModal } from "@/components/announcement-popup-modal";
import { ChatPriorityNotification } from "@/components/chat-priority-notification";
import { ChatProvider } from "@/contexts/chat-context";
import { GroupChatProvider } from "@/contexts/group-chat-context";
import { TaskProvider } from "@/contexts/task-context";
import { IdeasProvider } from "@/contexts/ideas-context";
import { NotificationMuteProvider } from "@/contexts/notification-mute-context";
import { InactivityHandler } from "@/components/inactivity-handler";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { TaskDeadlinePopup } from "@/components/task-deadline-popup";
import { FCMProvider } from "@/components/fcm-provider";
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
  title: "Dashboard App",
  description: "App with shadcn dashboard-01",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
          <NotificationMuteProvider>
          <NotificationProvider>
            <PresenceProvider>
            <AnnouncementProvider>
            <ChatProvider>
            <GroupChatProvider>
            <TaskProvider>
            <IdeasProvider>
            <FCMProvider>
            <QuickCreateProvider>
            <InactivityHandler />
            <TooltipProvider>
              {children}
              <AnnouncementPopupModal />
              <ChatPriorityNotification />
              <TaskDeadlinePopup />
              <Toaster position="bottom-right" />
            </TooltipProvider>
            </QuickCreateProvider>
            </FCMProvider>
            </IdeasProvider>
            </TaskProvider>
            </GroupChatProvider>
            </ChatProvider>
            </AnnouncementProvider>
            </PresenceProvider>
          </NotificationProvider>
          </NotificationMuteProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
