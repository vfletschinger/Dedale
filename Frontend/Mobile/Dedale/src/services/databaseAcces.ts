import { generateUUID } from './Helper';

export const updateComment = (commentId: string, newValue: string, db: any) => {
  db.runSync('UPDATE comment SET value = ? WHERE id = ?', [newValue, commentId]);
};

export const deleteComment = (commentId: string, db: any) => {
  db.runSync('DELETE FROM comment WHERE id = ?', [commentId]);
};

export const addComment = (pointId: string, value: string, db: any) => {
  const commentId = generateUUID();
  return db.runSync('INSERT INTO comment (id, point_id, value) VALUES (?, ?, ?)', [commentId, pointId, value]);
};

export const updatePicture = (pictureId: string, newImage: string, db: any) => {
  db.runSync('UPDATE picture SET image = ? WHERE id = ?', [newImage, pictureId]);
};

export const deletePicture = (pictureId: string, db: any) => {
  db.runSync('DELETE FROM picture WHERE id = ?', [pictureId]);
};

export const addPicture = (pointId: string, image: string, db: any) => {
  const pictureId = generateUUID();
  return db.runSync('INSERT INTO picture (id, point_id, image) VALUES (?, ?, ?)', [pictureId, pointId, image]);
};

export const updateObstacle = (obstacleId: string, newNumber: number, obstacleTypeId: number, db: any) => {
  db.runSync('UPDATE obstacle SET number = ?, type_id = ? WHERE id = ?', [newNumber, obstacleTypeId, obstacleId]);
};

export const deleteObstacle = (obstacleId: string, db: any) => {
  db.runSync('DELETE FROM obstacle WHERE id = ?', [obstacleId]);
};

export const addObstacle = (pointId: string, typeId: number, number: number, db: any) => {
  const obstacleId = generateUUID();
  return db.runSync('INSERT INTO obstacle (id, point_id, type_id, number) VALUES (?, ?, ?, ?)', [obstacleId, pointId, typeId, number]);
};

export const updatePointCoordinates = (pointId: string, x: number, y: number, db: any) => {
  db.runSync('UPDATE point SET x = ?, y = ? WHERE id = ?', [x, y, pointId]);
};

export const deletePoint = (id: string, db: any) => {
  const result = db.runSync('DELETE FROM point WHERE id = ?', [id]);
  return result;
};

export const updateTimeStamp = (pointId: string, db: any) => {
  try {
    db.runSync(
      'UPDATE point SET modified_at = ? WHERE id = ?',
      [new Date().toISOString(), pointId]
    );
  } catch (error) {
    console.error("Failed to update point's modified_at timestamp:", error);
  }
};