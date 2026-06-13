import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function toPagination(input: PaginationInput) {
  const take = input.pageSize;
  const skip = (input.page - 1) * take;

  return {
    page: input.page,
    pageSize: take,
    skip,
    take,
  };
}
