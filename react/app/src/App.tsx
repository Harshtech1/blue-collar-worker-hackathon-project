import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ReactNode } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Core pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Services from "./pages/Services";
import BookService from "./pages/BookService";
import MyBookings from "./pages/MyBookings";
import Help from "./pages/Help";
import EnhancedCustomerDashboard from "./pages/EnhancedCustomerDashboard";
// import EnhancedBookService from "./pages/EnhancedBookService"; // DISABLED
// import EnhancedWorkerShowcase from "./pages/EnhancedWorkerShowcase"; // DISABLED
import EnhancedLogin from "./pages/EnhancedLogin";
import Tracking from "./pages/Tracking";
import NotificationDemo from "./pages/NotificationDemo";
// import { TestChatbot } from "./pages/TestChatbot"; // KNOWN CRASH
import TestPage from "./pages/TestPage";
import ACServicePage from "./pages/ACServicePage";
import LiveTrackingPage from "./pages/LiveTrackingPage";
import PaymentPage from "./pages/PaymentPage";
import AdminDashboard from "./pages/admin/AdminDashboard";

// Worker pages import
import WorkerOnboardingPage from "./pages/worker/WorkerOnboardingPage";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerJobsPage from "./pages/worker/WorkerJobsPage";
import WorkerEarningsPage from "./pages/worker/WorkerEarningsPage";
import WorkerSchedulePage from "./pages/worker/WorkerSchedulePage";
import WorkerProfilePage from "./pages/worker/WorkerProfilePage";
import WorkerNotificationsPage from "./pages/worker/WorkerNotificationsPage";
import WorkerLayout from "@/components/layout/WorkerLayout";
import WorkerSettingsPage from "./pages/worker/WorkerSettingsPage";

// Thekedar Imports
import ThekedarProtectedRoute from "@/components/layout/ThekedarProtectedRoute";
import ThekedarLayout from "@/components/layout/ThekedarLayout";
// import DirectThekedarDashboard from "./pages/thekedar/DirectThekedarDashboard";
// import StandaloneThekedarDashboard from "./pages/thekedar/StandaloneThekedarDashboard";
import ThekedarOnboardingPage from "./pages/thekedar/ThekedarOnboardingPage";
import ThekedarDashboard from "./pages/thekedar/ThekedarDashboard";
import EnhancedSiteVisits from "./pages/thekedar/EnhancedSiteVisits";
import ThekedarTeamManagement from "./pages/thekedar/ThekedarTeamManagement";
import ThekedarEarnings from "./pages/thekedar/ThekedarEarnings";
import ThekedarProjects from "./pages/thekedar/ThekedarProjects";
import ThekedarAnalytics from "./pages/thekedar/ThekedarAnalytics";
import ThekedarSchedule from "./pages/thekedar/ThekedarSchedule";
import ThekedarProfile from "./pages/thekedar/ThekedarProfile";
import ThekedarSettings from "./pages/thekedar/ThekedarSettings";
import ServiceCardDemo from "./pages/ServiceCardDemo";
import JobLog from "@/components/job-log/JobLog";
import WorkerMapDashboard from "@/components/maps/WorkerMapDashboard";
import ThekedarMapHub from "@/components/maps/ThekedarMapHub";


// PLACEHOLDERS FOR CRASH TESTING
const Placeholder = ({ name }: { name: string }) => <div className="p-10"><h1>{name} Placeholder</h1><p>The actual component is temporarily disabled for debugging.</p></div>;

