export type AuthActionState = {
  ok: boolean;
  message: string;
  requiresMfa?: boolean;
};

export const initialAuthActionState: AuthActionState = { ok: false, message: '' };
