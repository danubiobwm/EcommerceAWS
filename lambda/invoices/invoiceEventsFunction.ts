import { Context, DynamoDBStreamEvent, AttributeValue } from "aws-lambda";
import { ApiGatewayManagementApi, DynamoDB } from "aws-sdk";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";
import * as AWSXRay from "aws-xray-sdk";

AWSXRay.captureAWS(require("aws-sdk"));

const eventsDdb = process.env.EVENTS_DDB!;
const invoicesWsApi = process.env.INVOICE_WSAPI_Endpoint!;

const ddbClient = new DynamoDB.DocumentClient();
const apiwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoicesWsApi,
});

const invoiceWSService = new InvoiceWSService(apiwManagementApi);

export async function handler(
  context: Context,
  event: DynamoDBStreamEvent
): Promise<void> {
  const promises: Promise<void>[] = [];

  event.Records.forEach((record) => {
    if (record.eventName === "INSERT") {
      if (record.dynamodb!.NewImage!.pk.S!.startsWith("#transaction")) {
        console.log("Invoice Transaction event Received");
      } else {
        console.log("Invoice event Received");
        promises.push(
          createEvent(record.dynamodb!.NewImage!, "INVOICE_CREATED")
        );
      }
    } else if (record.eventName === "MODIFY") {

    } else if (record.eventName === "REMOVE") {
      if (record.dynamodb!.OldImage!.pk.S === "#transaction") {
        console.log("Invoice Transaction event Received");
        promises.push(processExpiredTransaction(record.dynamodb!.OldImage!));
      }
    }
  });

  await Promise.all(promises);

  return;
}

async function createEvent(
  invoiceImage: { [key: string]: AttributeValue },
  eventType: string
): Promise<void> {
  const timestamp = new Date();
  const ttl = ~~(timestamp.getTime() / 1000 + 60 * 60);

  await ddbClient
    .put({
      TableName: eventsDdb,
      Item: {
        pk: `#invoice_${invoiceImage.pk.S}`,
        sk: `${eventType}#${timestamp}`,
        ttl: ttl,
        email: invoiceImage.pk.S!.split("_")[1],
        createdAt: timestamp,
        eventType: eventType,
        info: {
          transaction: invoiceImage.transactionId.S,
          productId: invoiceImage.productId.S,
          quantity: invoiceImage.quantity.N,
        },
      },
    })
    .promise();

  return;
}

async function processExpiredTransaction(
  invoiceTransactionImage: { [key: string]: AttributeValue }): Promise<void> {

  const transactionId = invoiceTransactionImage.sk.S!
  const connectionId = invoiceTransactionImage.connectionId.S!

  console.log(`transactionId ${transactionId} - ConnectionId ${connectionId}`)

  if(invoiceTransactionImage.transactionStatus.S === "INVOICE_PROCESSED"){
    console.log("Invoice Processed")
  }else{
    console.log(`Invoice Import failed - Status: ${invoiceTransactionImage.transactionStatus.S}`)
    await invoiceWSService.sendInvoiceStatus(transactionId, connectionId, "TIMEOUT")

    await invoiceWSService.disconnectClient(connectionId)
  }


}

