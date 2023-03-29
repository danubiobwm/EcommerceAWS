import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as ssm from "aws-cdk-lib/aws-ssm";

export class ProductsAppStack extends cdk.Stack {
  readonly productsFetchHandler: lambdaNodeJS.NodejsFunction;
  readonly productsAdminHandler: lambdaNodeJS.NodejsFunction;
  readonly productsDbd: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.productsDbd = new dynamodb.Table(this, "ProductsDbd", {
      tableName: "Products",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    });

    //Product Layer

    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, "ProductsLayersVersionArn");

    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsLayersVersionArn", productsLayerArn)

    this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(
      this,
      "ProductsFetchFunction",
      {
        functionName: "ProductsFetchFunction",
        entry: "lambda/products/ProductsFetchFunction.ts",
        handler: "handler",
        memorySize: 128,
        timeout: cdk.Duration.seconds(5),
        bundling: {
          minify: true,
          sourceMap: false,
        },
        environment: {
          PRODUCTS_DDB: this.productsDbd.tableName,
        },
        layers: [productsLayer]
      }
    );
    this.productsDbd.grantReadData(this.productsFetchHandler);

    this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(
      this,
      "ProductsAdminFunction",
      {
        functionName: "ProductsAdminFunction",
        entry: "lambda/products/ProductsAdminFunction.ts",
        handler: "handler",
        memorySize: 128,
        timeout: cdk.Duration.seconds(5),
        bundling: {
          minify: true,
          sourceMap: false,
        },
        environment: {
          PRODUCTS_DDB: this.productsDbd.tableName,
        },
        layers: [productsLayer]
      }
    );

    this.productsDbd.grantWriteData(this.productsAdminHandler);
  }
}
