// Shared types between frontend and backend

export interface JobListing {
  job_title: string;
  company: string;
  location: string;
  salary: string;
  match_percentage: number;
  source_url: string;
  full_description: string;
}

export interface SearchResponse {
  jobs: JobListing[];
  cv_text: string;
}

export interface TailorResponse {
  tailored_cv: string;
}

// Auth types
export interface User {
  id: number;
  email: string;
  has_gemini_key: boolean;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  email: string;
  id: number;
  has_gemini_key?: boolean;
}
