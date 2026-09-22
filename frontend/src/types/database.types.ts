// Refactor del tipo role
export type UserRole = 'admin' | 'gestor' | 'agente' | 'cliente';
export type DocumentType = 'CC' | 'CE' | 'Pasaporte' | 'NIT';
export type KycStatus = 'no_iniciado' | 'pendiente' | 'aprobado' | 'rechazado';

export interface NotificationPreferences {
  paquete_recibido: boolean;
  aprobado_aduana: boolean;
  impuesto_pendiente: boolean;
  canal_whatsapp_sms: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  locker_code: string | null;
  phone: string | null;
  role: UserRole;
  gestor_id: string | null;
  created_at: string;
  updated_at: string;
  document_type: DocumentType | null;
  document_number: string | null;
  kyc_status: KycStatus;
  kyc_document_path: string | null;
  kyc_rejection_reason: string | null;
  terms_accepted_at: string | null;
  habeas_data_accepted_at: string | null;
  notification_preferences: NotificationPreferences;
  address_street: string | null;
  address_city: string | null;
  address_department: string | null;
  address_postal_code: string | null;
  address_country: string | null;
}

export interface PreAlert {
  id: string;
  user_id: string;
  tracking_number: string;
  carrier: string;
  description: string;
  declared_value: number;
  status: 'pendiente' | 'recibido' | 'en_transito' | 'entregado';
  created_at: string;
}

export interface CustomsQuery {
  id: string;
  user_id: string;
  product_description: string;
  hs_code: string | null;
  ai_verdict: string;
  ai_confidence: number | null;
  raw_response: Record<string, unknown> | null;
  created_at: string;
  overridden_by: string | null;
  override_reason: string | null;
  overridden_at: string | null;
  original_ai_verdict: string | null;
  assigned_agent_id: string | null;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  related_pre_alert_id: string | null;
  created_at: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  reviewed_by: string | null;
  review_reason: string | null;
  reviewed_at: string | null;
  assigned_agent_id: string | null;
}

export interface SolicitudAsesor {
  id: string;
  user_id: string;
  mensaje: string | null;
  estado: 'pendiente' | 'atendida';
  created_at: string;
  atendida_por: string | null;
  atendida_at: string | null;
}

export type NotificationType = 'paquete_recibido' | 'aprobado_aduana' | 'impuesto_pendiente';

export interface NotificationRecord {
  id: string;
  user_id: string;
  tipo: NotificationType;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  created_at: string;
}