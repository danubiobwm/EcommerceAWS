import * as cdk from 'aws-cdk-lib'
import * as apigatewayv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apigatewayv2_integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha"
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import *  as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

export class InvoiceWSApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    //Invoice Transaction Layer
    const invoiceTransactionLayerArn = ssm.StringParameter
      .valueForStringParameter(this, "InvoiceTransactionLayerVersionArn")
    const invoiceTransactionLayer = lambda.LayerVersion
      .fromLayerVersionArn(this, "InvoiceTransactionLayerVersionArn", invoiceTransactionLayerArn)

    //Invoice Layer
    const invoiceLayerArn = ssm.StringParameter
    .valueForStringParameter(this, "InvoiceRepositoryLayerVersionArn")
    const invoiceLayer = lambda.LayerVersion
    .fromLayerVersionArn(this, "InvoiceRepositoryLayer", invoiceLayerArn)

    //Invoice WebSocket API
    const invoiceWSConnectionLayerArn = ssm.StringParameter
    .valueForStringParameter(this, "InvoiceWSConnectionLayerVersionArn")
    const invoiceWSConnectionLayer = lambda.LayerVersion
    .fromLayerVersionArn(this, "InvoiceWSConnectionLayer", invoiceWSConnectionLayerArn)


    //Invoice an invoice transaction DDB
    const invoicesDdb = new dynamodb.Table(this, "InvoiceDdb", {
      tableName: 'invoices',
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    //Invoice bucket
    const bucket = new s3.Bucket(this, "InvoiceBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(1)
        }
      ]
    })

    //WebSocket connection handler

    const connectionHandler = new lambdaNodeJs.NodejsFunction(this, "InvoiceConnectionFunction", {
      functionName: "InvoiceConnectionFunction",
      entry: "lambda/invoices/invoiceConnectionFunction.ts",
      handler: "handler",
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      tracing: lambda.Tracing.ACTIVE,
    })

    //WebSocket disconnection handler

    const disconnectionHandler = new lambdaNodeJs.NodejsFunction(this, "InvoiceDisconnectionFunction", {
      functionName: "InvoiceDisconnectionFunction",
      entry: "lambda/invoices/invoiceDisconnectionFunction.ts",
      handler: "handler",
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      tracing: lambda.Tracing.ACTIVE,
    })

    //WebSocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, "InvoiceWSApi", {
      apiName: "InvoiceWSApi",
      connectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration("ConnectionHandler", connectionHandler)
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration("DisconnectionHandler", disconnectionHandler)
      }

    })


    const stage = "prod"
    const wsApiEndPoint = `${webSocketApi.apiEndpoint}/${stage}`

    new apigatewayv2.WebSocketStage(this, "InvoiceWSApiStage", {
      webSocketApi: webSocketApi,
      stageName: "stage",
      autoDeploy: true
    })

    //Invoice URL handler

    const getUrlHandler = new lambdaNodeJs.NodejsFunction(this, "InvoiceGetUrlFunction", {
      functionName: "InvoiceGetUrlFunction",
      entry: "lambda/invoices/invoiceGetUrlFunction.ts",
      handler: "handler",
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      layers:[invoiceTransactionLayer, invoiceWSConnectionLayer],
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        INVOICE_DDB: invoicesDdb.tableName,
        BUCKET_NAME: bucket.bucketName,
        INVOICE_WSAPI_ENDPOINT: wsApiEndPoint
      }
    })

    const invoicesDdbWriteTransactionPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [invoicesDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb: LeadingKeys': ['#transaction']
        }
      }
    })

    getUrlHandler.addToRolePolicy(invoicesDdbWriteTransactionPolicy)
    const invoicesBucketPutObjectPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [`${bucket.bucketArn}/*`]
    })

    getUrlHandler.addToRolePolicy(invoicesDdbWriteTransactionPolicy)
    getUrlHandler.addToRolePolicy(invoicesBucketPutObjectPolicy)
    webSocketApi.grantManageConnections(getUrlHandler)

    //Invoice Import handler
    const invoiceImportHandler = new lambdaNodeJs.NodejsFunction(this, "InvoiceImportHandler", {
      functionName: "InvoiceImportHandler",
      entry: "lambda/invoices/invoiceImportHandler.ts",
      handler: "handler",
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      tracing: lambda.Tracing.ACTIVE,
      layers:[invoiceLayer, invoiceTransactionLayer, invoiceWSConnectionLayer],
      environment: {
        INVOICE_DDB: invoicesDdb.tableName,
        INVOICE_WSAPI_ENDPOINT: wsApiEndPoint
      }
    })
    invoicesDdb.grantReadWriteData(invoiceImportHandler)
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(invoiceImportHandler))

    const invoicesBucketGetDeleteObjectPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:DeleteObject', 's3n:GetObject'],
      resources: [`${bucket.bucketArn}/*`]
    })

    invoiceImportHandler.addToRolePolicy(invoicesBucketGetDeleteObjectPolicy)
    webSocketApi.grantManageConnections(invoiceImportHandler)

    //Cancel import handler
    const cancelImportHandler = new lambdaNodeJs.NodejsFunction(this, "CancelImportHandler", {
      functionName: "CancelImportHandler",
      entry: "lambda/invoices/cancelImportHandler.ts",
      handler: "handler",
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      layers:[invoiceTransactionLayer, invoiceWSConnectionLayer],
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        INVOICE_DDB: invoicesDdb.tableName,
        INVOICE_WSAPI_ENDPOINT: wsApiEndPoint
      }
    })

    const invoicesDdbReadWriteTransactionPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:UpdateItem', 'dynamodb:GetItem'],
      resources: [invoicesDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb: LeadingKeys': ['#transaction']
        }
      }
    })
    cancelImportHandler.addToRolePolicy(invoicesDdbReadWriteTransactionPolicy)
    webSocketApi.grantManageConnections(cancelImportHandler)

    //WebSocket Api routes
    webSocketApi.addRoute('getImportUrl', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration("getUrlHandler", getUrlHandler)
    })

    webSocketApi.addRoute('cancelImport', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration("cancelImportHandler", cancelImportHandler)
    })

  }
}