import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cwlogs from 'aws-cdk-lib/aws-logs'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'


interface ECommerceApiStackProps extends cdk.StackProps{
  productsFetchHandler: lambdaNodeJS.NodejsFunction
  productsAdminHandler: lambdaNodeJS.NodejsFunction
  ordersHandler: lambdaNodeJS.NodejsFunction
}


export class ECommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string,  props: ECommerceApiStackProps ) {
    super(scope, id, props)

    const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs")

    const api = new apigateway.RestApi(this, "ECommerceApi",

      {
        restApiName: "ECommerceApi",
        cloudWatchRole: true,
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

  private createOrdersService(props: ECommerceApiStackProps, api: apigateway.RestApi){
    const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

    // RESOURCE "/orders"

    // get "/orders"
    // get "/orders?email=admin@gmail.com"
    // get "/orders?email=admin@gmail.com&orderId=123"
    const ordersResource = api.root.addResource("orders")
    ordersResource.addMethod("GET", ordersIntegration)

    // post "/orders?email=admin@gmail.com&orderId=123"
    ordersResource.addMethod("POST", ordersIntegration)

    // delete "/orders?email=admin@gmail.com&orderId=123"
    const orderDeletionValidator = new apigateway.RequestValidator(this, "OrderDeletionValidator", {
      restApi: api,
      requestValidatorName: "OrderDeletionValidator",
      validateRequestParameters: true

    })
    ordersResource.addMethod("DELETE", ordersIntegration,{
      requestParameters:{
        'method.request.querystring.email': true,
        'method.request.querystring.orderId': true,
      },
      requestValidator: orderDeletionValidator
    })
  }

  private createProductsService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
    const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

    // GET "/products"
    const productsResource = api.root.addResource("products")
    productsResource.addMethod("GET", productsFetchIntegration)

    // GET "/products/{id}"
    const productsIdResource = productsResource.addResource("{id}")
    productsIdResource.addMethod("GET", productsFetchIntegration)

    //
    const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

    //POST /products
    productsResource.addMethod("POST", productsAdminIntegration)

    //PUT /products/{id}
    productsIdResource.addMethod("PUT", productsAdminIntegration)
    //DELETE /products/{id}
    productsIdResource.addMethod("DELETE", productsAdminIntegration)
  }
}

