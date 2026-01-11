import { invoke } from '@tauri-apps/api/core';
import type { Event, EventInput, EventGeometryInput } from '../types/event';

// ========== SERVICES POUR LES ÉVÉNEMENTS ==========

/**
 * Récupère tous les événements avec leurs géométries
 */
export async function fetchEvents(): Promise<Event[]> {
  try {
    return await invoke("fetch_events");
  } catch (error) {
    console.error("Erreur lors de la récupération des événements:", error);
    throw new Error(`Impossible de récupérer les événements: ${error}`);
  }
}

/**
 * Récupère un événement par son ID avec ses géométries
 */
export async function fetchEventById(eventId: string): Promise<Event | null> {
    try {
        return await invoke('fetch_event_by_id', { eventId });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'événement:', error);
        throw new Error(`Impossible de récupérer l'événement ${eventId}: ${error}`);
    }
}

/**
 * Crée un nouvel événement
 */
export async function createEvent(event: EventInput): Promise<string> {
    try {
        return await invoke('create_event', { event });
    } catch (error) {
        console.error('Erreur lors de la création de l\'événement:', error);
        throw new Error(`Impossible de créer l'événement: ${error}`);
    }
}

/**
 * Met à jour un événement existant
 */
export async function updateEvent(eventId: string, event: EventInput): Promise<void> {
    try {
        await invoke('update_event', { eventId, event });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'événement:', error);
        throw new Error(`Impossible de mettre à jour l'événement ${eventId}: ${error}`);
    }
}

/**
 * Supprime un événement
 */
export async function deleteEvent(eventId: string): Promise<void> {
    try {
        await invoke('delete_event', { eventId });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'événement:', error);
        throw new Error(`Impossible de supprimer l'événement ${eventId}: ${error}`);
    }
}

// ========== SERVICES POUR LES GÉOMÉTRIES D'ÉVÉNEMENTS ==========

/**
 * Crée une nouvelle géométrie pour un événement
 */
export async function createEventGeometry(
  geometry: EventGeometryInput,
): Promise<string> {
  try {
    return await invoke("create_event_geometry", { geometry });
  } catch (error) {
    console.error("Erreur lors de la création de la géométrie:", error);
    throw new Error(`Impossible de créer la géométrie: ${error}`);
  }
}

/**
 * Met à jour une géométrie d'événement existante
 */
export async function updateEventGeometry(
  geometryId: string,
  geometry: EventGeometryInput,
): Promise<void> {
  try {
    await invoke("update_event_geometry", { geometryId, geometry });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la géométrie:", error);
    throw new Error(
      `Impossible de mettre à jour la géométrie ${geometryId}: ${error}`,
    );
  }
}

/**
 * Supprime une géométrie d'événement
 */
export async function deleteEventGeometry(geometryId: string): Promise<void> {
  try {
    await invoke("delete_event_geometry", { geometryId });
  } catch (error) {
    console.error("Erreur lors de la suppression de la géométrie:", error);
    throw new Error(
      `Impossible de supprimer la géométrie ${geometryId}: ${error}`,
    );
  }
}

// ========== UTILITAIRES ==========

/**
 * Parse les propriétés de style d'une géométrie (JSON)
 */
export function parseStyleProperties(stylePropertiesJson?: string): Record<string, unknown> | null {
    if (!stylePropertiesJson) return null;

    try {
        return JSON.parse(stylePropertiesJson);
    } catch (error) {
        console.error('Erreur lors du parsing des propriétés de style:', error);
        return null;
    }
}

/**
 * Stringify les propriétés de style pour la base de données
 */
export function stringifyStyleProperties(
  styleProperties: Record<string, unknown>,
): string {
  return JSON.stringify(styleProperties);
}

/**
 * Génère une couleur par défaut pour un type de géométrie
 */
export function getDefaultColorForGeometryType(geometryTypeId: number): string {
    const colorMap: Record<number, string> = {
        1: '#4CAF50', // Zone de couverture - Vert
        2: '#2196F3', // Tracé de course - Bleu
        3: '#F44336', // Zone interdite - Rouge
        4: '#FF9800', // Zone de sécurité - Orange
        5: '#9C27B0', // Point de contrôle - Violet
        6: '#00BCD4', // Zone d'accueil public - Cyan
        7: '#FFEB3B', // Ligne de départ/arrivée - Jaune
        8: '#795548', // Zone logistique - Marron
    };

    return colorMap[geometryTypeId] || '#000000';
}

/**
 * Valide qu'une géométrie WKT est correcte (basique)
 */
export function validateWKT(wkt: string): boolean {
    if (!wkt || wkt.trim().length === 0) {
        return false;
    }

    // Vérifications basiques pour les formats WKT courants
    const wktUpper = wkt.trim().toUpperCase();
    const validTypes = [
        'POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT',
        'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION'
    ];

    return validTypes.some(type => wktUpper.startsWith(type));
}
