import { generateUUID } from "./Helper";

// Comment functions - Now integrated into point table
export const updateComment = (pointId: string, newValue: string, db: any) => {
  db.runSync("UPDATE point SET comment = ? WHERE id = ?", [newValue, pointId]);
};

export const deleteComment = (pointId: string, db: any) => {
  db.runSync("UPDATE point SET comment = NULL WHERE id = ?", [pointId]);
};

export const addComment = (pointId: string, value: string, db: any) => {
  return db.runSync("UPDATE point SET comment = ? WHERE id = ?", [
    value,
    pointId,
  ]);
};

// Picture functions - No changes
export const updatePicture = (pictureId: string, newImage: string, db: any) => {
  db.runSync("UPDATE picture SET image = ? WHERE id = ?", [
    newImage,
    pictureId,
  ]);
};

export const deletePicture = (pictureId: string, db: any) => {
  db.runSync("DELETE FROM picture WHERE id = ?", [pictureId]);
};

export const addPicture = (pointId: string, image: string, db: any) => {
  const pictureId = generateUUID();
  return db.runSync(
    "INSERT INTO picture (id, point_id, image) VALUES (?, ?, ?)",
    [pictureId, pointId, image]
  );
};

// Equipement functions (formerly obstacle) - number renamed to quantity
export const updateEquipement = (
  equipementId: string,
  newQuantity: number,
  equipementTypeId: number,
  db: any
) => {
  db.runSync("UPDATE equipement SET quantity = ?, type_id = ? WHERE id = ?", [
    newQuantity,
    equipementTypeId,
    equipementId,
  ]);
};

export const deleteEquipement = (equipementId: string, db: any) => {
  db.runSync("DELETE FROM equipement WHERE id = ?", [equipementId]);
};

export const addEquipement = (
  eventId: string,
  typeId: string,
  quantity: number,
  db: any,
  coordinates?: { x: number; y: number }[]
) => {
  const equipementId = generateUUID();
  db.runSync(
    "INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit) VALUES (?, ?, ?, ?, ?)",
    [equipementId, eventId, typeId, quantity, 0]
  );
  
  // Ajouter les coordonnées si fournies
  if (coordinates && coordinates.length > 0) {
    coordinates.forEach((coord, index) => {
      const coordId = generateUUID();
      db.runSync(
        "INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)",
        [coordId, equipementId, coord.x, coord.y, index]
      );
    });
  }
  
  return equipementId;
};

// Legacy aliases for backward compatibility during migration
export const updateObstacle = updateEquipement;
export const deleteObstacle = deleteEquipement;
export const addObstacle = addEquipement;

// Point functions
export const updatePointCoordinates = (
  pointId: string,
  x: number,
  y: number,
  db: any
) => {
  db.runSync("UPDATE point SET x = ?, y = ? WHERE id = ?", [x, y, pointId]);
};

export const deletePoint = (id: string, db: any) => {
  // Pictures and equipements will be deleted by CASCADE
  // point.comment is directly in point table
  const result = db.runSync("DELETE FROM point WHERE id = ?", [id]);
  return result;
};

export const updateTimeStamp = (pointId: string, db: any) => {
  try {
    db.runSync("UPDATE point SET modified_at = ? WHERE id = ?", [
      new Date().toISOString(),
      pointId,
    ]);
  } catch (error) {
    console.error("Failed to update point's modified_at timestamp:", error);
  }
};
