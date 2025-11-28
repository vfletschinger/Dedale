export interface Event {
    id: number;
    name?: string;
    date: Date;
    geometry?: string;
}

export const DEFAULT_GEOMETRY_TYPES: Event[] = [
    { id: 1, name: 'Zone de couverture', date: new Date(), geometry: '#4CAF50' },
    { id: 2, name: 'Tracé de course', date: new Date(), geometry: '#2196F3' },
    { id: 3, name: 'Zone interdite', date: new Date(), geometry: '#F44336' },
    { id: 4, name: 'Zone de sécurité', date: new Date(), geometry: '#FF9800' },
    { id: 5, name: 'Point de contrôle', date: new Date(), geometry: '#9C27B0' },
    { id: 6, name: 'Zone d\'accueil public', date: new Date(), geometry: '#00BCD4' },
    { id: 7, name: 'Ligne de départ/arrivée', date: new Date(), geometry: '#FFEB3B' },
    { id: 8, name: 'Zone logistique', date: new Date(), geometry: '#795548' },
];