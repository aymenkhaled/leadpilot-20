import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, saveToken, clearToken } from "@/lib/api";

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

interface AuthResponse {
  token?: string;
  user: User;
  workspace: Workspace | null;
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
    queryFn: () => api.get<AuthResponse>("/auth/me"),
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
      api.post<AuthResponse>("/auth/login", data),
    onSuccess: (data) => {
      if (data.token) saveToken(data.token);
      queryClient.setQueryData(["auth", "me"], data);
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; firstName: string; lastName: string }) =>
      api.post<AuthResponse>("/auth/signup", data),
    onSuccess: (data) => {
      if (data.token) saveToken(data.token);
      queryClient.setQueryData(["auth", "me"], data);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      clearToken();
      queryClient.clear();
    },
  });
}
