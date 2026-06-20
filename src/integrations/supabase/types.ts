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
      audit_logs: {
        Row: {
          created_at: string
          details: Json
          entity_id: string | null
          event_type: string
          id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          entity_id?: string | null
          event_type: string
          id?: string
        }
        Update: {
          created_at?: string
          details?: Json
          entity_id?: string | null
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          is_demo: boolean
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_custom: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_custom?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_custom?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          attachment_path: string | null
          category: string
          created_at: string
          description: string
          id: string
          is_demo: boolean
          notes: string | null
          payment_method: string
          recorded_by: string | null
          reference: string
          spent_at: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_path?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          payment_method?: string
          recorded_by?: string | null
          reference?: string
          spent_at?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          payment_method?: string
          recorded_by?: string | null
          reference?: string
          spent_at?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_prices: {
        Row: {
          created_at: string
          currency: string
          fetched_at: string
          id: string
          is_demo: boolean
          karat: number
          price_date: string
          price_per_gram: number
          price_per_ounce: number | null
          source: string
        }
        Insert: {
          created_at?: string
          currency?: string
          fetched_at?: string
          id?: string
          is_demo?: boolean
          karat: number
          price_date?: string
          price_per_gram: number
          price_per_ounce?: number | null
          source?: string
        }
        Update: {
          created_at?: string
          currency?: string
          fetched_at?: string
          id?: string
          is_demo?: boolean
          karat?: number
          price_date?: string
          price_per_gram?: number
          price_per_ounce?: number | null
          source?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_this_tx: number
          balance: number
          created_at: string
          customer_address: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number
          employee_id: string | null
          employee_name: string | null
          gold_karat: number | null
          id: string
          invoice_number: string
          invoice_type: string
          is_demo: boolean
          issued_at: string
          metal_type: string | null
          notes: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number
          sale_id: string | null
          sale_number: string | null
          sale_type: string | null
          total_amount: number
          total_paid: number
          unit_price: number
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          amount_this_tx?: number
          balance?: number
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          employee_id?: string | null
          employee_name?: string | null
          gold_karat?: number | null
          id?: string
          invoice_number: string
          invoice_type?: string
          is_demo?: boolean
          issued_at?: string
          metal_type?: string | null
          notes?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          quantity?: number
          sale_id?: string | null
          sale_number?: string | null
          sale_type?: string | null
          total_amount?: number
          total_paid?: number
          unit_price?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          amount_this_tx?: number
          balance?: number
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          employee_id?: string | null
          employee_name?: string | null
          gold_karat?: number | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          is_demo?: boolean
          issued_at?: string
          metal_type?: string | null
          notes?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          quantity?: number
          sale_id?: string | null
          sale_number?: string | null
          sale_type?: string | null
          total_amount?: number
          total_paid?: number
          unit_price?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_demo: boolean
          notes: string | null
          paid_at: string
          payment_method: string
          receipt_number: string
          recorded_by: string | null
          sale_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          paid_at?: string
          payment_method?: string
          receipt_number: string
          recorded_by?: string | null
          sale_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          paid_at?: string
          payment_method?: string
          receipt_number?: string
          recorded_by?: string | null
          sale_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          gold_karat: number | null
          id: string
          internal_code: string
          is_demo: boolean
          labor_cost: number
          making_charge: number
          metal_purchase_price: number
          metal_type: string
          name: string
          origin: string | null
          selling_price: number
          status: string
          stone_cost: number
          supplier_id: string | null
          updated_at: string
          weight_grams: number
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          gold_karat?: number | null
          id?: string
          internal_code: string
          is_demo?: boolean
          labor_cost?: number
          making_charge?: number
          metal_purchase_price?: number
          metal_type?: string
          name: string
          origin?: string | null
          selling_price?: number
          status?: string
          stone_cost?: number
          supplier_id?: string | null
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          gold_karat?: number | null
          id?: string
          internal_code?: string
          is_demo?: boolean
          labor_cost?: number
          making_charge?: number
          metal_purchase_price?: number
          metal_type?: string
          name?: string
          origin?: string | null
          selling_price?: number
          status?: string
          stone_cost?: number
          supplier_id?: string | null
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount_paid: number
          created_at: string
          customer_id: string | null
          due_date: string | null
          id: string
          is_demo: boolean
          notes: string | null
          payment_method: string
          product_id: string | null
          product_name: string | null
          sale_number: string
          sale_type: string
          sold_by: string | null
          total_amount: number
          updated_at: string
          weight_grams: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          payment_method?: string
          product_id?: string | null
          product_name?: string | null
          sale_number: string
          sale_type?: string
          sold_by?: string | null
          total_amount?: number
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          payment_method?: string
          product_id?: string | null
          product_name?: string | null
          sale_number?: string
          sale_type?: string
          sold_by?: string | null
          total_amount?: number
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      delete_demo_data: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoice_status: {
        Args: { _due: string; _paid: number; _total: number }
        Returns: string
      }
      next_expense_number: { Args: never; Returns: string }
      next_invoice_number: { Args: { _prefix?: string }; Returns: string }
      seed_demo_data: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "employe"
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
      app_role: ["admin", "employe"],
    },
  },
} as const
