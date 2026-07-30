// Section 6 - Veri Modeli

export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export enum StockStatus {
  Available = 'available',
  Reserved = 'reserved',
  Quarantine = 'quarantine',
  Damaged = 'damaged',
  Blocked = 'blocked',
}

export interface Warehouse extends BaseEntity {
  code: string;
  name: string;
  timezone: string;
  operatingHours: { open: string; close: string };
  isActive: boolean;
}

export type LocationClass = 'ambient' | 'chilled' | 'frozen' | 'hazmat';
export type LocationStatus = 'active' | 'blocked' | 'full' | 'inactive';

export interface Location extends BaseEntity {
  warehouseId: ID;
  parentId: ID | null;
  path: string; // hierarchical path e.g. A/12/03
  type: 'zone' | 'aisle' | 'rack' | 'bin' | 'staging';
  locationClass: LocationClass;
  status: LocationStatus;
  capacity: {
    maxWeightKg: number;
    maxVolumeM3: number;
    usedWeightKg: number;
    usedVolumeM3: number;
  };
  temperatureRangeC?: { min: number; max: number };
}

export interface SKU extends BaseEntity {
  code: string;
  name: string;
  uom: string;
  weightKg: number;
  volumeM3: number;
  lotTracked: boolean;
  serialTracked: boolean;
  storageClass: LocationClass;
  shelfLifeDays?: number;
}

export interface InventoryBalance extends BaseEntity {
  skuId: ID;
  lot?: string;
  serial?: string;
  locationId: ID;
  warehouseId: ID;
  quantity: number;
  status: StockStatus;
  expiryDate?: string;
}

export interface StockMovement extends BaseEntity {
  skuId: ID;
  lot?: string;
  serial?: string;
  quantity: number;
  fromLocationId?: ID;
  toLocationId?: ID;
  reasonCode: string;
  referenceType: 'receipt' | 'putaway' | 'pick' | 'adjustment' | 'cycle-count' | 'shipment';
  referenceId: ID;
  performedBy: ID;
}

export type ASNStatus = 'expected' | 'arrived' | 'receiving' | 'closed' | 'cancelled';

export interface ASN extends BaseEntity {
  number: string;
  supplierName: string;
  warehouseId: ID;
  expectedDate: string;
  status: ASNStatus;
}

export type ReceiptLineStatus = 'pending' | 'matched' | 'short' | 'over' | 'damaged' | 'quarantined';

export interface ReceiptLine extends BaseEntity {
  asnId: ID;
  skuId: ID;
  lot?: string;
  expectedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  status: ReceiptLineStatus;
}

export interface PutawaySuggestion extends BaseEntity {
  receiptLineId: ID;
  suggestedLocationId: ID;
  score: number;
  reasons: string[];
  accepted: boolean;
}

export type SalesOrderStatus = 'new' | 'allocated' | 'waved' | 'picking' | 'packed' | 'shipped' | 'cancelled';

export interface SalesOrder extends BaseEntity {
  number: string;
  warehouseId: ID;
  priority: number;
  carrier: string;
  cutOffTime: string;
  route: string;
  status: SalesOrderStatus;
}

export interface Allocation extends BaseEntity {
  salesOrderId: ID;
  skuId: ID;
  lot?: string;
  locationId: ID;
  quantity: number;
  isPartial: boolean;
  isBackorder: boolean;
  overrideReason?: string;
}

export type WaveStatus = 'draft' | 'planned' | 'released' | 'completed' | 'cancelled';

export interface Wave extends BaseEntity {
  name: string;
  warehouseId: ID;
  rule: { zone?: string; carrier?: string; cutOffTime?: string; minPriority?: number };
  salesOrderIds: ID[];
  capacityUsedPct: number;
  status: WaveStatus;
}

export type PickTaskType = 'single' | 'batch' | 'zone';
export type PickTaskStatus = 'pending' | 'in-progress' | 'exception' | 'completed';

export interface PickTask extends BaseEntity {
  waveId: ID;
  type: PickTaskType;
  assignedTo?: ID;
  route: ID[]; // ordered location ids
  lines: { skuId: ID; locationId: ID; quantity: number; pickedQuantity: number }[];
  status: PickTaskStatus;
}

export type PackageStatus = 'open' | 'sealed' | 'weight-hold' | 'shipped';

export interface Package extends BaseEntity {
  salesOrderId: ID;
  contents: { skuId: ID; quantity: number }[];
  weightKg: number;
  weightToleranceOk: boolean;
  labelSimulated: boolean;
  status: PackageStatus;
}

export type ShipmentStatus = 'staged' | 'loading' | 'in-transit' | 'delivered' | 'exception';

export interface Shipment extends BaseEntity {
  packageIds: ID[];
  carrier: string;
  door: string;
  loadedAt?: string;
  closedAt?: string;
  status: ShipmentStatus;
}

export type CycleCountStatus = 'scheduled' | 'in-progress' | 'variance-review' | 'closed';

export interface CycleCount extends BaseEntity {
  warehouseId: ID;
  scope: { locationIds: ID[] } | { skuIds: ID[] };
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  status: CycleCountStatus;
}

export type ExceptionType =
  | 'wrong-barcode'
  | 'short-pick'
  | 'damage'
  | 'capacity-overflow'
  | 'manual-override'
  | 'shipment-mismatch';
export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ExceptionStatus = 'open' | 'investigating' | 'resolved';

export interface WarehouseException extends BaseEntity {
  type: ExceptionType;
  severity: ExceptionSeverity;
  ownerId?: ID;
  referenceType: string;
  referenceId: ID;
  status: ExceptionStatus;
  resolutionNote?: string;
}

export interface AuditEvent extends BaseEntity {
  actorId: ID;
  actionType: string;
  targetType: string;
  targetId: ID;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: string;
}
