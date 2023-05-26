import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  S3Event,
  S3EventRecord,
} from "aws-lambda";
import * as AWSRay from "aws-xray-sdk";
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk";
import { InvoiceTransactionStatus, InvoiceTransactionRepository } from '/opt/nodejs/invoiceTransaction';
import { InvoiceWSService } from '/opt/nodejs/invoiceWSConnection';
import { InvoiceFile, InvoiceRepository } from "/opt/nodejs/invoiceRepository";

const AWS = AWSRay.captureAWS(require("aws-sdk"));

const invoicesDdb = process.env.INVOICES_DDB!
const invoicesWsApiEndpoint = process.env.INVOICES_WSAPI_ENDPOINT!.substring(6)



const s3Client = new S3()
const ddbClient = new DynamoDB.DocumentClient()
const apigwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoicesWsApiEndpoint
})

const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoicesDdb);
const invoiceWsService = new InvoiceWSService(apigwManagementApi);
const invoicesRepository = new InvoiceRepository(ddbClient, invoicesDdb);




export async function handler(event: S3Event, context: Context): Promise<void> {

  const promises: Promise<void>[] = [];

  //TODO: to be removed
  console.log(event);

  event.Records.forEach((record) => {
    promises.push(processRecord(record))
  });

  await Promise.all(promises);

  return

}

async function processRecord(record: S3EventRecord) {

  const key = record.s3.object.key;

  try {

    const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(key);

    if (invoiceTransaction.transactionStatus === InvoiceTransactionStatus.GENERATED) {
      await Promise.all([
        invoiceWsService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.RECEIVED),
        invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.RECEIVED)
      ])

      console.error(`Non valid transaction status`)

    } else {
      await invoiceWsService.sendInvoiceStatus(key, invoiceTransaction.connectionId, invoiceTransaction.transactionStatus)
      console.error(`Non valid transaction status`)
      return
    }

    const object = await s3Client.getObject({
      Key: key,
      Bucket: record.s3.bucket.name
    }).promise()

    const invoice = JSON.parse(object.Body!.toString('utf-8')) as InvoiceFile

    console.log(invoice)

    const createInvoicePromise = invoicesRepository.create({
      pk: `#invoice#${invoice.customerName}`,
      sk: invoice.invoiceNumber,
      ttl: 0,
      totalValue: invoice.totalValue,
      productId: invoice.productId,
      quantity: invoice.quantity,
      transactionId: key,
      createdAt: Date.now(),
    })

    const deleteObjectPromise = s3Client.deleteObject({
      Key: key,
      Bucket: record.s3.bucket.name
    }).promise()

    const updateInvoicePromise = await invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.PROCESSED)

    const sendStatusPromise = await invoiceWsService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.PROCESSED)

    await Promise.all([createInvoicePromise, deleteObjectPromise, updateInvoicePromise, sendStatusPromise])

  } catch (error) {
    console.error((<Error>error).message)
  }

}

