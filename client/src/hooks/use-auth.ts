import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  avatarUrl?: string;
  currentWorkspaceId: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  credits: number;
  subscriptionStatus?: string;
}

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<{ user: User; workspace: Workspace }>("/auth/me"),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  return {
    user: data?.user ?? null,
    workspace: data?.workspace ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<{ user: User; workspace: Workspace }>("/auth/login", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; firstName: string; lastName: string }) =>
      api.post<{ user: User; workspace: Workspace }>("/auth/signup", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
