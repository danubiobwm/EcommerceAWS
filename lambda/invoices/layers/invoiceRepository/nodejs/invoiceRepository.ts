import { DocumentClient } from "aws-sdk/clients/dynamodb";


export interface InvoiceFile{
  customerName: string;
  invoiceNumber: string;
  totalValue: number;
  productId: string;
  quantity: number;
}
export interface Invoice{
  pk: string;
  sk: string;
  totalValue: number;
  productId: string;
  quantity: number;
  transactionId: string;
  ttl: number;
  createdAt: number;
}


export class InvoiceRepository {
  private ddbClient: DocumentClient;
  private invoiceDdb: string;

  constructor(ddbClient: DocumentClient, invoiceDdb: string){
    this.ddbClient = ddbClient;
    this.invoiceDdb = invoiceDdb;
  }

  async create(invoice: Invoice): Promise<Invoice>{
    await this.ddbClient.put({
      TableName: this.invoiceDdb,
      Item: invoice
    }).promise()
    return invoice
  }

}