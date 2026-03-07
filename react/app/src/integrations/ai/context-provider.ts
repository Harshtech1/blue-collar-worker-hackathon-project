import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pdfLoader, KnowledgeBase } from './pdf-loader';

export interface ChatContext {
  currentPage: string;
  userStatus: 'authenticated' | 'unauthenticated';
  // FIX: Widened to include all 5 roles — 'thekedar' and 'admin' were missing,
  // causing a TS2322 compile error that crashed the AI/Voice module.
  userRole: 'customer' | 'worker' | 'thekedar' | 'admin' | 'guest';
  availableServices: string[];
  location: string;
  language: string;
  knowledgeBase: KnowledgeBase | null;
}

export const useChatContext = () => {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { language } = useLanguage();

  const getCurrentPageName = (pathname: string): string => {
    const pageMap: Record<string, string> = {
      '/': 'Home',
      '/services': 'Services',
      '/login': 'Login',
      '/register': 'Register',
      '/bookings': 'Bookings',
      '/profile': 'Profile',
      '/worker/dashboard': 'Worker Dashboard',
      '/thekedar/dashboard': 'Thekedar Dashboard',
      '/admin-portal-2026': 'Admin',
    };
    return pageMap[pathname] || 'Unknown';
  };

  const getChatContext = async (): Promise<ChatContext> => {
    const knowledgeBase = await pdfLoader.loadAllPdfs();
    const currentPage = getCurrentPageName(location.pathname);
    const userStatus = user ? 'authenticated' : 'unauthenticated';
    // Cast is safe — AuthContext.Profile['role'] is now a superset of ChatContext['userRole']
    const userRole = (profile?.role as ChatContext['userRole']) || 'guest';

    return {
      currentPage,
      userStatus,
      userRole,
      availableServices: [
        'Plumbing',
        'Electrical',
        'Carpentry',
        'Cleaning',
        'Beauty Services',
        'Tutoring',
      ],
      location: 'Delhi-NCR',
      language,
      knowledgeBase,
    };
  };

  return { getChatContext };
};

export const generateSystemPrompt = (context: ChatContext): string => {
  const {
    currentPage,
    userStatus,
    userRole,
    availableServices,
    location,
    language,
    knowledgeBase,
  } = context;

  const servicesList = availableServices.join(', ');
  const knowledgeSummary =
    knowledgeBase?.documents
      .map(doc => `- ${doc.title}: ${doc.content.substring(0, 100)}...`)
      .join('\n') || 'No knowledge base loaded';

  return `
    You are RAHI's intelligent assistant, here to help users navigate the RAHI platform and understand our services.

    Current Context:
    - Page: ${currentPage}
    - User Status: ${userStatus}
    - User Role: ${userRole}
    - Location: ${location}
    - Language: ${language}
    - Available Services: ${servicesList}

    RAHI Knowledge Base:
    ${knowledgeSummary}

    Your Role:
    1. Help users navigate the website and find relevant services
    2. Answer questions about RAHI's mission, services, and processes
    3. Guide users to booking services and using platform features
    4. Provide information about worker verification, pricing, and service quality
    5. Assist with account-related queries (login, registration, profile management)

    Response Guidelines:
    - Be friendly, helpful, and conversational
    - Use the knowledge base to provide accurate information about RAHI
    - Guide users to specific pages or actions when relevant
    - If you don't know something, suggest they contact support
    - Keep responses concise but informative
    - Always respect the user's language preference

    Platform Navigation:
    - Home: Main landing page with services overview
    - Services: Browse and search available services
    - Bookings: View and manage service bookings
    - Profile: User account and settings
    - Login/Register: Authentication pages

    Key Features to Highlight:
    - Verified professionals with quality assurance
    - Real-time tracking of service providers
    - Secure payment processing
    - Transparent pricing
    - 24/7 customer support
    - Rating and feedback system
  `.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX: contextProvider — named export RESTORED for backward compatibility.
//
// Root cause of the compile crash: this export was commented out in a previous
// debug session (line 127 of original file), but 6+ components still imported it:
//   - src/components/VoiceChatbot.tsx
//   - src/components/AiChat/AiChatWindow.tsx
//   - src/components/chat/ChatAssistant.tsx (+ 4 backup variants)
//   - src/integrations/ai/test.ts
//
// All those files will now resolve without TS2305 errors and compile cleanly.
// ─────────────────────────────────────────────────────────────────────────────
export const contextProvider = {
  useChatContext,
  generateSystemPrompt,
};