// warehousing.ts
// Auto-generated from contracts/warehousing.md
// Do not edit manually

export interface Warehousebin {
  id: string;
  warehouseId: string;
  zone: unknown;
  shelf: unknown;
  position: unknown;
  status: unknown;
}

export interface Binstock {
  binId: string;
  variantId: string;
  quantity: unknown;
}

export interface Picklist {
  id: string;
  orderId: string;
  status: unknown;
  items: unknown;
  createdAt: Timestamp;
}

export interface Picklistitem {
  variantId: string;
  quantity: unknown;
  binId: string;
  status: unknown;
}

export type Binstatus = BinStatus = active | suspended;

export type Pickliststatus = PickListStatus = pending | picking | packed | cancelled;

export type Pickitemstatus = PickItemStatus = pending | picked | omitted;

export interface WarehousingContract {
  registerBin(warehouseId: unknown, zone: unknown, shelf: unknown, position: unknown): Promise<WarehouseBin>;
  assignStockToBin(variantId: unknown, binId: unknown, quantity: unknown): Promise<void>;
  createPickList(orderId: unknown): Promise<PickList>;
  confirmPick(pickListId: unknown, pickerId: unknown): Promise<void>;
  moveStock(sourceBinId: unknown, destBinId: unknown, quantity: unknown): Promise<void>;
}
