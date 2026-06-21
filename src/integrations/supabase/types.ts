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
      employee_credentials: {
        Row: {
          backing_email: string
          backing_password: string
          employee_id: string
          pin_hash: string
          pin_salt: string
          updated_at: string
        }
        Insert: {
          backing_email: string
          backing_password: string
          employee_id: string
          pin_hash: string
          pin_salt: string
          updated_at?: string
        }
        Update: {
          backing_email?: string
          backing_password?: string
          employee_id?: string
          pin_hash?: string
          pin_salt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_credentials_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          created_by: string | null
          first_name: string
          id: string
          is_active: boolean
          is_bootstrap: boolean
          last_login_at: string | null
          last_name: string
          permissions: string[]
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          is_bootstrap?: boolean
          last_login_at?: string | null
          last_name?: string
          permissions?: string[]
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          is_bootstrap?: boolean
          last_login_at?: string | null
          last_name?: string
          permissions?: string[]
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string | null
          username?: string
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
      gold_sync_logs: {
        Row: {
          alert: boolean
          app_price_eur: number | null
          attempts: number
          created_at: string
          currency: string
          data_source: string | null
          discrepancy_eur: number | null
          discrepancy_pct: number | null
          error: string | null
          eur_dzd_rate: number | null
          fallback_used: boolean
          goldrepublic_price_eur: number | null
          id: string
          manual_override: boolean
          price_per_gram_eur: number | null
          price_per_ounce_eur: number | null
          products_recalculated: number
          raw_response: Json | null
          source: string
          status: string
          threshold_pct: number | null
          usd_eur_rate: number | null
        }
        Insert: {
          alert?: boolean
          app_price_eur?: number | null
          attempts?: number
          created_at?: string
          currency?: string
          data_source?: string | null
          discrepancy_eur?: number | null
          discrepancy_pct?: number | null
          error?: string | null
          eur_dzd_rate?: number | null
          fallback_used?: boolean
          goldrepublic_price_eur?: number | null
          id?: string
          manual_override?: boolean
          price_per_gram_eur?: number | null
          price_per_ounce_eur?: number | null
          products_recalculated?: number
          raw_response?: Json | null
          source: string
          status: string
          threshold_pct?: number | null
          usd_eur_rate?: number | null
        }
        Update: {
          alert?: boolean
          app_price_eur?: number | null
          attempts?: number
          created_at?: string
          currency?: string
          data_source?: string | null
          discrepancy_eur?: number | null
          discrepancy_pct?: number | null
          error?: string | null
          eur_dzd_rate?: number | null
          fallback_used?: boolean
          goldrepublic_price_eur?: number | null
          id?: string
          manual_override?: boolean
          price_per_gram_eur?: number | null
          price_per_ounce_eur?: number | null
          products_recalculated?: number
          raw_response?: Json | null
          source?: string
          status?: string
          threshold_pct?: number | null
          usd_eur_rate?: number | null
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
          gold_value: number | null
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
          purchase_price_per_gram: number | null
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
          gold_value?: number | null
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
          purchase_price_per_gram?: number | null
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
          gold_value?: number | null
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
          purchase_price_per_gram?: number | null
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
      jewelry_set_events: {
        Row: {
          created_at: string
          detail: string | null
          event_type: string
          id: string
          product_id: string | null
          set_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          product_id?: string | null
          set_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          product_id?: string | null
          set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jewelry_set_events_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "jewelry_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      jewelry_sets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          reference: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          reference: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          reference?: string
          updated_at?: string
        }
        Relationships: []
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
      pin_audit_log: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          target_name: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          target_name?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          target_name?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_origin_events: {
        Row: {
          changed_by: string | null
          country_of_origin: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          metal_origin: string | null
          product_id: string
        }
        Insert: {
          changed_by?: string | null
          country_of_origin?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          metal_origin?: string | null
          product_id: string
        }
        Update: {
          changed_by?: string | null
          country_of_origin?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          metal_origin?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_origin_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_quantity_events: {
        Row: {
          changed_by: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          product_id: string
          quantity_after: number
          quantity_change: number | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          product_id: string
          quantity_after: number
          quantity_change?: number | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          product_id?: string
          quantity_after?: number
          quantity_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_quantity_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          country_of_origin: string | null
          created_at: string
          created_by: string | null
          gold_karat: number | null
          id: string
          internal_code: string
          is_demo: boolean
          labor_cost: number
          making_charge: number
          metal_origin: string | null
          metal_purchase_price: number
          metal_type: string
          name: string
          origin: string | null
          quantity: number
          selling_price: number
          set_id: string | null
          status: string
          stone_cost: number
          subcategory: string | null
          supplier_id: string | null
          updated_at: string
          weight_grams: number
        }
        Insert: {
          category: string
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          gold_karat?: number | null
          id?: string
          internal_code: string
          is_demo?: boolean
          labor_cost?: number
          making_charge?: number
          metal_origin?: string | null
          metal_purchase_price?: number
          metal_type?: string
          name: string
          origin?: string | null
          quantity?: number
          selling_price?: number
          set_id?: string | null
          status?: string
          stone_cost?: number
          subcategory?: string | null
          supplier_id?: string | null
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          category?: string
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          gold_karat?: number | null
          id?: string
          internal_code?: string
          is_demo?: boolean
          labor_cost?: number
          making_charge?: number
          metal_origin?: string | null
          metal_purchase_price?: number
          metal_type?: string
          name?: string
          origin?: string | null
          quantity?: number
          selling_price?: number
          set_id?: string | null
          status?: string
          stone_cost?: number
          subcategory?: string | null
          supplier_id?: string | null
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "jewelry_sets"
            referencedColumns: ["id"]
          },
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
      purchases: {
        Row: {
          created_at: string
          employee_name: string | null
          expense_id: string | null
          gold_karat: number | null
          id: string
          is_demo: boolean
          labor_cost: number
          making_charge: number
          metal_purchase_price: number
          metal_type: string | null
          notes: string | null
          product_id: string | null
          product_name: string | null
          purchased_at: string
          quantity: number
          recorded_by: string | null
          reference: string
          sku: string | null
          stone_cost: number
          supplier_id: string | null
          supplier_name: string | null
          total_cost: number
          unit_cost: number
          updated_at: string
          weight_grams: number
        }
        Insert: {
          created_at?: string
          employee_name?: string | null
          expense_id?: string | null
          gold_karat?: number | null
          id?: string
          is_demo?: boolean
          labor_cost?: number
          making_charge?: number
          metal_purchase_price?: number
          metal_type?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          purchased_at?: string
          quantity?: number
          recorded_by?: string | null
          reference: string
          sku?: string | null
          stone_cost?: number
          supplier_id?: string | null
          supplier_name?: string | null
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          created_at?: string
          employee_name?: string | null
          expense_id?: string | null
          gold_karat?: number | null
          id?: string
          is_demo?: boolean
          labor_cost?: number
          making_charge?: number
          metal_purchase_price?: number
          metal_type?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          purchased_at?: string
          quantity?: number
          recorded_by?: string | null
          reference?: string
          sku?: string | null
          stone_cost?: number
          supplier_id?: string | null
          supplier_name?: string | null
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          repair_id: string
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          repair_id: string
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          repair_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_history_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          estimated_completion: string | null
          estimated_cost: number | null
          id: string
          intake_at: string
          is_demo: boolean
          jewelry_description: string | null
          jewelry_type: string
          metal_type: string | null
          notes: string | null
          photos: string[]
          purity: string | null
          reference: string
          repair_description: string
          status: string
          tracking_token: string
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          id?: string
          intake_at?: string
          is_demo?: boolean
          jewelry_description?: string | null
          jewelry_type: string
          metal_type?: string | null
          notes?: string | null
          photos?: string[]
          purity?: string | null
          reference?: string
          repair_description: string
          status?: string
          tracking_token?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          id?: string
          intake_at?: string
          is_demo?: boolean
          jewelry_description?: string | null
          jewelry_type?: string
          metal_type?: string | null
          notes?: string | null
          photos?: string[]
          purity?: string | null
          reference?: string
          repair_description?: string
          status?: string
          tracking_token?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          purchase_price_per_gram: number | null
          quantity: number
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
          purchase_price_per_gram?: number | null
          quantity?: number
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
          purchase_price_per_gram?: number | null
          quantity?: number
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
      scrap_gold: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          gold_karat: number
          id: string
          is_demo: boolean
          notes: string | null
          price_per_gram: number
          purchased_at: string
          reference: string
          status: string
          total_amount: number
          updated_at: string
          weight_grams: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          gold_karat?: number
          id?: string
          is_demo?: boolean
          notes?: string | null
          price_per_gram?: number
          purchased_at?: string
          reference: string
          status?: string
          total_amount?: number
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          gold_karat?: number
          id?: string
          is_demo?: boolean
          notes?: string | null
          price_per_gram?: number
          purchased_at?: string
          reference?: string
          status?: string
          total_amount?: number
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "scrap_gold_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      scrap_gold_events: {
        Row: {
          changed_by: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          scrap_id: string
          status: string | null
          weight_grams: number | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          scrap_id: string
          status?: string | null
          weight_grams?: number | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          scrap_id?: string
          status?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scrap_gold_events_scrap_id_fkey"
            columns: ["scrap_id"]
            isOneToOne: false
            referencedRelation: "scrap_gold"
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
      store_settings: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          default_mode: string
          default_theme: string
          email: string | null
          eur_to_dzd: number
          favicon_url: string | null
          gold_auto_sync: boolean
          gold_discrepancy_threshold_pct: number
          gold_manual_override: boolean
          gold_manual_price_eur: number | null
          id: string
          invoice_footer: string | null
          invoice_header: string | null
          invoice_prefix: string
          language: string
          login_background_url: string | null
          login_logo_url: string | null
          logo_url: string | null
          phone: string | null
          receipt_prefix: string
          signature_left: string | null
          signature_right: string | null
          singleton: boolean
          slogan: string | null
          social: Json
          store_name: string
          tagline: string | null
          tax_id: string | null
          terms: string | null
          thank_you_message: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          default_mode?: string
          default_theme?: string
          email?: string | null
          eur_to_dzd?: number
          favicon_url?: string | null
          gold_auto_sync?: boolean
          gold_discrepancy_threshold_pct?: number
          gold_manual_override?: boolean
          gold_manual_price_eur?: number | null
          id?: string
          invoice_footer?: string | null
          invoice_header?: string | null
          invoice_prefix?: string
          language?: string
          login_background_url?: string | null
          login_logo_url?: string | null
          logo_url?: string | null
          phone?: string | null
          receipt_prefix?: string
          signature_left?: string | null
          signature_right?: string | null
          singleton?: boolean
          slogan?: string | null
          social?: Json
          store_name?: string
          tagline?: string | null
          tax_id?: string | null
          terms?: string | null
          thank_you_message?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          default_mode?: string
          default_theme?: string
          email?: string | null
          eur_to_dzd?: number
          favicon_url?: string | null
          gold_auto_sync?: boolean
          gold_discrepancy_threshold_pct?: number
          gold_manual_override?: boolean
          gold_manual_price_eur?: number | null
          id?: string
          invoice_footer?: string | null
          invoice_header?: string | null
          invoice_prefix?: string
          language?: string
          login_background_url?: string | null
          login_logo_url?: string | null
          logo_url?: string | null
          phone?: string | null
          receipt_prefix?: string
          signature_left?: string | null
          signature_right?: string | null
          singleton?: boolean
          slogan?: string | null
          social?: Json
          store_name?: string
          tagline?: string | null
          tax_id?: string | null
          terms?: string | null
          thank_you_message?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
      user_preferences: {
        Row: {
          accent_color: string | null
          created_at: string
          density: string
          header_color: string | null
          hidden_widgets: string[]
          landing_page: string
          menu_order: string[] | null
          mode: string
          primary_color: string | null
          secondary_color: string | null
          sidebar_color: string | null
          sidebar_default: string
          theme: string
          updated_at: string
          user_id: string
          widget_order: string[] | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          density?: string
          header_color?: string | null
          hidden_widgets?: string[]
          landing_page?: string
          menu_order?: string[] | null
          mode?: string
          primary_color?: string | null
          secondary_color?: string | null
          sidebar_color?: string | null
          sidebar_default?: string
          theme?: string
          updated_at?: string
          user_id: string
          widget_order?: string[] | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          density?: string
          header_color?: string | null
          hidden_widgets?: string[]
          landing_page?: string
          menu_order?: string[] | null
          mode?: string
          primary_color?: string | null
          secondary_color?: string | null
          sidebar_color?: string | null
          sidebar_default?: string
          theme?: string
          updated_at?: string
          user_id?: string
          widget_order?: string[] | null
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
      get_repair_tracking: {
        Args: { _token: string }
        Returns: {
          estimated_completion: string
          intake_at: string
          jewelry_type: string
          reference: string
          status: string
          updated_at: string
        }[]
      }
      get_repair_tracking_history: {
        Args: { _token: string }
        Returns: {
          created_at: string
          note: string
          status: string
        }[]
      }
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
      next_purchase_number: { Args: never; Returns: string }
      next_repair_number: { Args: never; Returns: string }
      next_scrap_number: { Args: never; Returns: string }
      next_set_number: { Args: never; Returns: string }
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
