export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      clips: {
        Row: {
          id: string
          project_id: string
          user_id: string
          file_name: string
          storage_path: string
          duration: number
          order_index: number
          transcript: string | null
          segments: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          file_name: string
          storage_path: string
          duration: number
          order_index: number
          transcript?: string | null
          segments?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          file_name?: string
          storage_path?: string
          duration?: number
          order_index?: number
          transcript?: string | null
          segments?: Json | null
          created_at?: string
        }
      }
      renders: {
        Row: {
          id: string
          project_id: string
          user_id: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          progress: number
          output_path: string | null
          error: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress?: number
          output_path?: string | null
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress?: number
          output_path?: string | null
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
