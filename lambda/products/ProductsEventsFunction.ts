import { Callback, Context } from "aws-lambda";
import { DynamoDB } from 'aws-sdk'
import { ProductEvent } from "/opt/nodejs/productEventsLayer";
import * as AWSRay from 'aws-xray-sdk'

AWSRay.captureAWS(require('aws-sdk'))

const eventsDdb = process.env.EVENTS_DDB!
const ddbClient = new DynamoDB.DocumentClient();

export async function handle(event: ProductEvent, context: Context, callback: Callback): Promise<void> {

  console.log(event);

  console.log(`Lambda requestId: ${context.awsRequestId}`);

  await createEvent(event)

  callback(null, JSON.stringify({
    productEventCreated: true,
    message: 'OK'
  }))
}

function createEvent(event: ProductEvent) {
  const timestamp = Date.now();
  const ttl = ~~(timestamp / 1000) + 5 * 60

  return ddbClient.put({
    TableName: eventsDdb,
    Item:{
      pk: `#product_${event.productCode}`,
      sk: `${event.eventType}`,
      email: event.email,
      createEvent: timestamp,
      requestId: event.requestId,
      eventType: event.eventType,
      info: {
        productId: event.productId,
        price: event.productPrice
      },
      ttl: ttl
    },
  }).promise()
}
