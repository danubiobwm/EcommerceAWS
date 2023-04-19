import * as cdk from "aws-cdk-lib"
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import { Construct } from "constructs"

interface ECommerceApiStackProps extends cdk.StackProps {
   productsFetchHandler: lambdaNodeJS.NodejsFunction;
   productsAdminHandler: lambdaNodeJS.NodejsFunction;
   ordersHandler: lambdaNodeJS.NodejsFunction;
}

export class ECommerceApiStack extends cdk.Stack {

   constructor(scope: Construct, id: string, props: ECommerceApiStackProps) {
      super(scope, id, props)

      const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs")
      const api = new apigateway.RestApi(this, "ECommerceApi", {
         restApiName: "ECommerceApi",
         deployOptions: {
            accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
            accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
               httpMethod: true,
               ip: true,
               protocol: true,
               requestTime: true,
               resourcePath: true,
               responseLength: true,
               status: true,
               caller: true,
               user: true
            })
         }
      })

      this.createProductsService(props, api)

      this.createOrdersService(props, api)
   }

   private createOrdersService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
      const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

      //resource - /orders
      const ordersResource = api.root.addResource('orders')

      //GET /orders
      //GET /orders?email=matilde@siecola.com.br
      //GET /orders?email=matilde@siecola.com.br&orderId=123
      ordersResource.addMethod("GET", ordersIntegration)

      const orderDeletionValidator = new apigateway.RequestValidator(this, "OrderDeletionValidator", {
         restApi: api,
         requestValidatorName: "OrderDeletionValidator",
         validateRequestParameters: true,
      })

      //DELETE /orders?email=matilde@siecola.com.br&orderId=123
      ordersResource.addMethod("DELETE", ordersIntegration, {
         requestParameters: {
            'method.request.querystring.email': true,
            'method.request.querystring.orderId': true
         },
         requestValidator: orderDeletionValidator
      })

      //POST /orders
      const orderRequestValidator = new apigateway.RequestValidator(this, "OrderRequestValidator", {
         restApi: api,
         requestValidatorName: "Order request validator",
         validateRequestBody: true
      })

      const orderModel = new apigateway.Model(this, "OrderModel", {
         modelName: "OrderModel",
         restApi: api,
         schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
               email: {
                  type: apigateway.JsonSchemaType.STRING
               },
               productIds: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  minItems: 1,
                  items: {
                     type: apigateway.JsonSchemaType.STRING
                  }
               },
               payment: {
                  type: apigateway.JsonSchemaType.STRING,
                  enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD"]
               }
            },
            required: [
               "email",
               "productIds",
               "payment"
            ]
         }
      })
      ordersResource.addMethod("POST", ordersIntegration, {
         requestValidator: orderRequestValidator,
         requestModels: {
            "application/json": orderModel
         }
      })
   }

   private createProductsService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
      const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

      // "/products"
      const productsResource = api.root.addResource("products")
      productsResource.addMethod("GET", productsFetchIntegration)

      // GET /products/{id}
      const productIdResource = productsResource.addResource("{id}")
      productIdResource.addMethod("GET", productsFetchIntegration)

      const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

      // POST /products
      productsResource.addMethod("POST", productsAdminIntegration)

      // PUT /products/{id}
      productIdResource.addMethod("PUT", productsAdminIntegration)

      // DELETE /products/{id}
      productIdResource.addMethod("DELETE", productsAdminIntegration)
   }
}
