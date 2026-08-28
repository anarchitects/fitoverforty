export interface Paged<T> {
  items: T[];
  /** 1-based. */
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}
