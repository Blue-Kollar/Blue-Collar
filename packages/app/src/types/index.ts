export interface Category {
  id: string;
  name: string;
  icon?: string | null;
}

export interface Worker {
  id: string;
  name: string;
  bio?: string | null;
  avatar?: string | null;
  phone?: string | null;
  email?: string | null;
  isVerified: boolean;
  locationId?: string | null;
  category: Category;
}

export interface Meta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Meta;
  status: string;
  code: number;
}
