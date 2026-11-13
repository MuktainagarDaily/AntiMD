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
      announcement_locations: {
        Row: {
          announcement_id: string
          area_text: string | null
          city_id: string
          created_at: string
          id: string
          village_id: string | null
        }
        Insert: {
          announcement_id: string
          area_text?: string | null
          city_id: string
          created_at?: string
          id?: string
          village_id?: string | null
        }
        Update: {
          announcement_id?: string
          area_text?: string | null
          city_id?: string
          created_at?: string
          id?: string
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_locations_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "authority_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_locations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_locations_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_villages"
            referencedColumns: ["id"]
          },
        ]
      }
      authority_admin_grants: {
        Row: {
          can_edit: boolean
          can_publish: boolean
          city_id: string | null
          created_at: string
          department_id: string | null
          district_id: string | null
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_publish?: boolean
          city_id?: string | null
          created_at?: string
          department_id?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_publish?: boolean
          city_id?: string | null
          created_at?: string
          department_id?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "authority_admin_grants_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_admin_grants_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "authority_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_admin_grants_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      authority_announcements: {
        Row: {
          category: string
          city_id: string
          created_at: string
          created_by: string | null
          department_id: string
          description: string
          description_mr: string | null
          end_time: string | null
          id: string
          is_demo: boolean
          media_urls: string[]
          org_id: string
          priority: string
          published_at: string
          start_time: string | null
          status: string
          title: string
          title_mr: string
          updated_at: string
        }
        Insert: {
          category: string
          city_id: string
          created_at?: string
          created_by?: string | null
          department_id: string
          description: string
          description_mr?: string | null
          end_time?: string | null
          id?: string
          is_demo?: boolean
          media_urls?: string[]
          org_id: string
          priority: string
          published_at?: string
          start_time?: string | null
          status?: string
          title: string
          title_mr: string
          updated_at?: string
        }
        Update: {
          category?: string
          city_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string
          description_mr?: string | null
          end_time?: string | null
          id?: string
          is_demo?: boolean
          media_urls?: string[]
          org_id?: string
          priority?: string
          published_at?: string
          start_time?: string | null
          status?: string
          title?: string
          title_mr?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authority_announcements_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "authority_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_announcements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "authority_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      authority_departments: {
        Row: {
          color_theme: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          name_mr: string
          slug: string
          sort_order: number
        }
        Insert: {
          color_theme?: string
          created_at?: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          name_mr: string
          slug: string
          sort_order?: number
        }
        Update: {
          color_theme?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          name_mr?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      authority_organizations: {
        Row: {
          city_id: string
          created_at: string
          department_ids: string[]
          district_id: string | null
          email: string | null
          emergency_phone: string | null
          helpline_phone: string
          id: string
          is_active: boolean
          is_demo: boolean
          is_verified: boolean
          key_contacts: Json | null
          maps_url: string | null
          name: string
          name_mr: string
          office_address: string | null
          updated_at: string
          visiting_hours: string | null
          whatsapp_number: string | null
        }
        Insert: {
          city_id: string
          created_at?: string
          department_ids?: string[]
          district_id?: string | null
          email?: string | null
          emergency_phone?: string | null
          helpline_phone: string
          id?: string
          is_active?: boolean
          is_demo?: boolean
          is_verified?: boolean
          key_contacts?: Json | null
          maps_url?: string | null
          name: string
          name_mr: string
          office_address?: string | null
          updated_at?: string
          visiting_hours?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          city_id?: string
          created_at?: string
          department_ids?: string[]
          district_id?: string | null
          email?: string | null
          emergency_phone?: string | null
          helpline_phone?: string
          id?: string
          is_active?: boolean
          is_demo?: boolean
          is_verified?: boolean
          key_contacts?: Json | null
          maps_url?: string | null
          name?: string
          name_mr?: string
          office_address?: string | null
          updated_at?: string
          visiting_hours?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authority_organizations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_organizations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          click_count: number
          close_enable_seconds: number
          created_at: string
          end_date: string | null
          id: string
          image_broken_at: string | null
          image_checked_at: string | null
          image_url: string
          is_active: boolean
          placement: string
          popup_delay_seconds: number
          sort_order: number
          start_date: string | null
          target_city_id: string | null
          target_district_id: string | null
          target_level: string
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
          image_broken_at?: string | null
          image_checked_at?: string | null
          image_url: string
          is_active?: boolean
          placement: string
          popup_delay_seconds?: number
          sort_order?: number
          start_date?: string | null
          target_city_id?: string | null
          target_district_id?: string | null
          target_level?: string
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
          image_broken_at?: string | null
          image_checked_at?: string | null
          image_url?: string
          is_active?: boolean
          placement?: string
          popup_delay_seconds?: number
          sort_order?: number
          start_date?: string | null
          target_city_id?: string | null
          target_district_id?: string | null
          target_level?: string
          target_url?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "banners_target_city_id_fkey"
            columns: ["target_city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_target_district_id_fkey"
            columns: ["target_district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_stand_info: {
        Row: {
          address: string | null
          city_id: string | null
          id: number
          maps_url: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          id?: number
          maps_url?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          id?: number
          maps_url?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_stand_info_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: true
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_timetable: {
        Row: {
          city_id: string | null
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
          city_id?: string | null
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
          city_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "bus_timetable_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
        ]
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
      edge_rate_limits: {
        Row: {
          calls: number
          key: string
          window_start: string
        }
        Insert: {
          calls?: number
          key: string
          window_start?: string
        }
        Update: {
          calls?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      geo_cities: {
        Row: {
          created_at: string
          district_id: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          name_mr: string | null
          slug: string
          sort_order: number
          type: string
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          name_mr?: string | null
          slug: string
          sort_order?: number
          type?: string
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          name_mr?: string | null
          slug?: string
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_cities_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_countries: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
          name_mr: string | null
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          name_mr?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          name_mr?: string | null
        }
        Relationships: []
      }
      geo_districts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_mr: string | null
          slug: string
          state_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_mr?: string | null
          slug: string
          state_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_mr?: string | null
          slug?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_districts_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "geo_states"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_states: {
        Row: {
          code: string
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_mr: string | null
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_mr?: string | null
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_mr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_states_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "geo_countries"
            referencedColumns: ["code"]
          },
        ]
      }
      geo_villages: {
        Row: {
          city_id: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          name_mr: string | null
          pincode: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          name_mr?: string | null
          pincode?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          name_mr?: string | null
          pincode?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "geo_villages_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      local_news: {
        Row: {
          category: string
          city_id: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          is_pinned: boolean
          language: string
          published_at: string
          scraped_at: string
          source_id: string | null
          source_name: string
          source_url: string | null
          summary: string | null
          summary_mr: string | null
          title: string
          title_mr: string | null
          updated_at: string
          village_id: string | null
        }
        Insert: {
          category?: string
          city_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_pinned?: boolean
          language?: string
          published_at?: string
          scraped_at?: string
          source_id?: string | null
          source_name?: string
          source_url?: string | null
          summary?: string | null
          summary_mr?: string | null
          title: string
          title_mr?: string | null
          updated_at?: string
          village_id?: string | null
        }
        Update: {
          category?: string
          city_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_pinned?: boolean
          language?: string
          published_at?: string
          scraped_at?: string
          source_id?: string | null
          source_name?: string
          source_url?: string | null
          summary?: string | null
          summary_mr?: string | null
          title?: string
          title_mr?: string | null
          updated_at?: string
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_news_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_news_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "news_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_news_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_villages"
            referencedColumns: ["id"]
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
      mess_daily_menus: {
        Row: {
          created_at: string
          dinner_text: string | null
          id: string
          lunch_text: string | null
          menu_date: string
          photo_url: string | null
          shop_id: string
          special_tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dinner_text?: string | null
          id?: string
          lunch_text?: string | null
          menu_date?: string
          photo_url?: string | null
          shop_id: string
          special_tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dinner_text?: string | null
          id?: string
          lunch_text?: string | null
          menu_date?: string
          photo_url?: string | null
          shop_id?: string
          special_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mess_daily_menus_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_daily_menus_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_daily_menus_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_daily_menus_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      mess_profiles: {
        Row: {
          created_at: string
          dinner_timing: string | null
          lunch_timing: string | null
          mess_type: string
          monthly_rate: number | null
          shop_id: string
          single_thali_rate: number | null
          sunday_feast: boolean
          tiffin_delivery: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          dinner_timing?: string | null
          lunch_timing?: string | null
          mess_type?: string
          monthly_rate?: number | null
          shop_id: string
          single_thali_rate?: number | null
          sunday_feast?: boolean
          tiffin_delivery?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          dinner_timing?: string | null
          lunch_timing?: string | null
          mess_type?: string
          monthly_rate?: number | null
          shop_id?: string
          single_thali_rate?: number | null
          sunday_feast?: boolean
          tiffin_delivery?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mess_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      news_sources: {
        Row: {
          category_default: string
          city_id: string
          created_at: string
          id: string
          is_active: boolean
          language: string
          last_scraped_at: string | null
          last_status: string | null
          name: string
          source_type: string
          updated_at: string
          url: string
        }
        Insert: {
          category_default?: string
          city_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          last_scraped_at?: string | null
          last_status?: string | null
          name: string
          source_type?: string
          updated_at?: string
          url: string
        }
        Update: {
          category_default?: string
          city_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          last_scraped_at?: string | null
          last_status?: string | null
          name?: string
          source_type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_sources_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      pg_profiles: {
        Row: {
          amenities: string[]
          available_beds: number
          created_at: string
          deposit_amount: number
          food_included: boolean
          gate_closing_time: string | null
          gender: string
          notice_period_days: number
          occupancy_target: string
          sharing_rates: Json
          shop_id: string
          total_beds: number
          updated_at: string
          vacancies_updated_at: string
        }
        Insert: {
          amenities?: string[]
          available_beds?: number
          created_at?: string
          deposit_amount?: number
          food_included?: boolean
          gate_closing_time?: string | null
          gender?: string
          notice_period_days?: number
          occupancy_target?: string
          sharing_rates?: Json
          shop_id: string
          total_beds?: number
          updated_at?: string
          vacancies_updated_at?: string
        }
        Update: {
          amenities?: string[]
          available_beds?: number
          created_at?: string
          deposit_amount?: number
          food_included?: boolean
          gate_closing_time?: string | null
          gender?: string
          notice_period_days?: number
          occupancy_target?: string
          sharing_rates?: Json
          shop_id?: string
          total_beds?: number
          updated_at?: string
          vacancies_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pg_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pg_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_list_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pg_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_search_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pg_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_with_claim"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          city_id: string | null
          created_at: string
          district_id: string | null
          full_name: string | null
          full_name_changed_at: string | null
          gender: string | null
          id: string
          locale: string
          phone: string | null
          state_id: string | null
          updated_at: string
          village_id: string | null
        }
        Insert: {
          birth_date?: string | null
          city_id?: string | null
          created_at?: string
          district_id?: string | null
          full_name?: string | null
          full_name_changed_at?: string | null
          gender?: string | null
          id: string
          locale?: string
          phone?: string | null
          state_id?: string | null
          updated_at?: string
          village_id?: string | null
        }
        Update: {
          birth_date?: string | null
          city_id?: string | null
          created_at?: string
          district_id?: string | null
          full_name?: string | null
          full_name_changed_at?: string | null
          gender?: string | null
          id?: string
          locale?: string
          phone?: string | null
          state_id?: string | null
          updated_at?: string
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "geo_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_villages"
            referencedColumns: ["id"]
          },
        ]
      }
      school_claims: {
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
          role_claimed: string | null
          school_id: string
          status: string
          udise_or_id: string | null
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
          role_claimed?: string | null
          school_id: string
          status?: string
          udise_or_id?: string | null
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
          role_claimed?: string | null
          school_id?: string
          status?: string
          udise_or_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_claims_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_engagement: {
        Row: {
          created_at: string
          event_type: string
          id: string
          school_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          school_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_engagement_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_notices: {
        Row: {
          attachment_url: string | null
          body: string
          body_mr: string | null
          category: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          is_pinned: boolean
          school_id: string
          title: string
          title_mr: string | null
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string
          body_mr?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          school_id: string
          title: string
          title_mr?: string | null
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          body_mr?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          school_id?: string
          title?: string
          title_mr?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_notices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_owners: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_title: string
          school_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_title?: string
          school_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_title?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_owners_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_review_helpful: {
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
            foreignKeyName: "school_review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "school_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      school_reviews: {
        Row: {
          body: string
          created_at: string
          helpful_count: number
          id: string
          rating: number
          school_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          helpful_count?: number
          id?: string
          rating: number
          school_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          helpful_count?: number
          id?: string
          rating?: number
          school_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          accreditation: string | null
          address: string | null
          address_mr: string | null
          admission_deadline: string | null
          admission_status: string
          admission_url: string | null
          annual_fee_max: number | null
          annual_fee_min: number | null
          area: string | null
          available_seats: number | null
          board: string | null
          city_id: string | null
          classes_offered: string | null
          coaching_focus: string[]
          created_at: string
          description: string | null
          district_id: string | null
          email: string | null
          established_year: number | null
          facilities: string[]
          fee_tier: string
          gender_type: string
          id: string
          image_broken_at: string | null
          image_checked_at: string | null
          image_url: string | null
          is_active: boolean
          is_claimed: boolean
          is_verified: boolean
          latitude: number | null
          longitude: number | null
          management_type: string | null
          medium: string | null
          mediums: string[]
          meta: Json
          name: string
          name_mr: string | null
          office_timing: string | null
          phone: string | null
          photos: string[]
          principal_name: string | null
          prospectus_url: string | null
          required_documents: string[]
          scholarships: string[]
          school_type: string
          slug: string | null
          state_id: string | null
          streams: string[]
          sub_area: string | null
          total_seats: number | null
          transport_villages: string[]
          udise_aishe_code: string | null
          updated_at: string
          village_id: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          accreditation?: string | null
          address?: string | null
          address_mr?: string | null
          admission_deadline?: string | null
          admission_status?: string
          admission_url?: string | null
          annual_fee_max?: number | null
          annual_fee_min?: number | null
          area?: string | null
          available_seats?: number | null
          board?: string | null
          city_id?: string | null
          classes_offered?: string | null
          coaching_focus?: string[]
          created_at?: string
          description?: string | null
          district_id?: string | null
          email?: string | null
          established_year?: number | null
          facilities?: string[]
          fee_tier?: string
          gender_type?: string
          id?: string
          image_broken_at?: string | null
          image_checked_at?: string | null
          image_url?: string | null
          is_active?: boolean
          is_claimed?: boolean
          is_verified?: boolean
          latitude?: number | null
          longitude?: number | null
          management_type?: string | null
          medium?: string | null
          mediums?: string[]
          meta?: Json
          name: string
          name_mr?: string | null
          office_timing?: string | null
          phone?: string | null
          photos?: string[]
          principal_name?: string | null
          prospectus_url?: string | null
          required_documents?: string[]
          scholarships?: string[]
          school_type?: string
          slug?: string | null
          state_id?: string | null
          streams?: string[]
          sub_area?: string | null
          total_seats?: number | null
          transport_villages?: string[]
          udise_aishe_code?: string | null
          updated_at?: string
          village_id?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          accreditation?: string | null
          address?: string | null
          address_mr?: string | null
          admission_deadline?: string | null
          admission_status?: string
          admission_url?: string | null
          annual_fee_max?: number | null
          annual_fee_min?: number | null
          area?: string | null
          available_seats?: number | null
          board?: string | null
          city_id?: string | null
          classes_offered?: string | null
          coaching_focus?: string[]
          created_at?: string
          description?: string | null
          district_id?: string | null
          email?: string | null
          established_year?: number | null
          facilities?: string[]
          fee_tier?: string
          gender_type?: string
          id?: string
          image_broken_at?: string | null
          image_checked_at?: string | null
          image_url?: string | null
          is_active?: boolean
          is_claimed?: boolean
          is_verified?: boolean
          latitude?: number | null
          longitude?: number | null
          management_type?: string | null
          medium?: string | null
          mediums?: string[]
          meta?: Json
          name?: string
          name_mr?: string | null
          office_timing?: string | null
          phone?: string | null
          photos?: string[]
          principal_name?: string | null
          prospectus_url?: string | null
          required_documents?: string[]
          scholarships?: string[]
          school_type?: string
          slug?: string | null
          state_id?: string | null
          streams?: string[]
          sub_area?: string | null
          total_seats?: number | null
          transport_villages?: string[]
          udise_aishe_code?: string | null
          updated_at?: string
          village_id?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "geo_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_villages"
            referencedColumns: ["id"]
          },
        ]
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
          city_id: string | null
          closing_time: string | null
          created_at: string
          description: string | null
          district_id: string | null
          entity_type: string
          id: string
          image_url: string | null
          keywords: string | null
          latitude: number | null
          longitude: number | null
          maps_link: string | null
          meta: Json
          name: string
          opening_time: string | null
          phone: string
          photos: string[]
          state_id: string | null
          status: string
          sub_area: string | null
          submitter_name: string | null
          submitter_user_id: string | null
          updated_at: string
          village_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[]
          area?: string | null
          category_text?: string | null
          city_id?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          district_id?: string | null
          entity_type?: string
          id?: string
          image_url?: string | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          maps_link?: string | null
          meta?: Json
          name: string
          opening_time?: string | null
          phone: string
          photos?: string[]
          state_id?: string | null
          status?: string
          sub_area?: string | null
          submitter_name?: string | null
          submitter_user_id?: string | null
          updated_at?: string
          village_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[]
          area?: string | null
          category_text?: string | null
          city_id?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          district_id?: string | null
          entity_type?: string
          id?: string
          image_url?: string | null
          keywords?: string | null
          latitude?: number | null
          longitude?: number | null
          maps_link?: string | null
          meta?: Json
          name?: string
          opening_time?: string | null
          phone?: string
          photos?: string[]
          state_id?: string | null
          status?: string
          sub_area?: string | null
          submitter_name?: string | null
          submitter_user_id?: string | null
          updated_at?: string
          village_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_requests_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_requests_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_requests_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "geo_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_requests_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_villages"
            referencedColumns: ["id"]
          },
        ]
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
          city_id: string | null
          closing_time: string | null
          created_at: string
          description: string | null
          district_id: string | null
          id: string
          image_broken_at: string | null
          image_checked_at: string | null
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
          photos: string[]
          slug: string | null
          state_id: string | null
          sub_area: string | null
          updated_at: string
          village_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          area?: string | null
          category_id?: string | null
          city_id?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          district_id?: string | null
          id?: string
          image_broken_at?: string | null
          image_checked_at?: string | null
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
          photos?: string[]
          slug?: string | null
          state_id?: string | null
          sub_area?: string | null
          updated_at?: string
          village_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[]
          area?: string | null
          category_id?: string | null
          city_id?: string | null
          closing_time?: string | null
          created_at?: string
          description?: string | null
          district_id?: string | null
          id?: string
          image_broken_at?: string | null
          image_checked_at?: string | null
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
          photos?: string[]
          slug?: string | null
          state_id?: string | null
          sub_area?: string | null
          updated_at?: string
          village_id?: string | null
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
          {
            foreignKeyName: "shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "geo_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_villages"
            referencedColumns: ["id"]
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
          city_id: string | null
          closing_time: string | null
          created_at: string | null
          description: string | null
          district_id: string | null
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
          state_id: string | null
          sub_area: string | null
          updated_at: string | null
          village_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          category_id?: string | null
          city_id?: string | null
          closing_time?: string | null
          created_at?: string | null
          description?: string | null
          district_id?: string | null
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
          state_id?: string | null
          sub_area?: string | null
          updated_at?: string | null
          village_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          category_id?: string | null
          city_id?: string | null
          closing_time?: string | null
          created_at?: string | null
          description?: string | null
          district_id?: string | null
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
          state_id?: string | null
          sub_area?: string | null
          updated_at?: string | null
          village_id?: string | null
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
          {
            foreignKeyName: "shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "geo_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "geo_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "geo_villages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apnatown_check_rate_limit: {
        Args: { _key: string; _max_calls?: number; _window_secs?: number }
        Returns: boolean
      }
      approve_school_claim: { Args: { _claim_id: string }; Returns: undefined }
      approve_shop_claim: { Args: { _claim_id: string }; Returns: undefined }
      assign_school_owner: {
        Args: { _role_title?: string; _school_id: string; _user_id: string }
        Returns: undefined
      }
      assign_shop_owner: {
        Args: { _shop_id: string; _user_id: string }
        Returns: undefined
      }
      check_authority_admin_access: {
        Args: { _city_id: string; _department_id: string; _user_id: string }
        Returns: boolean
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
      get_claimed_shop_ids: { Args: { _shop_ids: string[] }; Returns: string[] }
      get_public_reviewer_names: {
        Args: { _user_ids: string[] }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      get_school_rating: {
        Args: { _school_id: string }
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
      get_schools_rating_summary: {
        Args: { _school_ids: string[] }
        Returns: {
          average: number
          count: number
          school_id: string
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
      get_shops_page:
        | {
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
        | {
            Args: {
              p_area?: string
              p_category?: string
              p_city_id?: string
              p_limit?: number
              p_offset?: number
              p_search?: string
              p_village_id?: string
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
      get_system_health_snapshot: { Args: never; Returns: Json }
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
      is_school_owner: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_shop_owner: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      owns_shop: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      refresh_category_shop_counts: { Args: never; Returns: undefined }
      refresh_engagement_stats: { Args: never; Returns: undefined }
      reject_school_claim: {
        Args: { _claim_id: string; _notes?: string }
        Returns: undefined
      }
      reject_shop_claim: {
        Args: { _claim_id: string; _notes?: string }
        Returns: undefined
      }
      reorder_banners: { Args: { _ids: string[] }; Returns: undefined }
      reprocess_shop_image: { Args: { _shop_id: string }; Returns: string }
      revoke_school_owner: {
        Args: { _school_id: string; _user_id: string }
        Returns: undefined
      }
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
      app_role: ["admin", "shopkeeper", "user"],
    },
  },
} as const
