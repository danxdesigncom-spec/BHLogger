// Hand-written types for M2.
// Replace this file by running: supabase gen types typescript --local > lib/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Role = "admin" | "caregiver" | "viewer";
export type CareStage = "baby" | "child" | "teen_adult";
export type ProfileColor = "violet" | "teal" | "rose" | "amber" | "blue";
export type Toileting = "diapers" | "training" | "toilet";
export type MedKind = "scheduled" | "prn";
export type MedChangeType = "started" | "stopped" | "dose_changed" | "schedule_changed";

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: Role;
          display_name: string;
          initials: string;
          access_from: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role: Role;
          display_name: string;
          initials: string;
          access_from?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: Role;
          display_name?: string;
          initials?: string;
          access_from?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      invites: {
        Row: {
          id: string;
          household_id: string;
          email: string;
          role: Role;
          token: string;
          expires_at: string;
          accepted_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          email: string;
          role: Role;
          token?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          email?: string;
          role?: Role;
          token?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          color: ProfileColor;
          avatar: string | null;
          dob: string | null;
          care_stage: CareStage;
          toileting: Toileting;
          feeding_methods: string[];
          enabled_modules: string[];
          settings: Json;
          care_card: Json;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          color: ProfileColor;
          avatar?: string | null;
          dob?: string | null;
          care_stage: CareStage;
          toileting?: Toileting;
          feeding_methods?: string[];
          enabled_modules?: string[];
          settings?: Json;
          care_card?: Json;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          color?: ProfileColor;
          avatar?: string | null;
          dob?: string | null;
          care_stage?: CareStage;
          toileting?: Toileting;
          feeding_methods?: string[];
          enabled_modules?: string[];
          settings?: Json;
          care_card?: Json;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      member_profile_access: {
        Row: {
          member_id: string;
          profile_id: string;
        };
        Insert: {
          member_id: string;
          profile_id: string;
        };
        Update: {
          member_id?: string;
          profile_id?: string;
        };
        Relationships: [];
      };

      entries: {
        Row: {
          id: string;
          household_id: string;
          profile_id: string;
          type: string;
          occurred_at: string;
          tz: string;
          ended_at: string | null;
          data: Json;
          note: string | null;
          flagged_for_doctor: boolean;
          logged_by: string;
          logged_by_name: string;
          logged_by_initials: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          schema_version: number;
        };
        Insert: {
          id: string;
          household_id: string;
          profile_id: string;
          type: string;
          occurred_at: string;
          tz?: string;
          ended_at?: string | null;
          data?: Json;
          note?: string | null;
          flagged_for_doctor?: boolean;
          logged_by: string;
          logged_by_name: string;
          logged_by_initials: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          schema_version?: number;
        };
        Update: {
          household_id?: string;
          profile_id?: string;
          type?: string;
          occurred_at?: string;
          tz?: string;
          ended_at?: string | null;
          data?: Json;
          note?: string | null;
          flagged_for_doctor?: boolean;
          logged_by?: string;
          logged_by_name?: string;
          logged_by_initials?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          schema_version?: number;
        };
        Relationships: [];
      };

      entry_revisions: {
        Row: {
          id: string;
          entry_id: string;
          household_id: string;
          changed_by: string;
          changed_at: string;
          before: Json;
          after: Json;
        };
        Insert: {
          id?: string;
          entry_id: string;
          household_id: string;
          changed_by: string;
          changed_at?: string;
          before: Json;
          after: Json;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      medications: {
        Row: {
          id: string;
          household_id: string;
          profile_id: string;
          name: string;
          form: string | null;
          strength: string | null;
          default_dose: number;
          dose_unit: string;
          kind: MedKind;
          schedule: Json | null;
          dose_window_min: number;
          min_interval_hours: number | null;
          purpose: string | null;
          prescriber: string | null;
          instructions: string | null;
          start_date: string | null;
          end_date: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          profile_id: string;
          name: string;
          form?: string | null;
          strength?: string | null;
          default_dose: number;
          dose_unit: string;
          kind: MedKind;
          schedule?: Json | null;
          dose_window_min?: number;
          min_interval_hours?: number | null;
          purpose?: string | null;
          prescriber?: string | null;
          instructions?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          profile_id?: string;
          name?: string;
          form?: string | null;
          strength?: string | null;
          default_dose?: number;
          dose_unit?: string;
          kind?: MedKind;
          schedule?: Json | null;
          dose_window_min?: number;
          min_interval_hours?: number | null;
          purpose?: string | null;
          prescriber?: string | null;
          instructions?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      medication_changes: {
        Row: {
          id: string;
          household_id: string;
          medication_id: string;
          change_type: MedChangeType;
          effective_at: string;
          before: Json;
          after: Json;
          changed_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          medication_id: string;
          change_type: MedChangeType;
          effective_at: string;
          before: Json;
          after: Json;
          changed_by: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      option_lists: {
        Row: {
          id: string;
          household_id: string;
          profile_id: string | null;
          module: string;
          key: string;
          label: string;
          icon: string | null;
          sort_order: number;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          profile_id?: string | null;
          module: string;
          key: string;
          label: string;
          icon?: string | null;
          sort_order?: number;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          profile_id?: string | null;
          module?: string;
          key?: string;
          label?: string;
          icon?: string | null;
          sort_order?: number;
          archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      favorites: {
        Row: {
          id: string;
          household_id: string;
          profile_id: string;
          label: string;
          entry_template: Json;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          profile_id: string;
          label: string;
          entry_template: Json;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          profile_id?: string;
          label?: string;
          entry_template?: Json;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      appointments: {
        Row: {
          id: string;
          household_id: string;
          profile_id: string;
          date: string;
          provider: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          profile_id: string;
          date: string;
          provider?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          profile_id?: string;
          date?: string;
          provider?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      audit_events: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          action: string;
          target: string | null;
          at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          action: string;
          target?: string | null;
          at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          action?: string;
          target?: string | null;
          at?: string;
        };
        Relationships: [];
      };
    };

    Views: Record<string, never>;
    CompositeTypes: Record<string, never>;

    Functions: {
      get_member_role: {
        Args: { p_household_id: string };
        Returns: Role | null;
      };
      is_household_member: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
      can_access_profile: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      create_household: {
        Args: { p_name: string; p_display_name: string; p_initials: string };
        Returns: string;
      };
      accept_invite: {
        Args: { p_token: string; p_display_name: string; p_initials: string };
        Returns: void;
      };
    };

    Enums: Record<string, never>;
  };
}