// Initialize QueryClient outside component to prevent re-creation loops
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role?: string }) => {
  const { user, loading, profile } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // You can replace this with a spinner
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Redirect user based on role if accessing home page
  if (!profile) {
    return <div>Loading profile...</div>;
  }

  if (role && profile.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Worker Protected Route Component
const WorkerProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Wait for profile to load
  if (!profile) {
    return <div>Loading profile...</div>;
  }

  if (profile.role !== 'worker') {
    // If user is a thekedar, they might be accessing worker routes
    if (profile.role === 'thekedar') {
      return <Navigate to="/thekedar/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Role-Based Home Redirect Component
const RoleBasedHome = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size={40} /></div>;
  }

  // If user is authenticated but no profile exists, redirect to login to complete registration
  if (user && !profile) {
    return <Navigate to="/" replace />;
  }

  // If no user is authenticated, show the default index
  if (!user) {
    return <Index />;
  }

  // If user is authenticated and has a profile, redirect based on role
  if (profile?.role === 'worker') {
    return <Navigate to="/worker/dashboard" replace />;
  } else if (profile?.role === 'thekedar') {
    return <Navigate to="/thekedar/dashboard" replace />;
  } else {
    // For customers and other roles, show the default index
    return <Index />;
  }
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <LocationProvider>
          <AuthProvider>
            <NotificationProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<RoleBasedHome />} />

                    {/* Admin Portal - Hidden Route */}
                    <Route path="/admin-portal-2026" element={<AdminDashboard />} />

                    <Route path="/login" element={<EnhancedLogin />} />
                    <Route path="/register" element={<Register />} />

                    {/* ENABLED ROUTES */}
                    <Route path="/test" element={<TestPage />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/book/:serviceId" element={<BookService />} />
                    <Route path="/bookings" element={<MyBookings />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/profile" element={
                      <ProtectedRoute>
                        <EnhancedCustomerDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/enhanced-book/:serviceId" element={<Placeholder name="EnhancedBookService" />} />
                    <Route path="/customer-dashboard" element={
                      <ProtectedRoute>
                        <EnhancedCustomerDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/workers" element={<Placeholder name="Workers" />} />
                    <Route path="/enhanced-login" element={<Placeholder name="EnhancedLogin" />} />
                    <Route path="/tracking/:bookingId" element={<Tracking />} />
                    <Route path="/notifications/demo" element={<Placeholder name="NotificationDemo" />} />
                    <Route path="/test-chatbot" element={<Placeholder name="Chatbot" />} />
                    <Route path="/ac-services" element={<ACServicePage />} />
                    <Route path="/live-tracking" element={<LiveTrackingPage />} />
                    <Route path="/service-card-demo" element={<ServiceCardDemo />} />
                    <Route path="/thekedar-direct" element={<Navigate to="/thekedar/dashboard" replace />} />
                    <Route path="/thekedar-standalone" element={<Navigate to="/thekedar/dashboard" replace />} />
                    <Route path="/payment" element={<PaymentPage />} />

                    <Route path="/worker/onboarding" element={
                      <WorkerProtectedRoute>
                        <WorkerOnboardingPage />
                      </WorkerProtectedRoute>
                    } />

                    {/* Worker Routes */}
                    <Route path="/worker" element={
                      <WorkerProtectedRoute>
                        <WorkerLayout />
                      </WorkerProtectedRoute>
                    }>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<WorkerDashboard />} />
                      <Route path="jobs" element={<WorkerJobsPage />} />
                      <Route path="earnings" element={<WorkerEarningsPage />} />
                      <Route path="schedule" element={<WorkerSchedulePage />} />
                      <Route path="profile" element={<WorkerProfilePage />} />
                      <Route path="notifications" element={<WorkerNotificationsPage />} />
                      <Route path="job-log" element={<JobLog />} />
                      <Route path="map" element={<WorkerMapDashboard />} />
                      <Route path="settings" element={<WorkerSettingsPage />} />
                    </Route>

                    {/* Thekedar Routes */}
                    <Route path="/thekedar/onboarding" element={
                      <ThekedarProtectedRoute>
                        <ThekedarOnboardingPage />
                      </ThekedarProtectedRoute>
                    } />

                    <Route path="/thekedar" element={
                      <ThekedarProtectedRoute>
                        <ThekedarLayout />
                      </ThekedarProtectedRoute>
                    }>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<ThekedarDashboard />} />
                      <Route path="site-visits" element={<EnhancedSiteVisits />} />
                      <Route path="team" element={<ThekedarTeamManagement />} />
                      <Route path="projects" element={<ThekedarProjects />} />
                      <Route path="analytics" element={<ThekedarAnalytics />} />
                      <Route path="earnings" element={<ThekedarEarnings />} />
                      <Route path="schedule" element={<ThekedarSchedule />} />
                      <Route path="map" element={<ThekedarMapHub />} />
                      <Route path="profile" element={<ThekedarProfile />} />
                      <Route path="settings" element={<ThekedarSettings />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </NotificationProvider>
          </AuthProvider>
        </LocationProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;