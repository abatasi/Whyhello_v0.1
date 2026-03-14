import * as zod from "zod";

export const AuthUser = zod.object({
  id: zod.string(),
  email: zod.string().nullable().optional(),
  firstName: zod.string().nullable().optional(),
  lastName: zod.string().nullable().optional(),
  profileImageUrl: zod.string().nullable().optional(),
});

export type AuthUser = zod.infer<typeof AuthUser>;

export const GetCurrentAuthUserResponse = zod.object({
  user: AuthUser.nullable(),
});

export const ExchangeMobileAuthorizationCodeBody = zod.object({
  code: zod.string().min(1),
  code_verifier: zod.string().min(1),
  redirect_uri: zod.string().url(),
  state: zod.string().min(1),
  nonce: zod.string().min(1).optional(),
});

export const ExchangeMobileAuthorizationCodeResponse = zod.object({
  token: zod.string(),
});

export const LogoutMobileSessionResponse = zod.object({
  success: zod.literal(true),
});
