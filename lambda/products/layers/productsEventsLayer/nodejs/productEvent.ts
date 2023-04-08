export enum ProductEventType {
  CREATE = "PRODUCT_CREATE",
  UPDATE = "PRODUCT_UPDATE",
  DELETED = "PRODUCT_DELETED",
}

export interface ProductEvent {
  requestId: string;
  eventType: ProductEventType;
  productId: string;
  productCode: string;
  productPrice: Number;
  email: string;
}