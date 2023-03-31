import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from 'aws-sdk'


const productDdb =  process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbClient, productDdb)

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {

  const lambdaRequestId = context.awsRequestId

  const apiRequestId = event.requestContext.requestId


  console.log(`API Gateway RequestID: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)


  const method = event.httpMethod

  if(event.resource === "/products"){
    if(method === 'GET'){
      console.log('GET /products')

      const products = await  productRepository.getAllProducts()

      return {
        statusCode: 200,
        body: JSON.stringify(products)
      }
    }
  } else if(event.resource === '/products/{id}') {
    const productId = event.pathParameters!.id as string
    console.log(`GET /products/${productId}`)

    try {
      const product = await productRepository.getProductsById(productId)
      return  {
        statusCode: 200,
        body: JSON.stringify(product),
      }
    }catch (error) {
      console.error((<Error>error).message)
      return {
        statusCode: 404,
        body:(<Error>error).message
      }
    }

  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      msg: 'Erro na requisição - Bad Request '
    })
  }
}
