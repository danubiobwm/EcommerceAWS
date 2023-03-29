#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsAppLayerStack } from '../lib/productsAppLayers-stack';

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

const productsAppStack = new ProductsAppStack(app, "ProductsAppStack", {
  tags: tags,
  env: env
});

productsAppStack.addDependency(productsAppLayerStack);

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApiStack", {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  tags: tags,
  env: env
 })

 eCommerceApiStack.addDependency(productsAppStack);