import { invoke } from '@tauri-apps/api/core';

// Types
export interface Person {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  members: number[];
  created_at?: string;
}

export interface Equipment {
  id: number;
  name: string;
  type: string;
  quantity: number;
  point_id: number;
  created_at?: string;
}

// Validation utilities
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateRole(role: string): boolean {
  if (!role) return false;
  const validRoles = ['admin', 'user', 'guest'];
  return validRoles.includes(role);
}

export function validateEquipmentType(type: string): boolean {
  if (!type) return false;
  const validTypes = ['tool', 'material', 'safety'];
  return validTypes.includes(type);
}

// Person Management
export async function getAllPersons(): Promise<Person[]> {
  try {
    const persons = await invoke<Person[]>('get_all_persons');
    return persons;
  } catch {
    throw new Error('Failed to fetch persons');
  }
}

export async function getPersonById(id: number | null): Promise<Person> {
  if (id === null || id === undefined) {
    throw new Error('Person ID is required');
  }
  if (id <= 0) {
    throw new Error('Person ID must be positive');
  }
  
  try {
    const person = await invoke<Person>('get_person_by_id', { id });
    return person;
  } catch {
    throw new Error('Person not found');
  }
}

export async function createPerson(person: Omit<Person, 'id'>): Promise<number> {
  if (!person.name || person.name.trim() === '') {
    throw new Error('Name is required');
  }
  if (!validateEmail(person.email)) {
    throw new Error('Invalid email format');
  }
  if (!validateRole(person.role)) {
    throw new Error('Invalid role');
  }
  
  try {
    const id = await invoke<number>('create_person', person);
    return id;
  } catch {
    throw new Error('Failed to create person');
  }
}

export async function updatePerson(id: number, updateData: Partial<Omit<Person, 'id'>>): Promise<void> {
  if (id <= 0) {
    throw new Error('Person ID must be positive');
  }
  if (updateData.name !== undefined && (!updateData.name || updateData.name.trim() === '')) {
    throw new Error('Name is required');
  }
  if (updateData.email && !validateEmail(updateData.email)) {
    throw new Error('Invalid email format');
  }
  if (updateData.role && !validateRole(updateData.role)) {
    throw new Error('Invalid role');
  }
  
  try {
    await invoke('update_person', { id, ...updateData });
  } catch {
    throw new Error('Failed to update person');
  }
}

export async function deletePerson(id: number): Promise<void> {
  if (id <= 0) {
    throw new Error('Person ID must be positive');
  }
  
  try {
    await invoke('delete_person', { id });
  } catch {
    throw new Error('Person has associated records');
  }
}

// Team Management
export async function getAllTeams(): Promise<Team[]> {
  try {
    const teams = await invoke<Team[]>('get_all_teams');
    return teams;
  } catch {
    throw new Error('Failed to fetch teams');
  }
}

export async function getTeamById(id: number | null): Promise<Team> {
  if (id === null || id === undefined) {
    throw new Error('Team ID is required');
  }
  
  try {
    const team = await invoke<Team>('get_team_by_id', { id });
    return team;
  } catch {
    throw new Error('Team not found');
  }
}

export async function createTeam(team: Omit<Team, 'id'>): Promise<number> {
  if (!team.name || team.name.trim() === '') {
    throw new Error('Team name is required');
  }
  if (!Array.isArray(team.members)) {
    throw new Error('Team members must be an array');
  }
  
  try {
    const id = await invoke<number>('create_team', team);
    return id;
  } catch {
    throw new Error('Failed to create team');
  }
}

export async function updateTeam(id: number, updateData: Partial<Omit<Team, 'id'>>): Promise<void> {
  if (id <= 0) {
    throw new Error('Team ID must be positive');
  }
  
  try {
    await invoke('update_team', { id, ...updateData });
  } catch {
    throw new Error('Failed to update team');
  }
}

export async function deleteTeam(id: number): Promise<void> {
  if (id <= 0) {
    throw new Error('Team ID must be positive');
  }
  
  try {
    await invoke('delete_team', { id });
  } catch {
    throw new Error('Failed to delete team');
  }
}

// Equipment Management
export async function getAllEquipments(): Promise<Equipment[]> {
  try {
    const equipments = await invoke<Equipment[]>('get_all_equipments');
    return equipments;
  } catch {
    throw new Error('Failed to fetch equipments');
  }
}

export async function getEquipmentsByPointId(pointId: number | null): Promise<Equipment[]> {
  if (pointId === null || pointId === undefined) {
    throw new Error('Point ID is required');
  }
  
  try {
    const equipments = await invoke<Equipment[]>('get_equipments_by_point', { point_id: pointId });
    return equipments;
  } catch {
    throw new Error('Failed to fetch equipments');
  }
}

