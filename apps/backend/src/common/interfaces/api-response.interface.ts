export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  timestamp: string;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  timestamp: string;
}
