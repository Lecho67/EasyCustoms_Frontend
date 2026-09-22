import { vi } from "vitest";

/**
 * Stub encadenable para `supabase.from(...)`. Los query builders de
 * supabase-js son "thenable": cada método (select/eq/in/is/order/...)
 * devuelve el mismo objeto para poder encadenar, y el resultado final se
 * resuelve tanto si el código hace `await builder` directamente (sin
 * `.single()`) como si termina en `.single()`.
 */
export function createQueryBuilderMock(result: { data: unknown; error: unknown }) {
  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise<unknown>;
  } = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}
