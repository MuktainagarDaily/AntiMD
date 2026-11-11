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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      amenity_translations: {
        Row: {
          amenity_key: string
          label: string
          locale: string
        }
        Insert: {
          amenity_key: string
          label: string
          locale: string
        }
        Update: {
          amenity_key?: string
          label?: string
          locale?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          click_count: number
          close_enable_seconds: number
          created_at: string
          end_date: string | null
          id: string
          image_url: string
          is_active: boolean
          placement: string
          popup_delay_seconds: number
          sort_order: number
          start_date: string | null
          target_url: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          click_count?: number
          close_enable_seconds?: number
          created_at?: string
          end_date?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          placement: string
          popup_delay_seconds?: number
          sort_order?: number
          start_date?: string | null
          target_url: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          click_count?: number
          close_enable_seconds?: number
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          placement?: string
          popup_delay_seconds?: number
          sort_order?: number
          start_date?: string | null
          target_url?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      bus_stand_info: {
        Row: {
          address: string | null
          id: number
          maps_url: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          id?: number
          maps_url?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          id?: number
          maps_url?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bus_timetable: {
        Row: {
          created_at: string
          departure_times: string[]
          destination: string
          destination_mr: string | null
          id: string
          is_active: boolean
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          departure_times?: string[]
          destination: string
          destination_mr?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          departure_times?: string[]
          destination?: string
          destination_mr?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      category_translations: {
        Row: {
          category_id: string
          id: string
          locale: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          id?: string
          locale: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          id?: string
          locale?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_shop_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      mcp_endpoints: {
        Row: {
          auth_type: string
          created_at: string
          credential_ref: string | null
          environment: string
          id: string
          is_enabled: boolean
          name: string
          notes: string | null
          updated_at: string
          url: string
        }
        Insert: {
          auth_type?: string
          created_at?: string
          credential_ref?: string | null
          environment?: string
          id?: string
          is_enabled?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          auth_type?: string
          created_at?: string
          credential_ref?: string | null
          environment?: string
          id?: string
          is_enabled?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string | null
          full_name_changed_at: string | null
          gender: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          full_name_changed_at?: string | null
          gender?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          full_name_changed_at?: string | null
          gender?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          address: string | null
          area: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          image_url: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          medium: string | null
          name: string
          name_mr: string | null
          phone: string | null
          school_type: string
          sub_area: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          medium?: string | null
          name: string
          name_mr?: string | null
          phone?: string | null
          school_type?: string
          sub_area?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          medium?: string | null
          name?: string
          name_mr?: string | null
          phone?: string | null
          school_type?: string
          sub_area?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      shop_bookmarks: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_bookmarks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_bookmarks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_bookmarks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_bookmarks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_categories: {
        Row: {
          category_id: string
          id: string
          shop_id: string
        }
        Insert: {
          category_id: string
          id?: string
          shop_id: string
        }
        Update: {
          category_id?: string
          id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_shop_counts"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "shop_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_claims: {
        Row: {
          admin_notes: string | null
          contact_phone: string | null
          created_at: string
          id: string
          note: string | null
          proof_image_path: string | null
          proof_type: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          note?: string | null
          proof_image_path?: string | null
          proof_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          note?: string | null
          proof_image_path?: string | null
          proof_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_claims_reviewed_profile_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_claims_reviewed_profile_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_claims_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_claims_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_claims_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_claims_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_claims_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_claims_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_engagement: {
        Row: {
          created_at: string
          event_type: string
          id: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          shop_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_owners: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          shop_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          shop_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_owners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_owners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_owners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_owners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_owners_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_owners_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_requests: {
        Row: {
          address: string | null
          admin_notes: string | null
          amenities: string[]
          area: string | null
          category_text: string | null
          closing_time: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          keywords: string | null
          latitude: number | null
          longitude: number | null
          maps_link: string | null
          name: string
          opening_time: string | null
          phone: string
          status: string
          sub_area: string | null
          submitter_name: string | null
          submitter_user_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[]
          area?: string | null
          category_text?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          maps_link?: string | null
          name: string
          opening_time?: string | null
          phone: string
          status?: string
          sub_area?: string | null
          submitter_name?: string | null
          submitter_user_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[]
          area?: string | null
          category_text?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          maps_link?: string | null
          name?: string
          opening_time?: string | null
          phone?: string
          status?: string
          sub_area?: string | null
          submitter_name?: string | null
          submitter_user_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      shop_review_helpful: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "shop_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_reviews: {
        Row: {
          body: string
          created_at: string
          helpful_count: number
          id: string
          rating: number
          shop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          helpful_count?: number
          id?: string
          rating: number
          shop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          helpful_count?: number
          id?: string
          rating?: number
          shop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_translations: {
        Row: {
          address: string | null
          area: string | null
          description: string | null
          id: string
          keywords: string | null
          locale: string
          name: string | null
          shop_id: string
          sub_area: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          description?: string | null
          id?: string
          keywords?: string | null
          locale: string
          name?: string | null
          shop_id: string
          sub_area?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          description?: string | null
          id?: string
          keywords?: string | null
          locale?: string
          name?: string | null
          shop_id?: string
          sub_area?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          amenities: string[]
          area: string | null
          category_id: string | null
          closing_time: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_open: boolean
          is_verified: boolean
          keywords: string | null
          latitude: number | null
          longitude: number | null
          name: string
          opening_time: string | null
          phone: string | null
          slug: string | null
          sub_area: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          area?: string | null
          category_id?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_open?: boolean
          is_verified?: boolean
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_time?: string | null
          phone?: string | null
          slug?: string | null
          sub_area?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[]
          area?: string | null
          category_id?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_open?: boolean
          is_verified?: boolean
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          slug?: string | null
          sub_area?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_shop_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      translation_cache: {
        Row: {
          created_at: string
          direction: string
          hit_count: number
          id: string
          last_used_at: string
          source_text: string
          translated: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction: string
          hit_count?: number
          id?: string
          last_used_at?: string
          source_text: string
          translated: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          source_text?: string
          translated?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      category_shop_counts: {
        Row: {
          category_id: string | null
          shop_count: number | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      shop_engagement_stats: {
        Row: {
          calls_30d: number | null
          last_event_at: string | null
          shop_id: string | null
          total_30d: number | null
          waps_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_engagement_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      shops_list_public: {
        Row: {
          address: string | null
          area: string | null
          category_id: string | null
          closing_time: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          is_claimed: boolean | null
          is_open: boolean | null
          is_verified: boolean | null
          name: string | null
          opening_time: string | null
          slug: string | null
          sub_area: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          category_id?: string | null
          closing_time?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_claimed?: never
          is_open?: boolean | null
          is_verified?: boolean | null
          name?: string | null
          opening_time?: string | null
          slug?: string | null
          sub_area?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          category_id?: string | null
          closing_time?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_claimed?: never
          is_open?: boolean | null
          is_verified?: boolean | null
          name?: string | null
          opening_time?: string | null
          slug?: string | null
          sub_area?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_shop_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      shops_search_public: {
        Row: {
          area: string | null
          description: string | null
          id: string | null
          keywords: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          phone: string | null
          sub_area: string | null
          whatsapp: string | null
        }
        Insert: {
          area?: string | null
          description?: string | null
          id?: string | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          sub_area?: string | null
          whatsapp?: string | null
        }
        Update: {
          area?: string | null
          description?: string | null
          id?: string | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          sub_area?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      shops_with_claim: {
        Row: {
          address: string | null
          amenities: string[] | null
          area: string | null
          category_id: string | null
          closing_time: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          is_claimed: boolean | null
          is_open: boolean | null
          is_verified: boolean | null
          keywords: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          opening_time: string | null
          phone: string | null
          slug: string | null
          sub_area: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          category_id?: string | null
          closing_time?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_claimed?: never
          is_open?: boolean | null
          is_verified?: boolean | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          opening_time?: string | null
          phone?: string | null
          slug?: string | null
          sub_area?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          category_id?: string | null
          closing_time?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_claimed?: never
          is_open?: boolean | null
          is_verified?: boolean | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          opening_time?: string | null
          phone?: string | null
          slug?: string | null
          sub_area?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_shop_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
    }
    Functions: {
      approve_shop_claim: { Args: { _claim_id: string }; Returns: undefined }
      assign_shop_owner: {
        Args: { _shop_id: string; _user_id: string }
        Returns: undefined
      }
      generate_shop_slug: {
        Args: { p_exclude_id?: string; p_name: string }
        Returns: string
      }
      get_category_shop_counts: {
        Args: never
        Returns: {
          category_id: string
          shop_count: number
        }[]
      }
      get_shop_rating: {
        Args: { _shop_id: string }
        Returns: {
          average: number
          count: number
          d1: number
          d2: number
          d3: number
          d4: number
          d5: number
        }[]
      }
      get_shops_page: {
        Args: {
          p_area?: string
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          address: string
          area: string
          category_id: string
          closing_time: string
          id: string
          image_url: string
          is_claimed: boolean
          is_open: boolean
          is_verified: boolean
          name: string
          opening_time: string
          slug: string
          sub_area: string
          total_count: number
        }[]
      }
      get_trending_shops: {
        Args: { lim?: number }
        Returns: {
          area: string
          calls_30d: number
          closing_time: string
          id: string
          image_url: string
          is_open: boolean
          is_verified: boolean
          name: string
          opening_time: string
          phone: string
          slug: string
          total_30d: number
          waps_30d: number
          whatsapp: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_banner_click: { Args: { _id: string }; Returns: undefined }
      increment_banner_view: { Args: { _id: string }; Returns: undefined }
      is_shop_owner: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      refresh_category_shop_counts: { Args: never; Returns: undefined }
      refresh_engagement_stats: { Args: never; Returns: undefined }
      reject_shop_claim: {
        Args: { _claim_id: string; _notes?: string }
        Returns: undefined
      }
      reorder_banners: { Args: { _ids: string[] }; Returns: undefined }
      reprocess_shop_image: { Args: { _shop_id: string }; Returns: string }
      revoke_shop_owner: {
        Args: { _shop_id: string; _user_id: string }
        Returns: undefined
      }
      search_shops: {
        Args: { lim?: number; q: string }
        Returns: {
          address: string
          area: string
          closing_time: string
          id: string
          image_url: string
          is_open: boolean
          is_verified: boolean
          name: string
          opening_time: string
          phone: string
          score: number
          slug: string
          whatsapp: string
        }[]
      }
      shop_is_claimed: { Args: { _shop_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "shopkeeper" | "user"
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
      app_role: ["admin", "shopkeeper", "user"],
    },
  },
} as const
