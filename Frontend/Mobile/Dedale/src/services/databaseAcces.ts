export const updateComment = (commentId: number, newValue: string, db: any) => {
  db.runSync('UPDATE comment SET value = ? WHERE id = ?', [newValue, commentId]);
};

export const deleteComment = (commentId: number, db: any) => {
  db.runSync('DELETE FROM comment WHERE id = ?', [commentId]);
};

export const addComment = (pointId: number, value: string, db: any) => {
  return db.runSync('INSERT INTO comment (point_id, value) VALUES (?, ?)', [pointId, value]);
};

export const updatePicture = (pictureId: number, newImage: string, db: any) => {
  db.runSync('UPDATE picture SET image = ? WHERE id = ?', [newImage, pictureId]);
};

export const deletePicture = (pictureId: number, db: any) => {
  db.runSync('DELETE FROM picture WHERE id = ?', [pictureId]);
};

export const addPicture = (pointId: number, image: string, db: any) => {
  return db.runSync('INSERT INTO picture (point_id, image) VALUES (?, ?)', [pointId, image]);
};

export const updateObstacle = (obstacleId: number, newNumber: number, obstacleTypeId: number, db: any) => {
  db.runSync('UPDATE obstacle SET number = ?, type_id = ? WHERE id = ?', [newNumber, obstacleTypeId, obstacleId]);
};

export const deleteObstacle = (obstacleId: number, db: any) => {
  db.runSync('DELETE FROM obstacle WHERE id = ?', [obstacleId]);
};

export const addObstacle = (pointId: number, typeId: number, number: number, db: any) => {
  return db.runSync('INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)', [pointId, typeId, number]);
};

export const updatePointCoordinates = (pointId: number, x: number, y: number, db: any) => {
  db.runSync('UPDATE point SET x = ?, y = ? WHERE id = ?', [x, y, pointId]);
};

export const deletePoint = (id: number, db: any) => {
  const result = db.runSync('DELETE FROM point WHERE id = ?', [id]);
  return result;
};

 export const updateTimeStamp = (pointId: number, db: any) => {
    try {
      db.runSync(
        'UPDATE point SET modified_at = ? WHERE id = ?',
        [new Date().toISOString(), pointId]
      );
    } catch (error) {
      console.error("Failed to update point's modified_at timestamp:", error);
    }
  };