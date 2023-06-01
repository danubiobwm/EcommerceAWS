#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack';
import { EventsDbdStack } from '../lib/eventsDbd-stack'
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';
import { InvoiceWSApiStack } from '../lib/invoiceWSApi-stack'
import { InvoicesAppLayerStack } from '../lib/invoicesAppLayers-stack'

const app = new cdk.App();

const env: cdk.Environment = {
  account: "856247121966",
  region: "us-east-1",
}

const tags = {
  cost: "ECommerce",
  team: "SiecolaCode"
}

const productsAppLayerStack = new ProductsAppLayersStack(app, "ProductsAppLayer", {
  tags: tags,
  env: env
})

const eventsDbdStack = new EventsDbdStack(app, "EventsDbd", {
  tags: tags,
  env: env
})

const productsAppStack = new ProductsAppStack(app, "ProductsAppStack", {
  eventsDdb: eventsDbdStack.table,
  tags: tags,
  env: env
})

productsAppStack.addDependency(productsAppLayerStack)
productsAppStack.addDependency(eventsDbdStack)

const ordersAppLayersStack = new OrdersAppLayersStack(app, "OrdersAppLayers", {
  tags: tags,
  env: env
})

const ordersAppStack = new OrdersAppStack(app, "OrdersApp", {
  tags: tags,
  env: env,
  productsDdb: productsAppStack.productsDdb,
  eventsDdb: eventsDbdStack.table
})

ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayersStack)
ordersAppStack.addDependency(eventsDbdStack)


const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApi", {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
  orderEventsFetchHandler: ordersAppStack.orderEventsFetchHandler,
  tags: tags,
  env: env
})
eCommerceApiStack.addDependency(productsAppStack)
eCommerceApiStack.addDependency(ordersAppStack)

const invoicesAppLayersStack = new InvoicesAppLayerStack(app, "InvoicesAppLayer", {
  tags: {
    const: "InvoiceApp",
    team: "SiecolaCode"
  },
  env: env
})

const invoiceWSApiStack = new InvoiceWSApiStack(app, "InvoiceApi", {
  eventsDdb: eventsDbdStack.table,
  tags: {
    const: "InvoiceApp",
    team: "SiecolaCode"
  },
  env: env
})

invoiceWSApiStack.addDependency(invoicesAppLayersStack)
invoiceWSApiStack.addDependency(eventsDbdStack)