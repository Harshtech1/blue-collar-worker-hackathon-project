import React, { ReactNode, Suspense, useEffect, useState } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';


// Dynamically import ChatAssistant to prevent it from breaking the entire app
const ChatAssistant = React.lazy(() => import('../chat/ChatAssistant').then(module => ({ default: module.ChatAssistant })));

interface LayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
}

interface ChatBoundaryState {
  hasError: boolean;
}

class ChatBoundary extends React.Component<{ children: ReactNode }, ChatBoundaryState> {
  state: ChatBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Chat assistant failed to load. Continuing without it.', error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export function Layout({ children, hideHeader, hideBottomNav }: LayoutProps) {
  const [chatMounted, setChatMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChatMounted(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {!hideHeader && <Header />}
      <main className="pb-20 md:pb-0">{children}</main>
      {!hideBottomNav && <BottomNav />}
      
      {/* 
          This is the specialized RAHI Conversational Assistant.
          Wrapped in Suspense to prevent errors from breaking the entire app */}
      {chatMounted && (
        <ChatBoundary>
          <Suspense fallback={null}>
            <ChatAssistant />
          </Suspense>
        </ChatBoundary>
      )}

    </div>
  );
}
