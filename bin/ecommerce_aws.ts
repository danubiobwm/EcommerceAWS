#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsAppLayerStack } from '../lib/productsAppLayers-stack';
import { EventDbdStack } from '../lib/eventsDbd-stack';
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack'
import { OrdersAppStack } from '../lib/ordersApp-stack'

const app = new cdk.App();

const env: cdk.Environment ={
  account: "856247121966",
  region: "us-east-1",
}

const tags ={
  cost: "ECommerce",
  team: "SiecolaCode",
}


const productsAppLayerStack= new ProductsAppLayerStack(app, "ProductsAppLayer",{
  tags: tags,
  env: env
})

const eventsDbdStack = new EventDbdStack(app, "EventsDbd",{
  tags: tags,
  env: env,
})

const productsAppStack = new ProductsAppStack(app, "ProductsAppStack", {
  eventsDbd: eventsDbdStack.table,
  tags: tags,
  env: env,
});

productsAppStack.addDependency(productsAppLayerStack);
productsAppStack.addDependency(eventsDbdStack);

const ordersAppLayersStack = new OrdersAppLayersStack(app, "OrdersAppLayers",{
  tags: tags,
  env: env,
})

const ordersAppStack = new OrdersAppStack(app, "OrdersApp", {
  tags: tags,
  env: env,
  productsDbd: productsAppStack.productsDbd
})
ordersAppStack.addDependency(productsAppStack);
ordersAppStack.addDependency(ordersAppLayersStack);

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApiStack", {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
  tags: tags,
  env: env
 })

 eCommerceApiStack.addDependency(productsAppStack);