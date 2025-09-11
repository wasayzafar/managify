/// src/auth/useAuth.ts
import { useAuthContext } from "./AuthProvider";

export const useAuth = () => {
  return useAuthContext();
};
