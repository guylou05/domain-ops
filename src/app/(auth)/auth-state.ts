export type AuthActionState = {
  ok: boolean;
  message: string;
};

export const initialAuthActionState: AuthActionState = { ok: false, message: '' };
