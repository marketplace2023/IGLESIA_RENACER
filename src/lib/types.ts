export type Rol = "admin" | "lider";
export type Origen = "evangelismo" | "visitante";
export type Estado = "nuevo" | "en_seguimiento" | "integrado" | "inactivo";
export type Etapa = "ganado" | "consolidacion" | "escuela_formacion" | "academia_lideres" | "lanzado" | "discipulado";
export type TipoContacto = "visita" | "llamada" | "whatsapp" | "reunion" | "otro";

export interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  telefono: string | null;
  rol: Rol;
  activo: number;
  creado_en?: string;
  total_personas?: number;
  total_casas?: number;
}

export interface Lider {
  id: number;
  nombre: string;
  rol: Rol;
}

export interface Casa {
  id: number;
  nombre: string;
  direccion: string | null;
  zona: string | null;
  dia_reunion: string | null;
  hora: string | null;
  lider_id: number | null;
  lider_nombre: string | null;
  anfitrion_id: number | null;
  anfitrion_nombre: string | null;
  anfitrion_telefono: string | null;
  total_personas: number;
}

export interface Persona {
  id: number;
  nombres: string;
  apellidos: string;
  telefono_casa: string | null;
  telefono_personal: string | null;
  direccion: string | null;
  zona: string | null;
  origen: Origen;
  invitado_por: string | null;
  fecha_llegada: string | null;
  casa_amistad_id: number | null;
  lider_id: number | null;
  estado: Estado;
  /** Solo cuando estado = "integrado" */
  etapa: Etapa | null;
  notas: string | null;
  creado_por: number | null;
  creado_por_nombre: string | null;
  creado_en: string;
  lider_nombre: string | null;
  casa_nombre: string | null;
  ultimo_contacto: string | null;
  total_contactos: number;
  /** Id de la casa de amistad que funciona en su hogar (si es anfitrión) */
  casa_propia_id: number | null;
}

export interface Seguimiento {
  id: number;
  persona_id: number;
  tipo: TipoContacto;
  fecha: string;
  observaciones: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
}

export interface CasaPropia {
  id: number;
  nombre: string;
  dia_reunion: string | null;
  hora: string | null;
  total_personas: number;
}

export interface PersonaDetalle extends Persona {
  casa_propia: CasaPropia | null;
  seguimientos: Seguimiento[];
}

export interface Resumen {
  total: number;
  evangelismo: number;
  visitante: number;
  nuevos_mes: number;
  nuevo: number;
  en_seguimiento: number;
  integrado: number;
  inactivo: number;
  pendientes: number;
  contactos_mes: number;
  dias_pendiente: number;
  etapas: Partial<Record<Etapa, number>>;
  pendientes_lista: Pick<
    Persona,
    "id" | "nombres" | "apellidos" | "telefono_personal" | "telefono_casa" | "ultimo_contacto" | "fecha_llegada" | "estado" | "etapa"
  >[];
  recientes: Pick<Persona, "id" | "nombres" | "apellidos" | "origen" | "fecha_llegada" | "creado_en" | "invitado_por">[];
  actividad: {
    id: number;
    tipo: TipoContacto;
    fecha: string;
    observaciones: string | null;
    persona_id: number;
    nombres: string;
    apellidos: string;
    usuario_nombre: string | null;
  }[];
}

export const ORIGEN_LABEL: Record<Origen, string> = {
  evangelismo: "Evangelismo",
  visitante: "Visitante",
};

export const ESTADO_LABEL: Record<Estado, string> = {
  nuevo: "Nuevo",
  en_seguimiento: "En seguimiento",
  integrado: "Integrado",
  inactivo: "Inactivo",
};

/** Etapas del estado "Integrado", en orden */
export const ETAPA_LABEL: Record<Etapa, string> = {
  ganado: "Ganado",
  consolidacion: "En Consolidación",
  escuela_formacion: "En Escuela de Formación",
  academia_lideres: "En Academia de Líderes",
  lanzado: "Lanzado",
  discipulado: "En Discipulado",
};

export const TIPO_LABEL: Record<TipoContacto, string> = {
  visita: "Visita",
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  reunion: "Reunión / culto",
  otro: "Otro",
};

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
