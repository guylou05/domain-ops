declare module 'papaparse' {
  export type ParseError = { row?: number; message: string; code: string };
  export type ParseResult<T> = { data: T[]; errors: ParseError[] };
  const Papa: { parse<T = Record<string, string>>(input: string, config?: Record<string, unknown>): ParseResult<T> };
  export default Papa;
}
