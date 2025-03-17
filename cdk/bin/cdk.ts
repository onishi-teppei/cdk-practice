#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
// import { CdkStack } from '../lib/cdk-stack';
import {VpcStack} from '../lib/vpc-stack';
import {EcrStack} from "../lib/ecr-stack";

const app = new cdk.App();

const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
    if (envKey == undefined)
      throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=stg`);
const envVals = app.node.tryGetContext(envKey);
    if (envVals == undefined) throw new Error('Invalid environment.');

// 環境変数を設定
const env = { account: envVals['env']['account'], region: envVals['env']['region'] };

// VPC Stackを作成
const vpcStack = new VpcStack(app, 'VpcStack', {
  env,
})

const ecrStack = new EcrStack(app, 'EcrStack', {
  env,
})

// new CdkStack(app, 'CdkStack', {
//   /* If you don't specify 'env', this stack will be environment-agnostic.
//    * Account/Region-dependent features and context lookups will not work,
//    * but a single synthesized template can be deployed anywhere. */

//   /* Uncomment the next line to specialize this stack for the AWS Account
//    * and Region that are implied by the current CLI configuration. */
//   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

//   /* Uncomment the next line if you know exactly what Account and Region you
//    * want to deploy the stack to. */
//   // env: { account: '123456789012', region: 'us-east-1' },

//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });