export type InterestPointsType = {
    id: number;
    x: number;
    y: number;
}

export type PointDetailType = InterestPointsType & {
    value: string;
    description: string;
    length: number;
    name: string;
    image: string;
    width: number;
    point_id: number
}