import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {Repository} from "aws-cdk-lib/aws-ecr";
import {DockerImageAsset} from "aws-cdk-lib/aws-ecr-assets";

export class EcrStack extends Stack {

  public readonly repository: Repository;
  public readonly imageOnline: DockerImageAsset;
  public readonly imageBatch: DockerImageAsset;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const argContext = 'environment';
    const envKey = this.node.tryGetContext(argContext);
    if (envKey == undefined)
      throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=stg`);
    const context = this.node.tryGetContext(envKey);
    if (context == undefined) throw new Error('Invalid environment.');

    // ECRリポジトリを作成
    this.repository = new ecr.Repository(this, `${context.AWSENV}-to2go-app-ecr-repository`, {
      repositoryName: `${context.AWSENV}-to2go-app-ecr-repository`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタックを削除するときにリポジトリも削除
      emptyOnDelete: true // リポジトリを削除するときにリポジトリ内のイメージも削除
    })
  }
}
