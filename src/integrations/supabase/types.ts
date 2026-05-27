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
      ai_settings: {
        Row: {
          api_key: string | null
          auto_hide_abusive: boolean
          auto_reply_comments: boolean
          auto_reply_messages: boolean
          comment_trigger_keywords: string[]
          id: string
          language_mode: string
          model: string
          provider: string
          system_instructions: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          auto_hide_abusive?: boolean
          auto_reply_comments?: boolean
          auto_reply_messages?: boolean
          comment_trigger_keywords?: string[]
          id?: string
          language_mode?: string
          model?: string
          provider?: string
          system_instructions?: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          auto_hide_abusive?: boolean
          auto_reply_comments?: boolean
          auto_reply_messages?: boolean
          comment_trigger_keywords?: string[]
          id?: string
          language_mode?: string
          model?: string
          provider?: string
          system_instructions?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meta: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meta?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          action: string
          comment_id: string | null
          commenter_id: string | null
          commenter_name: string | null
          created_at: string
          dm_sent: boolean
          hidden: boolean
          id: string
          post_id: string | null
          text: string
        }
        Insert: {
          action?: string
          comment_id?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          created_at?: string
          dm_sent?: boolean
          hidden?: boolean
          id?: string
          post_id?: string | null
          text: string
        }
        Update: {
          action?: string
          comment_id?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          created_at?: string
          dm_sent?: boolean
          hidden?: boolean
          id?: string
          post_id?: string | null
          text?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          fb_user_avatar: string | null
          fb_user_id: string | null
          fb_user_name: string | null
          human_takeover: boolean
          id: string
          last_message: string | null
          last_message_at: string
          status: string
          unread_count: number
        }
        Insert: {
          created_at?: string
          fb_user_avatar?: string | null
          fb_user_id?: string | null
          fb_user_name?: string | null
          human_takeover?: boolean
          id?: string
          last_message?: string | null
          last_message_at?: string
          status?: string
          unread_count?: number
        }
        Update: {
          created_at?: string
          fb_user_avatar?: string | null
          fb_user_id?: string | null
          fb_user_name?: string | null
          human_takeover?: boolean
          id?: string
          last_message?: string | null
          last_message_at?: string
          status?: string
          unread_count?: number
        }
        Relationships: []
      }
      fb_config: {
        Row: {
          app_secret: string | null
          connected: boolean
          id: string
          monitored_post_ids: string[]
          page_access_token: string | null
          page_id: string | null
          page_name: string | null
          updated_at: string
          verify_token: string | null
        }
        Insert: {
          app_secret?: string | null
          connected?: boolean
          id?: string
          monitored_post_ids?: string[]
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          updated_at?: string
          verify_token?: string | null
        }
        Update: {
          app_secret?: string | null
          connected?: boolean
          id?: string
          monitored_post_ids?: string[]
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          updated_at?: string
          verify_token?: string | null
        }
        Relationships: []
      }
      knowledge_entries: {
        Row: {
          answer: string | null
          category: string | null
          created_at: string
          id: string
          question: string | null
          raw_row: Json | null
        }
        Insert: {
          answer?: string | null
          category?: string | null
          created_at?: string
          id?: string
          question?: string | null
          raw_row?: Json | null
        }
        Update: {
          answer?: string | null
          category?: string | null
          created_at?: string
          id?: string
          question?: string | null
          raw_row?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_ai: boolean
          sender: string
          text: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_ai?: boolean
          sender: string
          text: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_ai?: boolean
          sender?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          conversation_id: string | null
          created_at: string
          customer_name: string
          id: string
          items: Json
          notes: string | null
          phone: string | null
          status: string
          synced_to_sheet: boolean
          total: number | null
        }
        Insert: {
          address?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_name: string
          id?: string
          items?: Json
          notes?: string | null
          phone?: string | null
          status?: string
          synced_to_sheet?: boolean
          total?: number | null
        }
        Update: {
          address?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          items?: Json
          notes?: string | null
          phone?: string | null
          status?: string
          synced_to_sheet?: boolean
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sheets_config: {
        Row: {
          connected: boolean
          id: string
          last_synced_at: string | null
          orders_last_synced_at: string | null
          orders_sheet_id: string | null
          orders_sheet_tab: string | null
          orders_sheet_url: string | null
          row_count: number | null
          sheet_id: string | null
          sheet_name: string | null
          sheet_url: string | null
          updated_at: string
        }
        Insert: {
          connected?: boolean
          id?: string
          last_synced_at?: string | null
          orders_last_synced_at?: string | null
          orders_sheet_id?: string | null
          orders_sheet_tab?: string | null
          orders_sheet_url?: string | null
          row_count?: number | null
          sheet_id?: string | null
          sheet_name?: string | null
          sheet_url?: string | null
          updated_at?: string
        }
        Update: {
          connected?: boolean
          id?: string
          last_synced_at?: string | null
          orders_last_synced_at?: string | null
          orders_sheet_id?: string | null
          orders_sheet_tab?: string | null
          orders_sheet_url?: string | null
          row_count?: number | null
          sheet_id?: string | null
          sheet_name?: string | null
          sheet_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
