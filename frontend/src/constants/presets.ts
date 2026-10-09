import type { Coordinate } from "../types/route";

export interface PresetLocation {
  name: string;
  originName: string;
  destName: string;
  origin: Coordinate;
  dest: Coordinate;
}

export const INDORE_PRESETS: PresetLocation[] = [
  {
    name: "Rajwada ➔ 56 Dukan",
    originName: "Rajwada Palace",
    destName: "56 Dukan (Chappan)",
    origin: { latitude: 22.7196, longitude: 75.8577 },
    dest: { latitude: 22.7256, longitude: 75.8656 },
  },
  {
    name: "Sarafa ➔ Bhawarkua",
    originName: "Sarafa Night Bazaar",
    destName: "Bhawarkua Square",
    origin: { latitude: 22.7177, longitude: 75.8543 },
    dest: { latitude: 22.6922, longitude: 75.8676 },
  },
  {
    name: "TI Mall ➔ Nehru Stadium",
    originName: "Treasure Island Mall",
    destName: "Nehru Stadium",
    origin: { latitude: 22.7225, longitude: 75.879 },
    dest: { latitude: 22.7118, longitude: 75.8765 },
  },
  {
    name: "Vijay Nagar ➔ Sayaji",
    originName: "Vijay Nagar Square",
    destName: "Sayaji Hotel",
    origin: { latitude: 22.7533, longitude: 75.8937 },
    dest: { latitude: 22.7502, longitude: 75.897 },
  },
];
