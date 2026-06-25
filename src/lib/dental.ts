// ============================================================================
// Dental domain helpers: FDI tooth numbering, shade guides, restoration meta.
// ============================================================================

import type { RestorationType, MaterialType } from './types/db';

// FDI two-digit notation. Top: 18..11 | 21..28; Bottom: 48..41 | 31..38.
export const FDI_TOP = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
];
export const FDI_BOTTOM = [
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
];

export const VITA_CLASSICAL = [
  'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D2', 'D3', 'D4',
];

export const VITA_3D_MASTER = [
  '0M1', '0M2', '0M3',
  '1M1', '1M2',
  '2L1.5', '2L2.5', '2M1', '2M2', '2M3', '2R1.5', '2R2.5',
  '3L1.5', '3L2.5', '3M1', '3M2', '3M3', '3R1.5', '3R2.5',
  '4L1.5', '4L2.5', '4M1', '4M2', '4M3', '4R1.5', '4R2.5',
  '5M1', '5M2', '5M3',
];

export const RESTORATION_TYPES: RestorationType[] = [
  'crown',
  'bridge',
  'veneer',
  'inlay_onlay',
  'denture_full',
  'denture_partial',
  'implant_crown',
  'implant_bridge',
  'night_guard',
  'other',
];

export const MATERIAL_TYPES: MaterialType[] = [
  'zirconia',
  'emax',
  'pfm',
  'full_metal',
  'pmma',
  'acrylic',
  'other',
];
