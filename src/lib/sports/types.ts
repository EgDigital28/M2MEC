export type Sport = {
  id: string;
  abbreviation: string;
  full_name: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type SportPayload = {
  abbreviation?: string;
  full_name?: string;
  is_active?: boolean;
  sort_order?: number;
};
