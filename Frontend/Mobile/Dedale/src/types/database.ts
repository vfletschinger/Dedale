export type InterestPointsType = {
    id: number;
    x: number;
    y: number;
}

export type CommentType = {
    id: number;
    point_id: number;
    value: string;
}

export type PictureType = {
    id: number;
    point_id: number;
    image: string;
}

export type ObstacleType = {
    id: number;
    point_id: number;
    type_id: number;
    nombre: number;
    name?: string;
    description?: string;
    width?: number;
    length?: number;
}

export type PointDetailType = {
    point: InterestPointsType;
    comments: CommentType[];
    pictures: PictureType[];
    obstacles: ObstacleType[];
}