export async function createEquipment(equipment: Omit<Equipment, 'id'>): Promise<number> {
  if (!equipment.name || equipment.name.trim() === '') {
    throw new Error('Equipment name is required');
  }
  if (!validateEquipmentType(equipment.type)) {
    throw new Error('Invalid equipment type');
  }
  if (equipment.quantity <= 0) {
    throw new Error('Quantity must be positive');
  }
  
  try {
    const id = await invoke<number>('create_equipment', equipment);
    return id;
  } catch {
    throw new Error('Failed to create equipment');
  }
}

export async function updateEquipment(id: number, updateData: Partial<Omit<Equipment, 'id'>>): Promise<void> {
  if (id <= 0) {
    throw new Error('Equipment ID must be positive');
  }
  
  try {
    await invoke('update_equipment', { id, ...updateData });
  } catch {
    throw new Error('Failed to update equipment');
  }
}

export async function deleteEquipment(id: number): Promise<void> {
  if (id <= 0) {
    throw new Error('Equipment ID must be positive');
  }
  
  try {
    await invoke('delete_equipment', { id });
  } catch {
    throw new Error('Failed to delete equipment');
  }
}

// Search and Filter Functions
export async function searchPersons(query: string): Promise<Person[]> {
  try {
    if (!query || query.trim() === '') {
      return await invoke<Person[]>('get_all_persons');
    }
    const persons = await invoke<Person[]>('search_persons', { query });
    return persons;
  } catch {
    throw new Error('Failed to search persons');
  }
}

export async function getPersonsByRole(role: string): Promise<Person[]> {
  if (!validateRole(role)) {
    throw new Error('Invalid role');
  }
  
  try {
    const persons = await invoke<Person[]>('get_persons_by_role', { role });
    return persons;
  } catch {
    throw new Error('Failed to fetch persons by role');
  }
}

export async function getTeamMembers(teamId: number): Promise<Person[]> {
  if (teamId <= 0) {
    throw new Error('Team ID must be positive');
  }
  
  try {
    const members = await invoke<Person[]>('get_team_members', { team_id: teamId });
    return members;
  } catch {
    throw new Error('Failed to fetch team members');
  }
}

// Database Maintenance
export async function initializeDatabase(): Promise<boolean> {
  try {
    const result = await invoke<boolean>('initialize_database');
    return result;
  } catch {
    throw new Error('Database initialization failed');
  }
}

export async function backupDatabase(): Promise<string> {
  try {
    const backupPath = await invoke<string>('backup_database');
    return backupPath;
  } catch {
    throw new Error('Backup failed');
  }
}

export async function restoreDatabase(backupPath: string): Promise<boolean> {
  if (!backupPath || backupPath.trim() === '') {
    throw new Error('Backup path is required');
  }
  
  try {
    const result = await invoke<boolean>('restore_database', { backup_path: backupPath });
    return result;
  } catch {
    throw new Error('Restore failed');
  }
}

export async function clearDatabase(): Promise<boolean> {
  try {
    const result = await invoke<boolean>('clear_database');
    return result;
  } catch {
    throw new Error('Clear database failed');
  }
}

// Batch Operations
export async function createMultiplePersons(persons: Omit<Person, 'id'>[]): Promise<number[]> {
  // Validate all persons data
  for (const person of persons) {
    if (!person.name || person.name.trim() === '') {
      throw new Error('Invalid person data');
    }
    if (!validateEmail(person.email)) {
      throw new Error('Invalid person data');
    }
    if (!validateRole(person.role)) {
      throw new Error('Invalid person data');
    }
  }
  
  try {
    const ids = await invoke<number[]>('create_multiple_persons', { persons });
    return ids;
  } catch {
    throw new Error('Failed to create multiple persons');
  }
}

export async function deleteMultiplePersons(ids: number[]): Promise<boolean> {
  // Validate all IDs
  if (ids.some(id => id <= 0)) {
    throw new Error('All person IDs must be positive');
  }
  
  try {
    const result = await invoke<boolean>('delete_multiple_persons', { ids });
    return result;
  } catch {
    throw new Error('Failed to delete multiple persons');
  }
}

// Legacy database functionality (keeping for compatibility)
import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function initLegacyDatabase(): Promise<Database> {
  if (db) return db;

  console.log("[DB] Chargement de la base de données...");
  try {
    db = await Database.load("sqlite:mydatabase.db");
    console.log("[DB] Base de données chargée !");

    const tables = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    );
    console.log("[DB] Tables existantes:", tables.map(t => t.name).join(", ") || "Aucune");

    return db;
  } catch (error) {
    console.error("[DB] Erreur lors du chargement:", error);
    throw error;
  }
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initLegacyDatabase();
  }
  return db;
}

export { db };
