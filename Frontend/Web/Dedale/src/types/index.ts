// =============================================
// TYPES CENTRALISÉS - Dedale Application
// =============================================
// Ce fichier est la source unique de vérité pour tous les types de l'application.
// Importez tous les types depuis ce fichier: import { Person, Team, Event } from '../types';

// =============================================
// PERSON - Types liés aux personnes
// =============================================
export interface Person {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    phone_number: string;
}

// =============================================
// TEAM - Types liés aux équipes
// =============================================
export interface Team {
    id: string;
    name: string;
    number?: number;     // Optionnel car pas toujours présent
    event_id?: string;   // snake_case pour cohérence avec backend
    eventId?: string;    // Alias camelCase pour compatibilité
}

export interface TeamDetailData {
    members: Person[];
    events: TeamEvent[];
    actions: EquipementAction[];
}

export interface TeamWithActions extends Team {
    actions: Action[];
}

export interface TransferTeamInfo {
    id: string;
    name: string;
    eventId: string;
}

// =============================================
// EVENT - Types liés aux événements
// =============================================
export interface Event {
    id: string;
    name: string;
    start_date?: string;
    end_date?: string;
    date_debut?: string;   // Alias pour compatibilité
    date_fin?: string;     // Alias pour compatibilité
    statut?: string;
    status?: string;       // Alias anglais
    description?: string;
    date?: Date;
    geometry?: string;
}

export interface TeamEvent {
    id: number;
    name: string;
    statut: string;
}

export interface EventInput {
    name?: string;
    date_debut?: string;
    date_fin?: string;
    description?: string;
    statut?: string;
}

export interface EventGeometryInput {
    event_id: string;
    geometry_type_id: number;
    geom: string;
    style_properties?: string;
}

export interface GeometryType {
    id: string;
    name: string;
    color?: string;
}

// =============================================
// MAP - Types liés à la carte
// =============================================
export interface GeometryData {
    id: string;
    event_id: string;
    geom: string;
    name?: string;
}

export interface Zone {
    id: string;
    name: string;
    event_id: string;
    color: string;
    description?: string;
    geometry_json: string;
}

export interface Parcours {
    id: string;
    event_id: string;
    name: string;
    color: string;
    start_time: string;
    speed_low: number;
    speed_high: number;
    geometry_json: string;
}

export interface Obstacle {
    id?: number;
    name?: string;
    number?: number;
    description?: string;
    width?: number;
    length?: number;
}

export interface MapPoint {
    id: string;
    x: number;
    y: number;
    name?: string;
    event_id: string | null;
    status?: boolean;
    comment?: string;
    type?: string;
    pictures?: Array<{
        id: string;
        point_id: string;
        image?: string;
    }>;
}

export interface MapInterest {
    id: string;
    x: number;
    y: number;
    description: string;
    event_id: string | null;
}

export interface MapEvent {
    id: string;
    name?: string;
    event_type?: string;
    status?: string;
    statut?: string;
}

export interface SearchResult {
    lon: string;
    lat: string;
    display_name: string;
}

export interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

// =============================================
// EQUIPEMENT - Types liés aux équipements
// =============================================
export interface EquipementType {
    id: string;
    name: string;
    description?: string;
}

export interface EquipementCoordinate {
    id: string;
    equipement_id: string;
    x: number;
    y: number;
    order_index?: number;
}

export interface Equipement {
    id: string;
    type_id?: string;
    type_name?: string;
    type_description?: string;
    length?: number;
    length_per_unit?: number;
    quantity?: number;
    description?: string;
    date_pose?: string;
    hour_pose?: string;
    date_depose?: string;
    hour_depose?: string;
    event_id?: string;
    coordinates: EquipementCoordinate[];
}

export interface TransferEquipementCoordinate {
    id: string;
    equipement_id: string;
    x: number;
    y: number;
    order_index: number | null;
}

export interface EquipementAction extends Equipement {
    action_id: string;
    action_type: string;
}

// =============================================
// ACTION - Types liés aux actions/planning
// =============================================
export interface Action {
    id: string;
    team_id: string;
    equipement_id: string;
    action_type: string;
    scheduled_time: string;
    is_done: boolean;
}

export interface Planning {
    team: TransferTeamInfo;
    actions: Action[];
    equipements: Equipement[];
    coordonees: TransferEquipementCoordinate[];
}

export type TransferPhase = "idle" | "qr_displayed" | "connected";

// =============================================
// VISIBILITY FILTERS - Filtres d'affichage
// =============================================
export interface VisibilityFilters {
    showZones: boolean;
    showParcours: boolean;
    showInterests: boolean;
    showEquipements: boolean;
}

// =============================================
// GEOMETRY - Types utilitaires pour géométries
// =============================================
export type GeometryItem =
    | ({ type: "zone" } & Zone)
    | ({ type: "parcours" } & Parcours);

export interface ZoneWithDescription extends Zone {
    description?: string;
}

export interface ParcoursWithDescription extends Parcours {
    description?: string;
}

// =============================================
// DEFAULT VALUES / CONSTANTS
// =============================================
export const DEFAULT_GEOMETRY_TYPES: Event[] = [
    { id: "1", name: "Zone de couverture", date: new Date(), geometry: "#4CAF50" },
    { id: "2", name: "Tracé de course", date: new Date(), geometry: "#2196F3" },
    { id: "3", name: "Zone interdite", date: new Date(), geometry: "#F44336" },
    { id: "4", name: "Zone de sécurité", date: new Date(), geometry: "#FF9800" },
    { id: "5", name: "Point de contrôle", date: new Date(), geometry: "#9C27B0" },
    { id: "6", name: "Zone d'accueil public", date: new Date(), geometry: "#00BCD4" },
    { id: "7", name: "Ligne de départ/arrivée", date: new Date(), geometry: "#FFEB3B" },
    { id: "8", name: "Zone logistique", date: new Date(), geometry: "#795548" },
];
