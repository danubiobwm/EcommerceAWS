import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import * as AWSXRay from 'aws-xray-sdk';


AWSXRay.captureAWS(require("aws-sdk"))

export async function handle(event: APIGatewayProxyEvent, context:Context):
Promise<APIGatewayProxyResult> {
  console.log(event);
  return {
    statusCode: 200,
    body: 'ok'
  }
}