import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'


export class ProductsAppStack extends cdk.Stack{
  readonly productsFetchHandler: lambdaNodeJS.NodejsFunction
  readonly productsAdminHandler: lambdaNodeJS.NodejsFunction
  readonly productsDbd: dynamodb.Table

  constructor(scope: Construct, id:string, props?: cdk.StackProps){
    super(scope, id, props)

    this.productsDbd = new dynamodb.Table(this, "ProductsDbd", {
     tableName: "Products",
     removalPolicy: cdk.RemovalPolicy.DESTROY,
     partitionKey:{
      name: "id",
      type: dynamodb.AttributeType.STRING,
     },
     billingMode: dynamodb.BillingMode.PROVISIONED,
     readCapacity: 1,
     writeCapacity:1
    })

    this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(this, "ProductsFetchFunction", {
      functionName: 'ProductsFetchFunction',
      entry: 'lambda/products/ProductsFetchFunction.ts',
      handler: 'handler',
      memorySize:  128,
      timeout: cdk.Duration.seconds(5),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment:{
        PRODUCTS_DDB: this.productsDbd.tableName
      }
    })
    this.productsDbd.grantReadData(this.productsFetchHandler)

    this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(this, "ProductsAdminFunction", {
      functionName: 'ProductsAdminFunction',
      entry: 'lambda/products/ProductsAdminFunction.ts',
      handler: 'handler',
      memorySize:  128,
      timeout: cdk.Duration.seconds(5),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment:{
        PRODUCTS_DDB: this.productsDbd.tableName
      }
    })

    this.productsDbd.grantWriteData(this.productsAdminHandler)


  }
}