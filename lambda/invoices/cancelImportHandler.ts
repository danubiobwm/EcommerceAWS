import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { InvoiceTransactionStatus, InvoiceTransactionRepository } from '/opt/nodejs/invoiceTransaction';
import { InvoiceWSService } from '/opt/nodejs/invoiceWSConnection';
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk";
import * as AWSXRay from 'aws-xray-sdk';


AWSXRay.captureAWS(require("aws-sdk"))

const invoicesDdb = process.env.INVOICES_DDB!
const invoicesWsApiEndpoint = process.env.INVOICES_WSAPI_ENDPOINT!.substring(6)

const ddbClient = new DynamoDB.DocumentClient()
const apigwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoicesWsApiEndpoint
})


const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoicesDdb);
const invoiceWsService = new InvoiceWSService(apigwManagementApi);

export async function handle(event: APIGatewayProxyEvent, context: Context):
  Promise<APIGatewayProxyResult> {

  const transactionId = JSON.parse(event.body!).transactionId as string;
  const lambdaRequestId = context.awsRequestId;
  const connectionId = event.requestContext.connectionId!;

  console.log(`ConnectionId: ${connectionId} - LambdaRequestId: ${lambdaRequestId}`)

  try {
    const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(transactionId);

    if (invoiceTransaction.transactionStatus === InvoiceTransactionStatus.GENERATED) {
      await Promise.all([
        invoiceWsService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.CANCELLED),
        invoiceTransactionRepository.updateInvoiceTransaction(transactionId, InvoiceTransactionStatus.CANCELLED),
      ]);

    } else {
      await invoiceWsService.sendInvoiceStatus(transactionId, connectionId, invoiceTransaction.transactionStatus);
      console.error(`Can´t cancel an ongoing process`);
    }
  } catch (error) {
    console.error((<Error>error).message);
    console.error(`InvoiceTransaction not found: ${transactionId}`);
    await invoiceWsService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.NOT_FOUND);
  }


  return {
    statusCode: 200,
    body: 'ok'

  }
}