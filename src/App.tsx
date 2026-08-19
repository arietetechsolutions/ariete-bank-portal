import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import SetPassword from "./pages/SetPassword";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallbackHandler from "./components/AuthCallbackHandler";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import { AdminProvider } from "./hooks/useAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <AuthCallbackHandler />
        <AdminProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
