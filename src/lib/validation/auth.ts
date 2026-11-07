// GCC — authentication input schemas.
// All schemas are validated again on the server; client-side validation is a
// usability nicety only.
// TODO(phase 2): confirm password policy and Firebase Authentication integration.

import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const sessionExchangeSchema = z.object({
  idToken: z.string().trim().min(20).max(10000),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type SessionExchangeInput = z.infer<typeof sessionExchangeSchema>;
