export type Transport = 'metro' | 'metrobus';
export type RouteMode = 'fast' | 'transfers';

export type TransitLine = {
  id: string;
  color: string;
  stations: string[];
};

export type RouteSegment = {
  line: TransitLine;
  stations: string[];
  direction: string;
};

export type TransitRoute = {
  segments: RouteSegment[];
  stops: number;
  transfers: number;
  minutes: number;
  path: string[];
};
