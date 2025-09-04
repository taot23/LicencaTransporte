// Esquema para tipos de conjunto dinâmicos
import { z } from "zod";

export const vehicleSetTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string().optional(),
  axleConfiguration: z.object({
    tractorAxles: z.number(),
    firstTrailerAxles: z.number(),
    secondTrailerAxles: z.number(),
    dollyAxles: z.number().optional(),
    totalAxles: z.number(),
    requiresDolly: z.boolean(),
    isFlexible: z.boolean(), // Se true, ignora validação de eixos
  }),
  dimensionLimits: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    maxWidth: z.number().optional(),
    maxHeight: z.number().optional(),
  }),
  vehicleTypes: z.object({
    tractor: z.array(z.string()),
    firstTrailer: z.array(z.string()),
    secondTrailer: z.array(z.string()).optional(),
    dolly: z.array(z.string()).optional(),
  }),
  iconPath: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type VehicleSetType = z.infer<typeof vehicleSetTypeSchema>;

// Tipos padrão do sistema (cache estático)
let _defaultTypesCache: VehicleSetType[] | null = null;

function getDefaultVehicleSetTypes(): VehicleSetType[] {
  if (_defaultTypesCache) {
    return _defaultTypesCache;
  }
  
  _defaultTypesCache = [
  {
    id: "bitrain_6_axles",
    name: "bitrain_6_axles",
    label: "Bitrem 6 eixos",
    description: "Composição bitrem com 6 eixos totais",
    axleConfiguration: {
      tractorAxles: 2,
      firstTrailerAxles: 2,
      secondTrailerAxles: 2,
      totalAxles: 6,
      requiresDolly: false,
      isFlexible: false,
    },
    dimensionLimits: {
      minLength: 19.8,
      maxLength: 30.0,
      maxWidth: 2.6,
      maxHeight: 4.4,
    },
    vehicleTypes: {
      tractor: ["tractor_unit"],
      firstTrailer: ["semi_trailer"],
      secondTrailer: ["semi_trailer"],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "bitrain_7_axles",
    name: "bitrain_7_axles",
    label: "Bitrem 7 eixos",
    description: "Composição bitrem com 7 eixos totais",
    axleConfiguration: {
      tractorAxles: 3,
      firstTrailerAxles: 2,
      secondTrailerAxles: 2,
      totalAxles: 7,
      requiresDolly: false,
      isFlexible: false,
    },
    dimensionLimits: {
      minLength: 19.8,
      maxLength: 30.0,
      maxWidth: 2.6,
      maxHeight: 4.4,
    },
    vehicleTypes: {
      tractor: ["tractor_unit"],
      firstTrailer: ["semi_trailer"],
      secondTrailer: ["semi_trailer"],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "bitrain_9_axles",
    name: "bitrain_9_axles",
    label: "Bitrem 9 eixos",
    description: "Composição bitrem com 9 eixos totais",
    axleConfiguration: {
      tractorAxles: 3,
      firstTrailerAxles: 3,
      secondTrailerAxles: 3,
      totalAxles: 9,
      requiresDolly: false,
      isFlexible: false,
    },
    dimensionLimits: {
      minLength: 19.8,
      maxLength: 30.0,
      maxWidth: 2.6,
      maxHeight: 4.4,
    },
    vehicleTypes: {
      tractor: ["tractor_unit"],
      firstTrailer: ["semi_trailer"],
      secondTrailer: ["semi_trailer"],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "roadtrain_9_axles",
    name: "roadtrain_9_axles",
    label: "Rodotrem 9 eixos",
    description: "Composição rodotrem com 9 eixos totais",
    axleConfiguration: {
      tractorAxles: 3,
      firstTrailerAxles: 2,
      secondTrailerAxles: 2,
      dollyAxles: 2,
      totalAxles: 9,
      requiresDolly: true,
      isFlexible: false,
    },
    dimensionLimits: {
      minLength: 19.8,
      maxLength: 30.0,
      maxWidth: 2.6,
      maxHeight: 4.4,
    },
    vehicleTypes: {
      tractor: ["tractor_unit"],
      firstTrailer: ["semi_trailer"],
      secondTrailer: ["semi_trailer"],
      dolly: ["dolly"],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "flatbed",
    name: "flatbed",
    label: "Prancha",
    description: "Composição flexível para pranchas",
    axleConfiguration: {
      tractorAxles: 0,
      firstTrailerAxles: 0,
      secondTrailerAxles: 0,
      totalAxles: 0,
      requiresDolly: false,
      isFlexible: true,
    },
    dimensionLimits: {
      maxWidth: 3.2,
      maxHeight: 4.95,
    },
    vehicleTypes: {
      tractor: ["tractor_unit"],
      firstTrailer: ["flatbed", "semi_trailer"],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "romeo_and_juliet",
    name: "romeo_and_juliet",
    label: "Romeu e Julieta",
    description: "Composição flexível para romeu e julieta",
    axleConfiguration: {
      tractorAxles: 0,
      firstTrailerAxles: 0,
      secondTrailerAxles: 0,
      totalAxles: 0,
      requiresDolly: false,
      isFlexible: true,
    },
    dimensionLimits: {
      minLength: 19.8,
      maxLength: 30.0,
      maxWidth: 2.6,
      maxHeight: 4.4,
    },
    vehicleTypes: {
      tractor: ["tractor_unit"],
      firstTrailer: ["semi_trailer"],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "crane",
    name: "crane",
    label: "Guindastes",
    description: "Conjunto para guindastes sem restrições de comprimento e sem tipo de carga",
    axleConfiguration: {
      tractorAxles: 0,
      firstTrailerAxles: 0,
      secondTrailerAxles: 0,
      totalAxles: 0,
      requiresDolly: false,
      isFlexible: true, // Ignora validação de eixos
    },
    dimensionLimits: {
      // Sem limite de comprimento para guindastes
      maxWidth: 3.2,
      maxHeight: 4.95,
    },
    vehicleTypes: {
      tractor: ["crane"], // Apenas veículos tipo guindaste
      firstTrailer: [], // Guindastes não usam trailers
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  ];
  
  return _defaultTypesCache;
}

export const DEFAULT_VEHICLE_SET_TYPES = getDefaultVehicleSetTypes();