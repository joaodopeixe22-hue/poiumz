export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      institutional_contents: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          duracao_segundos: number | null
          frequencia_musicas: number | null
          horario: string | null
          id: string
          last_played_at: string | null
          storage_path: string
          tipo: Database["public"]["Enums"]["institutional_type"]
          titulo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          duracao_segundos?: number | null
          frequencia_musicas?: number | null
          horario?: string | null
          id?: string
          last_played_at?: string | null
          storage_path: string
          tipo: Database["public"]["Enums"]["institutional_type"]
          titulo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          duracao_segundos?: number | null
          frequencia_musicas?: number | null
          horario?: string | null
          id?: string
          last_played_at?: string | null
          storage_path?: string
          tipo?: Database["public"]["Enums"]["institutional_type"]
          titulo?: string
        }
        Relationships: []
      }
      playback_state: {
        Row: {
          active_playlist_id: string | null
          controlled_by: string | null
          current_institutional_id: string | null
          current_playlist_id: string | null
          current_song_id: string | null
          id: boolean
          institutional_enabled: boolean
          interrupted_song_id: string | null
          interrupted_song_position: number
          is_locked: boolean
          is_playing: boolean
          loop_index: number
          loop_playlist: boolean
          position_seconds: number
          resume_song_after_institutional: boolean
          shuffle: boolean
          songs_since_institutional: number
          started_at: string | null
          updated_at: string
          volume: number
        }
        Insert: {
          active_playlist_id?: string | null
          controlled_by?: string | null
          current_institutional_id?: string | null
          current_playlist_id?: string | null
          current_song_id?: string | null
          id?: boolean
          institutional_enabled?: boolean
          interrupted_song_id?: string | null
          interrupted_song_position?: number
          is_locked?: boolean
          is_playing?: boolean
          loop_index?: number
          loop_playlist?: boolean
          position_seconds?: number
          resume_song_after_institutional?: boolean
          shuffle?: boolean
          songs_since_institutional?: number
          started_at?: string | null
          updated_at?: string
          volume?: number
        }
        Update: {
          active_playlist_id?: string | null
          controlled_by?: string | null
          current_institutional_id?: string | null
          current_playlist_id?: string | null
          current_song_id?: string | null
          id?: boolean
          institutional_enabled?: boolean
          interrupted_song_id?: string | null
          interrupted_song_position?: number
          is_locked?: boolean
          is_playing?: boolean
          loop_index?: number
          loop_playlist?: boolean
          position_seconds?: number
          resume_song_after_institutional?: boolean
          shuffle?: boolean
          songs_since_institutional?: number
          started_at?: string | null
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "playback_state_controlled_by_fkey"
            columns: ["controlled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_state_current_playlist_id_fkey"
            columns: ["current_playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_state_current_song_id_fkey"
            columns: ["current_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_state_interrupted_song_id_fkey"
            columns: ["interrupted_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_songs: {
        Row: {
          id: string
          playlist_id: string
          posicao: number
          song_id: string
        }
        Insert: {
          id?: string
          playlist_id: string
          posicao?: number
          song_id: string
        }
        Update: {
          id?: string
          playlist_id?: string
          posicao?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          can_upload: boolean
          created_at: string
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          can_upload?: boolean
          created_at?: string
          id: string
          nome?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          can_upload?: boolean
          created_at?: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: []
      }
      queue: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          posicao: number
          song_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          posicao?: number
          song_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          posicao?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          artista: string | null
          created_at: string
          duracao_segundos: number | null
          id: string
          storage_path: string
          titulo: string
          uploaded_by: string | null
        }
        Insert: {
          artista?: string | null
          created_at?: string
          duracao_segundos?: number | null
          id?: string
          storage_path: string
          titulo: string
          uploaded_by?: string | null
        }
        Update: {
          artista?: string | null
          created_at?: string
          duracao_segundos?: number | null
          id?: string
          storage_path?: string
          titulo?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_playback: {
        Args: { expected_institutional?: string; expected_song?: string }
        Returns: {
          active_playlist_id: string | null
          controlled_by: string | null
          current_institutional_id: string | null
          current_playlist_id: string | null
          current_song_id: string | null
          id: boolean
          institutional_enabled: boolean
          interrupted_song_id: string | null
          interrupted_song_position: number
          is_locked: boolean
          is_playing: boolean
          loop_index: number
          loop_playlist: boolean
          position_seconds: number
          resume_song_after_institutional: boolean
          shuffle: boolean
          songs_since_institutional: number
          started_at: string | null
          updated_at: string
          volume: number
        }
        SetofOptions: {
          from: "*"
          to: "playback_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_user_upload: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_approved_member: { Args: never; Returns: boolean }
      next_queue_position: { Args: never; Returns: number }
      pause_playback: {
        Args: never
        Returns: {
          active_playlist_id: string | null
          controlled_by: string | null
          current_institutional_id: string | null
          current_playlist_id: string | null
          current_song_id: string | null
          id: boolean
          institutional_enabled: boolean
          interrupted_song_id: string | null
          interrupted_song_position: number
          is_locked: boolean
          is_playing: boolean
          loop_index: number
          loop_playlist: boolean
          position_seconds: number
          resume_song_after_institutional: boolean
          shuffle: boolean
          songs_since_institutional: number
          started_at: string | null
          updated_at: string
          volume: number
        }
        SetofOptions: {
          from: "*"
          to: "playback_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reorder_queue: {
        Args: { p_item_id: string; p_new_position: number }
        Returns: undefined
      }
      resume_playback: {
        Args: never
        Returns: {
          active_playlist_id: string | null
          controlled_by: string | null
          current_institutional_id: string | null
          current_playlist_id: string | null
          current_song_id: string | null
          id: boolean
          institutional_enabled: boolean
          interrupted_song_id: string | null
          interrupted_song_position: number
          is_locked: boolean
          is_playing: boolean
          loop_index: number
          loop_playlist: boolean
          position_seconds: number
          resume_song_after_institutional: boolean
          shuffle: boolean
          songs_since_institutional: number
          started_at: string | null
          updated_at: string
          volume: number
        }
        SetofOptions: {
          from: "*"
          to: "playback_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_playback: {
        Args: { p_playlist_id: string }
        Returns: {
          active_playlist_id: string | null
          controlled_by: string | null
          current_institutional_id: string | null
          current_playlist_id: string | null
          current_song_id: string | null
          id: boolean
          institutional_enabled: boolean
          interrupted_song_id: string | null
          interrupted_song_position: number
          is_locked: boolean
          is_playing: boolean
          loop_index: number
          loop_playlist: boolean
          position_seconds: number
          resume_song_after_institutional: boolean
          shuffle: boolean
          songs_since_institutional: number
          started_at: string | null
          updated_at: string
          volume: number
        }
        SetofOptions: {
          from: "*"
          to: "playback_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      institutional_type: "vinheta" | "aviso"
      user_role: "admin" | "operador"
      user_status: "pendente" | "aprovado" | "recusado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      institutional_type: ["vinheta", "aviso"],
      user_role: ["admin", "operador"],
      user_status: ["pendente", "aprovado", "recusado"],
    },
  },
} as const
