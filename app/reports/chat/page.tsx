import type { Metadata } from 'next';
import ChatRoute from '@/components/ChatRoute';

export const metadata: Metadata = {
  title: 'Чат — Отчёты',
};

export default function ReportsChatPage() {
  return <ChatRoute />;
}
