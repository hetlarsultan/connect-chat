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
      ad_error_logs: {
        Row: {
          ad_unit_id: string | null
          created_at: string
          id: string
          message: string | null
          stage: string
          user_id: string | null
        }
        Insert: {
          ad_unit_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          stage: string
          user_id?: string | null
        }
        Update: {
          ad_unit_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          stage?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ad_reward_transactions: {
        Row: {
          ad_network: string
          created_at: string
          credit_status: string
          id: string
          notified_at: string | null
          occurred_at: string
          reward_amount: number
          transaction_id: string
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          ad_network?: string
          created_at?: string
          credit_status?: string
          id?: string
          notified_at?: string | null
          occurred_at?: string
          reward_amount?: number
          transaction_id: string
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          ad_network?: string
          created_at?: string
          credit_status?: string
          id?: string
          notified_at?: string | null
          occurred_at?: string
          reward_amount?: number
          transaction_id?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      ad_settings: {
        Row: {
          ads_enabled: boolean
          created_at: string
          id: boolean
          rewarded_ad_unit_id: string | null
          rewarded_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ads_enabled?: boolean
          created_at?: string
          id?: boolean
          rewarded_ad_unit_id?: string | null
          rewarded_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ads_enabled?: boolean
          created_at?: string
          id?: boolean
          rewarded_ad_unit_id?: string | null
          rewarded_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ad_view_requests: {
        Row: {
          created_at: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      cleanup_logs: {
        Row: {
          created_at: string
          deleted_count: number
          details: Json | null
          id: string
          task: string
        }
        Insert: {
          created_at?: string
          deleted_count?: number
          details?: Json | null
          id?: string
          task: string
        }
        Update: {
          created_at?: string
          deleted_count?: number
          details?: Json | null
          id?: string
          task?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          reply_snippet: string | null
          reply_to_id: string | null
          reply_username: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reply_snippet?: string | null
          reply_to_id?: string | null
          reply_username?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reply_snippet?: string | null
          reply_to_id?: string | null
          reply_username?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      private_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_path: string | null
          read: boolean | null
          receiver_id: string
          sender_id: string
          viewed_at: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_path?: string | null
          read?: boolean | null
          receiver_id: string
          sender_id: string
          viewed_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_path?: string | null
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          bio: string | null
          country: string | null
          country_code: string | null
          created_at: string
          gender: string | null
          id: string
          is_guest: boolean | null
          is_online: boolean | null
          last_seen: string | null
          name_color: string | null
          text_color: string | null
          username: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          gender?: string | null
          id: string
          is_guest?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          name_color?: string | null
          text_color?: string | null
          username: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          is_guest?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          name_color?: string | null
          text_color?: string | null
          username?: string
        }
        Relationships: []
      }
      revenue_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          network_amount: number
          network_pct: number
          note: string | null
          owner_amount: number
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          network_amount?: number
          network_pct?: number
          note?: string | null
          owner_amount?: number
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          network_amount?: number
          network_pct?: number
          note?: string | null
          owner_amount?: number
          status?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
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
      wallets: {
        Row: {
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_owner_role: { Args: never; Returns: boolean }
      cleanup_expired_data: { Args: never; Returns: undefined }
      credit_ad_reward: {
        Args: {
          _ad_network?: string
          _gross_value: number
          _transaction_id: string
          _user_id: string
        }
        Returns: {
          credited: boolean
          reward: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_reward_totals: {
        Args: never
        Returns: {
          credited_count: number
          failed_count: number
          first_at: string
          last_at: string
          pending_count: number
          total_earned: number
          wallet_balance: number
        }[]
      }
      owner_ads_stats: {
        Args: never
        Returns: {
          available_total: number
          failed_count: number
          gross_total: number
          pending_count: number
          total_count: number
          transferred_total: number
          user_share_total: number
          verification_rate: number
          verified_count: number
        }[]
      }
      owner_reward_overview: {
        Args: never
        Returns: {
          available_total: number
          credited_count: number
          gross_total: number
          transferred_total: number
          user_share_total: number
          users_count: number
        }[]
      }
      record_failed_ad_reward: {
        Args: {
          _ad_network?: string
          _transaction_id: string
          _user_id: string
        }
        Returns: undefined
      }
      record_revenue_transfer: {
        Args: { _amount: number; _network_pct: number; _note?: string }
        Returns: {
          amount: number
          created_at: string
          created_by: string
          id: string
          network_amount: number
          network_pct: number
          note: string | null
          owner_amount: number
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "revenue_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
