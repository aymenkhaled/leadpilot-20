import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/toast";
import LandingPage from "@/pages/Landing";
import LoginPage from "@/pages/Login";
import SignupPage from "@/pages/Signup";
import AppLayout from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/app/Dashboard";
import JobsPage from "@/pages/app/Jobs";
import JobDetailPage from "@/pages/app/JobDetail";
import SignalsPage from "@/pages/app/Signals";
import CompaniesPage from "@/pages/app/Companies";
import ContactsPage from "@/pages/app/Contacts";
import OutreachPage from "@/pages/app/Outreach";
import AgentRunsPage from "@/pages/app/AgentRuns";
import SettingsPage from "@/pages/app/Settings";
import AdminPage from "@/pages/app/Admin";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AppLoading />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function AppLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Loading LeadPilot…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />

        <Route path="/app">
          {() => (
            <AppLayout>
              <Switch>
                <Route path="/app/dashboard">
                  {() => <ProtectedRoute component={DashboardPage} />}
                </Route>
                <Route path="/app/jobs/:id">
                  {() => <ProtectedRoute component={JobDetailPage} />}
                </Route>
                <Route path="/app/jobs">
                  {() => <ProtectedRoute component={JobsPage} />}
                </Route>
                <Route path="/app/signals">
                  {() => <ProtectedRoute component={SignalsPage} />}
                </Route>
                <Route path="/app/companies">
                  {() => <ProtectedRoute component={CompaniesPage} />}
                </Route>
                <Route path="/app/contacts">
                  {() => <ProtectedRoute component={ContactsPage} />}
                </Route>
                <Route path="/app/outreach">
                  {() => <ProtectedRoute component={OutreachPage} />}
                </Route>
                <Route path="/app/agent">
                  {() => <ProtectedRoute component={AgentRunsPage} />}
                </Route>
                <Route path="/app/settings/:tab?">
                  {() => <ProtectedRoute component={SettingsPage} />}
                </Route>
                <Route path="/app/admin">
                  {() => <ProtectedRoute component={AdminPage} />}
                </Route>
                <Route>
                  <Redirect to="/app/dashboard" />
                </Route>
              </Switch>
            </AppLayout>
          )}
        </Route>

        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
      <Toaster />
    </>
  );
}
