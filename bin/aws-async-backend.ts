#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsAsyncBackendStack } from '../lib/aws-async-backend-stack';

const app = new cdk.App();
new AwsAsyncBackendStack(app, 'AwsAsyncBackendStack');
